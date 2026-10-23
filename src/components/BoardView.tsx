import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api.ts';
import Footer from './Footer.tsx';
import { io, Socket } from 'socket.io-client';
import {
  ChevronLeft,
  Users,
  Calendar,
  Filter,
  Share2,
  MoreVertical,
  Plus,
  CheckCircle2,
  Clock,
  Eye,
  Tag,
  AlertCircle,
  FileSpreadsheet,
  Gauge,
  Copy,
  LogOut,
  Palette,
  MessageSquare,
  CheckSquare,
  CalendarSync,
  X,
  Search,
  SlidersHorizontal,
  Flame,
  Check,
  Building2,
  Sparkles,
  Pencil,
  Trash2,
  Layout,
  Table,
  History,
  UserPlus,
  Shield,
  Camera,
  QrCode,
  Archive,
} from 'lucide-react';
import CardModal from './CardModal.tsx';
import HospitalityInviteModal from './HospitalityInviteModal.tsx';
import { ToastContainer, ToastMessage } from './Toast.tsx';

interface SafeUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  avatar_url?: string;
}

interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: 'Board Admin' | 'Member' | 'Viewer';
  user_name: string;
  user_email: string;
  user_role: string;
  user_avatar?: string;
}

interface BoardLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
  is_archived: boolean;
  created_by: string;
}

interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description?: string;
  position: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  assigned_to?: string | null;
  google_event_id?: string | null;
  is_archived: boolean;
  image_paths?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  labels?: BoardLabel[];
  watchers?: string[];
  checklists?: any[];
  comments?: any[];
  assigned_user?: SafeUser | null;
  created_by_user?: SafeUser | null;
  completed_by_user?: SafeUser | null;
}

interface BoardViewProps {
  boardId: string;
  currentUser: SafeUser;
  onBackToDashboard: () => void;
  onLogout?: () => void;
}

export default function BoardView({ boardId, currentUser, onBackToDashboard, onLogout }: BoardViewProps) {
  // Board & State Data
  const [board, setBoard] = useState<any>(null);
  const [userRole, setUserRole] = useState<'Board Admin' | 'Member' | 'Viewer'>('Member');
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [labels, setLabels] = useState<BoardLabel[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time socket & presence
  const socketRef = useRef<Socket | null>(null);
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);

  // View Layout: 'kanban' | 'table' | 'calendar'
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'calendar'>('kanban');

  // Active Modals & Popovers
  const [activeCardModal, setActiveCardModal] = useState<Card | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isArchivedCardsModalOpen, setIsArchivedCardsModalOpen] = useState(false);
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [wallpaperMode, setWallpaperMode] = useState<'repeat' | 'cover'>('repeat');
  const [selectedWallpaperFile, setSelectedWallpaperFile] = useState<File | null>(null);

  // Quick Card Add state per column
  const [addingCardInListId, setAddingCardInListId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  // Column renaming state
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');

  // Board title editing
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false);
  const [boardTitleInput, setBoardTitleInput] = useState('');

  // Drag-and-drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Column management states & handlers
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  const isBoardCreator = board?.created_by === currentUser.id;
  const canEditColumns = isBoardCreator || userRole === 'Board Admin' || currentUser.role === 'Admin/Group Owner' || currentUser.role === 'Manager';
  const canManageColumns = currentUser.role === 'Admin/Group Owner' || currentUser.role === 'Manager' || userRole === 'Board Admin' || canEditColumns;

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim() || !canManageColumns) return;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ title: newColumnTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setLists((prev) => [...prev, data.list]);
        setNewColumnTitle('');
        setIsAddingColumn(false);
        showToast({ title: 'Column Added', message: `"${data.list.title}" column created.`, type: 'success' });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create column');
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Could not add column.', type: 'error' });
    }
  };

  const handleDeleteColumn = async (listId: string) => {
    if (!canManageColumns) return;
    if (!confirm('Are you sure you want to delete this column and all tasks inside it?')) return;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/lists/${listId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLists((prev) => prev.filter((l) => l.id !== listId));
        setCards((prev) => prev.filter((c) => c.list_id !== listId));
        showToast({ title: 'Column Deleted', message: 'Column removed from board.', type: 'success' });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete column');
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Could not delete column.', type: 'error' });
    }
  };

  // WIP Limits (in-memory per column title)
  const [wipLimits, setWipLimits] = useState<Record<string, number>>({
    Today: 6,
    Tomorrow: 10,
  });

  // Label Management Modal state
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');
  const [editingLabelColor, setEditingLabelColor] = useState('');
  const [confirmDeleteBoardLabelId, setConfirmDeleteBoardLabelId] = useState<string | null>(null);

  const LABEL_PRESET_COLORS = [
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b', // Slate
  ];

  // Directory users & Invitation / User Creation
  const [companyDirectory, setCompanyDirectory] = useState<SafeUser[]>([]);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<'Board Admin' | 'Member' | 'Viewer'>('Member');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // New user creation tab state (Admin/Manager)
  const [shareTab, setShareTab] = useState<'existing' | 'new'>('existing');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Admin/Group Owner' | 'Manager' | 'Staff'>('Staff');
  const [newUserBoardRole, setNewUserBoardRole] = useState<'Board Admin' | 'Member' | 'Viewer'>('Member');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserSuccess, setNewUserSuccess] = useState<string | null>(null);
  const [confirmDeleteLabelId, setConfirmDeleteLabelId] = useState<string | null>(null);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast Notification Helper
  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // =========================================================================
  // INITIAL DATA & WEBSOCKET SETUP
  // =========================================================================

  const fetchBoardData = async () => {
    try {
      const res = await apiFetch(`/api/boards/${boardId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch board details');
      }
      const data = await res.json();
      setBoard(data.board);
      setUserRole(data.userRole || 'Member');
      setLists(data.lists || []);
      setCards(data.cards || []);
      setArchivedCards(data.archivedCards || []);
      setMembers(data.members || []);
      setLabels(data.labels || []);
      setActivityLogs(data.activityLogs || []);
      setBoardTitleInput(data.board?.title || '');
    } catch (err) {
      console.error('Error fetching board:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();

    // Fetch company directory for invitations
    apiFetch('/api/users/directory')
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setCompanyDirectory(data.users);
      })
      .catch((err) => console.error(err));

    // Initialize Socket.io connection for real-time collaboration
    const socket = io({
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected, joining board:', boardId);
      socket.emit('join:board', { boardId });
    });

    // Real-Time Presence
    socket.on('board:presence', ({ activeUserIds }: { activeUserIds: string[] }) => {
      setActiveUserIds(activeUserIds || []);
    });

    // Real-Time Card Moved
    socket.on('card:moved', ({ card }: { card: Card }) => {
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    });

    // Real-Time Card Created
    socket.on('card:created', ({ card }: { card: Card }) => {
      setCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev;
        return [...prev, card];
      });
    });

    // Real-Time Card Updated
    socket.on('card:updated', ({ card }: { card: Card }) => {
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
      if (activeCardModal && activeCardModal.id === card.id) {
        setActiveCardModal(card);
      }
    });

    // Real-Time Card Deleted
    socket.on('card:deleted', ({ cardId }: { cardId: string }) => {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    });

    // Real-Time Activity Log
    socket.on('board:activity', ({ log }: { log: any }) => {
      setActivityLogs((prev) => [log, ...prev]);
    });

    // Real-Time Column Renamed
    socket.on('list:updated', ({ list }: { list: List }) => {
      setLists((prev) => prev.map((l) => (l.id === list.id ? list : l)));
    });

    // Real-Time Board Labels Updated
    socket.on('labels:updated', ({ labels: updatedLabels }: { labels: BoardLabel[] }) => {
      setLabels(updatedLabels);
      setCards((prevCards) =>
        prevCards.map((c) => ({
          ...c,
          labels: (c.labels || [])
            .filter((l) => updatedLabels.some((nl) => nl.id === l.id))
            .map((l) => updatedLabels.find((nl) => nl.id === l.id) || l),
        }))
      );
      setActiveCardModal((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          labels: (prev.labels || [])
            .filter((l) => updatedLabels.some((nl) => nl.id === l.id))
            .map((l) => updatedLabels.find((nl) => nl.id === l.id) || l),
        };
      });
    });

    // Real-Time Board Members Updated
    socket.on('members:updated', ({ member, user }: any) => {
      if (user && member) {
        const memberWithUser = {
          ...member,
          user_name: user.name,
          user_email: user.email,
          user_role: user.role,
          user_avatar: user.avatar_url,
        };
        setMembers((prev) => {
          if (prev.some((m) => m.user_id === user.id)) {
            return prev.map((m) => m.user_id === user.id ? memberWithUser : m);
          }
          return [...prev, memberWithUser];
        });
      } else {
        fetchBoardData();
      }
    });

    return () => {
      socket.emit('leave:board', { boardId });
      socket.disconnect();
    };
  }, [boardId]);

  // Save Column Title (Board Creator / Admin)
  const handleSaveListTitle = async (listId: string) => {
    if (!editingListTitle.trim()) {
      setEditingListId(null);
      return;
    }
    const nextTitle = editingListTitle.trim();
    setEditingListId(null);

    // Optimistically update
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title: nextTitle } : l)));

    try {
      const res = await apiFetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: nextTitle }),
      });
      if (res.ok) {
        const data = await res.json();
        setLists((prev) => prev.map((l) => (l.id === listId ? data.list : l)));
      }
    } catch (err) {
      console.error('Failed to rename column:', err);
    }
  };

  // =========================================================================
  // LABEL MUTATIONS (ANY USER WITH BOARD ACCESS)
  // =========================================================================

  const handleCreateLabel = async (name: string, color: string): Promise<BoardLabel | null> => {
    if (!name.trim()) return null;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels);
        return data.label;
      }
    } catch (err) {
      console.error('Failed to create label:', err);
    }
    return null;
  };

  const handleUpdateLabel = async (labelId: string, name: string, color: string) => {
    if (!name.trim()) return;
    try {
      const res = await apiFetch(`/api/boards/${boardId}/labels/${labelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels);
        setCards((prevCards) =>
          prevCards.map((c) => ({
            ...c,
            labels: (c.labels || []).map((l) => (l.id === labelId ? data.label : l)),
          }))
        );
        if (activeCardModal) {
          setActiveCardModal((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              labels: (prev.labels || []).map((l) => (l.id === labelId ? data.label : l)),
            };
          });
        }
      }
    } catch (err) {
      console.error('Failed to update label:', err);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      const res = await apiFetch(`/api/boards/${boardId}/labels/${labelId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels);
        setCards((prevCards) =>
          prevCards.map((c) => ({
            ...c,
            labels: (c.labels || []).filter((l) => l.id !== labelId),
          }))
        );
        if (activeCardModal) {
          setActiveCardModal((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              labels: (prev.labels || []).filter((l) => l.id !== labelId),
            };
          });
        }
      }
    } catch (err) {
      console.error('Failed to delete label:', err);
    }
  };

  // =========================================================================
  // CARD MUTATIONS & QUICK ACTIONS
  // =========================================================================

  // Quick Check Mark as Complete
  const handleQuickComplete = async (e: React.MouseEvent, card: Card) => {
    e.stopPropagation();
    try {
      const nextCompleted = !card.is_completed;
      const res = await apiFetch(`/api/cards/${card.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: nextCompleted }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards((prev) => prev.map((c) => (c.id === card.id ? data.card : c)));
      }
    } catch (err) {
      console.error('Quick complete error:', err);
    }
  };

  // Quick Date Change
  const handleQuickDateChange = async (cardId: string, newDate: string) => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ due_date: newDate ? new Date(newDate).toISOString() : null }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)));
      }
    } catch (err) {
      console.error('Quick date change error:', err);
    }
  };

  // Restore archived card
  const handleRestoreCard = async (cardId: string) => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}/unarchive`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
        if (data.card) {
          setCards((prev) => [...prev, data.card]);
        }
        showToast({ title: 'Task Restored', message: data.message || 'Task returned to board.', type: 'success' });
      }
    } catch (err) {
      console.error('Failed to unarchive card:', err);
    }
  };

  const handleUpdateBackground = async (colorOrGradient: string) => {
    try {
      const res = await apiFetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ background_value: colorOrGradient }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        showToast({ title: 'Theme Updated', message: 'Board background updated instantly.', type: 'success' });
        setIsBackgroundModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to update background:', err);
    }
  };

  const uploadWallpaperFile = async (file: File, mode: 'cover' | 'repeat') => {
    if (file.size > 1 * 1024 * 1024) {
      showToast({ title: 'File Too Large', message: 'Wallpaper image must be under 1MB.', type: 'error' });
      return;
    }
    const formData = new FormData();
    formData.append('wallpaper', file);
    formData.append('mode', mode);

    try {
      const res = await apiFetch(`/api/boards/${boardId}/wallpaper`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        showToast({ title: 'Wallpaper Updated', message: 'Board wallpaper successfully uploaded.', type: 'success' });
        setIsBackgroundModalOpen(false);
        setSelectedWallpaperFile(null);
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload wallpaper');
      }
    } catch (err: any) {
      showToast({ title: 'Upload Error', message: err.message || 'Could not upload wallpaper.', type: 'error' });
    }
  };

  // Quick Card Create in List
  const handleCreateCard = async (listId: string) => {
    if (isCreatingCard || !newCardTitle.trim()) return;

    setIsCreatingCard(true);
    const titleToCreate = newCardTitle.trim();

    try {
      const res = await apiFetch('/api/cards/new', {
        method: 'POST',
        body: JSON.stringify({
          board_id: boardId,
          list_id: listId,
          title: titleToCreate,
          socketId: socketRef.current?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdCard = data.card;
        setCards((prev) => {
          if (prev.some((c) => c.id === createdCard.id)) return prev;
          return [...prev, createdCard];
        });
        setNewCardTitle('');
        setAddingCardInListId(null);

        const listObj = lists.find((l) => l.id === listId);
        showToast({
          type: 'success',
          title: 'Task Created',
          message: `"${createdCard.title}" added to ${listObj?.title || 'column'}.`,
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create task');
      }
    } catch (err: any) {
      console.error('Failed to create card:', err);
      showToast({
        type: 'error',
        title: 'Task Creation Failed',
        message: err.message || 'Could not create task. Please try again.',
      });
    } finally {
      setIsCreatingCard(false);
    }
  };

  // Delete Card Permanently
  const handleDeleteCard = async (cardId: string, cardTitle: string) => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete task');
      }

      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (activeCardModal && activeCardModal.id === cardId) {
        setActiveCardModal(null);
      }

      showToast({
        type: 'delete',
        title: 'Task Deleted',
        message: `"${cardTitle}" has been removed from the board.`,
      });
    } catch (err: any) {
      console.error('Failed to delete card:', err);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete task',
      });
    }
  };

  // Update Board Title
  const handleSaveBoardTitle = async () => {
    setIsEditingBoardTitle(false);
    if (!boardTitleInput.trim() || boardTitleInput === board?.title) return;

    try {
      const res = await apiFetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: boardTitleInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
      }
    } catch (err) {
      console.error('Failed to update board title:', err);
    }
  };

  // Invite Member to Board
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUserId) return;
    setInviteError(null);

    try {
      const res = await apiFetch(`/api/boards/${boardId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: inviteUserId, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite member');
      }
      setIsShareModalOpen(false);
      setInviteUserId('');

      const invitedUser = companyDirectory.find((u) => u.id === inviteUserId);
      showToast({
        type: 'success',
        title: 'Member Added to Board',
        message: `${invitedUser?.name || 'User'} has been invited as ${inviteRole}.`,
      });

      fetchBoardData(); // refresh member list
    } catch (err: any) {
      console.error('Failed to invite member:', err);
      setInviteError(err.message || 'Failed to invite member');
    }
  };

  // Create New User & Add to Board (Admin or Manager)
  const handleCreateUserAndAddToBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setInviteError('Please provide both full name and business email.');
      return;
    }

    setIsCreatingUser(true);
    setInviteError(null);
    setNewUserSuccess(null);

    const initialPassword = newUserPassword.trim() || 'Password123!';

    try {
      const res = await apiFetch(`/api/boards/${boardId}/members/new-user`, {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          board_role: newUserBoardRole,
          password: initialPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user and add to board');
      }

      const createdUser = data.user;
      const createdMember = data.member;

      // Immediately update local members state without requiring hard refresh or logout
      if (createdUser && createdMember) {
        const memberWithUser = {
          ...createdMember,
          user_name: createdUser.name,
          user_email: createdUser.email,
          user_role: createdUser.role,
          user_avatar: createdUser.avatar_url,
        };
        setMembers((prev) => {
          if (prev.some((m) => m.user_id === createdUser.id)) {
            return prev.map((m) => m.user_id === createdUser.id ? memberWithUser : m);
          }
          return [...prev, memberWithUser];
        });

        setCompanyDirectory((prev) => {
          if (prev.some((u) => u.id === createdUser.id)) return prev;
          return [...prev, createdUser];
        });
      }

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setIsShareModalOpen(false);

      // Trigger soft notification toast!
      showToast({
        type: 'user',
        title: 'User Added to System & Board',
        message: `${createdUser.name} (${createdUser.role}) saved. Initial Password: ${initialPassword}`,
      });

      fetchBoardData();
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setInviteError(err.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // =========================================================================
  // DRAG AND DROP HANDLERS
  // =========================================================================

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, listId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverListId !== listId) {
      setDragOverListId(listId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    setDraggedCardId(null);
    setDragOverListId(null);

    if (!cardId) return;

    const movingCard = cards.find((c) => c.id === cardId);
    if (!movingCard) {
      return;
    }

    // Compute target position at bottom of target list (or within same list)
    const cardsInTarget = cards.filter((c) => c.list_id === targetListId && c.id !== cardId);
    const maxPos = cardsInTarget.length > 0 ? Math.max(...cardsInTarget.map((c) => c.position)) : 0;
    const newPosition = maxPos + 65535;

    // Optimistically update UI
    const targetList = lists.find((l) => l.id === targetListId);
    const isMovingToDone = targetList?.title.toLowerCase() === 'done';

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              list_id: targetListId,
              position: newPosition,
              is_completed: isMovingToDone ? true : c.is_completed,
            }
          : c
      )
    );

    // Call backend
    try {
      const res = await apiFetch(`/api/cards/${cardId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({
          targetListId,
          newPosition,
          socketId: socketRef.current?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)));
      }
    } catch (err) {
      console.error('Failed to move card:', err);
    }
  };

  const handleCardDropOnCard = async (e: React.DragEvent, targetCard: Card, targetListId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    setDraggedCardId(null);
    setDragOverListId(null);

    if (!cardId || cardId === targetCard.id) return;

    const movingCard = cards.find((c) => c.id === cardId);
    if (!movingCard) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;

    const listCardsSorted = cards
      .filter((c) => c.list_id === targetListId && c.id !== cardId)
      .sort((a, b) => a.position - b.position);

    const targetIdx = listCardsSorted.findIndex((c) => c.id === targetCard.id);
    if (targetIdx === -1) return;

    let newPosition = targetCard.position;
    if (isAfter) {
      const nextCard = listCardsSorted[targetIdx + 1];
      newPosition = nextCard ? (targetCard.position + nextCard.position) / 2 : targetCard.position + 65535;
    } else {
      const prevCard = listCardsSorted[targetIdx - 1];
      newPosition = prevCard ? (prevCard.position + targetCard.position) / 2 : targetCard.position / 2;
    }

    const targetList = lists.find((l) => l.id === targetListId);
    const isMovingToDone = targetList?.title.toLowerCase() === 'done';

    // Optimistically update UI
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              list_id: targetListId,
              position: newPosition,
              is_completed: isMovingToDone ? true : c.is_completed,
            }
          : c
      )
    );

    try {
      const res = await apiFetch(`/api/cards/${cardId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({
          targetListId,
          newPosition,
          socketId: socketRef.current?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)));
      }
    } catch (err) {
      console.error('Failed to move card:', err);
    }
  };

  // =========================================================================
  // EXPORT SHIFT SUMMARY (KANBAN MENU FEATURE)
  // =========================================================================
  const handleExportShiftSummary = () => {
    const summary = cards.map((c) => ({
      Title: c.title,
      List: lists.find((l) => l.id === c.list_id)?.title || '',
      Priority: c.priority,
      Status: c.is_completed ? 'Done' : 'Pending',
      CompletedBy: c.completed_by_user?.name || '',
      CompletedAt: c.completed_at || '',
      AssignedTo: c.assigned_user?.name || 'Unassigned',
      DueDate: c.due_date || '',
    }));

    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${board?.title || 'Shift'}-operations-export.json`;
    a.click();
    setIsSettingsMenuOpen(false);
  };

  // =========================================================================
  // FILTERING LOGIC
  // =========================================================================
  // Deduplicate cards by ID to ensure no duplicate elements in UI state
  const uniqueCards = Array.from(new Map(cards.map((c) => [c.id, c])).values());

  const filteredCards = uniqueCards.filter((card) => {
    if (searchFilter && !card.title.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    if (selectedMemberFilter !== 'all' && card.assigned_to !== selectedMemberFilter) {
      return false;
    }
    if (selectedPriorityFilter !== 'all' && card.priority !== selectedPriorityFilter) {
      return false;
    }
    if (selectedLabelFilter !== 'all') {
      const hasLbl = card.labels?.some((l: any) => l.id === selectedLabelFilter);
      if (!hasLbl) return false;
    }
    if (selectedStatusFilter === 'completed' && !card.is_completed) return false;
    if (selectedStatusFilter === 'pending' && card.is_completed) return false;
    return true;
  });

  const bgVal = board?.background_value || '#0f172a';
  const isImageBg = bgVal.startsWith('/uploads/') || bgVal.startsWith('http');
  const boardBgStyle = isImageBg ? {
    backgroundImage: `url(${bgVal})`,
    backgroundSize: board?.background_style === 'repeat' ? '250px 250px' : 'cover',
    backgroundRepeat: board?.background_style === 'repeat' ? 'repeat' : 'no-repeat',
    backgroundPosition: 'top left',
  } : {
    background: bgVal,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Loading Station Board...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 flex flex-col" style={boardBgStyle}>
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ========================================================================= */}
      {/* TOP-RIGHT TOOLBAR & HEADER */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-xs">
        {/* Left: Back & Board Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
            title="Return to Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div>
            {isEditingBoardTitle ? (
              <input
                type="text"
                value={boardTitleInput}
                onChange={(e) => setBoardTitleInput(e.target.value)}
                onBlur={handleSaveBoardTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBoardTitle()}
                autoFocus
                className="bg-white border border-teal-500 rounded-md px-2 py-0.5 text-sm font-bold text-slate-900 focus:outline-none"
              />
            ) : (
              <h2
                onClick={() => userRole !== 'Viewer' && setIsEditingBoardTitle(true)}
                className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2 cursor-pointer group"
                title="Click to rename board"
              >
                <span>{board?.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                  {userRole}
                </span>
              </h2>
            )}
            <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md hidden sm:block">
              {board?.description || 'Hospitality Kanban operations & shift tracking.'}
            </p>
          </div>
        </div>

        {/* Right: Toolbar Icons Required */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Active Presence Indicators */}
          <div className="hidden md:flex items-center -space-x-2 mr-2">
            {activeUserIds.slice(0, 3).map((uId) => {
              const u = members.find((m) => m.user_id === uId);
              return (
                <div
                  key={uId}
                  className="w-7 h-7 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow"
                  title={`${u?.user_name || 'Staff Member'} is currently viewing this board`}
                >
                  {(u?.user_name || 'U').charAt(0)}
                </div>
              );
            })}
            {activeUserIds.length > 3 && (
              <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] text-slate-600 font-semibold">
                +{activeUserIds.length - 3}
              </div>
            )}
          </div>

          {/* 1. People / Members Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsMembersDrawerOpen(true)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Board Members"
          >
            <Users className="w-4 h-4 text-teal-600" />
            <span className="hidden sm:inline">Members ({members.length})</span>
          </button>

          {/* 2. 3-Way View Switcher (Kanban | Table | Calendar) */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kanban Board View"
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View (Sharp Corners)"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Calendar Timeline View"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>

          {/* 3. Filter Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              searchFilter || selectedMemberFilter !== 'all' || selectedPriorityFilter !== 'all' || selectedStatusFilter !== 'all'
                ? 'bg-teal-50 text-teal-800 border-teal-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Filter Tasks"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
          </button>

          {/* 4. Share Board Trigger */}
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Share & Invite Others"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* 4b. Live Activity Feed Trigger */}
          <button
            type="button"
            onClick={() => setIsActivityDrawerOpen(true)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Live Board Activity Trail"
          >
            <History className="w-4 h-4 text-teal-600" />
            <span className="hidden md:inline">Activity</span>
          </button>

          {/* 5. Board Settings Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isSettingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-700">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1.5 tracking-wider">
                  Board Settings & Ops
                </div>

                {/* 1. Generate QR Code & Invite Link */}
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100/80 flex items-center gap-2 cursor-pointer border border-teal-200/60 mb-1"
                >
                  <QrCode className="w-4 h-4 text-teal-600" />
                  <span>Generate Invite Link / QR Code</span>
                </button>

                {/* 2. About this Board */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAboutModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-teal-600" />
                  <span>About this board (Stats & Owner)</span>
                </button>

                {/* 3. Background Customizer */}
                <button
                  type="button"
                  onClick={() => {
                    setIsBackgroundModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Palette className="w-4 h-4 text-teal-600" />
                  <span>Background & Theme Customizer</span>
                </button>

                {/* 4. Labels Manager */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLabelsModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-teal-600" />
                  <span>Labels (customize text & colors)</span>
                </button>

                {/* 5. Archived Cards */}
                <button
                  type="button"
                  onClick={() => {
                    setIsArchivedCardsModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4 text-teal-600" />
                  <span>Archived Tasks ({archivedCards.length})</span>
                </button>

                {/* 6. Live Activity History */}
                <button
                  type="button"
                  onClick={() => {
                    setIsActivityDrawerOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-4 h-4 text-teal-600" />
                  <span>Live Activity History ({activityLogs.length})</span>
                </button>

                {/* 7. WIP Limits */}
                <button
                  type="button"
                  onClick={() => {
                    setIsWipModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Gauge className="w-4 h-4 text-teal-600" />
                  <span>Set Column WIP Limits</span>
                </button>

                {/* 8. Export Shift Summary */}
                <button
                  type="button"
                  onClick={handleExportShiftSummary}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <span>Export Shift Summary (JSON)</span>
                </button>

                <div className="my-1 border-t border-slate-200" />

                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Operations feedback sent ✓</span>
                </button>

                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                  <span>Leave Board</span>
                </button>

                <div className="my-1 border-t border-slate-200" />

                <button
                  type="button"
                  onClick={async () => {
                    setIsSettingsMenuOpen(false);
                    if (onLogout) {
                      onLogout();
                    } else {
                      try {
                        await apiFetch('/api/auth/logout', { method: 'POST' });
                      } catch {}
                      window.location.reload();
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Filter Bar (Conditional) */}
      {isFilterOpen && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-2 duration-150 shadow-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter tasks by name or prep items..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Filter by Member */}
          <select
            value={selectedMemberFilter}
            onChange={(e) => setSelectedMemberFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
          >
            <option value="all">All Members</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_name}
              </option>
            ))}
          </select>

          {/* Filter by Priority */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Filter by Status */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed Only</option>
          </select>

          {/* Filter by Label */}
          <select
            value={selectedLabelFilter}
            onChange={(e) => setSelectedLabelFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
          >
            <option value="all">All Labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                🏷️ {l.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchFilter('');
              setSelectedMemberFilter('all');
              setSelectedPriorityFilter('all');
              setSelectedLabelFilter('all');
              setSelectedStatusFilter('all');
            }}
            className="text-xs text-slate-500 hover:text-teal-700 px-2 py-1 cursor-pointer font-medium"
          >
            Reset
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: KANBAN COLUMNS */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' ? (
        <main className="flex-1 overflow-x-auto p-4 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-6 min-w-max pb-6">
            {lists.map((list) => {
              const listCards = filteredCards
                .filter((c) => c.list_id === list.id)
                .sort((a, b) => a.position - b.position);

              const limit = wipLimits[list.title] || 0;
              const isOverWip = limit > 0 && listCards.length > limit;

              return (
                <div
                  key={list.id}
                  onDragOver={(e) => handleDragOver(e, list.id)}
                  onDrop={(e) => handleDrop(e, list.id)}
                  className={`w-80 sm:w-84 shrink-0 bg-slate-100/90 border rounded-xl flex flex-col max-h-[82vh] transition-all duration-200 ${
                    dragOverListId === list.id
                      ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20'
                      : 'border-slate-200/90'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200/90 flex items-center justify-between">
                    {editingListId === list.id ? (
                      <div className="flex items-center gap-1.5 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingListTitle}
                          onChange={(e) => setEditingListTitle(e.target.value)}
                          onBlur={() => handleSaveListTitle(list.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveListTitle(list.id);
                            if (e.key === 'Escape') setEditingListId(null);
                          }}
                          autoFocus
                          className="w-full bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSaveListTitle(list.id)}
                          className="p-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
                          title="Save column title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span
                          onClick={() => {
                            if (canEditColumns) {
                              setEditingListId(list.id);
                              setEditingListTitle(list.title);
                            }
                          }}
                          className={`font-bold text-slate-900 text-sm ${
                            canEditColumns ? 'cursor-pointer hover:text-teal-700' : ''
                          }`}
                          title={canEditColumns ? 'Click to rename column' : ''}
                        >
                          {list.title}
                        </span>

                        {canEditColumns && (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingListId(list.id);
                                setEditingListTitle(list.title);
                              }}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-teal-700 cursor-pointer"
                              title="Rename column"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(list.id)}
                              className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Delete column"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isOverWip ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {listCards.length}{limit > 0 ? `/${limit}` : ''}
                        </span>
                      </div>
                    )}

                    {userRole !== 'Viewer' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCardInListId(list.id);
                          setNewCardTitle('');
                        }}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                        title="Add task to column"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Cards Scrollable Container */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[140px]">
                    {listCards.map((card) => {
                      const isComplete = card.is_completed;
                      const hasChecklists = (card.checklists || []).length > 0;
                      const completedCount = (card.checklists || []).filter((c) => c.is_completed).length;

                      return (
                        <div
                          key={card.id}
                          draggable={userRole !== 'Viewer'}
                          onDragStart={(e) => handleDragStart(e, card.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleCardDropOnCard(e, card, list.id)}
                          onClick={() => setActiveCardModal(card)}
                          className={`group relative bg-white border rounded-lg p-3.5 shadow-xs transition-all duration-150 cursor-pointer ${
                            isComplete
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : 'border-slate-200/90 hover:border-teal-400 hover:shadow-md'
                          }`}
                        >
                          {/* Labels row */}
                          {card.labels && card.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {card.labels.map((lbl) => (
                                <span
                                  key={lbl.id}
                                  className="text-[9px] font-bold px-2 py-0.5 rounded text-white"
                                  style={{ backgroundColor: lbl.color }}
                                >
                                  {lbl.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Cover Photo Preview if card has photos */}
                          {card.image_paths && card.image_paths.length > 0 && (
                            <div className="mb-2 rounded-md overflow-hidden h-20 bg-slate-100 border border-slate-200 relative">
                              <img
                                src={card.image_paths[0]}
                                alt="Task cover"
                                className="w-full h-full object-cover"
                              />
                              {card.image_paths.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-slate-900/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Camera className="w-2.5 h-2.5" />
                                  <span>+{card.image_paths.length - 1}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Card Title & Priority */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-xs font-semibold leading-snug flex-1 ${
                              isComplete ? 'line-through text-slate-400' : 'text-slate-900 group-hover:text-teal-700'
                            }`}>
                              {card.title}
                            </h4>

                            {card.priority === 'urgent' && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                                <Flame className="w-3 h-3" />
                                Urgent
                              </span>
                            )}
                          </div>

                          {/* Card Hover Action Bar */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
                            
                            {/* Quick Complete Button */}
                            <button
                              type="button"
                              onClick={(e) => handleQuickComplete(e, card)}
                              className={`flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                                isComplete ? 'text-emerald-600' : 'hover:text-teal-600'
                              }`}
                              title={isComplete ? 'Mark task incomplete' : 'Quick mark as Done'}
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 ${isComplete ? 'fill-emerald-100 text-emerald-600' : ''}`} />
                              <span>{isComplete ? 'Done' : 'Complete'}</span>
                            </button>

                            {/* Checklist, Photos & Due Date Badge */}
                            <div className="flex items-center gap-2">
                              {card.image_paths && card.image_paths.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium" title={`${card.image_paths.length} photo(s)`}>
                                  <Camera className="w-3 h-3 text-slate-400" />
                                  <span>{card.image_paths.length}</span>
                                </span>
                              )}

                              {hasChecklists && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <CheckSquare className="w-3 h-3" />
                                  <span>{completedCount}/{(card.checklists || []).length}</span>
                                </span>
                              )}

                              {card.due_date && (
                                <span className="flex items-center gap-1 text-[10px] text-teal-700 font-medium">
                                  <Clock className="w-3 h-3 text-teal-600" />
                                  <span>{new Date(card.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </span>
                              )}

                              {card.assigned_user && (
                                <img
                                  src={card.assigned_user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(card.assigned_user.name)}`}
                                  alt={card.assigned_user.name}
                                  title={`Assigned to ${card.assigned_user.name}`}
                                  className="w-5 h-5 rounded-full object-cover bg-slate-200 ring-1 ring-teal-500/30"
                                />
                              )}

                              {userRole !== 'Viewer' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCard(card.id, card.title);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer ml-1"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}

                    {/* Inline Quick Card Adder */}
                    {addingCardInListId === list.id && (
                      <div className="p-3 bg-white border border-teal-500/50 rounded-lg space-y-2 shadow-sm animate-in fade-in duration-150">
                        <textarea
                          rows={2}
                          value={newCardTitle}
                          disabled={isCreatingCard}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (newCardTitle.trim() && !isCreatingCard) {
                                handleCreateCard(list.id);
                              }
                            }
                            if (e.key === 'Escape') {
                              setAddingCardInListId(null);
                            }
                          }}
                          placeholder="Task title (press Enter to add)..."
                          autoFocus
                          className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 resize-none disabled:opacity-50"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">↵ Enter to add</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isCreatingCard}
                              onClick={() => setAddingCardInListId(null)}
                              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isCreatingCard || !newCardTitle.trim()}
                              onClick={() => handleCreateCard(list.id)}
                              className="text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            >
                              {isCreatingCard ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Adding...</span>
                                </>
                              ) : (
                                <span>Add Task</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {canEditColumns && (
              <div className="w-80 sm:w-84 shrink-0">
                {isAddingColumn ? (
                  <form onSubmit={handleAddColumn} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
                    <input
                      type="text"
                      autoFocus
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Column title (e.g. Quality Check)..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Add Column
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsAddingColumn(false); setNewColumnTitle(''); }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full h-14 border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl bg-slate-50/50 hover:bg-teal-50/30 text-slate-600 hover:text-teal-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Column</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      ) : viewMode === 'table' ? (
        /* ========================================================================= */
        /* VIEW: SHIFT OPERATIONS TABLE (SHARP CORNERS) */
        /* ========================================================================= */
        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Table className="w-4 h-4 text-teal-600" />
                  <span>Shift Task Operations Grid</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tabular view of all tasks across station columns. Click any row to view and edit details.
                </p>
              </div>
              {lists.length > 0 && userRole !== 'Viewer' && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingCardInListId(lists[0].id);
                    setViewMode('kanban');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse rounded-none">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider rounded-none">
                    <th className="py-3 px-4">Status / Column</th>
                    <th className="py-3 px-4">Task Name</th>
                    <th className="py-3 px-4">Station Labels</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Checklist</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCards.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No tasks match the active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCards.map((card) => {
                      const list = lists.find((l) => l.id === card.list_id);
                      const isComplete = card.is_completed;
                      const completedCount = (card.checklists || []).filter((c) => c.is_completed).length;
                      const totalCount = (card.checklists || []).length;

                      return (
                        <tr
                          key={card.id}
                          onClick={() => setActiveCardModal(card)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {list?.title || 'Column'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 group-hover:text-teal-700 transition-colors">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickComplete(e, card);
                                }}
                                className={`cursor-pointer ${isComplete ? 'text-emerald-600' : 'text-slate-400 hover:text-teal-600'}`}
                              >
                                <CheckCircle2 className={`w-4 h-4 ${isComplete ? 'fill-emerald-100 text-emerald-600' : ''}`} />
                              </button>
                              <span className={isComplete ? 'line-through text-slate-400' : 'text-slate-900'}>
                                {card.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(card.labels || []).map((lbl) => (
                                <span
                                  key={lbl.id}
                                  className="text-[9px] font-bold px-2 py-0.5 rounded text-white shadow-xs"
                                  style={{ backgroundColor: lbl.color }}
                                >
                                  {lbl.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                card.priority === 'urgent'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : card.priority === 'high'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : card.priority === 'low'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              }`}
                            >
                              {card.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            {card.assigned_user ? (
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={card.assigned_user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(card.assigned_user.name)}`}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover bg-slate-200"
                                />
                                <span>{card.assigned_user.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            {card.due_date ? (
                              <span className="text-teal-700 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-teal-600" />
                                {new Date(card.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            {totalCount > 0 ? (
                              <span className="text-[11px] font-medium text-slate-600">
                                {completedCount}/{totalCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2.5">
                              {userRole !== 'Viewer' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCard(card.id, card.title);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className="text-teal-600 font-semibold text-xs group-hover:underline">
                                Edit &rarr;
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        /* ========================================================================= */
        /* VIEW: CALENDAR TIMELINE (SHARP CORNERS) */
        /* ========================================================================= */
        <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-none p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span>Shift Operations Calendar</span>
            </h3>

            <div className="space-y-3">
              {cards.filter((c) => c.due_date).length === 0 ? (
                <p className="text-xs text-slate-500 py-10 text-center">
                  No tasks currently have due dates assigned. Add due dates to see them in this calendar.
                </p>
              ) : (
                cards
                  .filter((c) => c.due_date)
                  .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setActiveCardModal(c)}
                      className="p-3.5 bg-slate-50 border border-slate-200 hover:border-teal-400 rounded-none flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{c.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Assigned to: {c.assigned_user?.name || 'Unassigned'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-teal-700 font-medium">
                          {new Date(c.due_date!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.is_completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {c.is_completed ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* CARD MODAL (POP-UP OVER BOARD) */}
      {/* ========================================================================= */}
      {activeCardModal && (
        <CardModal
          card={activeCardModal}
          boardLabels={labels}
          boardMembers={members}
          currentUser={currentUser}
          onClose={() => setActiveCardModal(null)}
          onUpdateCard={(updated) => {
            setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setActiveCardModal(updated);
          }}
          onArchiveCard={(cardId) => {
            handleDeleteCard(cardId, activeCardModal.title);
          }}
          onDeleteCard={handleDeleteCard}
          onCreateLabel={handleCreateLabel}
          onUpdateLabel={handleUpdateLabel}
          onDeleteLabel={handleDeleteLabel}
          onOpenLabelsManager={() => setIsLabelsModalOpen(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* SHARE / INVITE MODAL */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SHARE / INVITE / CREATE USER MODAL */}
      {/* ========================================================================= */}
      {isShareModalOpen && (() => {
        const isCurrentUserAdmin = currentUser.role === 'Admin/Group Owner' || userRole === 'Board Admin';
        const isCurrentUserManager = currentUser.role === 'Manager' && !isCurrentUserAdmin;
        const isCurrentUserStaff = currentUser.role === 'Staff' && !isCurrentUserAdmin;
        const canCreateNewUsers = isCurrentUserAdmin || isCurrentUserManager;

        // Existing users filtered by role hierarchy:
        // Admin: can add other admins, managers, staff
        // Managers: can add other managers, staff (filters out Admins)
        // Staff: can invite staff only (filters out Admins and Managers)
        const allowedDirectoryUsers = companyDirectory.filter((user) => {
          if (isCurrentUserAdmin) return true;
          if (isCurrentUserManager) return user.role !== 'Admin/Group Owner';
          if (isCurrentUserStaff) return user.role === 'Staff';
          return false;
        });

        // Board roles allowed when inviting
        const allowedBoardRoles: { id: 'Board Admin' | 'Member' | 'Viewer'; desc: string }[] = isCurrentUserAdmin
          ? [
              { id: 'Board Admin', desc: 'Edit board, invite & manage team' },
              { id: 'Member', desc: 'Create, move & edit cards' },
              { id: 'Viewer', desc: 'Read-only visibility' },
            ]
          : [
              { id: 'Member', desc: 'Create, move & edit cards' },
              { id: 'Viewer', desc: 'Read-only visibility' },
            ];

        // System roles allowed when creating a new user
        const allowedSystemRoles: { id: 'Admin/Group Owner' | 'Manager' | 'Staff'; desc: string }[] = isCurrentUserAdmin
          ? [
              { id: 'Staff', desc: 'Staff team member' },
              { id: 'Manager', desc: 'Manager (can add managers & staff)' },
              { id: 'Admin/Group Owner', desc: 'Admin (full permissions)' },
            ]
          : [
              { id: 'Staff', desc: 'Staff team member' },
              { id: 'Manager', desc: 'Manager (can add managers & staff)' },
            ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Board Access & Team</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isCurrentUserAdmin
                      ? 'Admin Access: You can add admins, managers, staff, or create new accounts.'
                      : isCurrentUserManager
                      ? 'Manager Access: You can add managers and staff, or create new staff/manager accounts.'
                      : 'Staff Access: You can invite other staff colleagues to this board.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setInviteError(null);
                    setNewUserSuccess(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status / Error Notifications */}
              {inviteError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{inviteError}</span>
                </div>
              )}
              {newUserSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{newUserSuccess}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 mb-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShareTab('existing');
                    setInviteError(null);
                  }}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    shareTab === 'existing'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Invite Existing Colleague</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (canCreateNewUsers) {
                      setShareTab('new');
                      setInviteError(null);
                    }
                  }}
                  disabled={!canCreateNewUsers}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    shareTab === 'new'
                      ? 'border-teal-600 text-teal-700'
                      : canCreateNewUsers
                      ? 'border-transparent text-slate-500 hover:text-slate-800'
                      : 'border-transparent text-slate-300 cursor-not-allowed opacity-60'
                  }`}
                  title={!canCreateNewUsers ? 'Only Admins and Managers can create new user accounts' : 'Create new user'}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Create New User</span>
                  {!canCreateNewUsers && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-normal">
                      Admin/Mgr only
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: INVITE EXISTING COLLEAGUE */}
              {shareTab === 'existing' && (
                <form onSubmit={handleInviteMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Colleague
                    </label>
                    <select
                      required
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                    >
                      <option value="">-- Choose team member --</option>
                      {allowedDirectoryUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role}) • {user.email}
                        </option>
                      ))}
                    </select>
                    {allowedDirectoryUsers.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        No additional eligible colleagues found matching your invitation permissions.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Board Role & Permissions
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {allowedBoardRoles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setInviteRole(r.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                            inviteRole === r.id
                              ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500/30'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold text-xs text-slate-900">{r.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!inviteUserId}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      Confirm Invitation
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: CREATE NEW USER & ADD TO BOARD (ADMIN / MANAGER) */}
              {shareTab === 'new' && (
                <form onSubmit={handleCreateUserAndAddToBoard} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g., Sarah Jenkins"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Business Email
                      </label>
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="e.g., sarah@kitchenops.com"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      System Role (Hierarchy)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {allowedSystemRoles.map((sr) => (
                        <button
                          key={sr.id}
                          type="button"
                          onClick={() => setNewUserRole(sr.id)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            newUserRole === sr.id
                              ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500/30'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold text-xs text-slate-900">{sr.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{sr.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Board Role
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {allowedBoardRoles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setNewUserBoardRole(r.id)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            newUserBoardRole === r.id
                              ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500/30'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold text-xs text-slate-900">{r.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Password123! (or set custom password)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Defaults to <code className="text-teal-700 font-bold">Password123!</code>. The user can immediately sign in with this password.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingUser || !newUserName.trim() || !newUserEmail.trim()}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isCreatingUser ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <span>Create & Add to Board</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MEMBERS DRAWER */}
      {/* ========================================================================= */}
      {isMembersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  <span>Station Team ({members.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsMembersDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {members.map((m) => {
                  const isOnline = activeUserIds.includes(m.user_id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <img
                            src={m.user_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.user_name)}`}
                            alt={m.user_name}
                            className="w-8 h-8 rounded-lg object-cover bg-slate-200"
                          />
                          {isOnline && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Online now" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{m.user_name}</div>
                          <div className="text-[10px] text-slate-500">{m.user_role}</div>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsMembersDrawerOpen(false);
                  setIsInviteModalOpen(true);
                }}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-teal-200" />
                <span>Generate QR Code / Join Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMembersDrawerOpen(false);
                  setIsShareModalOpen(true);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Add Existing Staff from Directory</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVITY HISTORY DRAWER */}
      {/* ========================================================================= */}
      {isActivityDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-teal-600" />
                  <span>Live Board Activity History ({activityLogs.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsActivityDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activityLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No activity recorded on this board yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((act) => {
                    const d = act.details || {};
                    const user = act.user_name || 'Staff Member';

                    return (
                      <div
                        key={act.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1 hover:bg-slate-100/70 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-800">{user}</span>
                          <span>
                            {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                            {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="text-slate-700 text-xs">
                          {act.action_type === 'moved_card' ? (
                            <span>
                              Moved card <strong className="font-semibold text-slate-900">"{d.card_title || d.title || 'task'}"</strong> from{' '}
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-200 text-slate-800">
                                {d.from_list || 'Column 1'}
                              </span>{' '}
                              to{' '}
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                {d.to_list || 'Column 2'}
                              </span>
                            </span>
                          ) : act.action_type === 'updated_card_title' ? (
                            <span>
                              Updated title {d.old_title ? <span>from <span className="text-slate-500">"{d.old_title}"</span> to </span> : 'to '}
                              <strong className="font-semibold text-slate-900">"{d.new_title || d.card_title}"</strong>
                            </span>
                          ) : act.action_type === 'updated_card_description' ? (
                            <span>
                              Updated description for <strong className="font-semibold text-slate-900">"{d.card_title || 'task'}"</strong>
                            </span>
                          ) : act.action_type === 'updated_card_priority' ? (
                            <span>
                              Updated priority of <strong className="font-semibold text-slate-900">"{d.card_title || 'task'}"</strong> to{' '}
                              <span className="font-bold uppercase text-[10px] text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                                {d.priority}
                              </span>
                            </span>
                          ) : act.action_type === 'created_user' ? (
                            <span>
                              Created user <strong className="font-semibold text-slate-900">{d.created_name}</strong> ({d.role || 'Staff'}) and added to board
                            </span>
                          ) : act.action_type === 'invited_member' ? (
                            <span>
                              Invited <strong className="font-semibold text-slate-900">{d.invited_name}</strong> ({d.role || 'Member'}) to board
                            </span>
                          ) : d.summary ? (
                            <span>{d.summary}</span>
                          ) : (
                            <span>
                              {d.title && <strong className="font-semibold text-slate-900">"{d.title}"</strong>}
                              {d.card_title && <strong className="font-semibold text-slate-900">"{d.card_title}"</strong>}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsActivityDrawerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABOUT THIS BOARD MODAL */}
      {/* ========================================================================= */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl relative">
            <h3 className="text-lg font-bold text-slate-900 mb-2">About This Operations Board</h3>
            <p className="text-xs text-slate-500 mb-4">{board?.description || 'No description provided.'}</p>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Created On:</span>
                <strong className="text-slate-900">{new Date(board?.created_at).toLocaleDateString()}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Tasks:</span>
                <strong className="text-slate-900">{cards.length} cards</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Completed Tasks:</span>
                <strong className="text-emerald-600 font-bold">{cards.filter((c) => c.is_completed).length} cards</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Team Members:</span>
                <strong className="text-slate-900">{members.length} members</strong>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WIP LIMITS MODAL */}
      {/* ========================================================================= */}
      {isWipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Set Work In Progress (WIP) Limits</h3>
            <p className="text-xs text-slate-500 mb-4">
              Prevent kitchen bottlenecks during peak service by bounding column capacities.
            </p>

            <div className="space-y-3 mb-5">
              {lists.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-900">{l.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">Max Cards:</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={wipLimits[l.title] || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setWipLimits({ ...wipLimits, [l.title]: val });
                      }}
                      className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsWipModalOpen(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm transition-all"
              >
                Save WIP Limits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOARD LABELS MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      {isLabelsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 sm:p-6 shadow-xl relative max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-teal-600" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Board Station Labels</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLabelsModalOpen(false);
                  setEditingLabelId(null);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              All team members with board access can create, customize, and edit labels for kitchen stations, dietary alerts, and shift workflows.
            </p>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              
              {/* Form to Add New Label */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-teal-600" />
                  <span>Create New Label</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Label Title</label>
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="e.g. VIP Catering, Bar Stock, Pastry Prep..."
                    className="w-full bg-white border border-slate-300 focus:border-teal-500 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Color Palette Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-slate-600">Color Palette</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Custom:</span>
                      <input
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Pick custom hex color"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LABEL_PRESET_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewLabelColor(col)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          newLabelColor === col ? 'border-teal-600 scale-110 shadow-md ring-2 ring-teal-500/20' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: col }}
                      >
                        {newLabelColor === col && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview & Add Button */}
                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Preview:</span>
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-semibold text-white shadow-xs"
                      style={{ backgroundColor: newLabelColor }}
                    >
                      {newLabelName.trim() || 'Label Preview'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!newLabelName.trim()}
                    onClick={async () => {
                      if (!newLabelName.trim()) return;
                      await handleCreateLabel(newLabelName, newLabelColor);
                      setNewLabelName('');
                    }}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Label</span>
                  </button>
                </div>
              </div>

              {/* Current Board Labels List */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Current Board Labels ({labels.length})</span>
                  <span className="text-[10px] text-slate-500 font-normal">Click pencil to edit</span>
                </div>

                {labels.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                    No labels on this board yet. Use the form above to add your first label!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {labels.map((lbl) => {
                      const isEditing = editingLabelId === lbl.id;
                      const cardCount = cards.filter((c) => c.labels?.some((l) => l.id === lbl.id)).length;

                      if (isEditing) {
                        return (
                          <div
                            key={lbl.id}
                            className="p-3 bg-slate-50 rounded-lg border border-teal-500/50 space-y-3"
                          >
                            <input
                              type="text"
                              value={editingLabelName}
                              onChange={(e) => setEditingLabelName(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                              placeholder="Label Name"
                            />

                            <div className="flex flex-wrap gap-1.5 items-center">
                              {LABEL_PRESET_COLORS.map((col) => (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => setEditingLabelColor(col)}
                                  className={`w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center ${
                                    editingLabelColor === col ? 'border-teal-600 scale-110' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: col }}
                                >
                                  {editingLabelColor === col && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </button>
                              ))}
                              <input
                                type="color"
                                value={editingLabelColor}
                                onChange={(e) => setEditingLabelColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent ml-1"
                                title="Custom color"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingLabelId(null)}
                                className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editingLabelName.trim()) return;
                                  await handleUpdateLabel(lbl.id, editingLabelName, editingLabelColor);
                                  setEditingLabelId(null);
                                }}
                                className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={lbl.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-4 h-4 rounded-full shadow-xs flex-shrink-0"
                              style={{ backgroundColor: lbl.color }}
                            />
                            <span className="text-xs font-semibold text-slate-900">{lbl.name}</span>
                            <span className="text-[10px] text-slate-500">
                              ({cardCount} {cardCount === 1 ? 'task' : 'tasks'})
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLabelId(lbl.id);
                                setEditingLabelName(lbl.name);
                                setEditingLabelColor(lbl.color);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Edit label name and color"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteLabelId === lbl.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleDeleteLabel(lbl.id);
                                    setConfirmDeleteLabelId(null);
                                  }}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-md cursor-pointer transition-colors shadow-xs"
                                  title="Confirm delete label from board"
                                >
                                  Delete?
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLabelId(null)}
                                  className="px-1.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] rounded-md cursor-pointer"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteLabelId(lbl.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete label"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsLabelsModalOpen(false);
                  setEditingLabelId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hospitality QR Code & Invite Link Modal */}
      {isInviteModalOpen && (
        <HospitalityInviteModal
          boardId={boardId}
          boardTitle={board?.title || 'Shift Operations'}
          currentUser={currentUser}
          onClose={() => setIsInviteModalOpen(false)}
          onNotification={(msg, type) => showToast({ title: 'Shift Onboarding', message: msg, type: type || 'success' })}
        />
      )}

      {/* Background & Theme Customizer Modal */}
      {isBackgroundModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBackgroundModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Palette className="w-5 h-5 text-teal-600" />
                <span>Board Background & Theme</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBackgroundModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select an ambient background color/gradient or upload a custom wallpaper image (PNG/JPG, max 1MB).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { name: 'Slate Night', val: '#0f172a' },
                { name: 'Kitchen Dark', val: '#1e293b' },
                { name: 'Teal Ambient', val: 'linear-gradient(to right, #0f766e, #065f46)' },
                { name: 'Midnight Blue', val: 'linear-gradient(to right, #1e3a8a, #0f172a)' },
                { name: 'Deep Burgundy', val: 'linear-gradient(to right, #881337, #4c0519)' },
                { name: 'Forest Shift', val: 'linear-gradient(to right, #064e3b, #022c22)' },
              ].map((bg) => (
                <button
                  key={bg.name}
                  type="button"
                  onClick={() => handleUpdateBackground(bg.val)}
                  className="h-16 rounded-xl border border-slate-300 shadow-sm relative overflow-hidden flex flex-col justify-end p-2 cursor-pointer transition-transform hover:scale-102"
                  style={{ background: bg.val }}
                >
                  <span className="text-[10px] font-bold text-white drop-shadow-md">{bg.name}</span>
                </button>
              ))}
            </div>

            {/* Custom Wallpaper Upload Section */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Upload Custom Wallpaper (PNG/JPG, Max 1MB)
              </label>

              {/* Toggle Switch: Left = Repeat, Right = Full / Fit / Stretched */}
              <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setWallpaperMode('repeat')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    wallpaperMode === 'repeat'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Repeat / Tile
                </button>
                <button
                  type="button"
                  onClick={() => setWallpaperMode('cover')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    wallpaperMode === 'cover'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full / Fit / Stretched
                </button>
              </div>

              <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => setSelectedWallpaperFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
              {selectedWallpaperFile && (
                <div className="text-[11px] text-teal-700 font-medium bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200 flex items-center justify-between">
                  <span>Staged: {selectedWallpaperFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedWallpaperFile(null)}
                    className="text-teal-900 hover:text-rose-600 font-bold ml-2"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedWallpaperFile(null);
                  setIsBackgroundModalOpen(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedWallpaperFile) {
                    uploadWallpaperFile(selectedWallpaperFile, wallpaperMode);
                  } else {
                    setIsBackgroundModalOpen(false);
                  }
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm"
              >
                {selectedWallpaperFile ? 'Upload & Apply Wallpaper' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Cards Modal */}
      {isArchivedCardsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col max-h-[85vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Archive className="w-5 h-5 text-teal-600" />
                <span>Archived Shift Tasks ({archivedCards.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsArchivedCardsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5">
              {archivedCards.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No tasks archived on this board.
                </div>
              ) : (
                archivedCards.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{c.title}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                        {c.description || 'No description'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreCard(c.id)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer transition-colors"
                    >
                      Restore Task
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsArchivedCardsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer className="mt-auto" />
    </div>
  );
}
