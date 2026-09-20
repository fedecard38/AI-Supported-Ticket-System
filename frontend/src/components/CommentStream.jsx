import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  ShieldCheck,
  User,
  Bot,
  Lock,
  Loader2,
  Sparkles,
  Award,
} from 'lucide-react';
import api from '../services/api';

export function CommentStream({
  ticketId,
  comments = [],
  onCommentAdded,
  consumerEmail,
  authorRole = 'Customer', // 'Customer' | 'Responsible' | 'Owner'
}) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        content: content.trim(),
        author_role: authorRole,
        is_internal: isInternal,
      };

      const newComment = await api.addComment(ticketId, payload);
      setContent('');
      if (onCommentAdded) {
        onCommentAdded(newComment);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">Discussion & Updates</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
            {comments.length}
          </span>
        </div>

        {consumerEmail && (
          <span className="text-xs text-slate-400">
            Consumer notified via: <span className="text-slate-300">{consumerEmail}</span>
          </span>
        )}
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-500 text-xs">
            No updates or comments yet. Add the first comment below to communicate with the consumer or team.
          </div>
        ) : (
          comments.map((comment) => {
            const isResponsible =
              comment.author_role?.toLowerCase() === 'responsible';
            const isOwner = comment.author_role?.toLowerCase() === 'owner';
            const isAi = comment.author_role?.toLowerCase() === 'ai assistant';

            return (
              <div
                key={comment.id}
                className={`p-4 rounded-xl border transition-all ${
                  isResponsible
                    ? 'bg-gradient-to-r from-amber-500/[0.07] via-slate-900 to-blue-500/[0.07] border-amber-400/40 shadow-lg shadow-amber-500/5 ring-1 ring-amber-400/20'
                    : isOwner
                    ? 'bg-purple-950/20 border-purple-500/30'
                    : isAi
                    ? 'bg-indigo-950/20 border-indigo-500/30'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                {/* Header: Author info & Badges */}
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Requirement 3: Prominent Gold/Blue badge for 'Responsible' comments */}
                    {isResponsible ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 via-amber-300 to-blue-400 text-slate-950 shadow-md shadow-amber-500/20 border border-amber-300">
                        <Award className="w-3.5 h-3.5 text-slate-950" />
                        <span>Responsible Lead</span>
                      </div>
                    ) : isOwner ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>System Owner</span>
                      </div>
                    ) : isAi ? (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <Bot className="w-3.5 h-3.5" />
                        <span>AI Assistant</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <User className="w-3.5 h-3.5" />
                        <span>Customer</span>
                      </div>
                    )}

                    {comment.is_internal && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-3 h-3" />
                        Internal Note
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500 shrink-0">
                    {formatDate(comment.created_at)}
                  </span>
                </div>

                {/* Comment Body */}
                <div
                  className={`text-sm whitespace-pre-wrap leading-relaxed ${
                    isResponsible ? 'text-slate-100 font-medium' : 'text-slate-300'
                  }`}
                >
                  {comment.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Form - Role is LOCKED to authenticated context, no dropdown */}
      <form
        onSubmit={handleSubmit}
        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Identity indication (no role selector) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Posting as:
            </span>

            {authorRole === 'Responsible' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-blue-400 text-slate-950 shadow-sm">
                <Award className="w-3.5 h-3.5" />
                <span>Responsible Lead (Official)</span>
              </span>
            )}

            {authorRole === 'Owner' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>System Owner</span>
              </span>
            )}

            {authorRole === 'Customer' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Customer / Requester</span>
              </span>
            )}
          </div>

          {/* Internal note toggle (only for staff: Responsible or Owner) */}
          {(authorRole === 'Responsible' || authorRole === 'Owner') && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                Internal Note (Staff only)
              </span>
            </label>
          )}
        </div>

        {error && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            authorRole === 'Responsible'
              ? 'Post an official resolution or lead message (will feature the prominent Lead badge)...'
              : authorRole === 'Owner'
              ? 'Post an administrative comment as System Owner...'
              : 'Add a message or provide more details regarding your request...'
          }
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
        />

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500">
            {isInternal
              ? 'Internal notes are visible to operators only.'
              : 'Dispatched to conversation history and email notifications.'}
          </p>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md shadow-blue-600/20 transition-all"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Send Comment</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default CommentStream;
