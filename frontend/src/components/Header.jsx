import React from 'react';
import {
  Ticket,
  Shield,
  PlusCircle,
  Cpu,
  Layers,
  Sparkles,
  Award,
} from 'lucide-react';

export function Header({
  activeView,
  setActiveView,
  onOpenSubmitModal,
  systemHealth,
  responsibleUser,
  ownerUser,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-400 group-hover:text-indigo-300 transition-colors" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">
                  AI Ticket
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Auto-triage & Intelligent Routing
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'dashboard' || activeView === 'ticket-detail'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Tickets</span>
            </button>

            <button
              onClick={() => setActiveView('responsible')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                activeView === 'responsible'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Lead Portal</span>
              {responsibleUser && (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>

            <button
              onClick={() => setActiveView('owner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'owner'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Owner Panel</span>
              {ownerUser && (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Health indicator badge */}
          {systemHealth && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{systemHealth.ai?.model || 'Gemini Flash'}</span>
            </div>
          )}

          {/* New Ticket Button */}
          <button
            onClick={onOpenSubmitModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Ticket</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
