import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  Tag,
  Flame,
  FileText,
  User,
  Mail,
} from 'lucide-react';
import api from '../services/api';

export function ConsumerModal({ isOpen, onClose, onTicketCreated }) {
  const [formData, setFormData] = useState({
    consumer_name: '',
    consumer_email: '',
    title: '',
    description: '',
  });

  const [stage, setStage] = useState('form'); // 'form' | 'triaging' | 'created'
  const [triageResult, setTriageResult] = useState(null);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consumer_name.trim() || !formData.title.trim() || !formData.description.trim()) {
      setError('Please provide your name, a subject, and details about your issue.');
      return;
    }

    setError(null);
    setStage('triaging');

    try {
      // 1. Invoke AI Triage method to obtain category, priority, and summary
      const requestText = `Subject: ${formData.title}\n\nIssue Details:\n${formData.description}`;
      const classification = await api.triageTicket({
        consumer_name: formData.consumer_name.trim(),
        request_text: requestText,
      });

      setTriageResult(classification);

      // Brief delay so user sees AI classification in progress
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 2. Persist the ticket with AI classification results
      const ticketPayload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: classification.category,
        priority: classification.priority,
        ai_summary: classification.summary,
        consumer_name: formData.consumer_name.trim(),
        consumer_email: formData.consumer_email.trim() || null,
        status: 'Open',
      };

      const newTicket = await api.createTicket(ticketPayload);
      setCreatedTicket(newTicket);
      setStage('created');

      if (onTicketCreated) {
        onTicketCreated(newTicket);
      }
    } catch (err) {
      console.error('Failed to triage and create ticket:', err);
      setError(err.message || 'Failed to process ticket. Please try again.');
      setStage('form');
    }
  };

  const handleResetAndClose = () => {
    setFormData({
      consumer_name: '',
      consumer_email: '',
      title: '',
      description: '',
    });
    setStage('form');
    setTriageResult(null);
    setCreatedTicket(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Submit Support Ticket</h2>
              <p className="text-xs text-slate-400">
                Powered by Gemini AI — automated department triage & routing
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Your Name *</span>
                  </label>
                  <input
                    type="text"
                    name="consumer_name"
                    value={formData.consumer_name}
                    onChange={handleChange}
                    placeholder="e.g. Alex Rivera"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email Address (Optional)</span>
                  </label>
                  <input
                    type="email"
                    name="consumer_email"
                    value={formData.consumer_email}
                    onChange={handleChange}
                    placeholder="alex@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Subject / Issue Summary *</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Unable to access VPN while working remotely"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Detailed Description *
                </label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Please describe what happened, any error messages, or what you need assistance with..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  Our AI engine will automatically evaluate your inquiry to identify the category, urgency, and route it to the responsible lead.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          )}

          {stage === 'triaging' && (
            <div className="py-10 text-center space-y-5 animate-in fade-in">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 animate-pulse flex items-center justify-center">
                  <BrainCircuit className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  Gemini AI Analyzing Ticket...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Evaluating intent, determining category & urgency, and preparing notifications...
                </p>
              </div>

              {triageResult && (
                <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-left space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                      Auto-Classified
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Category: {triageResult.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Priority: {triageResult.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic">
                    "{triageResult.summary}"
                  </p>
                </div>
              )}
            </div>
          )}

          {stage === 'created' && createdTicket && (
            <div className="py-6 space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Ticket Created Successfully!</h3>
                <p className="text-xs text-slate-400">
                  Assigned Ticket ID <span className="font-mono text-blue-400 font-semibold">#{createdTicket.id}</span>
                </p>
              </div>

              {/* AI Details Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI Triage Summary
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {createdTicket.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {createdTicket.priority} Priority
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-200 font-medium bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  {createdTicket.ai_summary || createdTicket.title}
                </div>

                <p className="text-xs text-slate-400">
                  The designated department lead has been notified. You can track this ticket on the dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close & View on Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConsumerModal;
