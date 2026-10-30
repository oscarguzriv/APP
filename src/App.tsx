import React, { useState, useEffect } from 'react';
import AuthScreens from './components/AuthScreens.tsx';
import Dashboard from './components/Dashboard.tsx';
import BoardView from './components/BoardView.tsx';
import { apiFetch, setStoredToken, setStoredUser, getStoredUser } from './lib/api.ts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(getStoredUser());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

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
            return;
          }
        }

        // If no active session, auto-authenticate with test admin account
        const loginRes = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'admin@grandregency.com', password: 'Password123!' }),
        });
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          if (loginData.success && loginData.user) {
            setCurrentUser(loginData.user);
            setStoredUser(loginData.user);
            if (loginData.token) setStoredToken(loginData.token);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
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
    setStoredToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setSelectedBoardId(null);
  };

  // Quick switch user helper for testing roles
  const handleSwitchUser = async (email: string) => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password123!' }),
      });
      if (res.ok) {
        const data = await res.json();
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
          Authenticating PrimeShift Session...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreens
        onAuthSuccess={(user, token) => {
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
        currentUser={currentUser}
        onBackToDashboard={() => setSelectedBoardId(null)}
      />
    );
  }

  return (
    <Dashboard
      currentUser={currentUser}
      onLogout={handleLogout}
      onSelectBoard={(boardId) => {
        setSelectedBoardId(boardId);
      }}
      onSwitchUser={handleSwitchUser}
    />
  );
}
