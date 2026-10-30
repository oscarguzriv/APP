import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, Shield, Check, Info } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

interface NotificationSettingsModalProps {
  isDarkMode?: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({ isDarkMode = false, onClose }: NotificationSettingsModalProps) {
  const [preferences, setPreferences] = useState({
    inapp_mention_description: true,
    inapp_mention_comment: true,
    inapp_card_modification: true,
    email_mention_description: true,
    email_mention_comment: true,
    email_card_modification: true,
    email_welcome: true,
    email_password_reset: true,
  });
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'preferences' | 'logs'>('preferences');
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPreferencesAndLogs = async () => {
      setIsLoading(true);
      try {
        const prefRes = await apiFetch('/api/user/preferences');
        if (prefRes.ok) {
          const data = await prefRes.json();
          if (data.success && data.preferences) {
            setPreferences(data.preferences);
          }
        }
        const logRes = await apiFetch('/api/admin/email-logs');
        if (logRes.ok) {
          const data = await logRes.json();
          if (data.success) {
            setEmailLogs(data.emailLogs || []);
          }
        }
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferencesAndLogs();
  }, []);

  const handleToggle = async (key: string) => {
    const updated = { ...preferences, [key]: !(preferences as any)[key] };
    setPreferences(updated);
    setSaving(true);
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to update preference:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className={isDarkMode ? "w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" : "w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"}>
        
        {/* Header */}
        <div className={isDarkMode ? "px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900" : "px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50"}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className={isDarkMode ? "font-bold text-slate-100 text-base" : "font-bold text-slate-900 text-base"}>
                Notification & Email Settings
              </h3>
              <p className="text-xs text-slate-500">
                Manage your in-app alerts and email notification subscriptions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={isDarkMode ? "px-6 py-2 border-b border-slate-800 flex gap-4 bg-slate-900/50" : "px-6 py-2 border-b border-slate-100 flex gap-4 bg-slate-50/50"}>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeTab === 'preferences' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Preferences & Toggles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeTab === 'logs' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Simulated Email Logs ({emailLogs.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading preferences...</div>
          ) : activeTab === 'preferences' ? (
            <div className="space-y-6">
              
              {/* In-App Alerts */}
              <div>
                <h4 className={isDarkMode ? "font-bold text-xs uppercase tracking-wider text-teal-400 mb-3" : "font-bold text-xs uppercase tracking-wider text-teal-700 mb-3"}>
                  In-App Notifications
                </h4>
                <div className="space-y-3">
                  <ToggleRow
                    label="Mentions in Card Descriptions"
                    description="Get alerted when someone tags @you in a task description."
                    checked={preferences.inapp_mention_description}
                    onChange={() => handleToggle('inapp_mention_description')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Mentions in Comments"
                    description="Get alerted when someone tags @you in a task comment."
                    checked={preferences.inapp_mention_comment}
                    onChange={() => handleToggle('inapp_mention_comment')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Card Modifications"
                    description="Get alerted when tasks you created or are assigned to are modified."
                    checked={preferences.inapp_card_modification}
                    onChange={() => handleToggle('inapp_card_modification')}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              {/* Email Alerts */}
              <div className="pt-4 border-t border-slate-800/50">
                <h4 className={isDarkMode ? "font-bold text-xs uppercase tracking-wider text-teal-400 mb-3" : "font-bold text-xs uppercase tracking-wider text-teal-700 mb-3"}>
                  Email Notifications
                </h4>
                <div className="space-y-3">
                  <ToggleRow
                    label="Email on Description Mentions"
                    description="Receive an email alert when tagged @you in a task description."
                    checked={preferences.email_mention_description}
                    onChange={() => handleToggle('email_mention_description')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Email on Comment Mentions"
                    description="Receive an email alert when tagged @you in a comment."
                    checked={preferences.email_mention_comment}
                    onChange={() => handleToggle('email_mention_comment')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Email on Card Modifications"
                    description="Receive email updates for tasks you are related to."
                    checked={preferences.email_card_modification}
                    onChange={() => handleToggle('email_card_modification')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Welcome Emails"
                    description="Receive onboarding and welcome emails upon account creation."
                    checked={preferences.email_welcome}
                    onChange={() => handleToggle('email_welcome')}
                    isDarkMode={isDarkMode}
                  />
                  <ToggleRow
                    label="Password Reset Emails"
                    description="Receive password recovery tokens via email."
                    checked={preferences.email_password_reset}
                    onChange={() => handleToggle('email_password_reset')}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-500/10 text-teal-500 text-xs">
                <Info className="w-4 h-4 shrink-0" />
                <span>Simulated email dispatch records for testing & staging verification.</span>
              </div>
              {emailLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">No email logs recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {emailLogs.map((log) => (
                    <div
                      key={log.id}
                      className={isDarkMode ? "p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2" : "p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-teal-500 uppercase tracking-wide text-[10px] px-2 py-0.5 rounded bg-teal-500/10">
                          {log.type}
                        </span>
                        <span className="text-slate-400">
                          {new Date(log.sent_at).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <h5 className={isDarkMode ? "font-bold text-slate-100 text-sm" : "font-bold text-slate-900 text-sm"}>
                          {log.subject}
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          To: <span className="font-medium text-slate-200">{log.recipient_name} &lt;{log.recipient_email}&gt;</span>
                        </p>
                      </div>
                      <div
                        className={isDarkMode ? "mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 overflow-x-auto" : "mt-2 p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 overflow-x-auto"}
                        dangerouslySetInnerHTML={{ __html: log.body_html }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={isDarkMode ? "px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900" : "px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50"}>
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            {saving ? 'Saving changes...' : 'Preferences auto-saved'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, isDarkMode }: any) {
  return (
    <div className={isDarkMode ? "flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800" : "flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"}>
      <div>
        <h5 className={isDarkMode ? "font-semibold text-xs text-slate-200" : "font-semibold text-xs text-slate-900"}>
          {label}
        </h5>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {description}
        </p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
      </label>
    </div>
  );
}
