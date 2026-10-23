import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../lib/api.ts';
import {
  QrCode,
  Link,
  Copy,
  Check,
  X,
  Clock,
  Shield,
  Trash2,
  Users,
  Smartphone,
  Printer,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface HospitalityInviteModalProps {
  boardId: string;
  boardTitle: string;
  currentUser: any;
  onClose: () => void;
  onNotification?: (msg: string, type?: 'success' | 'delete' | 'user' | 'error') => void;
}

export default function HospitalityInviteModal({
  boardId,
  boardTitle,
  currentUser,
  onClose,
  onNotification,
}: HospitalityInviteModalProps) {
  const [role, setRole] = useState<'Member' | 'Viewer'>('Member');
  const [expiresInHours, setExpiresInHours] = useState<number>(72);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentInvitation, setCurrentInvitation] = useState<any | null>(null);
  const [existingInvitations, setExistingInvitations] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing invitations for this board
  const fetchInvitations = async () => {
    try {
      setIsLoadingList(true);
      const res = await apiFetch(`/api/invitations/board/${boardId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.invitations)) {
          setExistingInvitations(data.invitations);
          if (data.invitations.length > 0 && !currentInvitation) {
            setCurrentInvitation(data.invitations[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load board invitations:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [boardId]);

  // Generate new invitation link and QR code
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const res = await apiFetch('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          board_id: boardId,
          role,
          expires_in_hours: expiresInHours,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create QR code invitation.');
      }

      setCurrentInvitation(data.invitation);
      setExistingInvitations((prev) => [data.invitation, ...prev]);
      if (onNotification) {
        onNotification('QR Code invite link generated! Ready to scan or share.', 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Could not generate invitation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke invitation
  const handleRevoke = async (id: string) => {
    try {
      const res = await apiFetch(`/api/invitations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExistingInvitations((prev) => prev.filter((i) => i.id !== id));
        if (currentInvitation?.id === id) {
          setCurrentInvitation(null);
        }
        if (onNotification) {
          onNotification('Invitation link revoked.', 'delete');
        }
      }
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    }
  };

  const getFullJoinUrl = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/join/${token}`;
  };

  const handleCopyLink = (token: string) => {
    const url = getFullJoinUrl(token);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onNotification) {
        onNotification('Invite URL copied to clipboard!', 'success');
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const activeToken = currentInvitation?.token;
  const activeUrl = activeToken ? getFullJoinUrl(activeToken) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <QrCode className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Crew Onboarding</h2>
              <p className="text-xs text-teal-100 line-clamp-1">
                QR Code & Instant Join Link for <span className="font-semibold text-white">{boardTitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Generator Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
             <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Generate New Team Invite
              </span>
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                No Email/SMTP Needed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Assign Board Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="Member">Crew Member (Member)</option>
                  <option value="Viewer">Observer / Auditing (Viewer)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Link Expiration
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value={24}>24 Hours (Next Day)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                  <option value={72}>72 Hours (Weekend Work)</option>
                  <option value={168}>7 Days (Full Week)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating Secure QR Code...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-teal-200" />
                  <span>Generate QR Code & Join Link</span>
                </>
              )}
            </button>
          </div>

          {/* Active QR Code Display */}
          {currentInvitation ? (
            <div className="bg-white border-2 border-dashed border-teal-300 rounded-2xl p-5 text-center space-y-4">
              <div className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 inline-block">
                  <QRCodeSVG
                    value={activeUrl}
                    size={190}
                    level="H"
                    includeMargin={true}
                    className="rounded-lg"
                  />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <Smartphone className="w-4 h-4 text-teal-600" />
                  <span>Scan with mobile phone camera to join immediately</span>
                </div>
              </div>

              {/* URL Display and Copy */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-left">
                  <Link className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                  <input
                    type="text"
                    readOnly
                    value={activeUrl}
                    className="w-full bg-transparent text-xs text-slate-700 font-mono focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeToken)}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>Role: <strong className="text-slate-800">{currentInvitation.role}</strong></span>
                  <span>
                    Expires: <strong className="text-slate-800">
                      {new Date(currentInvitation.expires_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                  <span>Redemptions: <strong className="text-teal-700">{currentInvitation.used_count || 0}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No active QR code selected</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Click "Generate QR Code & Join Link" above</p>
            </div>
          )}

          {/* Active Invitations List */}
          {existingInvitations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Active Team Links ({existingInvitations.length})
                </span>
                <span className="text-[10px] text-slate-500">Tap to view QR</span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {existingInvitations.map((inv) => {
                  const isCurrent = currentInvitation?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setCurrentInvitation(inv)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className={`w-4 h-4 ${isCurrent ? 'text-teal-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>Role: {inv.role}</span>
                            <span className="text-[10px] font-normal text-slate-500">
                              • {inv.used_count || 0} joined
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Expires {new Date(inv.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLink(inv.token);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevoke(inv.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Revoke Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>Team invites auto-expire for security</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
