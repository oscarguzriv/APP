import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { broadcastCardCreated, broadcastActivityLogged } from '../socket.ts';

export const aiRouter = Router();

/**
 * POST /api/ai/claude-card
 * Endpoint for Claude AI or external webhooks to create cards on a board.
 * Requires API key in body or Bearer token.
 */
aiRouter.post('/claude-card', (req: Request, res: Response) => {
  try {
    const { board_id, list_id, title, description, priority, due_date, api_key } = req.body;

    const expectedKey = process.env.CLAUDE_API_KEY || 'roxcrew_claude_secret_2026';
    const authHeader = req.headers.authorization;
    const providedKey = api_key || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (providedKey && providedKey !== expectedKey) {
      res.status(401).json({ success: false, error: 'Invalid Claude API Key or Authorization Token.' });
      return;
    }

    if (!board_id) {
      res.status(400).json({ success: false, error: 'board_id is required.' });
      return;
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, error: 'Card title is required.' });
      return;
    }

    const board = db.boards.get(board_id);
    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found.' });
      return;
    }

    const lists = Array.from(db.lists.values()).filter((l) => l.board_id === board_id && !l.is_archived);
    if (lists.length === 0) {
      res.status(400).json({ success: false, error: 'No lists found on this board. Create a list first.' });
      return;
    }

    const targetListId = list_id && lists.some((l) => l.id === list_id) ? list_id : lists[0].id;

    const validPriorities = ['low', 'normal', 'high', 'urgent'] as const;
    const cardPriority = validPriorities.includes(priority) ? priority : 'normal';

    const newCard = db.createCard({
      board_id,
      list_id: targetListId,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: cardPriority,
      due_date: due_date || null,
      created_by: board.created_by,
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
      message: 'Card created successfully via Claude AI.',
      card: newCard,
    });
  } catch (error: any) {
    console.error('Error in Claude AI card creation:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
  }
});
