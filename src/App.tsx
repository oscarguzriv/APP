import React, { useState, useEffect } from 'react';
import AuthScreens from './components/AuthScreens.tsx';
import Dashboard from './components/Dashboard.tsx';
import BoardView from './components/BoardView.tsx';
import JoinBoardScreen from './components/JoinBoardScreen.tsx';
import { apiFetch, setStoredToken, setStoredUser, getStoredUser } from './lib/api.ts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Check for hospitality onboarding /join/:token path or ?invite= token
  const [joinToken, setJoinToken] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/join\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || null;
  });

  // Check or establish authenticated session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setStoredUser(data.user);
          } else {
            setCurrentUser(null);
            setStoredUser(null);
          }
        } else {
          setCurrentUser(null);
          setStoredUser(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setCurrentUser(null);
        setStoredUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    sessionStorage.setItem('ps_logged_out', 'true');
    setStoredToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setSelectedBoardId(null);
    setSelectedCardId(null);
  };

  // Quick switch user helper for testing roles
  const handleSwitchUser = async (email: string) => {
    try {
      const password = email === 'admin@test.com' ? 'admin' : 'Password123!';
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.removeItem('ps_logged_out');
        setCurrentUser(data.user);
        setStoredUser(data.user);
        if (data.token) setStoredToken(data.token);
      }
    } catch (err) {
      console.error('Switch user error:', err);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Authenticating RoxCrew Session...
        </p>
      </div>
    );
  }

  // If user arrived via /join/:token QR code or invite link
  if (joinToken) {
    return (
      <JoinBoardScreen
        token={joinToken}
        currentUser={currentUser}
        onJoinedBoard={(boardId) => {
          setJoinToken(null);
          window.history.replaceState({}, '', '/');
          setSelectedBoardId(boardId);
        }}
        onGoToLogin={() => {
          setJoinToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <AuthScreens
        onAuthSuccess={(user, token) => {
          sessionStorage.removeItem('ps_logged_out');
          setCurrentUser(user);
          setStoredUser(user);
          if (token) setStoredToken(token);
        }}
      />
    );
  }

  if (selectedBoardId) {
    return (
      <BoardView
        boardId={selectedBoardId}
        initialCardId={selectedCardId}
        currentUser={currentUser}
        onBackToDashboard={() => {
          setSelectedBoardId(null);
          setSelectedCardId(null);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      currentUser={currentUser}
      onLogout={handleLogout}
      onSelectBoard={(boardId, cardId) => {
        setSelectedBoardId(boardId);
        if (cardId) setSelectedCardId(cardId);
      }}
      onSwitchUser={handleSwitchUser}
    />
  );
}
