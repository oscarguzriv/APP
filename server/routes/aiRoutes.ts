import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware';
import { broadcastCardCreated, broadcastActivityLogged } from '../socket';

export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI generation requests, please try again later.' },
});

/**
 * POST /api/ai/claude-card
 * Secure endpoint for AI card creation on an authorized board.
 */
aiRouter.post('/claude-card', aiLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { board_id, list_id, title, description, priority, due_date } = req.body;

    if (!board_id) {
      res.status(400).json({ success: false, error: 'board_id is required.' });
      return;
    }

    if (!title || typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
      res.status(400).json({ success: false, error: 'Valid card title (max 255 chars) is required.' });
      return;
    }

    const board = db.boards.get(board_id);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found.' });
      return;
    }

    // Authorize board membership or tenant ownership
    const boardRole = db.getBoardMembership(board_id, user.id);
    const boardCreator = db.findUserById(board.created_by);
    const isTenantAdmin = (boardCreator && boardCreator.company.toLowerCase() === user.company.toLowerCase() && (user.role === 'Admin/Group Owner' || user.role === 'Manager'));

    if (!boardRole && !isTenantAdmin && board.created_by !== user.id) {
      res.status(403).json({ success: false, error: 'Access denied. You do not have permissions to create cards on this board.' });
      return;
    }

    const lists = Array.from(db.lists.values()).filter((l) => l.board_id === board_id && !l.is_archived);
    if (lists.length === 0) {
      res.status(400).json({ success: false, error: 'No active lists found on this board.' });
      return;
    }

    const targetListId = list_id && lists.some((l) => l.id === list_id) ? list_id : lists[0].id;

    const validPriorities = ['low', 'normal', 'high', 'urgent'] as const;
    const cardPriority = validPriorities.includes(priority) ? priority : 'normal';

    const newCard = db.createCard({
      board_id,
      list_id: targetListId,
      title: title.trim(),
      description: description && typeof description === 'string' ? description.trim().substring(0, 5000) : '',
      priority: cardPriority,
      due_date: due_date || null,
      created_by: user.id,
    });

    if (!newCard) {
      res.status(500).json({ success: false, error: 'Failed to create card.' });
      return;
    }

    broadcastCardCreated(board_id, newCard);
    const latestLog = db.getActivityLogsForBoard(board_id)[0];
    if (latestLog) {
      broadcastActivityLogged(board_id, latestLog);
    }

    res.status(201).json({
      success: true,
      message: 'Card created successfully via AI integration.',
      card: newCard,
    });
  } catch (error: any) {
    console.error('Error in AI card creation:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
  }
});
