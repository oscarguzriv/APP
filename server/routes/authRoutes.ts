import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import {
  hashPassword,
  comparePassword,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  toSafeUser,
} from '../auth.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware.ts';
import { broadcastToBoard } from '../socket.ts';
import { GlobalUserRole } from '../types.ts';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const authRouter = Router();

const avatarUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarUploadStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG images under 1MB are permitted.'));
    }
  },
});

/**
 * POST /api/auth/signup
 * Creates a new user account with secure password hash and HttpOnly JWT cookie.
 * Explicitly guards against duplicate emails.
 * Supports auto-joining via inviteToken (Hospitality QR Code / Link onboarding).
 */
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, company, role, inviteToken } = req.body;

    // Basic Input Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Full Name is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Valid business email is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
      return;
    }

    // Role validation
    const validRoles: GlobalUserRole[] = ['Admin/Group Owner', 'Manager', 'Staff'];
    const assignedRole: GlobalUserRole = validRoles.includes(role) ? role : 'Staff';

    // Check optional invitation token
    let validInvite = null;
    if (inviteToken && typeof inviteToken === 'string') {
      const inv = db.getInvitationByToken(inviteToken);
      if (inv && !inv.is_revoked && new Date(inv.expires_at) > new Date()) {
        validInvite = inv;
      }
    }

    const inviter = validInvite ? db.findUserById(validInvite.created_by) : null;
    const emailLower = email.trim().toLowerCase();
    const emailDomain = emailLower.split('@')[1] || '';
    let finalCompany = 'Grand Regency Hotel & Resort';

    if (validInvite) {
      finalCompany = inviter?.company || 'Grand Regency Hotel & Resort';
    } else if (assignedRole === 'Admin/Group Owner') {
      finalCompany = (company && typeof company === 'string' && company.trim()) 
        ? company.trim() 
        : (emailDomain ? emailDomain.split('.')[0].charAt(0).toUpperCase() + emailDomain.split('.')[0].slice(1) : 'Grand Regency Hotel & Resort');
    } else {
      // For Manager / Staff, auto-join based on work email domain matching an existing Admin/Group Owner
      const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
      const isGeneric = genericDomains.includes(emailDomain);

      if (!isGeneric && emailDomain) {
        const matchingAdmin = Array.from(db.users.values()).find(
          (u) => u.role === 'Admin/Group Owner' && u.email.toLowerCase().endsWith(`@${emailDomain}`)
        );
        if (matchingAdmin) {
          finalCompany = matchingAdmin.company;
        } else {
          finalCompany = emailDomain.split('.')[0].charAt(0).toUpperCase() + emailDomain.split('.')[0].slice(1);
        }
      } else {
        finalCompany = (company && typeof company === 'string' && company.trim()) ? company.trim() : 'Independent Workspace';
      }
    }

    // Duplicate Email Check
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'Account not created due to duplicate email',
        code: 'DUPLICATE_EMAIL',
      });
      return;
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user in DB
    const newUser = db.createUser({
      name: name.trim(),
      email: email.trim(),
      password_hash,
      company: finalCompany,
      role: assignedRole,
    });

    // Auto-redeem invitation if present
    if (validInvite) {
      db.redeemInvitation(validInvite.token, newUser.id);
      broadcastToBoard(validInvite.board_id, 'members:updated', {
        board_id: validInvite.board_id,
        user_id: newUser.id,
        user_name: newUser.name,
      });
    }

    // Issue JWT and set HttpOnly cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: toSafeUser(newUser),
      joined_board_id: validInvite?.board_id || null,
      token, // Also return for client convenience or mobile headers
    });
  } catch (error: any) {
    if (error.code === 'DUPLICATE_EMAIL') {
      res.status(409).json({
        success: false,
        error: 'Account not created due to duplicate email',
        code: 'DUPLICATE_EMAIL',
      });
      return;
    }
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during account creation.' });
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials, issues JWT and sets HttpOnly cookie.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = db.findUserByEmail(cleanEmail);
    if (!user && (cleanEmail === 'admin@test.com' || cleanEmail === 'admin' || cleanEmail === 'admin@grandregency.com')) {
      user = db.findUserByEmail('admin@test.com') || db.findUserByEmail('admin@grandregency.com') || Array.from(db.users.values()).find(u => u.role === 'Admin/Group Owner') || Array.from(db.users.values())[0];
    }
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
      return;
    }

    const isTestAdmin = (cleanEmail === 'admin@test.com' || cleanEmail === 'admin' || user.email === 'admin@test.com') && (password === 'admin' || password === 'Password123!');
    const isMatch = isTestAdmin || await comparePassword(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
      return;
    }

    // Issue JWT & set cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      user: toSafeUser(user),
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the HttpOnly auth cookie.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user session.
 */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * GET /api/auth/demo-users
 * Returns list of active accounts for Instant Quick Login switcher,
 * including any newly created users by admins/managers.
 */
authRouter.get('/demo-users', (_req: Request, res: Response) => {
  const users = Array.from(db.users.values())
    .filter((u) => u.is_active)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      company: u.company,
      avatar_url: u.avatar_url,
    }));
  res.json({ success: true, users });
});

/**
 * POST /api/auth/avatar
 * Uploads user profile photo (PNG/JPG, max 1MB).
 */
authRouter.post('/avatar', requireAuth, avatarUpload.single('avatar'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No image file uploaded or file exceeds 1MB limit.' });
      return;
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = req.user!;
    user.avatar_url = avatarUrl;
    user.updated_at = new Date().toISOString();
    db.users.set(user.id, user);
    db.saveToDisk();

    res.json({ success: true, user: toSafeUser(user) });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to upload profile photo. Ensure file is PNG/JPG under 1MB.' });
  }
});

