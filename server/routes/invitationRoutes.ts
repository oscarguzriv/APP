import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware.ts';
import { broadcastToBoard } from '../socket.ts';
import { BoardMemberRole } from '../types.ts';

export const invitationRouter = Router();

/**
 * GET /api/invitations/:token
 * PUBLIC: Validates invitation token and retrieves board & inviter details.
 * Used by /join/:token landing screen before or during registration.
 */
invitationRouter.get('/:token', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, error: 'Token is required.' });
      return;
    }

    const invitation = db.getInvitationByToken(token);
    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invitation not found or invalid.', code: 'INVALID_TOKEN' });
      return;
    }

    if (invitation.is_revoked) {
      res.status(410).json({ success: false, error: 'This invitation has been revoked by a manager.', code: 'REVOKED' });
      return;
    }

    const isExpired = new Date(invitation.expires_at) <= new Date();
    if (isExpired) {
      res.status(410).json({ success: false, error: 'This invitation link has expired.', code: 'EXPIRED' });
      return;
    }

    if (invitation.max_uses && invitation.used_count >= invitation.max_uses) {
      res.status(410).json({ success: false, error: 'This invitation link has reached its maximum redemptions.', code: 'MAX_USES_REACHED' });
      return;
    }

    const board = db.boards.get(invitation.board_id);
    const inviter = db.findUserById(invitation.created_by);

    res.json({
      success: true,
      valid: true,
      invitation: {
        token: invitation.token,
        board_id: invitation.board_id,
        board_title: board?.title || invitation.board_title || 'Hospitality Operations Board',
        role: invitation.role,
        inviter_name: inviter?.name || invitation.inviter_name || 'Shift Lead / Manager',
        company: inviter?.company || 'Hospitality Group',
        expires_at: invitation.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    res.status(500).json({ success: false, error: 'Failed to validate invitation.' });
  }
});

/**
 * POST /api/invitations
 * PROTECTED: Generates a new secure token invitation link and QR code payload.
 * Available to Managers, Admins, and Board Admins.
 */
invitationRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { board_id, role = 'Member', expires_in_hours = 72, max_uses } = req.body;

    if (!board_id) {
      res.status(400).json({ success: false, error: 'Board ID is required.' });
      return;
    }

    const board = db.boards.get(board_id);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found.' });
      return;
    }

    // Tenant ownership check: Manager/Admin must belong to the same company/tenant as the board creator
    const boardCreator = db.findUserById(board.created_by);
    if (!boardCreator || boardCreator.company.toLowerCase() !== user.company.toLowerCase()) {
      res.status(403).json({ success: false, error: 'Cross-tenant access denied. You can only manage invitations for boards within your own tenant/company.' });
      return;
    }

    // Permission check: Admins, Managers, or users with Board Admin membership on this board
    const boardRole = db.getBoardMembership(board_id, user.id);
    const isGlobalManagerOrAdmin = user.role === 'Admin/Group Owner' || user.role === 'Manager';
    const isBoardAdmin = boardRole === 'Board Admin';

    if (!isGlobalManagerOrAdmin && !isBoardAdmin) {
      res.status(403).json({ success: false, error: 'Only Managers and Board Admins can generate QR code invitations.' });
      return;
    }

    // Staff cannot invite as Board Admin
    const targetRole: BoardMemberRole = role === 'Board Admin' && user.role !== 'Admin/Group Owner' ? 'Member' : role;

    const invitation = db.createInvitation({
      board_id,
      role: targetRole,
      created_by: user.id,
      expires_in_hours: Number(expires_in_hours) || 72,
      max_uses: max_uses ? Number(max_uses) : undefined,
    });

    if (!invitation) {
      res.status(500).json({ success: false, error: 'Failed to create invitation.' });
      return;
    }

    // Return join URL and invitation object
    const join_url = `/join/${invitation.token}`;

    res.status(201).json({
      success: true,
      invitation: {
        ...invitation,
        join_url,
      },
    });
  } catch (error: any) {
    console.error('Error generating invitation:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invitation link.' });
  }
});

/**
 * POST /api/invitations/:token/accept
 * PROTECTED: Redeems an invite for an already logged-in user.
 */
invitationRouter.post('/:token/accept', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { token } = req.params;

    const result = db.redeemInvitation(token, user.id);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    // Broadcast member update to the board room
    broadcastToBoard(result.board_id!, 'members:updated', {
      board_id: result.board_id,
      user_id: user.id,
      user_name: user.name,
    });

    res.json({
      success: true,
      board_id: result.board_id,
      message: 'Successfully joined the board.',
    });
  } catch (error: any) {
    console.error('Error redeeming invitation:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation.' });
  }
});

/**
 * GET /api/invitations/board/:boardId
 * PROTECTED: Lists active invitations for a board so managers can inspect or revoke them.
 */
invitationRouter.get('/board/:boardId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { boardId } = req.params;
    const user = req.user!;

    const boardRole = db.getBoardMembership(boardId, user.id);
    const isAllowed = user.role === 'Admin/Group Owner' || user.role === 'Manager' || boardRole === 'Board Admin';

    if (!isAllowed) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const invitations = db.getBoardInvitations(boardId).map((inv) => ({
      ...inv,
      join_url: `/join/${inv.token}`,
    }));

    res.json({ success: true, invitations });
  } catch (error: any) {
    console.error('Error getting board invitations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invitations.' });
  }
});

/**
 * DELETE /api/invitations/:id
 * PROTECTED: Revokes an active invitation link.
 */
invitationRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const invitation = db.invitations.get(id);
    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invitation not found.' });
      return;
    }

    const boardRole = db.getBoardMembership(invitation.board_id, user.id);
    const isAllowed = user.role === 'Admin/Group Owner' || user.role === 'Manager' || boardRole === 'Board Admin';

    if (!isAllowed) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const revoked = db.revokeInvitation(id);
    res.json({ success: revoked });
  } catch (error: any) {
    console.error('Error revoking invitation:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke invitation.' });
  }
});
