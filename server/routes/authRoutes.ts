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
import { GlobalUserRole } from '../types.ts';

export const authRouter = Router();

/**
 * POST /api/auth/signup
 * Creates a new user account with secure password hash and HttpOnly JWT cookie.
 * Explicitly guards against duplicate emails.
 */
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, company, role } = req.body;

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

    if (!company || typeof company !== 'string' || !company.trim()) {
      res.status(400).json({ success: false, error: 'Hospitality company/property name is required.' });
      return;
    }

    // Role validation
    const validRoles: GlobalUserRole[] = ['Admin/Group Owner', 'Manager', 'Staff'];
    const assignedRole: GlobalUserRole = validRoles.includes(role) ? role : 'Staff';

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
      company: company.trim(),
      role: assignedRole,
    });

    // Issue JWT and set HttpOnly cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: toSafeUser(newUser),
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

    const user = db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email and password.',
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);
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
