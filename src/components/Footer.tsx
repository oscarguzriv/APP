import React, { useState } from 'react';
import { Info, HelpCircle, ExternalLink, X, CheckCircle2, ShieldCheck, QrCode, Image as ImageIcon, Calendar, Users, LayoutDashboard, Tag, FolderOpen } from 'lucide-react';

interface FooterProps {
  // Optional custom class names for styling wrapper
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  return (
    <>
      <footer className={`w-full py-4 px-6 border-t border-slate-200 bg-white/80 backdrop-blur-sm text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">RoxCrew</span>
          <span>© {new Date().getFullYear()} · Crew & Task Operations Kanban</span>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <a
            href="https://roxannes.group"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-teal-600 hover:text-teal-700 font-medium transition-colors"
          >
            brought to you by roxannes.group
            <ExternalLink className="w-3 h-3" />
          </a>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <button
            onClick={() => setIsAboutOpen(true)}
            className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors font-medium"
          >
            <Info className="w-3.5 h-3.5" /> About RoxCrew
          </button>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <button
            onClick={() => setIsFaqOpen(true)}
            className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" /> FAQ & Guide
          </button>
        </div>
      </footer>

      {/* About Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                  <img src="/assets/aistudio/Rox_R_aa42d01f.png" alt="RoxCrew Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">About RoxCrew</h3>
                  <p className="text-xs text-slate-500">Crew Project & Task Management</p>
                </div>
              </div>
              <button
                onClick={() => setIsAboutOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-600 max-h-[70vh] overflow-y-auto">
              <p>
                <strong>RoxCrew</strong> was created out of a direct need for a tailored, frictionless project and task management tool specifically designed for crew operations and contractor coordination—hotels, venues, hospitality spaces, and guest events.
              </p>
              <p>
                Traditional enterprise project management tools are often overly complex, generic, and unsuited for fast-paced, collaborative environments where team handoffs, quick task delegation, maintenance tracking, and mobile accessibility are paramount.
              </p>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2 text-teal-900">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> Built for Operations Crews
                </h4>
                <p className="text-xs text-teal-800 leading-relaxed">
                  From daily opening and closing checklists to maintenance log reports, guest requests, and team handoff audit trails, RoxCrew gives managers and crew members a unified, mobile-first workspace.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Brought to you by <strong className="text-slate-700">roxannes.group</strong></span>
                <a
                  href="https://roxannes.group"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:underline font-medium inline-flex items-center gap-1"
                >
                  Visit roxannes.group <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ & Guide Modal */}
      {isFaqOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                  <img src="/assets/aistudio/Rox_R_aa42d01f.png" alt="RoxCrew Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">FAQ & Feature Guide</h3>
                  <p className="text-xs text-slate-500">Everything you need to know about RoxCrew</p>
                </div>
              </div>
              <button
                onClick={() => setIsFaqOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-sm text-slate-600 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-teal-600" /> 1. How do boards and columns work?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Each board comes pre-configured with standard operational stages. <strong className="text-slate-800">Admins and Managers</strong> can also add new columns, rename existing columns, or delete columns directly from the board view. You can drag and drop cards between lists or toggle between Kanban, Table, and Calendar view modes.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-teal-600" /> 2. How does label filtering work?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Click the <strong className="text-slate-800">Filter</strong> button in the board header to filter cards by specific labels (e.g. venue tags, urgent action, or prep requirements), assigned members, priority, or completion status.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-teal-600" /> 3. How do I import from Trello JSON exports?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  From the main dashboard, click <strong className="text-slate-800">"Import Trello JSON"</strong> and upload or paste your Trello board JSON export. RoxCrew automatically converts your Trello lists, labels, and cards into a fully operational RoxCrew workspace board.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-600" /> 4. How do card photos and attachments work?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Within any card modal, you can upload up to <strong className="text-slate-800">5 photos per card</strong> (e.g. equipment maintenance photos, prep setup, or incident records). Files are securely saved to local storage via backend `multer` and rendered instantly.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-teal-600" /> 5. How do I invite crew members with QR codes and links?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Managers and board admins can click <strong className="text-slate-800">"Generate Invite Link / QR Code"</strong> in the board settings menu. The system generates a secure join URL and displays a scannable QR code using `qrcode.react`. New crew opening `/join/:token` are guided straight through sign-up and auto-added to the board.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> 6. How does team accountability work?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Every action is audit-logged. When a card is marked complete, RoxCrew records who completed it (`completed_by`) and the exact timestamp (`completed_at`), ensuring full transparency across all teams and rotations.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" /> 7. What are the user roles?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  RoxCrew supports global roles: <strong className="text-slate-800">Admin / Group Owner</strong>, <strong className="text-slate-800">Manager</strong>, and <strong className="text-slate-800">Staff</strong>, protected by secure JWTs in HttpOnly cookies.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsFaqOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
