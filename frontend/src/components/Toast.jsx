import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  const bgStyles = {
    success: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100',
    error: 'bg-rose-950/90 border-rose-500/30 text-rose-100',
    warning: 'bg-amber-950/90 border-amber-500/30 text-amber-100',
    info: 'bg-slate-900/95 border-blue-500/30 text-blue-100',
  };

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200 ${bgStyles[type] || bgStyles.info}`}
    >
      {icons[type] || icons.info}
      <div className="text-sm font-medium pr-2">{message}</div>
      <button
        onClick={onClose}
        className="ml-auto text-slate-400 hover:text-white transition-colors p-1"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default Toast;
