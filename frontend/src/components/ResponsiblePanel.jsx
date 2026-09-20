import React, { useState, useEffect } from 'react';
import {
  Award,
  ShieldCheck,
  Lock,
  Mail,
  User,
  LogOut,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowDown,
  Building,
  RefreshCw,
  Search,
  MessageSquare,
  FileText,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import LeadSwitcher from './LeadSwitcher';
import CommentStream from './CommentStream';

export function ResponsiblePanel({
  currentUser,
  onLogin,
  onLogout,
  onTicketUpdated,
  showToast,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Tickets & selection
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch tickets for this responsible lead
  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await api.listTickets();
      setTickets(data);
      // Update selected ticket if currently viewed
      if (selectedTicket) {
        const refreshed = data.find((t) => t.id === selectedTicket.id);
        if (refreshed) setSelectedTicket(refreshed);
      }
    } catch (err) {
      console.error('Failed to load tickets for responsible:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTickets();
    }
  }, [currentUser]);

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await api.login({ email: email.trim(), password });
      if (res.role !== 'Responsible' && res.role !== 'Owner') {
        throw new Error('Access denied: User account is not assigned a Lead role.');
      }
      onLogin(res);
      showToast?.(`Welcome back, ${res.full_name || res.email}!`, 'success');
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Invalid email or password.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Status Switcher handler
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const updated = await api.updateTicket(selectedTicket.id, { status: newStatus });
      setSelectedTicket((prev) => ({ ...prev, status: updated.status }));
      setTickets((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t))
      );
      if (onTicketUpdated) {
        onTicketUpdated(updated);
      }
      showToast?.(`Ticket #${selectedTicket.id} marked as ${newStatus}`, 'info');
    } catch (err) {
      console.error('Status update error:', err);
      showToast?.('Failed to update status', 'error');
    }
  };

  // Comment added handler
  const handleCommentAdded = (newComment) => {
    setSelectedTicket((prev) => ({
      ...prev,
      comments: [...(prev.comments || []), newComment],
    }));
    showToast?.('Comment added successfully with Lead badge', 'success');
  };

  // Select Ticket handler with full detail load
  const handleSelectTicket = async (ticket) => {
    try {
      const fullDetail = await api.getTicket(ticket.id);
      setSelectedTicket(fullDetail);
    } catch (err) {
      console.error('Failed to get ticket details:', err);
      setSelectedTicket(ticket);
    }
  };

  // Render Priority Badge
  const renderPriorityBadge = (priority) => {
    const p = priority?.toLowerCase() || 'medium';
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <Flame className="w-3 h-3 text-rose-400" />
          High
        </span>
      );
    }
    if (p === 'low') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ArrowDown className="w-3 h-3 text-emerald-400" />
          Low
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Medium
      </span>
    );
  };

  // If not logged in as Responsible, show authentication gate
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in duration-200">
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-blue-600 flex items-center justify-center p-0.5 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Responsible Lead Portal</h2>
            <p className="text-xs text-slate-400">
              Log in with your department lead credentials to manage tickets and post official resolutions
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Lead Email Address *</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lead@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Password *</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 via-amber-400 to-blue-500 hover:opacity-95 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              {loggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Award className="w-4 h-4 text-slate-950" />
              )}
              <span>Log In as Responsible Lead</span>
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
            Need an account? Contact the System Owner to register you in the Owner Panel.
          </div>
        </div>
      </div>
    );
  }

  // Filter tickets for this lead
  const filteredTickets = tickets.filter((ticket) => {
    // Optional category match if lead has an assigned category
    if (currentUser.assigned_category && currentUser.assigned_category !== 'All') {
      if (ticket.category !== currentUser.assigned_category) return false;
    }
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        String(ticket.id).includes(q) ||
        ticket.title?.toLowerCase().includes(q) ||
        ticket.consumer_name?.toLowerCase().includes(q) ||
        ticket.ai_summary?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Responsible Lead info & Logout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/[0.08] via-slate-900 to-blue-500/[0.08] border border-amber-400/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-blue-500 p-0.5 flex items-center justify-center shadow-md shadow-amber-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">
                {currentUser.full_name || 'Category Lead'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30">
                Responsible
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Department Assigned:{' '}
              <span className="text-blue-300 font-medium">
                {currentUser.assigned_category || 'All Categories'}
              </span>{' '}
              &bull; Logged in as <span className="text-slate-300">{currentUser.email}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Lead Portal</span>
        </button>
      </div>

      {/* Main Workspace: Left Ticket List, Right Focus View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Ticket list (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>Department Queue</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 font-mono">
                {filteredTickets.length}
              </span>
            </h2>

            <button
              onClick={fetchTickets}
              disabled={loadingTickets}
              className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search bar & status filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search department tickets..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['all', 'Open', 'In Progress', 'Resolved'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket items */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loadingTickets && tickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                Loading queue...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-500 text-xs">
                No tickets in queue matching filters.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-blue-500/80 shadow-md ring-1 ring-blue-500/40'
                        : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          #{t.id}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {t.category}
                        </span>
                      </div>
                      {renderPriorityBadge(t.priority)}
                    </div>

                    <h4 className="text-xs font-semibold text-white truncate mb-1">
                      {t.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>{t.consumer_name || 'Anonymous'}</span>
                      <span className="font-medium text-slate-300">{t.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Selected Ticket Detail & Lead Actions (7 cols) */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="space-y-6">
              {/* Ticket Banner */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                      #{selectedTicket.id}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                      {selectedTicket.category}
                    </span>
                    {renderPriorityBadge(selectedTicket.priority)}
                  </div>
                  <span className="text-xs text-slate-400">
                    Consumer: <strong className="text-white">{selectedTicket.consumer_name || 'Anonymous'}</strong>
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white tracking-tight">
                  {selectedTicket.title}
                </h2>

                {/* AI Summary Card */}
                {selectedTicket.ai_summary && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Gemini AI Triage Assessment</span>
                    </div>
                    <p className="text-xs text-slate-200 italic">
                      "{selectedTicket.ai_summary}"
                    </p>
                  </div>
                )}

                {/* Request details */}
                <div className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Lead Status Switcher (Requirement 4 & Lead Panel specification) */}
              <LeadSwitcher
                ticketId={selectedTicket.id}
                currentStatus={selectedTicket.status}
                onStatusChange={handleStatusChange}
              />

              {/* Comment Stream (Requirement 3 & Lead Panel specification) */}
              <CommentStream
                ticketId={selectedTicket.id}
                comments={selectedTicket.comments || []}
                onCommentAdded={handleCommentAdded}
                consumerEmail={selectedTicket.consumer_email}
                authorRole="Responsible"
              />
            </div>
          ) : (
            <div className="p-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No ticket selected</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select a ticket from your queue on the left to review details, update its status, or submit a lead response.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResponsiblePanel;
