import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { User, SafeUser, JWTPayload } from './types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'hospitality_kanban_secure_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';
export const AUTH_COOKIE_NAME = 'hospitalist_token';

/**
 * Hash a plain password using bcrypt salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain text password with hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Issue a signed JWT for the authenticated user
 */
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    company: user.company,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Set HttpOnly authentication cookie
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
}

/**
 * Clear the auth cookie on logout
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
}

/**
 * Strip password and sensitive tokens before returning to client
 */
export function toSafeUser(user: User): SafeUser {
  const { password_hash, google_access_token, google_refresh_token, ...safe } = user;
  return safe;
}
