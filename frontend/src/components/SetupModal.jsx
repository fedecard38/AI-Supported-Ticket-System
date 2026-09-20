import React, { useState } from 'react';
import {
  Wrench,
  Key,
  Database,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import api from '../services/api';

export function SetupModal({ isOpen, onSetupComplete }) {
  const [formData, setFormData] = useState({
    owner_email: 'admin@ticketworkspace.com',
    owner_password: '',
    gemini_api_key: '',
    db_host: 'postgres',
    db_port: 5432,
    db_name: 'ticket_system',
    db_user: 'postgres',
    db_password: 'postgres',
    validate_external: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        owner_email: formData.owner_email,
        owner_password: formData.owner_password,
        gemini_api_key: formData.gemini_api_key,
        validate_external: formData.validate_external,
        db_settings: {
          host: formData.db_host,
          port: Number(formData.db_port),
          db_name: formData.db_name,
          user: formData.db_user,
          password: formData.db_password,
        },
      };

      await api.initializeSystem(payload);
      if (onSetupComplete) {
        onSetupComplete();
      }
    } catch (err) {
      console.error('Setup failed:', err);
      setError(err.message || 'Setup initialization failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-blue-500/30 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">First-Time System Initialization</h2>
            <p className="text-xs text-slate-400">
              Configure master credentials and AI credentials to unlock the workspace
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Owner Email *
              </label>
              <input
                type="email"
                required
                value={formData.owner_email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, owner_email: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Owner Password (A-z, 0-9, spec) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.owner_password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, owner_password: e.target.value }))
                }
                placeholder="e.g. MasterPass@2026"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Google Gemini API Key *</span>
            </label>
            <input
              type="password"
              required
              minLength={20}
              value={formData.gemini_api_key}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, gemini_api_key: e.target.value }))
              }
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Used for automatic ticket triaging, department routing, and synthesis.
            </p>
          </div>

          {/* Database configuration collapsible or presets */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Database Target (PostgreSQL)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Host"
                value={formData.db_host}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, db_host: e.target.value }))
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs"
              />
              <input
                type="text"
                placeholder="DB Name"
                value={formData.db_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, db_name: e.target.value }))
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="validate_ext"
              checked={formData.validate_external}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  validate_external: e.target.checked,
                }))
              }
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="validate_ext" className="text-xs text-slate-400">
              Actively probe API keys and DB connection during initialization
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Initialize System</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetupModal;
