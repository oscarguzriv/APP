import bcrypt from 'bcryptjs';
import {
  User,
  Board,
  BoardMember,
  BoardLabel,
  List,
  Card,
  CardChecklistItem,
  CardComment,
  CardActivityLog,
  NotificationItem,
  GlobalUserRole,
  BoardMemberRole,
  CardPriority,
} from './types.ts';

/**
 * PrimeShift Database Store
 * Implements full PostgreSQL data model relationships, constraints,
 * duplicate email validation, and audit tracking.
 */
class DatabaseStore {
  public users: Map<string, User> = new Map();
  public boards: Map<string, Board> = new Map();
  public boardMembers: Map<string, BoardMember> = new Map();
  public boardLabels: Map<string, BoardLabel> = new Map();
  public lists: Map<string, List> = new Map();
  public cards: Map<string, Card> = new Map();
  public cardChecklistItems: Map<string, CardChecklistItem> = new Map();
  public cardComments: Map<string, CardComment> = new Map();
  public cardActivityLogs: CardActivityLog[] = [];
  public cardLabelsMapping: Set<string> = new Set(); // format: `${cardId}:${labelId}`
  public cardWatchers: Set<string> = new Set(); // format: `${cardId}:${userId}`
  public notifications: NotificationItem[] = [];

  constructor() {
    this.seedInitialData();
  }

  // Helper to generate UUIDs
  public generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // =========================================================================
  // USER METHODS
  // =========================================================================

  public findUserByEmail(email: string): User | undefined {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return undefined;
  }

  public findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public createUser(params: {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    company: string;
    role?: GlobalUserRole;
    avatar_url?: string;
  }): User {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Check if user already exists
    const existing = this.findUserByEmail(normalizedEmail);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: params.id || this.generateId(),
      name: params.name.trim(),
      email: normalizedEmail,
      password_hash: params.password_hash,
      company: params.company.trim(),
      role: params.role || 'Staff',
      avatar_url: params.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(params.name)}`,
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_calendar_id: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    this.users.set(newUser.id, newUser);
    return newUser;
  }

  // =========================================================================
  // BOARD & ACL METHODS
  // =========================================================================

  public getBoardsForUser(userId: string): Board[] {
    const user = this.findUserById(userId);
    if (!user) return [];

    const accessibleBoardIds = new Set<string>();

    // 1. Boards user created
    for (const board of this.boards.values()) {
      if (board.created_by === userId) {
        accessibleBoardIds.add(board.id);
      }
    }

    // 2. Boards user was explicitly invited to
    for (const member of this.boardMembers.values()) {
      if (member.user_id === userId) {
        accessibleBoardIds.add(member.board_id);
      }
    }

    // 3. Admin/Group Owner and Managers can oversee and look into all company boards
    if (user.role === 'Admin/Group Owner' || user.role === 'Manager') {
      for (const board of this.boards.values()) {
        const creator = this.findUserById(board.created_by);
        if (creator && creator.company.toLowerCase() === user.company.toLowerCase()) {
          accessibleBoardIds.add(board.id);
        }
      }
    }

    return Array.from(accessibleBoardIds)
      .map((id) => this.boards.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getBoardMembership(boardId: string, userId: string): BoardMemberRole | null {
    const board = this.boards.get(boardId);
    if (!board) return null;

    // Creator is always Board Admin
    if (board.created_by === userId) {
      return 'Board Admin';
    }

    // Check explicit membership
    for (const member of this.boardMembers.values()) {
      if (member.board_id === boardId && member.user_id === userId) {
        return member.role;
      }
    }

    // Admin/Group Owner and Managers can oversee and participate in all company boards
    const user = this.findUserById(userId);
    const creator = this.findUserById(board.created_by);
    if (
      (user?.role === 'Admin/Group Owner' || user?.role === 'Manager') &&
      creator &&
      creator.company.toLowerCase() === user.company.toLowerCase()
    ) {
      return user.role === 'Admin/Group Owner' ? 'Board Admin' : 'Member';
    }

    return null;
  }

  public createBoard(params: {
    title: string;
    description?: string;
    background_value?: string;
    created_by: string;
    labels?: { name: string; color: string }[];
  }): { board: Board; defaultLists: List[]; labels: BoardLabel[] } {
    const creator = this.findUserById(params.created_by);
    if (!creator) {
      throw new Error('Creator user not found');
    }

    // All authenticated users (Admin, Manager, Staff) are permitted to create boards

    const now = new Date().toISOString();
    const boardId = this.generateId();

    const board: Board = {
      id: boardId,
      title: params.title.trim(),
      description: params.description?.trim() || '',
      background_value: params.background_value || '#0f172a',
      is_closed: false,
      closed_at: null,
      created_by: params.created_by,
      created_at: now,
      updated_at: now,
    };

    this.boards.set(board.id, board);

    // Add creator as Board Admin
    const memberId = this.generateId();
    this.boardMembers.set(memberId, {
      id: memberId,
      board_id: board.id,
      user_id: params.created_by,
      role: 'Board Admin',
      invited_by: params.created_by,
      created_at: now,
      updated_at: now,
    });

    // Default clean starter labels for newly created board (distinct from the sample board's labels)
    const defaultLabels = params.labels || [
      { name: 'To Prep', color: '#3b82f6' }, // Blue
      { name: 'Chef Special', color: '#8b5cf6' }, // Purple
      { name: 'Urgent Action', color: '#ef4444' }, // Red
      { name: 'Inspection Ready', color: '#10b981' }, // Emerald
    ];

    const createdLabels: BoardLabel[] = [];
    for (const label of defaultLabels) {
      const labelId = this.generateId();
      const newLabel: BoardLabel = {
        id: labelId,
        board_id: board.id,
        name: label.name,
        color: label.color,
        created_at: now,
      };
      this.boardLabels.set(labelId, newLabel);
      createdLabels.push(newLabel);
    }

    // Hospitality Kanban default columns: "Brainstorm", "Today", "Tomorrow", "Done"
    const defaultListTitles = ['Brainstorm', 'Today', 'Tomorrow', 'Done'];
    const createdLists: List[] = [];

    defaultListTitles.forEach((title, index) => {
      const listId = this.generateId();
      const list: List = {
        id: listId,
        board_id: board.id,
        title,
        position: (index + 1) * 65535,
        is_archived: false,
        created_by: params.created_by,
        created_at: now,
        updated_at: now,
      };
      this.lists.set(list.id, list);
      createdLists.push(list);
    });

    // Log activity
    this.logActivity({
      board_id: board.id,
      user_id: params.created_by,
      action_type: 'created_board',
      details: { title: board.title },
    });

    return { board, defaultLists: createdLists, labels: createdLabels };
  }

  // =========================================================================
  // LABEL METHODS
  // =========================================================================

  public getLabelsForBoard(boardId: string): BoardLabel[] {
    return Array.from(this.boardLabels.values()).filter((l) => l.board_id === boardId);
  }

  public createBoardLabel(params: { board_id: string; name: string; color: string }): BoardLabel {
    const labelId = this.generateId();
    const label: BoardLabel = {
      id: labelId,
      board_id: params.board_id,
      name: params.name.trim(),
      color: params.color || '#3b82f6',
      created_at: new Date().toISOString(),
    };
    this.boardLabels.set(labelId, label);
    return label;
  }

  public updateBoardLabel(labelId: string, params: { name?: string; color?: string }): BoardLabel | null {
    const label = this.boardLabels.get(labelId);
    if (!label) return null;
    if (params.name !== undefined) label.name = params.name.trim();
    if (params.color !== undefined) label.color = params.color;
    this.boardLabels.set(labelId, label);
    return label;
  }

  public deleteBoardLabel(labelId: string): boolean {
    const exists = this.boardLabels.delete(labelId);
    if (exists) {
      for (const mapping of Array.from(this.cardLabelsMapping)) {
        if (mapping.endsWith(`:${labelId}`)) {
          this.cardLabelsMapping.delete(mapping);
        }
      }
    }
    return exists;
  }

  // =========================================================================
  // CARD & AUDIT METHODS
  // =========================================================================

  public createCard(params: {
    board_id: string;
    list_id: string;
    title: string;
    description?: string;
    priority?: CardPriority;
    due_date?: string | null;
    assigned_to?: string | null;
    google_event_id?: string | null;
    created_by: string;
  }): Card {
    const now = new Date().toISOString();
    const cardId = this.generateId();

    // Compute next position in list
    const existingCardsInList = Array.from(this.cards.values())
      .filter((c) => c.list_id === params.list_id && !c.is_archived)
      .sort((a, b) => a.position - b.position);

    const maxPos = existingCardsInList.length > 0 ? existingCardsInList[existingCardsInList.length - 1].position : 0;
    const position = maxPos + 65535;

    const newCard: Card = {
      id: cardId,
      board_id: params.board_id,
      list_id: params.list_id,
      title: params.title.trim(),
      description: params.description?.trim() || '',
      position,
      priority: params.priority || 'normal',
      due_date: params.due_date || null,
      is_completed: false,
      completed_at: null,
      completed_by: null,
      assigned_to: params.assigned_to || null,
      google_event_id: params.google_event_id || null,
      is_archived: false,
      archived_at: null,
      created_by: params.created_by,
      created_at: now,
      updated_at: now,
    };

    this.cards.set(newCard.id, newCard);

    // Auto add creator to watchers
    this.cardWatchers.add(`${newCard.id}:${params.created_by}`);

    // If assigned to another person, add assignee to watchers
    if (params.assigned_to && params.assigned_to !== params.created_by) {
      this.cardWatchers.add(`${newCard.id}:${params.assigned_to}`);
    }

    // Log creation
    this.logActivity({
      board_id: params.board_id,
      card_id: newCard.id,
      user_id: params.created_by,
      action_type: 'created_card',
      details: { title: newCard.title },
    });

    return this.getHydratedCard(newCard.id)!;
  }

  public updateCardCompletion(
    cardId: string,
    isCompleted: boolean,
    userId: string
  ): Card | null {
    const card = this.cards.get(cardId);
    if (!card) return null;

    const now = new Date().toISOString();
    card.is_completed = isCompleted;
    card.completed_at = isCompleted ? now : null;
    card.completed_by = isCompleted ? userId : null;
    card.updated_at = now;

    this.cards.set(card.id, card);

    // Log explicit audit trail of who completed/reopened it
    this.logActivity({
      board_id: card.board_id,
      card_id: card.id,
      user_id: userId,
      action_type: isCompleted ? 'completed_card' : 'uncompleted_card',
      details: { title: card.title, completed_at: card.completed_at },
    });

    return this.getHydratedCard(cardId);
  }

  public moveCard(params: {
    cardId: string;
    targetListId: string;
    newPosition: number;
    userId: string;
  }): Card | null {
    const card = this.cards.get(params.cardId);
    if (!card) return null;

    const oldList = this.lists.get(card.list_id);
    const newList = this.lists.get(params.targetListId);

    const oldListTitle = oldList?.title || 'Unknown';
    const newListTitle = newList?.title || 'Unknown';

    card.list_id = params.targetListId;
    card.position = params.newPosition;
    card.updated_at = new Date().toISOString();

    // Auto-complete if moved to "Done" column
    if (newListTitle.toLowerCase() === 'done' && !card.is_completed) {
      card.is_completed = true;
      card.completed_at = new Date().toISOString();
      card.completed_by = params.userId;
    }

    this.cards.set(card.id, card);

    this.logActivity({
      board_id: card.board_id,
      card_id: card.id,
      user_id: params.userId,
      action_type: 'moved_card',
      details: {
        from_list: oldListTitle,
        to_list: newListTitle,
        card_title: card.title,
        summary: `moved card "${card.title}" from ${oldListTitle} to ${newListTitle}`,
      },
    });

    return this.getHydratedCard(card.id);
  }

  // =========================================================================
  // CHECKLIST AUDIT TRAIL
  // =========================================================================

  public toggleChecklistItem(itemId: string, isCompleted: boolean, userId: string): CardChecklistItem | null {
    const item = this.cardChecklistItems.get(itemId);
    if (!item) return null;

    const now = new Date().toISOString();
    item.is_completed = isCompleted;
    item.completed_at = isCompleted ? now : null;
    item.completed_by = isCompleted ? userId : null;
    item.updated_at = now;

    this.cardChecklistItems.set(item.id, item);

    const card = this.cards.get(item.card_id);
    if (card) {
      this.logActivity({
        board_id: card.board_id,
        card_id: card.id,
        user_id: userId,
        action_type: isCompleted ? 'completed_checklist_item' : 'uncompleted_checklist_item',
        details: { item_content: item.content, card_title: card.title },
      });
    }

    return item;
  }

  // =========================================================================
  // HYDRATION & DETAILED VIEW
  // =========================================================================

  public getHydratedCard(cardId: string): Card | null {
    const card = this.cards.get(cardId);
    if (!card) return null;

    // Labels
    const labels: BoardLabel[] = [];
    for (const mapping of this.cardLabelsMapping) {
      const [cId, lId] = mapping.split(':');
      if (cId === cardId) {
        const label = this.boardLabels.get(lId);
        if (label) labels.push(label);
      }
    }

    // Watchers
    const watchers: string[] = [];
    for (const watcher of this.cardWatchers) {
      const [cId, uId] = watcher.split(':');
      if (cId === cardId) watchers.push(uId);
    }

    // Checklists
    const checklists = Array.from(this.cardChecklistItems.values())
      .filter((item) => item.card_id === cardId)
      .sort((a, b) => a.position - b.position);

    // Comments
    const comments = Array.from(this.cardComments.values())
      .filter((com) => com.card_id === cardId)
      .map((com) => {
        const user = this.findUserById(com.user_id);
        return {
          ...com,
          user_name: user?.name || 'Unknown User',
          user_avatar: user?.avatar_url,
        };
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Users
    const assignedUser = card.assigned_to ? this.findUserById(card.assigned_to) : null;
    const creatorUser = this.findUserById(card.created_by);
    const completedByUser = card.completed_by ? this.findUserById(card.completed_by) : null;

    const sanitize = (u: User | null | undefined) => {
      if (!u) return null;
      const { password_hash, google_access_token, google_refresh_token, ...safe } = u;
      return safe;
    };

    return {
      ...card,
      labels,
      watchers,
      checklists,
      comments,
      assigned_user: sanitize(assignedUser),
      created_by_user: sanitize(creatorUser),
      completed_by_user: sanitize(completedByUser),
    };
  }

  public logActivity(params: {
    board_id: string;
    card_id?: string | null;
    user_id?: string | null;
    action_type: string;
    details: Record<string, unknown>;
  }): CardActivityLog {
    const user = params.user_id ? this.findUserById(params.user_id) : null;
    const log: CardActivityLog = {
      id: this.generateId(),
      board_id: params.board_id,
      card_id: params.card_id || null,
      user_id: params.user_id || null,
      action_type: params.action_type,
      details: params.details,
      created_at: new Date().toISOString(),
      user_name: user?.name || 'System',
    };

    this.cardActivityLogs.unshift(log); // newest first
    return log;
  }

  // =========================================================================
  // SEED INITIAL HOSPITALITY DATA
  // =========================================================================

  private seedInitialData() {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

    // 1. Admin/Group Owner
    const admin = this.createUser({
      id: '11111111-1111-4111-a111-111111111111',
      name: 'Chef Marcus Vance',
      email: 'admin@grandregency.com',
      password_hash: defaultPasswordHash,
      company: 'Grand Regency Hotel & Resort',
      role: 'Admin/Group Owner',
      avatar_url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80',
    });

    // 2. Manager
    const manager = this.createUser({
      id: '22222222-2222-4222-a222-222222222222',
      name: 'Elena Rostova',
      email: 'manager@grandregency.com',
      password_hash: defaultPasswordHash,
      company: 'Grand Regency Hotel & Resort',
      role: 'Manager',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    });

    // 3. Staff
    const staff = this.createUser({
      id: '33333333-3333-4333-a333-333333333333',
      name: 'Carlos Mendez',
      email: 'staff@grandregency.com',
      password_hash: defaultPasswordHash,
      company: 'Grand Regency Hotel & Resort',
      role: 'Staff',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    });

    // Seed Hospitality Operations Board with custom hospitality operations labels
    const { board, defaultLists, labels } = this.createBoard({
      title: 'Main Kitchen & Banquets - Shift Operations',
      description: 'Daily shift handoffs, prep stations, VIP dietary requirements, and kitchen maintenance.',
      background_value: '#0f172a',
      created_by: admin.id,
      labels: [
        { name: 'VIP Banquet', color: '#e11d48' }, // Rose/Crimson
        { name: 'Dietary / Allergy', color: '#f59e0b' }, // Amber
        { name: 'Kitchen Prep', color: '#2563eb' }, // Blue
        { name: 'HACCP & Sanitation', color: '#059669' }, // Emerald
        { name: 'Beverage & Wine', color: '#7c3aed' }, // Purple
        { name: 'Equipment Maint', color: '#475569' }, // Slate
      ],
    });

    // Add manager & staff to board
    const mId = this.generateId();
    this.boardMembers.set(mId, {
      id: mId,
      board_id: board.id,
      user_id: manager.id,
      role: 'Board Admin',
      invited_by: admin.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const sId = this.generateId();
    this.boardMembers.set(sId, {
      id: sId,
      board_id: board.id,
      user_id: staff.id,
      role: 'Member',
      invited_by: manager.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed Cards
    const brainstormList = defaultLists[0];
    const todayList = defaultLists[1];
    const tomorrowList = defaultLists[2];
    const doneList = defaultLists[3];

    // Card 1: Today - VIP Catering
    const card1 = this.createCard({
      board_id: board.id,
      list_id: todayList.id,
      title: 'Prep 4-Course Tasting Menu for Presidential Suite',
      description: 'VIP Guests arriving at 7:30 PM. Gluten-free substitute required for Course 2 (Seared Scallops).',
      priority: 'urgent',
      due_date: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      assigned_to: manager.id,
      created_by: admin.id,
    });

    // Assign VIP Banquet and Dietary / Allergy labels to Card 1
    const vipLabel = labels.find((l) => l.name === 'VIP Banquet');
    const allergyLabel = labels.find((l) => l.name === 'Dietary / Allergy');
    const prepLabel = labels.find((l) => l.name === 'Kitchen Prep');
    const sanitationLabel = labels.find((l) => l.name === 'HACCP & Sanitation');

    if (vipLabel) this.cardLabelsMapping.add(`${card1.id}:${vipLabel.id}`);
    if (allergyLabel) this.cardLabelsMapping.add(`${card1.id}:${allergyLabel.id}`);

    // Add checklist items to Card 1
    const cl1 = this.generateId();
    this.cardChecklistItems.set(cl1, {
      id: cl1,
      card_id: card1.id,
      content: 'Source fresh scallops from cold room A',
      is_completed: true,
      position: 1,
      created_by: admin.id,
      completed_by: staff.id,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const cl2 = this.generateId();
    this.cardChecklistItems.set(cl2, {
      id: cl2,
      card_id: card1.id,
      content: 'Confirm wine pairings with Sommelier',
      is_completed: false,
      position: 2,
      created_by: admin.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Card 2: Today - Sanitization check
    const card2 = this.createCard({
      board_id: board.id,
      list_id: todayList.id,
      title: 'Deep Sanitization - Walk-in Freezer #2',
      description: 'Health inspection readiness protocol. Ensure temperature logs are logged in binder.',
      priority: 'high',
      due_date: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      assigned_to: staff.id,
      created_by: manager.id,
    });
    if (sanitationLabel) this.cardLabelsMapping.add(`${card2.id}:${sanitationLabel.id}`);

    // Card 3: Tomorrow - Stock delivery
    const card3 = this.createCard({
      board_id: board.id,
      list_id: tomorrowList.id,
      title: 'Receive Fresh Seafood Delivery at Loading Dock 4',
      description: 'Check temperatures upon delivery. Reject shipment if temperature > 4°C.',
      priority: 'normal',
      due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      assigned_to: staff.id,
      created_by: admin.id,
    });
    if (prepLabel) this.cardLabelsMapping.add(`${card3.id}:${prepLabel.id}`);

    // Card 4: Done - Morning briefing
    const card4 = this.createCard({
      board_id: board.id,
      list_id: doneList.id,
      title: 'Conduct Morning Kitchen Line Briefing',
      description: 'Review 86 items, allergies, and 200-cover banquet schedule.',
      priority: 'normal',
      created_by: admin.id,
    });
    if (prepLabel) this.cardLabelsMapping.add(`${card4.id}:${prepLabel.id}`);
    this.updateCardCompletion(card4.id, true, admin.id);
  }
}

export const db = new DatabaseStore();
