import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  Archive,
  ArrowRight,
  Loader2,
  Check,
  X,
} from 'lucide-react';

const STATUS_STEPS = [
  {
    status: 'Open',
    label: 'New / Open',
    description: 'Initial intake, awaiting lead assignment or triage review',
    icon: Sparkles,
    activeColor: 'bg-sky-500 text-white shadow-sky-500/30 border-sky-400',
    hoverColor: 'hover:border-sky-500/50 hover:bg-sky-500/10 text-sky-300',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    status: 'In Progress',
    label: 'In Progress',
    description: 'Lead or operator actively diagnosing or resolving issue',
    icon: Clock,
    activeColor: 'bg-indigo-600 text-white shadow-indigo-600/30 border-indigo-400',
    hoverColor: 'hover:border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-300',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  {
    status: 'Resolved',
    label: 'Resolved',
    description: 'Resolution provided to consumer; awaiting confirmation',
    icon: CheckCircle2,
    activeColor: 'bg-emerald-600 text-white shadow-emerald-600/30 border-emerald-400',
    hoverColor: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-300',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    status: 'Closed',
    label: 'Closed',
    description: 'Workflow concluded and archived',
    icon: Archive,
    activeColor: 'bg-slate-700 text-white shadow-slate-700/30 border-slate-500',
    hoverColor: 'hover:border-slate-600 hover:bg-slate-800 text-slate-300',
    badgeColor: 'bg-slate-700/40 text-slate-300 border-slate-600',
  },
];

export function LeadSwitcher({
  ticketId,
  currentStatus,
  onStatusChange,
  disabled = false,
}) {
  const [stagedStatus, setStagedStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setStagedStatus(currentStatus);
  }, [currentStatus]);

  const handleStageClick = (status) => {
    if (disabled || isUpdating) return;
    setStagedStatus(status);
  };

  const handleAcceptChange = async () => {
    if (stagedStatus === currentStatus || disabled || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusChange(stagedStatus);
    } catch (err) {
      console.error('Failed to change status:', err);
      // Revert staging on failure
      setStagedStatus(currentStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelChange = () => {
    setStagedStatus(currentStatus);
  };

  const hasPendingChange = stagedStatus !== currentStatus;

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Lead Status Switcher
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            (Select a state and click Accept Status Change)
          </span>
        </div>

        {isUpdating && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Updating ticket status...</span>
          </div>
        )}
      </div>

      {/* Segmented status stepper buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATUS_STEPS.map((step) => {
          const Icon = step.icon;
          const isCurrent = currentStatus === step.status;
          const isStaged = stagedStatus === step.status;

          return (
            <button
              key={step.status}
              type="button"
              disabled={disabled || isUpdating}
              onClick={() => handleStageClick(step.status)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isCurrent
                  ? `${step.activeColor} shadow-lg font-semibold border-transparent`
                  : isStaged
                  ? 'bg-blue-950/40 border-blue-400 text-blue-200 ring-2 ring-blue-500/40'
                  : `bg-slate-950/70 border-slate-800 text-slate-400 ${step.hoverColor}`
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-4 h-4 ${isCurrent || isStaged ? 'text-white' : ''}`} />
                <span className="text-xs font-semibold">{step.label}</span>
              </div>

              <span
                className={`text-[10px] line-clamp-1 ${
                  isCurrent ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                {step.description}
              </span>

              {/* Ping badge on active database status */}
              {isCurrent && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
              )}

              {/* Pending indicator on staged status */}
              {!isCurrent && isStaged && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirmation Bar: Accept Status Change Button */}
      {hasPendingChange && (
        <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 text-xs text-blue-200">
            <span>Change status:</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
              {currentStatus}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
              {stagedStatus}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleCancelChange}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={handleAcceptChange}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Accept Status Change</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadSwitcher;
