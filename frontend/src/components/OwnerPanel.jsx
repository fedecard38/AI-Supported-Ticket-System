import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Building,
  RefreshCw,
  Loader2,
  X,
  LogOut,
  KeyRound,
} from 'lucide-react';
import api from '../services/api';

const CATEGORIES = [
  'Finance',
  'Legal',
  'Operations',
  'IT Support',
  'Human Resources',
  'Customer Success',
];

export function OwnerPanel({
  currentUser,
  onLogin,
  onLogout,
  onResetSuccess,
  showToast,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Owner Login gate state
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Add Lead Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: '',
    assigned_category: 'IT Support',
    role: 'Responsible',
  });
  const [addingUser, setAddingUser] = useState(false);

  // Edit Lead Modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    assigned_category: '',
    is_active: true,
    password: '',
  });
  const [updatingUser, setUpdatingUser] = useState(false);

  // Delete Lead state
  const [deletingId, setDeletingId] = useState(null);

  // Factory Reset state
  const [resetPassword, setResetPassword] = useState('');
  const [wipeDatabase, setWipeDatabase] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.message || 'Failed to load category leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'Owner') {
      fetchUsers();
    }
  }, [currentUser]);

  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await api.login({
        email: ownerEmail.trim(),
        password: ownerPassword,
      });
      if (res.role !== 'Owner') {
        throw new Error('Access denied: Provided account does not have Owner permissions.');
      }
      onLogin(res);
      showToast?.('Owner verified successfully', 'success');
      setOwnerEmail('');
      setOwnerPassword('');
    } catch (err) {
      console.error('Owner login failed:', err);
      setLoginError(err.message || 'Invalid Owner credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle Add Lead
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    setError(null);
    try {
      await api.createUser(addForm);
      showToast?.('Category Lead successfully registered', 'success');
      setIsAddModalOpen(false);
      setAddForm({
        full_name: '',
        email: '',
        password: '',
        assigned_category: 'IT Support',
        role: 'Responsible',
      });
      fetchUsers();
    } catch (err) {
      console.error('Failed to create lead:', err);
      setError(err.message || 'Failed to create lead');
    } finally {
      setAddingUser(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || '',
      assigned_category: user.assigned_category || 'IT Support',
      is_active: user.is_active ?? true,
      password: '',
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);
    setError(null);
    try {
      const payload = {
        full_name: editForm.full_name,
        assigned_category: editForm.assigned_category,
        is_active: editForm.is_active,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await api.updateUser(editingUser.id, payload);
      showToast?.(`Lead #${editingUser.id} updated`, 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to update lead:', err);
      setError(err.message || 'Failed to update lead');
    } finally {
      setUpdatingUser(false);
    }
  };

  // Handle Delete Lead
  const handleDeleteUser = async (userId) => {
    if (!window.confirm(`Are you sure you want to remove Lead #${userId}?`)) {
      return;
    }
    setDeletingId(userId);
    try {
      await api.deleteUser(userId);
      showToast?.('Category Lead deleted', 'success');
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Factory Reset
  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (!resetPassword) {
      setError('Owner master password is required.');
      return;
    }

    setResetting(true);
    setError(null);
    try {
      await api.factoryReset({
        owner_password: resetPassword,
        wipe_database: wipeDatabase,
      });
      showToast?.('Factory reset completed successfully.', 'success');
      setIsResetConfirmOpen(false);
      setResetPassword('');
      if (onResetSuccess) {
        onResetSuccess();
      }
    } catch (err) {
      console.error('Factory reset failed:', err);
      setError(err.message || 'Factory reset authorization failed.');
    } finally {
      setResetting(false);
    }
  };

  if (!currentUser || currentUser.role !== 'Owner') {
    return (
      <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in duration-200">
        <div className="p-8 rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center p-0.5 shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Owner Authentication</h2>
            <p className="text-xs text-slate-400">
              Enter the system Owner email and master password to access administrative controls
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleOwnerLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Owner Email Address *</span>
              </label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="admin@ticketworkspace.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Master Password *</span>
              </label>
              <input
                type="password"
                required
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              {loggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              <span>Verify & Access Owner Panel</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Owner Control Panel</h1>
            <p className="text-xs text-slate-400">
              Authenticated as <span className="text-purple-300">{currentUser.email}</span> &bull; Manage departmental category leads and system lifecycle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Category Lead</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Lock Owner Panel"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Departmental Category Leads Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-bold text-white">Departmental Leads Directory</h2>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            title="Refresh Leads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-xs">Loading leads...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
            No users registered yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-white">
                        {user.full_name || 'System Operator'}
                      </h3>
                      {user.role === 'Owner' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">
                      {user.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Edit Lead"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {user.role !== 'Owner' && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingId === user.id}
                        className="p-1 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Department:</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-blue-300 border border-slate-700">
                      {user.assigned_category || 'All Categories'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                    ></span>
                    <span className="text-[11px] text-slate-400">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Danger Zone - Factory Reset */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-900 border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">System Lifecycle: Factory Reset</h2>
            <p className="text-xs text-rose-300/80">
              Restore the entire application to an uninitialized factory state. Requires Master Password.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
          Factory reset reverts <code className="text-rose-300 bg-rose-950/40 px-1 py-0.5 rounded font-mono">setup_state.json</code>,
          allowing the setup wizard to be executed anew. If "Wipe Database" is selected, all existing tickets, users, and comments will be completely cleared.
        </p>

        <div className="pt-2">
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Initiate Factory Reset...</span>
          </button>
        </div>
      </div>

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">Add Category Lead</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder="e.g. Jordan Lee"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="lead@company.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned Category Department *
                </label>
                <select
                  value={addForm.assigned_category}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      assigned_category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {addingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                Edit Lead: {editingUser.email}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned Category Department
                </label>
                <select
                  value={editForm.assigned_category}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      assigned_category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active_status"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active_status" className="text-xs text-slate-300">
                  Account Active Status
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Change Password (leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="New password (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingUser}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {updatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Factory Reset Modal Confirmation */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Execute Factory Reset</h3>
                <p className="text-xs text-rose-300">Action cannot be undone</p>
              </div>
            </div>

            <form onSubmit={handleExecuteReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Owner Master Password *
                </label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Master password..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={wipeDatabase}
                    onChange={(e) => setWipeDatabase(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-200">
                    Also wipe database (drop all tables & tickets)
                  </span>
                </label>
                <p className="text-[11px] text-rose-400/80 pl-5">
                  If unchecked, setup configuration is erased but existing database data is retained.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetConfirmOpen(false);
                    setResetPassword('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting || !resetPassword}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                >
                  {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerPanel;
