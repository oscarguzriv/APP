import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.ts';
import { 
  Building2, 
  ChefHat, 
  Plus, 
  Layout, 
  Archive, 
  Bell, 
  Clock, 
  LogOut, 
  CheckCircle2, 
  Calendar, 
  Layers, 
  Lock, 
  ShieldCheck, 
  Users, 
  ChevronRight, 
  Sparkles,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  Search
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  role: 'Admin/Group Owner' | 'Manager' | 'Staff';
  avatar_url?: string;
}

interface Board {
  id: string;
  title: string;
  description?: string;
  background_value: string;
  is_closed: boolean;
  closed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ActivityLog {
  id: string;
  board_id: string;
  action_type: string;
  details: any;
  created_at: string;
  user_name?: string;
}

interface DashboardProps {
  currentUser: User;
  onLogout: () => void;
  onSelectBoard: (boardId: string) => void;
  onSwitchUser?: (email: string) => void;
}

export default function Dashboard({
  currentUser,
  onLogout,
  onSelectBoard,
  onSwitchUser,
}: DashboardProps) {
  const [activeBoards, setActiveBoards] = useState<Board[]>([]);
  const [closedBoards, setClosedBoards] = useState<Board[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Board Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newBoardBackground, setNewBoardBackground] = useState('#0f172a');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Tab state for mobile/desktop switcher: 'boards' | 'closed' | 'activity'
  const [activeTab, setActiveTab] = useState<'boards' | 'closed' | 'activity'>('boards');

  // All users can create boards; managers and admins have company-wide board oversight
  const canCreateBoard = true;

  // Fetch Boards & Activities
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setActiveBoards(data.activeBoards || []);
        setClosedBoards(data.closedBoards || []);
      }

      // Load activities from first board if available
      const boardsRes = await apiFetch('/api/boards');
      const bData = await boardsRes.json();
      if (bData.activeBoards && bData.activeBoards.length > 0) {
        const firstBoardRes = await apiFetch(`/api/boards/${bData.activeBoards[0].id}`);
        if (firstBoardRes.ok) {
          const fbData = await firstBoardRes.json();
          setRecentActivities(fbData.activityLogs || []);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await apiFetch('/api/boards', {
        method: 'POST',
        body: JSON.stringify({
          title: newBoardTitle.trim(),
          description: newBoardDescription.trim(),
          background_value: newBoardBackground,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create board.');
      }

      // Add to list and close modal
      setActiveBoards([data.board, ...activeBoards]);
      setIsCreateModalOpen(false);
      setNewBoardTitle('');
      setNewBoardDescription('');
      
      // Auto open newly created board
      onSelectBoard(data.board.id);
    } catch (err: any) {
      setCreateError(err.message || 'Error creating board.');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredActiveBoards = activeBoards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredClosedBoards = closedBoards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatAction = (action: string) => {
    switch (action) {
      case 'created_card': return 'created task';
      case 'moved_card': return 'moved card';
      case 'updated_card_title': return 'updated title';
      case 'updated_card_description': return 'updated description';
      case 'updated_card_priority': return 'updated priority';
      case 'updated_card_due_date': return 'updated due date';
      case 'updated_card_assignee': return 'updated assignee';
      case 'updated_card_labels': return 'updated labels';
      case 'updated_card': return 'updated task';
      case 'completed_card': return 'marked task done';
      case 'uncompleted_card': return 'reopened task';
      case 'commented_on_card': return 'commented';
      case 'completed_checklist_item': return 'checked off item';
      case 'created_user': return 'created user';
      case 'invited_member': return 'invited member';
      default: return action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand & Property */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shadow-teal-600/20">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                PrimeShift
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                Ops Portal
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span className="truncate max-w-[200px] sm:max-w-xs">{currentUser.company}</span>
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Switcher (Helps testing Admin vs Manager vs Staff quickly) */}
          {onSwitchUser && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
              <span className="px-2 text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" /> Test as:
              </span>
              <button
                type="button"
                onClick={() => onSwitchUser('admin@grandregency.com')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  currentUser.role === 'Admin/Group Owner'
                    ? 'bg-teal-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => onSwitchUser('manager@grandregency.com')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  currentUser.role === 'Manager'
                    ? 'bg-teal-700 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => onSwitchUser('staff@grandregency.com')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  currentUser.role === 'Staff'
                    ? 'bg-teal-500 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Staff
              </button>
            </div>
          )}

          {/* User Card */}
          <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
            <img
              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
              alt={currentUser.name}
              className="w-7 h-7 rounded-md object-cover bg-slate-200 ring-1 ring-teal-500/30"
            />
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 leading-tight">{currentUser.name}</div>
              <div className="text-[10px] text-teal-700 font-medium leading-none mt-0.5">
                {currentUser.role}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            title="Log Out"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Hospitality Banner / Role Overview */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Signed in as {currentUser.role}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Shift Operations & Kanban Boards
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                {currentUser.role === 'Admin/Group Owner' &&
                  'Full privileges: Create and oversee boards across all hotel stations, manage roles, and review audit trails.'}
                {currentUser.role === 'Manager' &&
                  'Manager access: Create shift boards, look into all department boards across the property, and monitor tasks.'}
                {currentUser.role === 'Staff' &&
                  'Station access: Create your own operations boards, collaborate with your team, and complete tasks.'}
              </p>
            </div>

            {/* Create Board CTA */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Board</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Mobile Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tab Navigation */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('boards')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'boards'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Active Boards ({activeBoards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'closed'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Closed ({closedBoards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'activity'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Activity</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boards..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTENT: ACTIVE BOARDS */}
        {/* ========================================================================= */}
        {activeTab === 'boards' && (
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-40 bg-white border border-slate-200 rounded-xl p-5" />
                ))}
              </div>
            ) : filteredActiveBoards.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
                <Layout className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No active boards found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Click 'Create New Board' above to launch a station operations board.
                </p>
                {canCreateBoard && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Board</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredActiveBoards.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => onSelectBoard(board.id)}
                    className="group relative bg-white border border-slate-200 hover:border-teal-400 rounded-xl p-5 transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Color accent line */}
                      <div
                        className="w-10 h-1.5 rounded-full mb-3"
                        style={{ backgroundColor: board.background_value || '#0d9488' }}
                      />
                      <h4 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition-colors line-clamp-1">
                        {board.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 min-h-[32px]">
                        {board.description || 'Hospitality Kanban operations & shift tracking.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(board.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-teal-600 font-semibold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Open Board &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB CONTENT: CLOSED / ARCHIVED BOARDS (TABLE WITH SHARP CORNERS) */}
        {/* ========================================================================= */}
        {activeTab === 'closed' && (
          <div>
            {filteredClosedBoards.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
                <Archive className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No closed boards</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Archived boards from previous shifts and events will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse rounded-none">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Board Name</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Closed Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClosedBoards.map((board) => (
                      <tr
                        key={board.id}
                        onClick={() => onSelectBoard(board.id)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: board.background_value || '#0d9488' }}
                          />
                          {board.title}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {board.description || 'Closed shift board.'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {board.closed_at ? new Date(board.closed_at).toLocaleDateString() : 'Archived'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-teal-600 font-semibold text-xs hover:underline">
                            View &rarr;
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB CONTENT: RECENT ACTIVITY AUDIT TABLE (SHARP CORNERS) */}
        {/* ========================================================================= */}
        {activeTab === 'activity' && (
          <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                Live Shift Audit Trail
              </h3>
              <button
                type="button"
                onClick={loadDashboardData}
                className="text-xs text-slate-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center">No recent activity logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse rounded-none">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {recentActivities.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                          {act.user_name || 'Staff Member'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                            {formatAction(act.action_type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {act.action_type === 'moved_card' ? (
                            <span>
                              Moved card <strong className="font-semibold text-slate-900">"{act.details?.card_title || act.details?.title || 'task'}"</strong> from{' '}
                              <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {act.details?.from_list || 'Column 1'}
                              </span>{' '}
                              to{' '}
                              <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                {act.details?.to_list || 'Column 2'}
                              </span>
                            </span>
                          ) : act.action_type === 'updated_card_title' ? (
                            <span>
                              Updated title {act.details?.old_title ? <span>from <span className="text-slate-500">"{act.details.old_title}"</span> to </span> : 'to '}
                              <strong className="font-semibold text-slate-900">"{act.details?.new_title || act.details?.card_title}"</strong>
                            </span>
                          ) : act.action_type === 'updated_card_description' ? (
                            <span>
                              Updated description for <strong className="font-semibold text-slate-900">"{act.details?.card_title || 'task'}"</strong>
                            </span>
                          ) : act.action_type === 'updated_card_priority' ? (
                            <span>
                              Updated priority of <strong className="font-semibold text-slate-900">"{act.details?.card_title || 'task'}"</strong> to{' '}
                              <span className="font-bold uppercase text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                {act.details?.priority}
                              </span>
                            </span>
                          ) : act.action_type === 'updated_card_due_date' ? (
                            <span>
                              Updated due date for <strong className="font-semibold text-slate-900">"{act.details?.card_title || 'task'}"</strong>
                              {act.details?.due_date ? ` (${new Date(act.details.due_date).toLocaleDateString()})` : ''}
                            </span>
                          ) : act.action_type === 'updated_card_assignee' ? (
                            <span>
                              {act.details?.assignee_name
                                ? `Assigned "${act.details?.card_title || 'task'}" to ${act.details.assignee_name}`
                                : `Unassigned "${act.details?.card_title || 'task'}"`}
                            </span>
                          ) : act.action_type === 'updated_card_labels' ? (
                            <span>
                              Updated labels on <strong className="font-semibold text-slate-900">"{act.details?.card_title || 'task'}"</strong>
                            </span>
                          ) : act.action_type === 'created_user' ? (
                            <span>
                              Created user <strong className="font-semibold text-slate-900">{act.details?.created_name}</strong> ({act.details?.role || 'Staff'}) and added to board
                            </span>
                          ) : act.action_type === 'invited_member' ? (
                            <span>
                              Invited <strong className="font-semibold text-slate-900">{act.details?.invited_name}</strong> ({act.details?.role || 'Member'}) to board
                            </span>
                          ) : act.details?.summary ? (
                            <span>{act.details.summary}</span>
                          ) : (
                            <span>
                              {act.details?.title && <strong className="font-medium text-slate-900">"{act.details.title}"</strong>}
                              {act.details?.card_title && <strong className="font-medium text-slate-900">"{act.details.card_title}"</strong>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* CREATE BOARD MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Operations Board</h3>
            <p className="text-xs text-slate-500 mb-5">
              Set up a private Kanban board for a station, department, or special event.
            </p>

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Board Title
                </label>
                <input
                  type="text"
                  required
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  placeholder="e.g., Banquets & Catering - Weekend Service"
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description / Shift Objectives
                </label>
                <textarea
                  rows={2}
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  placeholder="Goals, allergen protocols, or shift supervisor instructions..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Station Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {[
                    { color: '#0d9488', label: 'Light Teal' },
                    { color: '#0284c7', label: 'Sky Blue' },
                    { color: '#059669', label: 'Emerald' },
                    { color: '#d97706', label: 'Amber' },
                    { color: '#e11d48', label: 'Rose' },
                    { color: '#7c3aed', label: 'Violet' },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setNewBoardBackground(preset.color)}
                      style={{ backgroundColor: preset.color }}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        newBoardBackground === preset.color
                          ? 'border-slate-800 scale-110 shadow-md ring-2 ring-teal-500/40'
                          : 'border-transparent hover:scale-105'
                      }`}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Board & Default Lists'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
