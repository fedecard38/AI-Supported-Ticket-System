import React, { useState } from 'react';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  Archive,
  ArrowRight,
  Loader2,
} from 'lucide-react';

const STATUS_STEPS = [
  {
    status: 'Open',
    label: 'New / Open',
    description: 'Initial intake, awaiting lead assignment or triage review',
    icon: Sparkles,
    activeColor: 'bg-sky-500 text-white shadow-sky-500/30 border-sky-400',
    hoverColor: 'hover:border-sky-500/50 hover:bg-sky-500/10 text-sky-300',
  },
  {
    status: 'In Progress',
    label: 'In Progress',
    description: 'Lead or operator actively diagnosing or resolving issue',
    icon: Clock,
    activeColor: 'bg-indigo-600 text-white shadow-indigo-600/30 border-indigo-400',
    hoverColor: 'hover:border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-300',
  },
  {
    status: 'Resolved',
    label: 'Resolved',
    description: 'Resolution provided to consumer; awaiting confirmation',
    icon: CheckCircle2,
    activeColor: 'bg-emerald-600 text-white shadow-emerald-600/30 border-emerald-400',
    hoverColor: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-300',
  },
  {
    status: 'Closed',
    label: 'Closed',
    description: 'Workflow concluded and archived',
    icon: Archive,
    activeColor: 'bg-slate-700 text-white shadow-slate-700/30 border-slate-500',
    hoverColor: 'hover:border-slate-600 hover:bg-slate-800 text-slate-300',
  },
];

export function LeadSwitcher({
  ticketId,
  currentStatus,
  onStatusChange,
  disabled = false,
}) {
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const handleStatusSelect = async (newStatus) => {
    if (newStatus === currentStatus || disabled || updatingStatus) return;

    setUpdatingStatus(newStatus);
    try {
      await onStatusChange(newStatus);
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Lead Status Switcher
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            (New &rarr; In Progress &rarr; Resolved)
          </span>
        </div>

        {updatingStatus && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Updating status...</span>
          </div>
        )}
      </div>

      {/* Segmented status stepper buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATUS_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = currentStatus === step.status;
          const isPending = updatingStatus === step.status;

          return (
            <button
              key={step.status}
              type="button"
              disabled={disabled || isPending}
              onClick={() => handleStatusSelect(step.status)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isCurrent
                  ? `${step.activeColor} shadow-lg font-semibold border-transparent`
                  : `bg-slate-950/70 border-slate-800 text-slate-400 ${step.hoverColor}`
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {/* Stepper badge or indicator */}
              <div className="flex items-center gap-1.5 mb-1">
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : ''}`} />
                )}
                <span className="text-xs font-semibold">{step.label}</span>
              </div>

              <span
                className={`text-[10px] line-clamp-1 ${
                  isCurrent ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                {step.description}
              </span>

              {isCurrent && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LeadSwitcher;
