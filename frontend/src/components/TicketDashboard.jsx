import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Flame,
  AlertTriangle,
  ArrowDown,
  Clock,
  CheckCircle2,
  Inbox,
  User,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Finance',
  'Legal',
  'Operations',
  'IT Support',
  'Human Resources',
  'Customer Success',
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'Open', label: 'Open (New)' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Resolved', label: 'Resolved' },
  { id: 'Closed', label: 'Closed' },
];

export function TicketDashboard({
  tickets = [],
  loading,
  onRefresh,
  onSelectTicket,
  onOpenSubmitModal,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // 1. Status Filter
      if (selectedStatus !== 'all' && ticket.status !== selectedStatus) {
        return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'All' && ticket.category !== selectedCategory) {
        return false;
      }

      // 3. Search Query (Title, Description, AI Summary, Consumer, ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = String(ticket.id).includes(query);
        const matchesTitle = ticket.title?.toLowerCase().includes(query);
        const matchesDesc = ticket.description?.toLowerCase().includes(query);
        const matchesAi = ticket.ai_summary?.toLowerCase().includes(query);
        const matchesConsumer = ticket.consumer_name?.toLowerCase().includes(query);
        const matchesCategory = ticket.category?.toLowerCase().includes(query);

        if (
          !matchesId &&
          !matchesTitle &&
          !matchesDesc &&
          !matchesAi &&
          !matchesConsumer &&
          !matchesCategory
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, selectedStatus, selectedCategory, searchQuery]);

  // Priority Badge Helper
  const renderPriorityBadge = (priority) => {
    const p = priority?.toLowerCase() || 'medium';
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <Flame className="w-3 h-3 text-rose-400" />
          High
        </span>
      );
    }
    if (p === 'low') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ArrowDown className="w-3 h-3 text-emerald-400" />
          Low
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Medium
      </span>
    );
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            New / Open
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Clock className="w-3 h-3 text-indigo-400" />
            In Progress
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Resolved
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  // Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Search and Quick Metrics */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by ID, title, summary, or requester..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Departments' : cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Refresh tickets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800/80">
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.id === 'all'
              ? tickets.length
              : tickets.filter((t) => t.status === filter.id).length;

          const isActive = selectedStatus === filter.id;

          return (
            <button
              key={filter.id}
              onClick={() => setSelectedStatus(filter.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-blue-800 text-blue-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {loading && tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm">Loading workspace tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">
              No tickets found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'All' || selectedStatus !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'No support requests have been submitted yet.'}
            </p>
            {(!tickets.length || (tickets.length && filteredTickets.length === 0)) && (
              <button
                onClick={onOpenSubmitModal}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Create First Ticket
              </button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticket.id)}
              className="group p-4 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Ticket ID, Category, Priority, Title */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      #{ticket.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {ticket.category}
                    </span>
                    {renderPriorityBadge(ticket.priority)}
                    {renderStatusBadge(ticket.status)}
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                    {ticket.title}
                  </h3>

                  {/* AI Summary Excerpt */}
                  {ticket.ai_summary && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-400 line-clamp-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="italic">{ticket.ai_summary}</span>
                    </div>
                  )}
                </div>

                {/* Right: Consumer & Date */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs text-slate-400 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ticket.consumer_name || 'Anonymous'}</span>
                  </div>

                  <span className="text-slate-500">{formatDate(ticket.created_at)}</span>

                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TicketDashboard;
