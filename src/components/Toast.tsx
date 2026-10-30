import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, Trash2, UserPlus } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'info' | 'error' | 'warning' | 'delete' | 'user';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
      {toasts.map((toast) => {
        const isDelete = toast.type === 'delete';
        const isUser = toast.type === 'user';
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success' || !toast.type;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg backdrop-blur-md flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
              isError
                ? 'bg-rose-50/95 border-rose-200 text-rose-950 shadow-rose-900/5'
                : isDelete
                ? 'bg-slate-900/95 border-slate-700 text-white shadow-slate-950/20'
                : isUser
                ? 'bg-indigo-50/95 border-indigo-200 text-indigo-950 shadow-indigo-900/5'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-900/5'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {isError && <AlertCircle className="w-5 h-5 text-rose-500" />}
              {isDelete && <Trash2 className="w-5 h-5 text-rose-400" />}
              {isUser && <UserPlus className="w-5 h-5 text-indigo-600" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-teal-600" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className={`text-xs font-bold leading-tight ${isDelete ? 'text-white' : 'text-slate-900'}`}>
                {toast.title}
              </h4>
              {toast.message && (
                <p className={`text-xs mt-0.5 leading-relaxed break-words ${isDelete ? 'text-slate-300' : 'text-slate-600'}`}>
                  {toast.message}
                </p>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                isDelete
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
              }`}
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
