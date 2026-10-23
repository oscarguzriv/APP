export type GlobalUserRole = 'Admin/Group Owner' | 'Manager' | 'Staff';
export type BoardMemberRole = 'Board Admin' | 'Member' | 'Viewer';
export type CardPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  company: string;
  role: GlobalUserRole;
  avatar_url?: string;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expires_at?: string | null;
  google_calendar_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash' | 'google_access_token' | 'google_refresh_token'>;

export interface JWTPayload {
  userId: string;
  email: string;
  role: GlobalUserRole;
  company: string;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  background_value: string;
  background_style?: 'cover' | 'repeat';
  is_closed: boolean;
  closed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardMemberRole;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BoardLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CardChecklistItem {
  id: string;
  card_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  created_by: string;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardComment {
  id: string;
  card_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description?: string;
  position: number;
  priority: CardPriority;
  due_date?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  assigned_to?: string | null;
  google_event_id?: string | null;
  is_archived: boolean;
  archived_at?: string | null;
  image_paths: string[]; // Maximum 5 local file paths in /uploads
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed / Joined details
  labels?: BoardLabel[];
  watchers?: string[]; // user IDs
  checklists?: CardChecklistItem[];
  comments?: CardComment[];
  assigned_user?: SafeUser | null;
  created_by_user?: SafeUser | null;
  completed_by_user?: SafeUser | null;
}

export interface Invitation {
  id: string;
  token: string;
  board_id: string;
  role: BoardMemberRole;
  created_by: string;
  expires_at: string;
  is_revoked: boolean;
  max_uses?: number;
  used_count: number;
  created_at: string;
  board_title?: string;
  inviter_name?: string;
}

export interface CardActivityLog {
  id: string;
  board_id: string;
  card_id?: string | null;
  user_id?: string | null;
  action_type: string;
  details: Record<string, unknown>;
  created_at: string;
  user_name?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  board_id?: string | null;
  card_id?: string | null;
  actor_id?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

