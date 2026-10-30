import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Settings } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import NotificationSettingsModal from './NotificationSettingsModal.tsx';

interface NotificationCenterProps {
  isDarkMode?: boolean;
  onSelectBoard?: (boardId: string, cardId?: string) => void;
}

export default function NotificationCenter({ isDarkMode = false, onSelectBoard }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={isDarkMode ? "relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer" : "relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={isDarkMode ? "absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden" : "absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden"}>
          <div className={isDarkMode ? "px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50" : "px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"}>
            <div className="flex items-center gap-2">
              <h3 className={isDarkMode ? "font-bold text-slate-100 text-sm" : "font-bold text-slate-900 text-sm"}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className={isDarkMode ? "text-xs text-slate-400 hover:text-teal-400 p-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer" : "text-xs text-slate-600 hover:text-teal-700 p-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"}
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowSettings(true);
                }}
                className={isDarkMode ? "text-xs text-slate-400 hover:text-teal-400 p-1 rounded-md transition-colors cursor-pointer" : "text-xs text-slate-600 hover:text-teal-700 p-1 rounded-md transition-colors cursor-pointer"}
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/50">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-40" />
                <p className={isDarkMode ? "text-xs text-slate-400 font-medium" : "text-xs text-slate-500 font-medium"}>
                  No notifications yet
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Mentions and task updates will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    handleMarkAsRead(n.id);
                    if (n.board_id && onSelectBoard) {
                      onSelectBoard(n.board_id, n.card_id);
                      setIsOpen(false);
                    }
                  }}
                  className={isDarkMode ? `p-3.5 transition-colors cursor-pointer hover:bg-slate-800/60 ${!n.is_read ? 'bg-slate-800/30' : ''}` : `p-3.5 transition-colors cursor-pointer hover:bg-slate-50 ${!n.is_read ? 'bg-teal-50/40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={isDarkMode ? "font-semibold text-xs text-slate-200" : "font-semibold text-xs text-slate-900"}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={isDarkMode ? "text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed" : "text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed"}>
                    {n.message}
                  </p>
                  {!n.is_read && (
                    <div className="mt-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Mark read
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <NotificationSettingsModal
          isDarkMode={isDarkMode}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
