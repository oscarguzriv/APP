import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
  NotificationPreferences,
  EmailLog,
  Invitation,
  GlobalUserRole,
  BoardMemberRole,
  CardPriority,
} from './types';

/**
 * MyShift Database Store
 * Implements persistent JSON storage, full data model relationships, constraints,
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
  public invitations: Map<string, Invitation> = new Map();
  public notifications: NotificationItem[] = [];
  public emailLogs: EmailLog[] = [];

  private dataDir = path.resolve(process.cwd(), 'data');
  private dbFilePath = path.join(this.dataDir, 'database.json');

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.users) && data.users.length > 0) {
          this.loadFromData(data);
          this.ensureAdminTestUser();
          console.log(`[DB] Restored persistent database with ${this.users.size} users, ${this.boards.size} boards, ${this.cards.size} cards.`);
          return;
        }
      }
    } catch (err) {
      console.error('[DB] Failed to restore database from file, re-seeding:', err);
    }

    this.seedInitialData();
    this.saveToDisk();
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const data = {
        users: Array.from(this.users.entries()),
        boards: Array.from(this.boards.entries()),
        boardMembers: Array.from(this.boardMembers.entries()),
        boardLabels: Array.from(this.boardLabels.entries()),
        lists: Array.from(this.lists.entries()),
        cards: Array.from(this.cards.entries()),
        cardChecklistItems: Array.from(this.cardChecklistItems.entries()),
        cardComments: Array.from(this.cardComments.entries()),
        cardActivityLogs: this.cardActivityLogs,
        cardLabelsMapping: Array.from(this.cardLabelsMapping),
        cardWatchers: Array.from(this.cardWatchers),
        invitations: Array.from(this.invitations.entries()),
        notifications: this.notifications,
        emailLogs: this.emailLogs,
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to save database to disk:', err);
    }
  }

  private loadFromData(data: any) {
    this.users = new Map(data.users || []);
    this.boards = new Map(data.boards || []);
    this.boardMembers = new Map(data.boardMembers || []);
    this.boardLabels = new Map(data.boardLabels || []);
    this.lists = new Map(data.lists || []);
    this.cards = new Map(data.cards || []);
    this.cardChecklistItems = new Map(data.cardChecklistItems || []);
    this.cardComments = new Map(data.cardComments || []);
    this.cardActivityLogs = data.cardActivityLogs || [];
    this.cardLabelsMapping = new Set(data.cardLabelsMapping || []);
    this.cardWatchers = new Set(data.cardWatchers || []);
    this.invitations = new Map(data.invitations || []);
    this.notifications = data.notifications || [];
    this.emailLogs = data.emailLogs || [];

    // Ensure all loaded cards have image_paths array
    for (const card of this.cards.values()) {
      if (!Array.isArray(card.image_paths)) {
        card.image_paths = [];
      }
    }
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
      notification_preferences: this.getDefaultNotificationPreferences(),
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    this.users.set(newUser.id, newUser);
    this.saveToDisk();
    this.sendWelcomeEmail(newUser);
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

  public addBoardMember(
    boardId: string,
    userId: string,
    role: BoardMemberRole = 'Member',
    invitedBy?: string
  ): BoardMember {
    for (const m of this.boardMembers.values()) {
      if (m.board_id === boardId && m.user_id === userId) {
        m.role = role;
        m.updated_at = new Date().toISOString();
        this.boardMembers.set(m.id, m);
        this.saveToDisk();
        return m;
      }
    }

    const memberId = this.generateId();
    const now = new Date().toISOString();
    const member: BoardMember = {
      id: memberId,
      board_id: boardId,
      user_id: userId,
      role,
      invited_by: invitedBy,
      created_at: now,
      updated_at: now,
    };

    this.boardMembers.set(memberId, member);
    this.saveToDisk();
    return member;
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

    this.saveToDisk();
    return { board, defaultLists: createdLists, labels: createdLabels };
  }

  // =========================================================================
  // LABEL METHODS
  // =========================================================================

  public getLabelsForBoard(boardId: string): BoardLabel[] {
    return Array.from(this.boardLabels.values()).filter((l) => l.board_id === boardId);
  }

  public getLabelsForCard(cardId: string): BoardLabel[] {
    const labels: BoardLabel[] = [];
    for (const mapping of this.cardLabelsMapping) {
      const [cId, lId] = mapping.split(':');
      if (cId === cardId) {
        const label = this.boardLabels.get(lId);
        if (label) labels.push(label);
      }
    }
    return labels;
  }

  public getActivityLogsForBoard(boardId: string): CardActivityLog[] {
    return this.cardActivityLogs.filter((log) => log.board_id === boardId);
  }

  public createList(params: { board_id: string; title: string; position?: number; created_by?: string }): List {
    const listId = this.generateId();
    const existingLists = Array.from(this.lists.values()).filter(l => l.board_id === params.board_id && !l.is_archived);
    const position = params.position !== undefined ? params.position : (existingLists.length > 0 ? Math.max(...existingLists.map(l => l.position)) + 1000 : 1000);
    const now = new Date().toISOString();

    const list: List = {
      id: listId,
      board_id: params.board_id,
      title: params.title.trim() || 'New List',
      position,
      is_archived: false,
      created_by: params.created_by || '',
      created_at: now,
      updated_at: now,
    };

    this.lists.set(listId, list);
    this.saveToDisk();
    return list;
  }

  public updateList(listId: string, params: { title?: string; position?: number }): List | null {
    const list = this.lists.get(listId);
    if (!list) return null;
    const now = new Date().toISOString();
    if (params.title !== undefined) list.title = params.title.trim();
    if (params.position !== undefined) list.position = params.position;
    list.updated_at = now;
    this.lists.set(listId, list);
    this.saveToDisk();
    return list;
  }

  public deleteList(listId: string): boolean {
    const list = this.lists.get(listId);
    if (!list) return false;
    for (const card of Array.from(this.cards.values())) {
      if (card.list_id === listId) {
        this.deleteCard(card.id, list.created_by || 'system');
      }
    }
    const deleted = this.lists.delete(listId);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public importTrelloBoard(userId: string, trelloData: any): { board: Board; lists: List[]; labels: BoardLabel[] } {
    const boardName = trelloData.name || 'Imported Trello Board';
    const boardDesc = trelloData.desc || '';
    
    const boardResult = this.createBoard({
      title: boardName,
      description: boardDesc,
      created_by: userId,
    });

    const boardId = boardResult.board.id;

    for (const defList of boardResult.defaultLists) {
      this.lists.delete(defList.id);
    }
    if (Array.isArray(trelloData.labels) && trelloData.labels.length > 0) {
      for (const defLbl of boardResult.labels) {
        this.boardLabels.delete(defLbl.id);
      }
    }

    const listMap = new Map<string, string>();
    if (Array.isArray(trelloData.lists)) {
      trelloData.lists.forEach((tList: any, idx: number) => {
        if (tList.closed) return;
        const created = this.createList({
          board_id: boardId,
          title: tList.name || 'List',
          position: (idx + 1) * 1000,
        });
        listMap.set(tList.id, created.id);
      });
    }

    if (listMap.size === 0) {
      const fallback = this.createList({ board_id: boardId, title: 'Tasks', position: 1000 });
      listMap.set('default', fallback.id);
    }

    const labelMap = new Map<string, string>();
    if (Array.isArray(trelloData.labels)) {
      trelloData.labels.forEach((tLbl: any) => {
        const colorMap: Record<string, string> = {
          green: '#10b981',
          yellow: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
          purple: '#8b5cf6',
          blue: '#3b82f6',
          sky: '#0ea5e9',
          lime: '#84cc16',
          pink: '#ec4899',
          black: '#1e293b',
        };
        const color = colorMap[tLbl.color] || '#3b82f6';
        const created = this.createBoardLabel({
          board_id: boardId,
          name: tLbl.name || tLbl.color || 'Label',
          color,
        });
        labelMap.set(tLbl.id, created.id);
      });
    }

    if (Array.isArray(trelloData.cards)) {
      trelloData.cards.forEach((tCard: any) => {
        if (tCard.closed) return;
        const targetListId = listMap.get(tCard.idList) || Array.from(listMap.values())[0];
        if (!targetListId) return;

        const createdCard = this.createCard({
          board_id: boardId,
          list_id: targetListId,
          title: tCard.name || 'Card',
          description: tCard.desc || '',
          priority: 'normal',
          due_date: tCard.due || null,
          created_by: userId,
        });

        if (Array.isArray(tCard.idLabels)) {
          for (const tLblId of tCard.idLabels) {
            const myLblId = labelMap.get(tLblId);
            if (myLblId) {
              this.cardLabelsMapping.add(`${createdCard.id}:${myLblId}`);
            }
          }
        }
      });
    }

    this.saveToDisk();

    const finalLists = Array.from(this.lists.values()).filter(l => l.board_id === boardId && !l.is_archived).sort((a,b) => a.position - b.position);
    const finalLabels = Array.from(this.boardLabels.values()).filter(l => l.board_id === boardId);

    return {
      board: boardResult.board,
      lists: finalLists,
      labels: finalLabels,
    };
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
    this.saveToDisk();
    return label;
  }

  public updateBoardLabel(labelId: string, params: { name?: string; color?: string }): BoardLabel | null {
    const label = this.boardLabels.get(labelId);
    if (!label) return null;
    if (params.name !== undefined) label.name = params.name.trim();
    if (params.color !== undefined) label.color = params.color;
    this.boardLabels.set(labelId, label);
    this.saveToDisk();
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
      this.saveToDisk();
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
      image_paths: [],
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

    this.saveToDisk();
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

    this.saveToDisk();
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
    if (!newList || newList.board_id !== card.board_id) {
      throw new Error('Relational Integrity Violation: Target list does not belong to the same board as the card.');
    }

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

    this.saveToDisk();
    return this.getHydratedCard(card.id);
  }

  public deleteCard(cardId: string, userId: string): { success: boolean; card: Card } | null {
    const card = this.cards.get(cardId);
    if (!card) return null;

    // Delete associated checklist items
    for (const [key, item] of this.cardChecklistItems.entries()) {
      if (item.card_id === cardId) {
        this.cardChecklistItems.delete(key);
      }
    }

    // Delete associated comments
    for (const [key, comment] of this.cardComments.entries()) {
      if (comment.card_id === cardId) {
        this.cardComments.delete(key);
      }
    }

    // Delete label mappings
    for (const mapping of Array.from(this.cardLabelsMapping)) {
      if (mapping.startsWith(`${cardId}:`)) {
        this.cardLabelsMapping.delete(mapping);
      }
    }

    // Delete watchers
    for (const watcher of Array.from(this.cardWatchers)) {
      if (watcher.startsWith(`${cardId}:`)) {
        this.cardWatchers.delete(watcher);
      }
    }

    // Remove card
    this.cards.delete(cardId);

    // Log activity
    this.logActivity({
      board_id: card.board_id,
      card_id: null,
      user_id: userId,
      action_type: 'deleted_card',
      details: {
        card_id: cardId,
        title: card.title,
        summary: `deleted task "${card.title}"`,
      },
    });

    this.saveToDisk();
    return { success: true, card };
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

    this.saveToDisk();
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
      image_paths: Array.isArray(card.image_paths) ? card.image_paths : [],
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
    this.saveToDisk();
    return log;
  }

  // =========================================================================
  // CARD IMAGES (Strict max 5 local paths in /uploads, no Base64 in JSON)
  // =========================================================================

  public addCardImage(cardId: string, imagePath: string, userId: string): Card | null {
    const card = this.cards.get(cardId);
    if (!card) return null;

    if (!Array.isArray(card.image_paths)) {
      card.image_paths = [];
    }

    if (card.image_paths.length >= 5) {
      throw new Error('Maximum of 5 photos reached for this card.');
    }

    card.image_paths.push(imagePath);
    card.updated_at = new Date().toISOString();
    this.cards.set(cardId, card);

    this.logActivity({
      board_id: card.board_id,
      card_id: card.id,
      user_id: userId,
      action_type: 'image_uploaded',
      details: {
        card_title: card.title,
        image_path: imagePath,
        total_images: card.image_paths.length,
      },
    });

    this.saveToDisk();
    return this.getHydratedCard(cardId);
  }

  public removeCardImage(cardId: string, imagePath: string, userId: string): Card | null {
    const card = this.cards.get(cardId);
    if (!card) return null;

    if (!Array.isArray(card.image_paths)) {
      card.image_paths = [];
    }

    card.image_paths = card.image_paths.filter((p) => p !== imagePath);
    card.updated_at = new Date().toISOString();
    this.cards.set(cardId, card);

    this.logActivity({
      board_id: card.board_id,
      card_id: card.id,
      user_id: userId,
      action_type: 'image_removed',
      details: {
        card_title: card.title,
        image_path: imagePath,
        total_images: card.image_paths.length,
      },
    });

    this.saveToDisk();
    return this.getHydratedCard(cardId);
  }

  // =========================================================================
  // HOSPITALITY ONBOARDING & QR CODE INVITATIONS
  // =========================================================================

  public createInvitation(params: {
    board_id: string;
    role?: BoardMemberRole;
    created_by: string;
    expires_in_hours?: number;
    max_uses?: number;
  }): Invitation | null {
    const board = this.boards.get(params.board_id);
    if (!board) return null;

    const token = crypto.randomBytes(16).toString('hex');
    const expiresInHours = params.expires_in_hours || 72; // default 72h
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
    const id = this.generateId();

    const inviter = this.findUserById(params.created_by);

    const invitation: Invitation = {
      id,
      token,
      board_id: params.board_id,
      role: params.role || 'Member',
      created_by: params.created_by,
      expires_at: expiresAt,
      is_revoked: false,
      max_uses: params.max_uses,
      used_count: 0,
      created_at: new Date().toISOString(),
      board_title: board.title,
      inviter_name: inviter?.name || 'Shift Manager',
    };

    this.invitations.set(id, invitation);
    this.saveToDisk();
    return invitation;
  }

  public getInvitationByToken(token: string): Invitation | null {
    for (const inv of this.invitations.values()) {
      if (inv.token === token) {
        const board = this.boards.get(inv.board_id);
        const inviter = this.findUserById(inv.created_by);
        return {
          ...inv,
          board_title: board?.title || 'Hospitality Board',
          inviter_name: inviter?.name || 'Shift Manager',
        };
      }
    }
    return null;
  }

  public getBoardInvitations(boardId: string): Invitation[] {
    const list: Invitation[] = [];
    const now = new Date();
    for (const inv of this.invitations.values()) {
      if (inv.board_id === boardId && !inv.is_revoked && new Date(inv.expires_at) > now) {
        list.push(inv);
      }
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public revokeInvitation(invitationId: string): boolean {
    const inv = this.invitations.get(invitationId);
    if (!inv) return false;
    inv.is_revoked = true;
    this.invitations.set(invitationId, inv);
    this.saveToDisk();
    return true;
  }

  public redeemInvitation(token: string, userId: string): { success: boolean; board_id?: string; error?: string } {
    const inv = this.getInvitationByToken(token);
    if (!inv) {
      return { success: false, error: 'Invalid invitation token.' };
    }
    if (inv.is_revoked) {
      return { success: false, error: 'This invitation has been revoked.' };
    }
    if (new Date(inv.expires_at) <= new Date()) {
      return { success: false, error: 'This invitation link has expired.' };
    }
    if (inv.max_uses && inv.used_count >= inv.max_uses) {
      return { success: false, error: 'This invitation has reached its maximum uses.' };
    }

    // Add user to board if not already member
    const existingRole = this.getBoardMembership(inv.board_id, userId);
    if (!existingRole) {
      this.addBoardMember(inv.board_id, userId, inv.role, inv.created_by);
    }

    inv.used_count += 1;
    this.invitations.set(inv.id, inv);
    this.saveToDisk();

    return { success: true, board_id: inv.board_id };
  }

  public ensureAdminTestUser() {
    const adminPasswordHash = bcrypt.hashSync('admin', 10);
    let admin = this.findUserByEmail('admin@test.com');
    if (!admin) {
      const existing = this.findUserByEmail('admin@grandregency.com') || Array.from(this.users.values()).find(u => u.role === 'Admin/Group Owner');
      if (existing) {
        existing.email = 'admin@test.com';
        existing.password_hash = adminPasswordHash;
        this.users.set(existing.id, existing);
      } else {
        admin = this.createUser({
          id: '11111111-1111-4111-a111-111111111111',
          name: 'Chef Marcus Vance',
          email: 'admin@test.com',
          password_hash: adminPasswordHash,
          company: 'Grand Regency Hotel & Resort',
          role: 'Admin/Group Owner',
          avatar_url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80',
        });
      }
      this.saveToDisk();
    } else {
      admin.password_hash = adminPasswordHash;
      this.users.set(admin.id, admin);
      this.saveToDisk();
    }
  }

  // =========================================================================
  // SEED INITIAL HOSPITALITY DATA
  // =========================================================================

  private seedInitialData() {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);
    const adminPasswordHash = bcrypt.hashSync('admin', 10);

    // 1. Admin/Group Owner (Test Account: admin@test.com / admin)
    const admin = this.createUser({
      id: '11111111-1111-4111-a111-111111111111',
      name: 'Chef Marcus Vance',
      email: 'admin@test.com',
      password_hash: adminPasswordHash,
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

  public getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      inapp_mention_description: true,
      inapp_mention_comment: true,
      inapp_card_modification: true,
      email_mention_description: true,
      email_mention_comment: true,
      email_card_modification: true,
      email_welcome: true,
      email_password_reset: true,
    };
  }

  public sendSimulatedEmail(recipientEmail: string, recipientName: string, subject: string, bodyHtml: string, type: string) {
    const emailLog: EmailLog = {
      id: this.generateId(),
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject,
      body_html: bodyHtml,
      type,
      sent_at: new Date().toISOString(),
    };
    this.emailLogs.push(emailLog);
    this.saveToDisk();
    console.log(`[Email Simulator] Sent "${subject}" to ${recipientEmail}`);
  }

  public sendWelcomeEmail(user: User) {
    const prefs = { ...this.getDefaultNotificationPreferences(), ...(user.notification_preferences || {}) };
    if (prefs.email_welcome) {
      this.sendSimulatedEmail(
        user.email,
        user.name,
        'Welcome to RoxCrew - Crew & Task Operations',
        `<div style="font-family:sans-serif;padding:20px;color:#333;"><h2>Welcome to RoxCrew, ${user.name}!</h2><p>Your account has been successfully created with ${user.company}. You can now manage shift operations, tasks, and team handoffs seamlessly.</p></div>`,
        'welcome'
      );
    }
  }

  public sendPasswordResetEmail(user: User, resetToken: string) {
    const prefs = { ...this.getDefaultNotificationPreferences(), ...(user.notification_preferences || {}) };
    if (prefs.email_password_reset) {
      this.sendSimulatedEmail(
        user.email,
        user.name,
        'Password Reset Request - RoxCrew',
        `<div style="font-family:sans-serif;padding:20px;color:#333;"><h2>Password Reset</h2><p>Hello ${user.name}, we received a request to reset your password. Use the following reset token:</p><p><b>Token:</b> ${resetToken}</p></div>`,
        'password_reset'
      );
    }
  }

  public createNotification(params: {
    user_id: string;
    title: string;
    message: string;
    type: 'mention_description' | 'mention_comment' | 'card_modification' | 'system';
    board_id?: string;
    card_id?: string;
  }) {
    const user = this.findUserById(params.user_id);
    if (!user) return;
    const prefs = { ...this.getDefaultNotificationPreferences(), ...(user.notification_preferences || {}) };

    let inAppEnabled = true;
    let emailEnabled = true;
    if (params.type === 'mention_description') {
      inAppEnabled = prefs.inapp_mention_description;
      emailEnabled = prefs.email_mention_description;
    } else if (params.type === 'mention_comment') {
      inAppEnabled = prefs.inapp_mention_comment;
      emailEnabled = prefs.email_mention_comment;
    } else if (params.type === 'card_modification') {
      inAppEnabled = prefs.inapp_card_modification;
      emailEnabled = prefs.email_card_modification;
    }

    if (inAppEnabled) {
      const notif: NotificationItem = {
        id: this.generateId(),
        user_id: params.user_id,
        board_id: params.board_id || null,
        card_id: params.card_id || null,
        actor_id: null,
        title: params.title,
        message: params.message,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      this.notifications.push(notif);
    }

    if (emailEnabled) {
      this.sendSimulatedEmail(
        user.email,
        user.name,
        params.title,
        `<div style="font-family:sans-serif;padding:20px;color:#333;"><h3>${params.title}</h3><p>${params.message}</p></div>`,
        params.type
      );
    }

    this.saveToDisk();
  }

  public parseAndTriggerMentions(text: string, boardId: string, cardId: string, actorId: string, isComment: boolean) {
    if (!text) return;
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    let match;
    const mentionedTags = new Set<string>();
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedTags.add(match[1].toLowerCase());
    }

    if (mentionedTags.size === 0) return;

    const actor = this.findUserById(actorId);
    const card = this.cards.get(cardId);
    const board = this.boards.get(boardId);

    for (const user of this.users.values()) {
      if (user.id === actorId) continue;
      const nameLower = user.name.toLowerCase();
      const firstName = nameLower.split(' ')[0];
      const nameSlug = nameLower.replace(/\s+/g, '');
      const emailPrefix = user.email.split('@')[0].toLowerCase();

      let isMatched = false;
      for (const tag of mentionedTags) {
        if (
          nameLower === tag ||
          nameSlug === tag ||
          firstName === tag ||
          emailPrefix === tag ||
          nameLower.includes(tag) ||
          tag.includes(firstName)
        ) {
          isMatched = true;
          break;
        }
      }

      if (isMatched) {
        const type = isComment ? 'mention_comment' : 'mention_description';
        const title = isComment ? `New mention in comment (${board?.title || 'Board'})` : `New mention in task (${board?.title || 'Board'})`;
        const message = `${actor?.name || 'Someone'} mentioned you in "${card?.title || 'a task'}": "${text.substring(0, 80)}..."`;

        this.createNotification({
          user_id: user.id,
          title,
          message,
          type,
          board_id: boardId,
          card_id: cardId,
        });
      }
    }
  }

  public triggerCardModification(cardId: string, actorId: string, changeDescription: string) {
    const card = this.cards.get(cardId);
    if (!card) return;
    const board = this.boards.get(card.board_id);
    const actor = this.findUserById(actorId);

    const recipientIds = new Set<string>();
    if (card.created_by && card.created_by !== actorId) recipientIds.add(card.created_by);
    if (card.assigned_to && card.assigned_to !== actorId) recipientIds.add(card.assigned_to);

    for (const watcher of this.cardWatchers) {
      const [cId, uId] = watcher.split(':');
      if (cId === cardId && uId !== actorId) {
        recipientIds.add(uId);
      }
    }

    for (const rId of recipientIds) {
      this.createNotification({
        user_id: rId,
        title: `Task Updated (${board?.title || 'Board'})`,
        message: `${actor?.name || 'Someone'} updated task "${card.title}": ${changeDescription}`,
        type: 'card_modification',
        board_id: card.board_id,
        card_id: cardId,
      });
    }
  }
}

export const db = new DatabaseStore();
