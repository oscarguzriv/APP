import { Request, Response, NextFunction } from 'express';
import { verifyToken, AUTH_COOKIE_NAME, toSafeUser } from './auth';
import { db } from './db';
import { SafeUser, GlobalUserRole, BoardMemberRole } from './types';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

/**
 * Authentication Middleware
 * Validates JWT strictly from HttpOnly cookie or Authorization Bearer header.
 * (Bypasses like x-user-email and admin fallback are removed for production security).
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.findUserById(payload.userId) || (payload.email ? db.findUserByEmail(payload.email) : undefined);
      if (user && user.is_active) {
        req.user = toSafeUser(user);
        return next();
      }
    }
  }

  res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in.',
    code: 'UNAUTHENTICATED',
  });
}

/**
 * CSRF Protection Middleware for state-changing requests (POST, PATCH, PUT, DELETE).
 * Validates Origin/Referer against allowed host.
 */
export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = req.get('origin');
    const referer = req.get('referer');
    const host = req.get('host');

    if (!origin && !referer) {
      return next();
    }

    const checkValid = (urlStr: string) => {
      try {
        const u = new URL(urlStr);
        return u.host === host;
      } catch {
        return false;
      }
    };

    const isValid = (origin && checkValid(origin)) || (referer && checkValid(referer));
    if (!isValid) {
      res.status(403).json({
        success: false,
        error: 'CSRF validation failed: Origin or Referer header mismatch.',
        code: 'CSRF_FAILURE',
      });
      return;
    }
  }
  next();
}

/**
 * Global App Role Authorization Middleware
 * Enforces permissions hierarchy: 'Admin/Group Owner' > 'Manager' > 'Staff'
 */
export function requireGlobalRole(allowedRoles: GlobalUserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Your role is: ${req.user.role}`,
        code: 'FORBIDDEN_ROLE',
      });
      return;
    }

    next();
  };
}

/**
 * Board ACL Access Middleware
 * Validates that the requesting user created the board, was explicitly invited,
 * or is an Admin/Group Owner within the same company.
 */
export function requireBoardAccess(minRole: BoardMemberRole = 'Viewer') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const boardId = (req.params.boardId || req.params.id || req.body.board_id) as string;
    if (!boardId) {
      res.status(400).json({ success: false, error: 'Board ID is required.' });
      return;
    }

    const board = db.boards.get(boardId);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found.' });
      return;
    }

    let memberRole = db.getBoardMembership(boardId, req.user.id);
    if (!memberRole) {
      if (board.created_by === req.user.id) {
        memberRole = 'Board Admin';
      } else if (req.user.role === 'Admin/Group Owner' || req.user.role === 'Manager') {
        const creator = db.findUserById(board.created_by);
        if (creator && creator.company.toLowerCase() === req.user.company.toLowerCase()) {
          memberRole = 'Board Admin';
        }
      }
    }

    if (!memberRole) {
      res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to view or modify this board.',
        code: 'BOARD_ACCESS_DENIED',
      });
      return;
    }

    const roleHierarchy: Record<BoardMemberRole, number> = {
      'Viewer': 1,
      'Member': 2,
      'Board Admin': 3,
    };

    if (roleHierarchy[memberRole] < roleHierarchy[minRole]) {
      res.status(403).json({
        success: false,
        error: `Insufficient board permissions. Requires '${minRole}', but you have '${memberRole}'.`,
        code: 'INSUFFICIENT_BOARD_ROLE',
      });
      return;
    }

    (req as any).boardMemberRole = memberRole;
    next();
  };
}
