import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.ts';
import {
  X,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Users,
  Eye,
  EyeOff,
  Tag,
  CheckSquare,
  MessageSquare,
  History,
  Trash2,
  Plus,
  Send,
  CalendarSync,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Pencil,
  Check,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Upload
} from 'lucide-react';

interface SafeUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  avatar_url?: string;
}

interface BoardLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

interface CardChecklistItem {
  id: string;
  card_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  created_by: string;
  completed_by?: string | null;
  completed_at?: string | null;
}

interface CardComment {
  id: string;
  card_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
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
  checklists?: CardChecklistItem[];
  comments?: CardComment[];
  assigned_user?: SafeUser | null;
  created_by_user?: SafeUser | null;
  completed_by_user?: SafeUser | null;
}

interface CardModalProps {
  card: Card;
  boardLabels: BoardLabel[];
  boardMembers: { user_id: string; user_name: string; user_email: string; user_role: string; user_avatar?: string }[];
  currentUser: SafeUser;
  onClose: () => void;
  onUpdateCard: (updatedCard: Card) => void;
  onArchiveCard: (cardId: string) => void;
  onDeleteCard?: (cardId: string, cardTitle: string) => void;
  onCreateLabel?: (name: string, color: string) => Promise<BoardLabel | null>;
  onUpdateLabel?: (labelId: string, name: string, color: string) => Promise<void>;
  onDeleteLabel?: (labelId: string) => Promise<void>;
  onOpenLabelsManager?: () => void;
}

export default function CardModal({
  card,
  boardLabels,
  boardMembers,
  currentUser,
  onClose,
  onUpdateCard,
  onArchiveCard,
  onDeleteCard,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onOpenLabelsManager,
}: CardModalProps) {
  // Local card editing states
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState(card.priority || 'normal');
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.substring(0, 16) : '');
  const [assignedTo, setAssignedTo] = useState(card.assigned_to || '');
  const [isConfirmingDeleteCard, setIsConfirmingDeleteCard] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    card.labels ? card.labels.map((l) => l.id) : []
  );

  // Inline Label Add/Edit State
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [newCardLabelName, setNewCardLabelName] = useState('');
  const [newCardLabelColor, setNewCardLabelColor] = useState('#3b82f6');
  const [editingCardLabelId, setEditingCardLabelId] = useState<string | null>(null);
  const [editingCardLabelName, setEditingCardLabelName] = useState('');
  const [editingCardLabelColor, setEditingCardLabelColor] = useState('');
  const [confirmDeleteLabelId, setConfirmDeleteLabelId] = useState<string | null>(null);

  const CARD_LABEL_PRESETS = [
    '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'
  ];

  // Checklists
  const [newChecklistText, setNewChecklistText] = useState('');
  const [checklists, setChecklists] = useState<CardChecklistItem[]>(card.checklists || []);

  // Comments
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState<CardComment[]>(card.comments || []);

  // Card specific activity log
  const [cardActivities, setCardActivities] = useState<any[]>([]);

  // Photos (Max 5 photos per card, local paths)
  const [imagePaths, setImagePaths] = useState<string[]>(card.image_paths || []);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Watch status
  const isWatching = Boolean(card.watchers?.includes(currentUser.id));

  // Interactive Pop-Up Calendar State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const initialDateObj = card.due_date ? new Date(card.due_date) : new Date();
  const [calYear, setCalYear] = useState(initialDateObj.getFullYear());
  const [calMonth, setCalMonth] = useState(initialDateObj.getMonth());
  const [calDay, setCalDay] = useState<number | null>(card.due_date ? initialDateObj.getDate() : null);
  const [calHour, setCalHour] = useState(() => {
    if (!card.due_date) return '07';
    const h = initialDateObj.getHours() % 12 || 12;
    return h < 10 ? `0${h}` : `${h}`;
  });
  const [calMinute, setCalMinute] = useState(() => {
    if (!card.due_date) return '00';
    const m = initialDateObj.getMinutes();
    return m < 10 ? `0${m}` : `${m}`;
  });
  const [calAmPm, setCalAmPm] = useState<'AM' | 'PM'>(() => {
    if (!card.due_date) return 'PM';
    return initialDateObj.getHours() >= 12 ? 'PM' : 'AM';
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const handleApplyCalendarDate = () => {
    if (!calDay) return;
    let hour = parseInt(calHour, 10);
    if (calAmPm === 'PM' && hour < 12) hour += 12;
    if (calAmPm === 'AM' && hour === 12) hour = 0;
    const minute = parseInt(calMinute, 10) || 0;

    const newDate = new Date(calYear, calMonth, calDay, hour, minute);
    const isoString = newDate.toISOString();
    setDueDate(isoString.substring(0, 16));
    handleSaveDetails({ due_date: isoString });
    setIsCalendarOpen(false);
  };

  const handleClearDueDate = () => {
    setDueDate('');
    setCalDay(null);
    handleSaveDetails({ due_date: null });
    setIsCalendarOpen(false);
  };

  const handleQuickPreset = (preset: 'today' | 'tomorrow' | 'weekend') => {
    const target = new Date();
    if (preset === 'today') {
      target.setHours(23, 0, 0, 0);
    } else if (preset === 'tomorrow') {
      target.setDate(target.getDate() + 1);
      target.setHours(8, 0, 0, 0);
    } else if (preset === 'weekend') {
      const day = target.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      target.setHours(18, 0, 0, 0);
    }

    setCalYear(target.getFullYear());
    setCalMonth(target.getMonth());
    setCalDay(target.getDate());
    const h = target.getHours() % 12 || 12;
    setCalHour(h < 10 ? `0${h}` : `${h}`);
    setCalMinute('00');
    setCalAmPm(target.getHours() >= 12 ? 'PM' : 'AM');
  };

  // Sync state if prop changes (via socket)
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
    setPriority(card.priority || 'normal');
    setDueDate(card.due_date ? card.due_date.substring(0, 16) : '');
    setAssignedTo(card.assigned_to || '');
    setSelectedLabelIds(card.labels ? card.labels.map((l) => l.id) : []);
    setChecklists(card.checklists || []);
    setComments(card.comments || []);
    setImagePaths(card.image_paths || []);
    if (card.due_date) {
      const d = new Date(card.due_date);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
      setCalDay(d.getDate());
    }
  }, [card]);

  // Load audit trail for this card
  useEffect(() => {
    const fetchCardHistory = async () => {
      try {
        const res = await apiFetch(`/api/boards/${card.board_id}`);
        if (res.ok) {
          const data = await res.json();
          const logs = (data.activityLogs || []).filter((l: any) => l.card_id === card.id);
          setCardActivities(logs);
        }
      } catch (err) {
        console.error('Failed to load card activity logs:', err);
      }
    };
    fetchCardHistory();
  }, [card.id, card.board_id]);

  // Save Card Details Handler
  const handleSaveDetails = async (overrides?: Partial<Card>) => {
    try {
      const payload = {
        title: overrides?.title !== undefined ? overrides.title : title.trim(),
        description: overrides?.description !== undefined ? overrides.description : description.trim(),
        priority: overrides?.priority !== undefined ? overrides.priority : priority,
        due_date: overrides?.due_date !== undefined ? overrides.due_date : (dueDate ? new Date(dueDate).toISOString() : null),
        assigned_to: overrides?.assigned_to !== undefined ? overrides.assigned_to : (assignedTo || null),
        label_ids: selectedLabelIds,
      };

      const res = await apiFetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.card) {
          onUpdateCard(data.card);
        }
      }
    } catch (err) {
      console.error('Failed to save card details:', err);
    }
  };

  // Toggle Completion with exact user attribution
  const handleToggleComplete = async () => {
    try {
      const nextStatus = !card.is_completed;
      const res = await apiFetch(`/api/cards/${card.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: nextStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.card) {
          onUpdateCard(data.card);
        }
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    }
  };

  // Toggle Checklist item with completed_by and completed_at
  const handleToggleChecklist = async (itemId: string, currentCompleted: boolean) => {
    try {
      const nextCompleted = !currentCompleted;
      const res = await apiFetch(`/api/cards/${card.id}/checklists/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: nextCompleted }),
      });

      if (res.ok) {
        const data = await res.json();
        setChecklists((prev) =>
          prev.map((item) => (item.id === itemId ? data.item : item))
        );
        if (data.card) onUpdateCard(data.card);
      }
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  };

  // Add Checklist item
  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    try {
      const res = await apiFetch(`/api/cards/${card.id}/checklists`, {
        method: 'POST',
        body: JSON.stringify({ content: newChecklistText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setChecklists([...checklists, data.item]);
        setNewChecklistText('');
        if (data.card) onUpdateCard(data.card);
      }
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const res = await apiFetch(`/api/cards/${card.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment_text: newCommentText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments([...comments, data.comment]);
        setNewCommentText('');
        if (data.card) onUpdateCard(data.card);
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  // Toggle Watching Status
  const handleToggleWatch = async () => {
    try {
      const res = await apiFetch(`/api/cards/${card.id}/watch`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.card) onUpdateCard(data.card);
      }
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    }
  };

  // Toggle Label selection
  const handleToggleLabel = (labelId: string) => {
    const updated = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((id) => id !== labelId)
      : [...selectedLabelIds, labelId];
    setSelectedLabelIds(updated);

    // Persist immediately
    apiFetch(`/api/cards/${card.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ label_ids: updated }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.card) onUpdateCard(data.card);
      });
  };

  // Create label and automatically attach to this card
  const handleCreateAndAttachLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardLabelName.trim()) return;

    try {
      let createdLabel: BoardLabel | null = null;
      if (onCreateLabel) {
        createdLabel = await onCreateLabel(newCardLabelName.trim(), newCardLabelColor);
      } else {
        const res = await apiFetch(`/api/boards/${card.board_id}/labels`, {
          method: 'POST',
          body: JSON.stringify({ name: newCardLabelName.trim(), color: newCardLabelColor }),
        });
        if (res.ok) {
          const data = await res.json();
          createdLabel = data.label;
        }
      }

      if (createdLabel) {
        const nextSelected = [...selectedLabelIds, createdLabel.id];
        setSelectedLabelIds(nextSelected);
        setNewCardLabelName('');

        // Attach to card
        const cardRes = await apiFetch(`/api/cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ label_ids: nextSelected }),
        });
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          if (cardData.card) onUpdateCard(cardData.card);
        }
      }
    } catch (err) {
      console.error('Failed to create & attach label:', err);
    }
  };

  // Edit existing label
  const handleSaveEditLabel = async (labelId: string) => {
    if (!editingCardLabelName.trim()) return;
    try {
      if (onUpdateLabel) {
        await onUpdateLabel(labelId, editingCardLabelName.trim(), editingCardLabelColor);
      } else {
        await apiFetch(`/api/boards/${card.board_id}/labels/${labelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: editingCardLabelName.trim(), color: editingCardLabelColor }),
        });
      }
      setEditingCardLabelId(null);
    } catch (err) {
      console.error('Failed to update label from card:', err);
    }
  };

  // Delete label
  const handleDeleteExistingLabel = async (labelId: string) => {
    try {
      if (onDeleteLabel) {
        await onDeleteLabel(labelId);
      } else {
        await apiFetch(`/api/boards/${card.board_id}/labels/${labelId}`, {
          method: 'DELETE',
        });
      }
      setSelectedLabelIds((prev) => prev.filter((id) => id !== labelId));
      setConfirmDeleteLabelId(null);
    } catch (err) {
      console.error('Failed to delete label from card:', err);
    }
  };

  // Upload card photos via Multer (Max 5 photos per card, strict file path strings only)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (imagePaths.length + files.length > 5) {
      setUploadError(`Cannot upload ${files.length} photo(s). Maximum 5 photos allowed per card (currently has ${imagePaths.length}/5).`);
      return;
    }

    setIsUploadingImages(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const res = await apiFetch(`/api/cards/${card.id}/images`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload photo(s).');
      }

      const updatedPaths = data.image_paths || [];
      setImagePaths(updatedPaths);
      if (data.card) {
        onUpdateCard(data.card);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading photo.');
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  // Remove photo from card and server storage
  const handleDeletePhoto = async (photoPath: string) => {
    try {
      const res = await apiFetch(`/api/cards/${card.id}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ imagePath: photoPath }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedPaths = data.image_paths || [];
        setImagePaths(updatedPaths);
        if (data.card) {
          onUpdateCard(data.card);
        }
        if (previewImage === photoPath) {
          setPreviewImage(null);
        }
      }
    } catch (err) {
      console.error('Failed to remove photo:', err);
    }
  };

  const completedChecklistCount = checklists.filter((c) => c.is_completed).length;
  const checklistProgress = checklists.length > 0
    ? Math.round((completedChecklistCount / checklists.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                card.is_completed
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{card.is_completed ? 'Task Completed' : 'Mark as Done'}</span>
            </button>

            {/* Watch Card Button */}
            <button
              type="button"
              onClick={handleToggleWatch}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isWatching
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Watching notifies you of shifts and card modifications"
            >
              {isWatching ? <Eye className="w-3.5 h-3.5 text-teal-600" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isWatching ? 'Watching' : 'Watch'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isConfirmingDeleteCard ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 rounded-lg px-2.5 py-1 text-xs animate-in fade-in duration-150">
                <span className="text-rose-800 font-bold text-[11px]">Delete task?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteCard) {
                      onDeleteCard(card.id, card.title);
                    } else {
                      onArchiveCard(card.id);
                    }
                  }}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px] cursor-pointer shadow-xs"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDeleteCard(false)}
                  className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDeleteCard(true)}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Delete this task permanently"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Delete Task</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Title Input */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleSaveDetails()}
                placeholder="Card title..."
                className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-teal-500 text-lg sm:text-xl font-bold text-slate-900 placeholder-slate-400 focus:outline-none px-1 py-1 transition-colors"
              />
              
              {/* Card Meta & Completion Audit Attribution */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1.5 px-1">
                <span>Created by <strong className="text-slate-700">{card.created_by_user?.name || 'Staff'}</strong></span>
                <span>•</span>
                <span>{new Date(card.created_at).toLocaleDateString()}</span>
                {card.is_completed && card.completed_by_user && (
                  <>
                    <span>•</span>
                    <span className="text-teal-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      Completed by {card.completed_by_user.name} ({new Date(card.completed_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Task Description & Shift Notes
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => handleSaveDetails()}
                placeholder="Add shift specifications, allergy alerts, VIP special requests..."
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none transition-all"
              />
            </div>

            {/* Shift Photos & Documentation (Max 5 photos, local uploads) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Camera className="w-4 h-4 text-teal-600" />
                  <span>Shift Photos & Documentation ({imagePaths.length}/5)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  {imagePaths.length >= 5 ? 'Max photos reached' : `${5 - imagePaths.length} photo slot(s) remaining`}
                </span>
              </div>

              {uploadError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Photos Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {imagePaths.map((photoPath, index) => (
                  <div
                    key={photoPath}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square shadow-xs"
                  >
                    <img
                      src={photoPath}
                      alt={`Task photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(photoPath)}
                        className="p-1.5 rounded-md bg-white/90 hover:bg-white text-slate-800 transition-colors cursor-pointer"
                        title="View photo"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photoPath)}
                        className="p-1.5 rounded-md bg-rose-600/90 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Upload Tile if under 5 photos */}
                {imagePaths.length < 5 && (
                  <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg flex flex-col items-center justify-center p-2 aspect-square cursor-pointer bg-white hover:bg-teal-50/30 transition-all text-center group">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploadingImages}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    {isUploadingImages ? (
                      <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-teal-600 mb-1 transition-colors" />
                        <span className="text-[10px] font-bold text-slate-700 group-hover:text-teal-700">Add Photo</span>
                        <span className="text-[9px] text-slate-400">JPG, PNG, WebP</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Checklists with Granular Audit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>Checklist ({completedChecklistCount}/{checklists.length})</span>
                </div>
                {checklists.length > 0 && (
                  <span className="text-xs font-semibold text-slate-600">{checklistProgress}%</span>
                )}
              </div>

              {/* Progress bar */}
              {checklists.length > 0 && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 mb-3">
                {checklists.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id, item.is_completed)}
                    className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => {}} // handled by parent div
                      className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 bg-white cursor-pointer"
                    />
                    <div className="flex-1 text-xs">
                      <span className={item.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}>
                        {item.content}
                      </span>
                      {item.is_completed && item.completed_at && (
                        <div className="text-[10px] text-teal-700 mt-0.5 font-medium">
                          Checked off {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add checklist item form */}
              <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Add a checklist item (e.g. check food temp)..."
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Comments Feed */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span>Comments & Shift Handoff Notes</span>
              </div>

              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No notes posted on this task yet.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <img
                        src={comment.user_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(comment.user_name || 'U')}`}
                        alt={comment.user_name}
                        className="w-7 h-7 rounded-md object-cover bg-slate-200 shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">{comment.user_name || 'Staff Member'}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{comment.comment_text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Write a shift note or mention a colleague..."
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* Front-End Card Activity Audit Log */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                <History className="w-4 h-4 text-teal-600" />
                <span>Card Activity History</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {cardActivities.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Created recently.</p>
                ) : (
                  cardActivities.map((act) => {
                    const d = act.details || {};
                    const user = act.user_name || 'Staff Member';

                    let message: React.ReactNode;
                    if (act.action_type === 'moved_card') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> moved card from{' '}
                          <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 text-[10px]">
                            {d.from_list || 'Column'}
                          </span>{' '}
                          to{' '}
                          <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 text-[10px]">
                            {d.to_list || 'Column'}
                          </span>
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_title') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> updated title to{' '}
                          <span className="font-medium text-slate-800">&quot;{d.new_title || title}&quot;</span>
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_description') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> updated description
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_priority') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> updated priority to{' '}
                          <span className="font-bold uppercase text-[10px] text-teal-700">{d.priority || priority}</span>
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_due_date') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> updated due date
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_assignee') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong>{' '}
                          {d.assignee_name ? `assigned card to ${d.assignee_name}` : 'unassigned card'}
                        </span>
                      );
                    } else if (act.action_type === 'updated_card_labels') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> updated station labels
                        </span>
                      );
                    } else if (act.action_type === 'completed_card') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> marked card as Done
                        </span>
                      );
                    } else if (act.action_type === 'uncompleted_card') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> reopened card
                        </span>
                      );
                    } else if (act.action_type === 'completed_checklist_item') {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> checked off &quot;{d.item_content || 'prep item'}&quot;
                        </span>
                      );
                    } else if (d.summary) {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> {d.summary}
                        </span>
                      );
                    } else {
                      message = (
                        <span>
                          <strong className="text-slate-900 font-semibold">{user}</strong> {act.action_type.replace(/_/g, ' ')}
                        </span>
                      );
                    }

                    return (
                      <div key={act.id} className="text-[11px] text-slate-600 flex items-center justify-between py-1.5 border-b border-slate-100 gap-2">
                        <div className="flex-1 leading-snug">{message}</div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Sidebar Controls (1 Col) */}
          <div className="space-y-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            
            {/* Assigned Member */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>Assigned To</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => {
                  setAssignedTo(e.target.value);
                  handleSaveDetails({ assigned_to: e.target.value || null });
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Unassigned --</option>
                {boardMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_name} ({m.user_role})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Shift Priority
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      handleSaveDetails({ priority: p });
                    }}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold capitalize border transition-all text-center ${
                      priority === p
                        ? p === 'urgent'
                          ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                          : p === 'high'
                          ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-sm'
                          : 'bg-teal-600 text-white border-teal-500 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date & Pop-Up Calendar Picker */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>Due Date</span>
                </span>
                <span className="text-[10px] text-teal-700 flex items-center gap-1 font-semibold" title="Sync with Google Calendar configured">
                  <CalendarSync className="w-3 h-3" /> GCal Sync
                </span>
              </label>

              {/* Clickable button that pops up the calendar */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="w-full bg-white hover:bg-slate-50 border border-slate-300 hover:border-teal-500 rounded-lg px-3 py-2.5 text-xs text-left text-slate-800 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
                  {card.due_date ? (
                    <span className="font-semibold text-slate-900">
                      {new Date(card.due_date).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {new Date(card.due_date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">+ Choose shift due date & time...</span>
                  )}
                </div>
                <span className="text-[10px] text-teal-700 font-bold uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {card.due_date ? 'Change' : 'Pick Date'}
                </span>
              </button>

              {/* POP-UP CALENDAR MODAL */}
              {isCalendarOpen && (
                <div 
                  className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
                  onClick={() => setIsCalendarOpen(false)}
                >
                  <div
                    className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header with Month / Year Navigation */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="font-bold text-slate-900 text-sm">
                        {monthNames[calMonth]} {calYear}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                          title="Previous Month"
                        >
                          &larr;
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                          title="Next Month"
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('today')}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Today (11 PM)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('tomorrow')}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Tomorrow (8 AM)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('weekend')}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Weekend (6 PM)
                      </button>
                    </div>

                    {/* Interactive Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                        <div key={d} className="font-bold text-slate-400 text-[10px] py-1">
                          {d}
                        </div>
                      ))}
                      {/* Blank placeholders before first day of month */}
                      {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }).map((_, idx) => (
                        <div key={`blank-${idx}`} className="py-1.5" />
                      ))}
                      {/* Days of month */}
                      {Array.from({ length: new Date(calYear, calMonth + 1, 0).getDate() }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const isSelected = calDay === dayNum;
                        const isToday =
                          new Date().getDate() === dayNum &&
                          new Date().getMonth() === calMonth &&
                          new Date().getFullYear() === calYear;

                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => setCalDay(dayNum)}
                            className={`py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600 text-white font-bold shadow-sm'
                                : isToday
                                ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Time Picker Controls */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Shift Time:</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={calHour}
                          onChange={(e) => setCalHour(e.target.value)}
                          className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                        >
                          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-slate-400">:</span>
                        <select
                          value={calMinute}
                          onChange={(e) => setCalMinute(e.target.value)}
                          className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                        >
                          {['00','15','30','45'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setCalAmPm(calAmPm === 'AM' ? 'PM' : 'AM')}
                          className="px-2 py-1 rounded-md bg-slate-100 font-bold text-teal-700 hover:bg-slate-200 cursor-pointer"
                        >
                          {calAmPm}
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleClearDueDate}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                      >
                        Clear Date
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCalendarOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!calDay}
                          onClick={handleApplyCalendarDate}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          Save Date
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Labels Selector & Management */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-600" />
                  <span>Station Labels</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingLabel(!isAddingLabel);
                      setEditingCardLabelId(null);
                    }}
                    className="text-[10px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isAddingLabel ? 'Close' : 'Add / Edit'}</span>
                  </button>
                  {onOpenLabelsManager && (
                    <button
                      type="button"
                      onClick={onOpenLabelsManager}
                      className="text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                      title="Open full board labels manager"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Label Creation & Editor Panel */}
              {isAddingLabel && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3 shadow-sm">
                  <form onSubmit={handleCreateAndAttachLabel} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                        + New Board Label
                      </span>
                      <span className="text-[10px] text-slate-500">Auto-attaches to task</span>
                    </div>

                    <input
                      type="text"
                      value={newCardLabelName}
                      onChange={(e) => setNewCardLabelName(e.target.value)}
                      placeholder="e.g. VIP Service, Pastry Prep, Urgent..."
                      className="w-full bg-white border border-slate-300 focus:border-teal-500 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                    />

                    {/* Color Swatches */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {CARD_LABEL_PRESETS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewCardLabelColor(col)}
                          className={`w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-transform ${
                            newCardLabelColor === col ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: col }}
                        >
                          {newCardLabelColor === col && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={newCardLabelColor}
                        onChange={(e) => setNewCardLabelColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent ml-1"
                        title="Pick custom color"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500">Preview:</span>
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-xs"
                          style={{ backgroundColor: newCardLabelColor }}
                        >
                          {newCardLabelName.trim() || 'Sample'}
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={!newCardLabelName.trim()}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-md shadow-sm cursor-pointer"
                      >
                        Create & Select
                      </button>
                    </div>
                  </form>

                  {/* Quick Edit Existing Labels Sub-list */}
                  {boardLabels.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Edit Existing Labels:
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {boardLabels.map((lbl) => {
                          const isEditingThis = editingCardLabelId === lbl.id;

                          if (isEditingThis) {
                            return (
                              <div key={lbl.id} className="p-2 bg-slate-50 rounded-md border border-teal-500 space-y-2">
                                <input
                                  type="text"
                                  value={editingCardLabelName}
                                  onChange={(e) => setEditingCardLabelName(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                                />
                                <div className="flex flex-wrap gap-1 items-center">
                                  {CARD_LABEL_PRESETS.slice(0, 6).map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => setEditingCardLabelColor(c)}
                                      className={`w-4 h-4 rounded-full border ${editingCardLabelColor === c ? 'border-slate-800' : 'border-transparent'}`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCardLabelId(null)}
                                    className="px-2 py-0.5 text-[10px] text-slate-500"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditLabel(lbl.id)}
                                    className="px-2 py-0.5 bg-teal-600 text-white font-bold text-[10px] rounded"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={lbl.id} className="flex items-center justify-between p-1.5 bg-slate-50 hover:bg-slate-100 rounded-md text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                                <span className="text-slate-800 text-[11px] truncate max-w-[120px] font-medium">{lbl.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCardLabelId(lbl.id);
                                    setEditingCardLabelName(lbl.name);
                                    setEditingCardLabelColor(lbl.color);
                                  }}
                                  className="p-1 text-slate-500 hover:text-slate-900"
                                  title="Edit name and color"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                 {confirmDeleteLabelId === lbl.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExistingLabel(lbl.id)}
                                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-colors shadow-xs"
                                        title="Confirm label deletion"
                                      >
                                        Delete?
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteLabelId(null)}
                                        className="px-1 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] rounded cursor-pointer"
                                        title="Cancel"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteLabelId(lbl.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Delete label"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Labels Chip Grid for Selection & Quick Delete */}
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No labels created on this board yet. Click &quot;Add / Edit&quot; to make one.</p>
                ) : (
                  boardLabels.map((label) => {
                    const isSelected = selectedLabelIds.includes(label.id);
                    return (
                      <div
                        key={label.id}
                        className={`group inline-flex items-center rounded-md text-xs font-medium border transition-all ${
                          isSelected
                            ? 'text-white border-slate-700 shadow-sm ring-1 ring-slate-800'
                            : 'opacity-85 border-transparent hover:opacity-100 text-white'
                        }`}
                        style={{
                          backgroundColor: label.color,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleLabel(label.id)}
                          className="px-2 py-1 flex items-center gap-1.5 cursor-pointer text-left"
                          title={isSelected ? 'Click to detach from task' : 'Click to attach to task'}
                        >
                          <span>{label.name}</span>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </button>

                        {/* Inline delete shortcut for this label */}
                        {confirmDeleteLabelId === label.id ? (
                          <div className="flex items-center gap-0.5 pr-1 pl-0.5 bg-black/40 rounded-r-md">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteExistingLabel(label.id);
                              }}
                              className="px-1 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded cursor-pointer"
                              title="Delete label permanently from board"
                            >
                              Delete?
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteLabelId(null);
                              }}
                              className="px-1 py-0.5 text-white/80 hover:text-white text-[9px] cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteLabelId(label.id);
                            }}
                            className="p-1 text-white/60 hover:text-white hover:bg-black/20 rounded-r-md cursor-pointer transition-colors"
                            title="Delete label from board"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Shift Watchers List */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-teal-600" />
                <span>Watching Members ({card.watchers?.length || 0})</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Watching members receive immediate alerts on task shifts and kitchen updates.
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* Lightbox Photo Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden p-2 shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Full preview"
              className="max-h-[85vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
