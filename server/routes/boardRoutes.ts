import { Router, Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireBoardAccess, AuthenticatedRequest } from '../middleware.ts';
import { hashPassword, toSafeUser } from '../auth.ts';
import {
  broadcastCardCreated,
  broadcastCardMoved,
  broadcastCardUpdated,
  broadcastCardDeleted,
  broadcastActivityLogged,
  broadcastChecklistItemUpdated,
  broadcastToBoard,
} from '../socket.ts';
import { BoardMemberRole, CardPriority, GlobalUserRole } from '../types.ts';

export const boardRouter = Router();

// Protect all board routes with authentication
boardRouter.use(requireAuth);

/**
 * GET /api/boards
 * Returns all boards the user is authorized to access.
 */
boardRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const boards = db.getBoardsForUser(userId);

  // Group into active and closed
  const activeBoards = boards.filter((b) => !b.is_closed);
  const closedBoards = boards.filter((b) => b.is_closed);

  res.json({
    success: true,
    activeBoards,
    closedBoards,
  });
});

/**
 * POST /api/boards
 * Creates a new board. Restricted: Staff cannot create boards.
 */
boardRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { title, description, background_value, labels } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ success: false, error: 'Board title is required.' });
      return;
    }

    const result = db.createBoard({
      title,
      description,
      background_value,
      created_by: user.id,
      labels,
    });

    res.status(201).json({
      success: true,
      message: 'Board created successfully.',
      board: result.board,
      lists: result.defaultLists,
      labels: result.labels,
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/boards/:id
 * Fetches board details with lists, cards, members, labels, and activity log.
 */
boardRouter.get('/:id', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const board = db.boards.get(boardId);

  if (!board) {
    res.status(404).json({ success: false, error: 'Board not found.' });
    return;
  }

  // Lists
  const lists = Array.from(db.lists.values())
    .filter((l) => l.board_id === boardId && !l.is_archived)
    .sort((a, b) => a.position - b.position);

  // Cards
  const cards = Array.from(db.cards.values())
    .filter((c) => c.board_id === boardId && !c.is_archived)
    .map((c) => db.getHydratedCard(c.id)!)
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  // Members
  const members = Array.from(db.boardMembers.values())
    .filter((m) => m.board_id === boardId)
    .map((m) => {
      const u = db.findUserById(m.user_id);
      return {
        ...m,
        user_name: u?.name || 'Unknown',
        user_email: u?.email || '',
        user_role: u?.role || 'Staff',
        user_avatar: u?.avatar_url,
      };
    });

  // Labels
  const labels = Array.from(db.boardLabels.values()).filter((l) => l.board_id === boardId);

  // Recent activity logs
  const activityLogs = db.cardActivityLogs
    .filter((log) => log.board_id === boardId)
    .slice(0, 30);

  res.json({
    success: true,
    board,
    userRole: (req as any).boardMemberRole,
    lists,
    cards,
    members,
    labels,
    activityLogs,
  });
});

/**
 * PATCH /api/boards/:id
 * Updates board settings (title, description, background, closed state).
 */
boardRouter.patch('/:id', requireBoardAccess('Board Admin'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const board = db.boards.get(boardId);
  if (!board) {
    res.status(404).json({ success: false, error: 'Board not found.' });
    return;
  }

  const { title, description, background_value, is_closed } = req.body;
  const now = new Date().toISOString();

  if (title !== undefined) board.title = title.trim();
  if (description !== undefined) board.description = description.trim();
  if (background_value !== undefined) board.background_value = background_value;
  if (is_closed !== undefined) {
    board.is_closed = Boolean(is_closed);
    board.closed_at = board.is_closed ? now : null;
  }
  board.updated_at = now;

  db.boards.set(board.id, board);

  db.logActivity({
    board_id: board.id,
    user_id: req.user!.id,
    action_type: 'updated_board_settings',
    details: { title: board.title, is_closed: board.is_closed },
  });

  res.json({ success: true, board });
});

/**
 * POST /api/boards/:id/copy
 * Duplicates a board with or without cards.
 */
boardRouter.post('/:id/copy', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const sourceBoard = db.boards.get(req.params.id);
  if (!sourceBoard) {
    res.status(404).json({ success: false, error: 'Source board not found.' });
    return;
  }

  const { title, copyCards = true } = req.body;
  const user = req.user!;

  const sourceLabels = db.getLabelsForBoard(sourceBoard.id).map((l) => ({ name: l.name, color: l.color }));
  const newBoardResult = db.createBoard({
    title: title || `${sourceBoard.title} (Copy)`,
    description: sourceBoard.description,
    background_value: sourceBoard.background_value,
    created_by: user.id,
    labels: sourceLabels.length > 0 ? sourceLabels : undefined,
  });

  const newBoard = newBoardResult.board;

  if (copyCards) {
    // Map old list positions to new list IDs
    const sourceLists = Array.from(db.lists.values())
      .filter((l) => l.board_id === sourceBoard.id && !l.is_archived)
      .sort((a, b) => a.position - b.position);

    sourceLists.forEach((oldList, idx) => {
      const targetList = newBoardResult.defaultLists[idx] || newBoardResult.defaultLists[0];
      const sourceCards = Array.from(db.cards.values()).filter(
        (c) => c.list_id === oldList.id && !c.is_archived
      );

      for (const sc of sourceCards) {
        db.createCard({
          board_id: newBoard.id,
          list_id: targetList.id,
          title: sc.title,
          description: sc.description,
          priority: sc.priority,
          due_date: sc.due_date,
          assigned_to: sc.assigned_to,
          google_event_id: sc.google_event_id,
          created_by: user.id,
        });
      }
    });
  }

  res.status(201).json({ success: true, board: newBoard });
});

/**
 * POST /api/boards/:id/members
 * Invites an existing company user to the board based on role hierarchy:
 * - Admin can add: other admins, managers, staff (with any board role).
 * - Managers can add: other managers, staff (with Member or Viewer board role).
 * - Staff can invite: other staff only (with Member or Viewer board role).
 */
boardRouter.post('/:id/members', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const { user_id, role } = req.body;
  const currentUser = req.user!;
  const currentBoardRole = (req as any).boardMemberRole as BoardMemberRole;

  const targetUser = db.findUserById(user_id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'User to invite not found.' });
    return;
  }

  // Hierarchy validation
  const isInviterAdmin = currentUser.role === 'Admin/Group Owner' || currentBoardRole === 'Board Admin';
  const isInviterManager = currentUser.role === 'Manager';
  const isInviterStaff = currentUser.role === 'Staff';

  if (isInviterStaff) {
    if (targetUser.role !== 'Staff') {
      res.status(403).json({
        success: false,
        error: 'Staff members can only invite other Staff members.',
      });
      return;
    }
    if (role === 'Board Admin') {
      res.status(403).json({
        success: false,
        error: 'Staff members cannot grant Board Admin permissions.',
      });
      return;
    }
  } else if (isInviterManager) {
    if (targetUser.role === 'Admin/Group Owner') {
      res.status(403).json({
        success: false,
        error: 'Managers can only add other Managers and Staff, not Admins.',
      });
      return;
    }
    if (role === 'Board Admin') {
      res.status(403).json({
        success: false,
        error: 'Managers cannot grant Board Admin permissions.',
      });
      return;
    }
  }

  const validRoles: BoardMemberRole[] = ['Board Admin', 'Member', 'Viewer'];
  const memberRole: BoardMemberRole = validRoles.includes(role) ? role : 'Member';

  // Check if already a member
  for (const m of db.boardMembers.values()) {
    if (m.board_id === boardId && m.user_id === user_id) {
      m.role = memberRole;
      m.updated_at = new Date().toISOString();
      db.boardMembers.set(m.id, m);
      broadcastToBoard(boardId, 'members:updated', { member: m });
      res.json({ success: true, message: 'Member role updated.', member: m });
      return;
    }
  }

  const newMemberId = db.generateId();
  const newMember = {
    id: newMemberId,
    board_id: boardId,
    user_id,
    role: memberRole,
    invited_by: currentUser.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.boardMembers.set(newMemberId, newMember);

  const memberLog = db.logActivity({
    board_id: boardId,
    user_id: currentUser.id,
    action_type: 'invited_member',
    details: {
      invited_name: targetUser.name,
      role: memberRole,
      global_role: targetUser.role,
      summary: `invited ${targetUser.name} (${memberRole}) to the board`,
    },
  });

  broadcastActivityLogged(boardId, memberLog);
  broadcastToBoard(boardId, 'members:updated', { member: newMember });

  res.status(201).json({ success: true, member: newMember });
});

/**
 * POST /api/boards/:id/members/new-user
 * Allows Admin or Manager to create a new user and add them to the board.
 * - Admin can create: other admins, managers, staff.
 * - Managers can create: other managers, staff.
 * - Staff cannot create new user accounts.
 */
boardRouter.post('/:id/members/new-user', requireBoardAccess('Viewer'), async (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const currentUser = req.user!;
  const currentBoardRole = (req as any).boardMemberRole as BoardMemberRole;

  const isInviterAdmin = currentUser.role === 'Admin/Group Owner' || currentBoardRole === 'Board Admin';
  const isInviterManager = currentUser.role === 'Manager';

  if (!isInviterAdmin && !isInviterManager) {
    res.status(403).json({
      success: false,
      error: 'Only Admins or Managers can create new user accounts and add them to the board.',
    });
    return;
  }

  const { name, email, role, board_role } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ success: false, error: 'Full name is required.' });
    return;
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'Valid business email is required.' });
    return;
  }

  // Hierarchy enforcement for the new user's global role
  const validRoles: GlobalUserRole[] = ['Admin/Group Owner', 'Manager', 'Staff'];
  const assignedRole: GlobalUserRole = validRoles.includes(role) ? role : 'Staff';

  if (isInviterManager && assignedRole === 'Admin/Group Owner') {
    res.status(403).json({
      success: false,
      error: 'Managers can only create Manager or Staff accounts, not Admins.',
    });
    return;
  }

  // Check if user already exists
  let targetUser = db.findUserByEmail(email.trim());
  let isBrandNewUser = false;

  if (!targetUser) {
    isBrandNewUser = true;
    const defaultPasswordHash = await hashPassword('Password123!');
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    targetUser = db.createUser({
      name: name.trim(),
      email: email.trim(),
      password_hash: defaultPasswordHash,
      company: currentUser.company,
      role: assignedRole,
      avatar_url: avatarUrl,
    });
  }

  // Determine board role
  let memberRole: BoardMemberRole = board_role === 'Board Admin' || board_role === 'Viewer' ? board_role : 'Member';
  if (!isInviterAdmin && memberRole === 'Board Admin') {
    memberRole = 'Member';
  }

  // Add to board members if not already
  let memberRecord: any = null;
  for (const m of db.boardMembers.values()) {
    if (m.board_id === boardId && m.user_id === targetUser.id) {
      memberRecord = m;
      break;
    }
  }

  if (!memberRecord) {
    const newMemberId = db.generateId();
    memberRecord = {
      id: newMemberId,
      board_id: boardId,
      user_id: targetUser.id,
      role: memberRole,
      invited_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.boardMembers.set(newMemberId, memberRecord);
  }

  // Log activity
  const newMemberLog = db.logActivity({
    board_id: boardId,
    user_id: currentUser.id,
    action_type: isBrandNewUser ? 'created_user' : 'invited_member',
    details: {
      created_name: targetUser.name,
      email: targetUser.email,
      role: assignedRole,
      board_role: memberRole,
      summary: isBrandNewUser
        ? `created new user ${targetUser.name} (${assignedRole}) and added them to board`
        : `added ${targetUser.name} (${memberRole}) to the board`,
    },
  });

  broadcastActivityLogged(boardId, newMemberLog);
  broadcastToBoard(boardId, 'members:updated', { member: memberRecord });

  res.status(201).json({
    success: true,
    message: isBrandNewUser
      ? `User ${targetUser.name} created and added to board.`
      : `User ${targetUser.name} added to board.`,
    user: toSafeUser(targetUser),
    member: memberRecord,
  });
});

/**
 * DELETE /api/boards/:id/members/:userId
 * Removes a member or allows user to leave board.
 */
boardRouter.delete('/:id/members/:userId', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const targetUserId = req.params.userId;
  const currentUserId = req.user!.id;
  const currentRole = (req as any).boardMemberRole;

  // Users can leave themselves, or Board Admins can remove members
  if (targetUserId !== currentUserId && currentRole !== 'Board Admin') {
    res.status(403).json({ success: false, error: 'Only Board Admins can remove other members.' });
    return;
  }

  for (const [id, m] of db.boardMembers.entries()) {
    if (m.board_id === boardId && m.user_id === targetUserId) {
      db.boardMembers.delete(id);
      res.json({ success: true, message: 'Member removed from board.' });
      return;
    }
  }

  res.status(404).json({ success: false, error: 'Membership record not found.' });
});

// =========================================================================
// LIST / COLUMN ROUTES
// =========================================================================

/**
 * PATCH /api/lists/:id
 * Allows the creator of the board (or board admin / manager) to edit column names.
 */
boardRouter.patch('/lists/:id', (req: AuthenticatedRequest, res: Response) => {
  const listId = req.params.id;
  const list = db.lists.get(listId);
  if (!list) {
    res.status(404).json({ success: false, error: 'Column not found.' });
    return;
  }

  const board = db.boards.get(list.board_id);
  if (!board) {
    res.status(404).json({ success: false, error: 'Board not found.' });
    return;
  }

  const userId = req.user!.id;
  const isCreator = board.created_by === userId;
  const memberRole = db.getBoardMembership(board.id, userId);

  // The creator of the board, board admins, or managers/admins can rename columns
  if (!isCreator && memberRole !== 'Board Admin' && req.user!.role !== 'Admin/Group Owner' && req.user!.role !== 'Manager') {
    res.status(403).json({
      success: false,
      error: 'Only the creator of the board or Board Admin can edit column names.',
    });
    return;
  }

  const { title } = req.body;
  if (!title || !title.trim()) {
    res.status(400).json({ success: false, error: 'Column title is required.' });
    return;
  }

  list.title = title.trim();
  list.updated_at = new Date().toISOString();
  db.lists.set(list.id, list);

  db.logActivity({
    board_id: board.id,
    user_id: userId,
    action_type: 'renamed_column',
    details: { list_id: list.id, title: list.title },
  });

  // Broadcast list update to other connected users on this board
  broadcastToBoard(board.id, 'list:updated', { list });

  res.json({ success: true, list });
});

// =========================================================================
// LABEL ROUTES
// =========================================================================

/**
 * GET /api/boards/:id/labels
 * Returns all labels for a board.
 */
boardRouter.get('/:id/labels', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const labels = db.getLabelsForBoard(boardId);
  res.json({ success: true, labels });
});

/**
 * POST /api/boards/:id/labels
 * Creates a new label on the board. Anyone with board access can create labels.
 */
boardRouter.post('/:id/labels', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const boardId = req.params.id;
  const { name, color } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, error: 'Label name is required.' });
    return;
  }

  const label = db.createBoardLabel({
    board_id: boardId,
    name: name.trim(),
    color: color || '#3b82f6',
  });

  const updatedLabels = db.getLabelsForBoard(boardId);
  broadcastToBoard(boardId, 'labels:updated', { labels: updatedLabels });

  res.status(201).json({ success: true, label, labels: updatedLabels });
});

/**
 * PATCH /api/boards/:id/labels/:labelId
 * Updates a label's name or color. Anyone with board access can edit labels.
 */
boardRouter.patch('/:id/labels/:labelId', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const { id: boardId, labelId } = req.params;
  const { name, color } = req.body;

  const updated = db.updateBoardLabel(labelId, { name, color });
  if (!updated) {
    res.status(404).json({ success: false, error: 'Label not found.' });
    return;
  }

  const updatedLabels = db.getLabelsForBoard(boardId);
  broadcastToBoard(boardId, 'labels:updated', { labels: updatedLabels });

  res.json({ success: true, label: updated, labels: updatedLabels });
});

/**
 * DELETE /api/boards/:id/labels/:labelId
 * Deletes a label from the board. Anyone with board access can delete labels.
 */
boardRouter.delete('/:id/labels/:labelId', requireBoardAccess('Viewer'), (req: AuthenticatedRequest, res: Response) => {
  const { id: boardId, labelId } = req.params;

  const deleted = db.deleteBoardLabel(labelId);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Label not found.' });
    return;
  }

  const updatedLabels = db.getLabelsForBoard(boardId);
  broadcastToBoard(boardId, 'labels:updated', { labels: updatedLabels });

  res.json({ success: true, message: 'Label removed.', labels: updatedLabels });
});

// =========================================================================
// CARD ROUTES
// =========================================================================

/**
 * POST /api/cards
 * Creates a new card and broadcasts in real-time.
 */
boardRouter.post('/cards/new', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { board_id, list_id, title, description, priority, due_date, assigned_to, socketId } = req.body;

    if (!board_id || !list_id || !title?.trim()) {
      res.status(400).json({ success: false, error: 'Board ID, List ID, and Card Title are required.' });
      return;
    }

    // Permission check
    const memberRole = db.getBoardMembership(board_id, req.user!.id);
    if (!memberRole || memberRole === 'Viewer') {
      res.status(403).json({ success: false, error: 'Viewers cannot create cards.' });
      return;
    }

    const card = db.createCard({
      board_id,
      list_id,
      title,
      description,
      priority,
      due_date,
      assigned_to,
      created_by: req.user!.id,
    });

    // Real-Time Broadcast (excludes originating socket to prevent duplicate reception)
    broadcastCardCreated(board_id, card, socketId);

    const latestLog = db.getActivityLogsForBoard(board_id)[0];
    if (latestLog) {
      broadcastActivityLogged(board_id, latestLog);
    }

    res.status(201).json({ success: true, card });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/cards/:id/move
 * Drag and drop card moving with instant Socket.io broadcast.
 */
boardRouter.patch('/cards/:id/move', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const memberRole = db.getBoardMembership(card.board_id, req.user!.id);
  if (!memberRole || memberRole === 'Viewer') {
    res.status(403).json({ success: false, error: 'Viewers cannot move cards.' });
    return;
  }

  const { targetListId, newPosition, socketId } = req.body;
  if (!targetListId || typeof newPosition !== 'number') {
    res.status(400).json({ success: false, error: 'Target List ID and position are required.' });
    return;
  }

  const updatedCard = db.moveCard({
    cardId,
    targetListId,
    newPosition,
    userId: req.user!.id,
  });

  if (!updatedCard) {
    res.status(500).json({ success: false, error: 'Failed to move card.' });
    return;
  }

  // Broadcast to other users viewing this board
  broadcastCardMoved(card.board_id, { card: updatedCard, targetListId, newPosition }, socketId);

  const moveLog = db.getActivityLogsForBoard(card.board_id)[0];
  if (moveLog) {
    broadcastActivityLogged(card.board_id, moveLog);
  }

  res.json({ success: true, card: updatedCard });
});

/**
 * PATCH /api/cards/:id/complete
 * Quick-check mark as complete / uncomplete with audit trail.
 */
boardRouter.patch('/cards/:id/complete', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const memberRole = db.getBoardMembership(card.board_id, req.user!.id);
  if (!memberRole || memberRole === 'Viewer') {
    res.status(403).json({ success: false, error: 'Viewers cannot change card completion.' });
    return;
  }

  const { is_completed } = req.body;
  const updatedCard = db.updateCardCompletion(cardId, Boolean(is_completed), req.user!.id);

  if (updatedCard) {
    broadcastCardUpdated(card.board_id, updatedCard);
  }

  res.json({ success: true, card: updatedCard });
});

/**
 * PATCH /api/cards/:id
 * Full card edit (title, description, priority, due date, assignees, labels).
 */
boardRouter.patch('/cards/:id', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const memberRole = db.getBoardMembership(card.board_id, req.user!.id);
  if (!memberRole || memberRole === 'Viewer') {
    res.status(403).json({ success: false, error: 'Viewers cannot edit cards.' });
    return;
  }

  const { title, description, priority, due_date, assigned_to, label_ids } = req.body;
  const now = new Date().toISOString();
  const oldTitle = card.title;
  const oldDesc = card.description || '';
  const oldPriority = card.priority;
  const oldDueDate = card.due_date;
  const oldAssignedTo = card.assigned_to;

  const changedFields: string[] = [];

  if (title !== undefined && title.trim() && title.trim() !== oldTitle) {
    card.title = title.trim();
    changedFields.push('title');
  }

  if (description !== undefined && description.trim() !== oldDesc) {
    card.description = description.trim();
    changedFields.push('description');
  }

  if (priority !== undefined && priority !== oldPriority) {
    card.priority = priority as CardPriority;
    changedFields.push('priority');
  }

  if (due_date !== undefined && due_date !== oldDueDate) {
    card.due_date = due_date;
    changedFields.push('due date');
  }

  if (assigned_to !== undefined && assigned_to !== oldAssignedTo) {
    card.assigned_to = assigned_to || null;
    changedFields.push('assignee');
  }

  card.updated_at = now;
  db.cards.set(card.id, card);

  // Update labels if provided
  let labelsChanged = false;
  if (Array.isArray(label_ids)) {
    const existingLabels = db.getLabelsForCard(cardId).map((l) => l.id).sort();
    const newLabels = [...label_ids].sort();
    if (JSON.stringify(existingLabels) !== JSON.stringify(newLabels)) {
      labelsChanged = true;
      changedFields.push('labels');
    }

    // Remove old mappings for this card
    for (const mapping of Array.from(db.cardLabelsMapping)) {
      if (mapping.startsWith(`${cardId}:`)) {
        db.cardLabelsMapping.delete(mapping);
      }
    }
    // Add new mappings
    for (const lId of label_ids) {
      db.cardLabelsMapping.add(`${cardId}:${lId}`);
    }
  }

  const hydrated = db.getHydratedCard(cardId);

  // Determine specific action type and human-readable summary
  if (changedFields.length > 0) {
    let actionType = 'updated_card';
    let summary = `updated ${changedFields.join(', ')} on "${card.title}"`;

    if (changedFields.length === 1) {
      const field = changedFields[0];
      if (field === 'title') {
        actionType = 'updated_card_title';
        summary = `updated title of "${oldTitle}" to "${card.title}"`;
      } else if (field === 'description') {
        actionType = 'updated_card_description';
        summary = `updated description for "${card.title}"`;
      } else if (field === 'priority') {
        actionType = 'updated_card_priority';
        summary = `updated priority of "${card.title}" to ${card.priority}`;
      } else if (field === 'due date') {
        actionType = 'updated_card_due_date';
        summary = `updated due date for "${card.title}"`;
      } else if (field === 'assignee') {
        actionType = 'updated_card_assignee';
        const assignee = card.assigned_to ? db.findUserById(card.assigned_to) : null;
        summary = assignee
          ? `assigned "${card.title}" to ${assignee.name}`
          : `unassigned "${card.title}"`;
      } else if (field === 'labels') {
        actionType = 'updated_card_labels';
        summary = `updated labels on "${card.title}"`;
      }
    }

    const actLog = db.logActivity({
      board_id: card.board_id,
      card_id: card.id,
      user_id: req.user!.id,
      action_type: actionType,
      details: {
        card_title: card.title,
        old_title: oldTitle,
        new_title: card.title,
        changed_fields: changedFields,
        priority: card.priority,
        due_date: card.due_date,
        summary,
      },
    });

    broadcastActivityLogged(card.board_id, actLog);
  }

  if (hydrated) {
    broadcastCardUpdated(card.board_id, hydrated);
  }

  res.json({ success: true, card: hydrated });
});

/**
 * POST /api/cards/:id/checklists
 * Adds a checklist item to a card.
 */
boardRouter.post('/cards/:id/checklists', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ success: false, error: 'Checklist content is required.' });
    return;
  }

  const count = Array.from(db.cardChecklistItems.values()).filter((c) => c.card_id === cardId).length;
  const itemId = db.generateId();
  const now = new Date().toISOString();

  const item = {
    id: itemId,
    card_id: cardId,
    content: content.trim(),
    is_completed: false,
    position: count + 1,
    created_by: req.user!.id,
    completed_by: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  db.cardChecklistItems.set(itemId, item);

  const hydrated = db.getHydratedCard(cardId);
  if (hydrated) broadcastCardUpdated(card.board_id, hydrated);

  res.status(201).json({ success: true, item, card: hydrated });
});

/**
 * PATCH /api/cards/:id/checklists/:itemId
 * Toggles a checklist item with completed_by and completed_at audit.
 */
boardRouter.patch('/cards/:id/checklists/:itemId', (req: AuthenticatedRequest, res: Response) => {
  const { id: cardId, itemId } = req.params;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const { is_completed } = req.body;
  const item = db.toggleChecklistItem(itemId, Boolean(is_completed), req.user!.id);

  if (!item) {
    res.status(404).json({ success: false, error: 'Checklist item not found.' });
    return;
  }

  broadcastChecklistItemUpdated(card.board_id, item);
  const hydrated = db.getHydratedCard(cardId);
  if (hydrated) broadcastCardUpdated(card.board_id, hydrated);

  res.json({ success: true, item, card: hydrated });
});

/**
 * POST /api/cards/:id/comments
 * Adds a comment to a card.
 */
boardRouter.post('/cards/:id/comments', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const card = db.cards.get(cardId);
  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found.' });
    return;
  }

  const { comment_text } = req.body;
  if (!comment_text || !comment_text.trim()) {
    res.status(400).json({ success: false, error: 'Comment text is required.' });
    return;
  }

  const now = new Date().toISOString();
  const commentId = db.generateId();

  const comment = {
    id: commentId,
    card_id: cardId,
    user_id: req.user!.id,
    comment_text: comment_text.trim(),
    created_at: now,
    updated_at: now,
  };

  db.cardComments.set(commentId, comment);

  db.logActivity({
    board_id: card.board_id,
    card_id: card.id,
    user_id: req.user!.id,
    action_type: 'commented_on_card',
    details: { card_title: card.title, preview: comment_text.slice(0, 50) },
  });

  const hydrated = db.getHydratedCard(cardId);
  if (hydrated) broadcastCardUpdated(card.board_id, hydrated);

  res.status(201).json({ success: true, comment, card: hydrated });
});

/**
 * POST /api/cards/:id/watch
 * Toggles whether the current user is watching this card.
 */
boardRouter.post('/cards/:id/watch', (req: AuthenticatedRequest, res: Response) => {
  const cardId = req.params.id;
  const userId = req.user!.id;
  const key = `${cardId}:${userId}`;

  let isWatching = false;
  if (db.cardWatchers.has(key)) {
    db.cardWatchers.delete(key);
    isWatching = false;
  } else {
    db.cardWatchers.add(key);
    isWatching = true;
  }

  const hydrated = db.getHydratedCard(cardId);
  res.json({ success: true, isWatching, card: hydrated });
});

/**
 * GET /api/users/directory
 * Fetches company members for assignment and board invitations.
 */
boardRouter.get('/users/directory', (req: AuthenticatedRequest, res: Response) => {
  const company = req.user!.company.toLowerCase();
  const users = Array.from(db.users.values())
    .filter((u) => u.company.toLowerCase() === company && u.is_active)
    .map((u) => {
      const { password_hash, google_access_token, google_refresh_token, ...safe } = u;
      return safe;
    });

  res.json({ success: true, users });
});
