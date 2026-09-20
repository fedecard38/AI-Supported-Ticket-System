import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Flame,
  AlertTriangle,
  ArrowDown,
  User,
  Mail,
  Calendar,
  Sparkles,
  Trash2,
  CheckCircle2,
  RefreshCw,
  FileText,
  Building,
} from 'lucide-react';
import api from '../services/api';
import LeadSwitcher from './LeadSwitcher';
import CommentStream from './CommentStream';

export function TicketDetail({
  ticketId,
  onBack,
  onTicketUpdated,
  onTicketDeleted,
  currentUser,
}) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTicketDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTicket(ticketId);
      setTicket(data);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
      setError(err.message || 'Failed to fetch ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails();
    }
  }, [ticketId]);

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await api.updateTicket(ticketId, { status: newStatus });
      setTicket((prev) => ({ ...prev, status: updated.status }));
      if (onTicketUpdated) {
        onTicketUpdated(updated);
      }
    } catch (err) {
      throw err;
    }
  };

  const handleCommentAdded = (newComment) => {
    setTicket((prev) => ({
      ...prev,
      comments: [...(prev.comments || []), newComment],
    }));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteTicket(ticketId);
      if (onTicketDeleted) {
        onTicketDeleted(ticketId);
      }
      onBack();
    } catch (err) {
      console.error('Failed to delete ticket:', err);
      setError(err.message || 'Failed to delete ticket');
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Priority Badge Helper
  const renderPriorityBadge = (priority) => {
    const p = priority?.toLowerCase() || 'medium';
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          High Priority
        </span>
      );
    }
    if (p === 'low') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
          Low Priority
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        Medium Priority
      </span>
    );
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        <p className="text-sm text-slate-400">Loading ticket #{ticketId}...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <p className="text-sm text-rose-400">{error || 'Ticket not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </button>

        <div className="flex items-center gap-3">
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400">Confirm deletion?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Ticket Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
              #{ticket.id}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              {ticket.category}
            </span>
            {renderPriorityBadge(ticket.priority)}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Created {new Date(ticket.created_at).toLocaleString()}</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {ticket.title}
        </h1>

        {/* Consumer metadata bar */}
        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80 flex-wrap">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-200 font-medium">
              {ticket.consumer_name || 'Anonymous Consumer'}
            </span>
          </div>

          {ticket.consumer_email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{ticket.consumer_email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Management based on Role */}
      {currentUser && (currentUser.role === 'Owner' || currentUser.role === 'Responsible') ? (
        <LeadSwitcher
          ticketId={ticket.id}
          currentStatus={ticket.status}
          onStatusChange={handleStatusChange}
        />
      ) : (
        /* Normal Consumer / User Status Card: Can only change to Resolved */
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ticket Status:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
              {ticket.status}
            </span>
          </div>

          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' ? (
            <button
              onClick={() => handleStatusChange('Resolved')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark as Resolved</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ticket is {ticket.status}</span>
            </div>
          )}
        </div>
      )}

      {/* Gemini AI Intelligence Card */}
      {ticket.ai_summary && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-purple-950/30 border border-indigo-500/30 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Gemini AI Triage Analysis
              </span>
            </div>

            <span className="text-[11px] text-indigo-400/80 font-medium">
              Synthesized Summary & Classification
            </span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-medium pl-1">
            "{ticket.ai_summary}"
          </p>
        </div>
      )}

      {/* Ticket Description */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Ticket Details & Request Content</span>
        </div>

        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          {ticket.description}
        </div>
      </div>

      {/* Comment Stream (Role is locked based on authenticated user) */}
      <CommentStream
        ticketId={ticket.id}
        comments={ticket.comments || []}
        onCommentAdded={handleCommentAdded}
        consumerEmail={ticket.consumer_email}
        authorRole={
          currentUser?.role === 'Owner'
            ? 'Owner'
            : currentUser?.role === 'Responsible'
            ? 'Responsible'
            : 'Customer'
        }
      />
    </div>
  );
}

export default TicketDetail;
