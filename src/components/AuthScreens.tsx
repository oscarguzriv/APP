import React, { useState } from 'react';
import { apiFetch, setStoredToken, setStoredUser } from '../lib/api.ts';
import Footer from './Footer.tsx';
import { 
  Building2, 
  Mail, 
  Lock, 
  User, 
  ShieldAlert, 
  ChefHat, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Users
} from 'lucide-react';

interface AuthScreensProps {
  onAuthSuccess: (user: any, token?: string) => void;
}

export default function AuthScreens({ onAuthSuccess }: AuthScreensProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [signupRole, setSignupRole] = useState<'Admin/Group Owner' | 'Manager' | 'Staff'>('Staff');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [demoUsers] = useState([
    { email: 'admin@test.com', name: 'Group Admin', role: 'Admin/Group Owner' },
    { email: 'manager@grandregency.com', name: 'Shift Manager', role: 'Manager' },
    { email: 'staff@grandregency.com', name: 'Station Staff', role: 'Staff' },
  ]);

  // Quick Demo Login Handler
  const handleQuickDemoLogin = (email: string) => {
    setLoginEmail(email);
    setLoginPassword('Password123!');
    setErrorMessage(null);
    setIsDuplicateEmail(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setIsDuplicateEmail(false);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in. Please verify your email and password.');
      }

      if (data.token) setStoredToken(data.token);
      setStoredUser(data.user);
      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setIsDuplicateEmail(false);
    setSuccessMessage(null);

    try {
      const response = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          company: signupCompany,
          role: signupRole,
        }),
      });

      const data = await response.json();

      // Explicit Duplicate Email Handling Requirement
      if (response.status === 409 || data.code === 'DUPLICATE_EMAIL') {
        setIsDuplicateEmail(true);
        setErrorMessage('Account not created due to duplicate email');
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account.');
      }

      if (data.token) setStoredToken(data.token);
      setStoredUser(data.user);
      setSuccessMessage('Account created successfully! Signing you in...');
      setTimeout(() => {
        onAuthSuccess(data.user, data.token);
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while creating account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between items-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Background Soft Glow Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 shadow-lg shadow-teal-600/10 mb-3 overflow-hidden p-1.5">
            <img src="/assets/aistudio/Rox_R_aa42d01f.png" alt="MyShift Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            RoxCrew <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">Ops Kanban</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mobile-First Crew & Task Operations
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* Switch Tab Headers */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMessage(null);
                setIsDuplicateEmail(false);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                isLogin
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrorMessage(null);
                setIsDuplicateEmail(false);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                !isLogin
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div
              className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in duration-200 ${
                isDuplicateEmail
                  ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMessage}</p>
                {isDuplicateEmail && (
                  <p className="text-xs text-rose-600 mt-1">
                    An account already exists with this email address. Please log in instead or use another email.
                  </p>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LOGIN FORM */}
          {/* ========================================================================= */}
          {isLogin ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@test.com"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Log In to RoxCrew</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ========================================================================= */
            /* SIGNUP FORM */
            /* ========================================================================= */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Marcus Vance"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      if (isDuplicateEmail) {
                        setIsDuplicateEmail(false);
                        setErrorMessage(null);
                      }
                    }}
                    placeholder="marcus@grandregency.com"
                    className={`w-full bg-white border rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none ${
                      isDuplicateEmail
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Initial Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Admin/Group Owner', label: 'Admin', desc: 'Oversee company boards' },
                    { id: 'Manager', label: 'Manager', desc: 'Oversee company boards' },
                    { id: 'Staff', label: 'Staff', desc: 'Join & collaborate' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSignupRole(r.id as any)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        signupRole === r.id
                          ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-900">{r.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {signupRole === 'Admin/Group Owner' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Organization / Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={signupCompany}
                      onChange={(e) => setSignupCompany(e.target.value)}
                      placeholder="Grand Regency Hotel & Resort"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-xs flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>Your company workspace will be automatically matched to your organization based on your work email domain.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Staff Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}


        </div>

        {/* Security badge footer */}
        <p className="text-center text-xs text-slate-500 mt-6 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted Session • HttpOnly JWT Authentication</span>
        </p>
      </div>

      <Footer className="w-full mt-12" />
    </div>
  );
}
