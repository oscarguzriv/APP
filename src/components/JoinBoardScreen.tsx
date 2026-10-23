import React, { useState, useEffect } from 'react';
import { apiFetch, setStoredToken, setStoredUser } from '../lib/api.ts';
import {
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Sparkles,
  QrCode
} from 'lucide-react';

interface JoinBoardScreenProps {
  token: string;
  currentUser: any | null;
  onJoinedBoard: (boardId: string) => void;
  onGoToLogin: () => void;
}

export default function JoinBoardScreen({
  token,
  currentUser,
  onJoinedBoard,
  onGoToLogin,
}: JoinBoardScreenProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [invitation, setInvitation] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth form states for unauthenticated visitors
  const [isNewAccount, setIsNewAccount] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        setIsValidating(true);
        setErrorMessage(null);

        const res = await apiFetch(`/api/invitations/${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'This invitation is invalid or has expired.');
        }

        setInvitation(data.invitation);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to validate invitation.');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Handle logged-in user accepting the invite
  const handleAcceptLoggedIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await apiFetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation.');
      }

      onJoinedBoard(data.board_id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not join board.');
      setIsSubmitting(false);
    }
  };

  // Handle sign up or log in with invite token
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    try {
      if (isNewAccount) {
        // Sign up with inviteToken
        const res = await apiFetch('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            password,
            company: invitation?.company || 'Grand Regency Hotel & Resort',
            role: 'Staff',
            inviteToken: token,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Could not create account.');
        }

        if (data.token) setStoredToken(data.token);
        if (data.user) setStoredUser(data.user);

        onJoinedBoard(data.joined_board_id || invitation?.board_id);
      } else {
        // Existing user login
        const loginRes = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();

        if (!loginRes.ok || !loginData.success) {
          throw new Error(loginData.error || 'Invalid email or password.');
        }

        if (loginData.token) setStoredToken(loginData.token);
        if (loginData.user) setStoredUser(loginData.user);

        // Redeem invitation for this user
        const acceptRes = await apiFetch(`/api/invitations/${token}/accept`, {
          method: 'POST',
        });
        const acceptData = await acceptRes.json();

        onJoinedBoard(acceptData.board_id || invitation?.board_id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error.');
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold">Verifying Hospitality QR Code...</h2>
        <p className="text-xs text-slate-400 mt-1">Checking team credentials and permissions</p>
      </div>
    );
  }

  if (errorMessage || !invitation) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invitation Expired or Invalid</h2>
            <p className="text-xs text-slate-500 mt-1">
              {errorMessage || 'This QR Code or link has expired or reached maximum uses.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToLogin}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Go to RoxCrew Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative z-10">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 p-6 text-white text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20">
            <QrCode className="w-6 h-6 text-teal-200" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-teal-200 bg-white/10 px-2.5 py-0.5 rounded-full">
            Hospitality Crew Onboarding
          </span>
          <h1 className="text-lg font-bold mt-2 tracking-tight">You're Invited!</h1>
          <p className="text-xs text-teal-100 mt-0.5">
            Join <strong className="text-white">{invitation.board_title}</strong>
          </p>
        </div>

        {/* Board Meta Badge */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-slate-800">{invitation.company}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
            Role: {invitation.role}
          </span>
        </div>

        {/* Action Body */}
        <div className="p-6">
          {currentUser ? (
            /* User already authenticated */
            <div className="space-y-5 text-center">
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Signed in as {currentUser.name}</div>
                    <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-teal-200/60 text-xs text-teal-900">
                  Invited by <strong>{invitation.inviter_name}</strong> to join station operations.
                </div>
              </div>

              <button
                type="button"
                onClick={handleAcceptLoggedIn}
                disabled={isSubmitting}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Joining Board...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-teal-200" />
                    <span>Accept & Enter Board</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* User not authenticated: Sign up or Login */
            <div className="space-y-4">
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-slate-200 mb-2">
                <button
                  type="button"
                  onClick={() => setIsNewAccount(true)}
                  className={`flex-1 pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                    isNewAccount
                      ? 'border-teal-600 text-teal-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Create Staff Account
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewAccount(false)}
                  className={`flex-1 pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                    !isNewAccount
                      ? 'border-teal-600 text-teal-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Log In & Join
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {isNewAccount && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Chef / Staff Name"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@hospitality.com"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isNewAccount ? 'Creating & Joining...' : 'Logging In & Joining...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isNewAccount ? 'Create Account & Enter Board' : 'Log In & Enter Board'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
