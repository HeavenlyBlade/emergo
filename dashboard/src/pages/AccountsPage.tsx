/**
 * AccountsPage — Admin-only user management
 *
 * Lists all official/admin accounts in Firestore.
 * Admin can create new accounts, reset passwords, and delete accounts.
 * Residents (phone-based users) are excluded from this list.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { hashPassword } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { Trash2, Plus, KeyRound, X } from 'lucide-react';
import type { UserRole } from '../types';

interface DashboardUser {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  phoneNumber: string;
  createdAt?: { toDate: () => Date };
}

const EMPTY_FORM = { username: '', password: '', displayName: '', phoneNumber: '', role: 'responder' as 'official' | 'admin' | 'responder' };

function normalizePhPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) return `+63${digits}`;
  if (digits.length === 11 && digits.startsWith('09')) return `+63${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('639')) return `+${digits}`;
  return null;
}

export default function AccountsPage() {
  const { userDoc } = useAuth();
  const isAdmin = userDoc?.role === 'admin';
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Reset password state
  const [resetUid, setResetUid] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as DashboardUser))
        .filter((u) => u.role === 'official' || u.role === 'admin' || u.role === 'responder' || u.role === 'tanod')
        .sort((a, b) => (a.displayName || a.username || '').localeCompare(b.displayName || b.username || ''));
      setUsers(list);
    } catch (e: any) {
      toast.error('Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ─── Create account ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRole = isAdmin ? form.role : 'responder';

    if (!form.displayName.trim()) {
      toast.error('Display name is required.');
      return;
    }

    if (effectiveRole === 'responder') {
      const normalizedPhone = normalizePhPhone(form.phoneNumber);
      if (!normalizedPhone) {
        toast.error('Enter a valid PH mobile number for the responder (e.g. +639171234567 or 09171234567).');
        return;
      }
      setSaving(true);
      try {
        const uid = normalizedPhone.replace(/\+/g, '');
        await setDoc(doc(db, 'users', uid), {
          role: 'responder',
          displayName: form.displayName.trim(),
          phoneNumber: normalizedPhone,
          createdAt: serverTimestamp(),
        });
        toast.success(`Responder "${form.displayName.trim()}" registered for mobile login.`);
        setForm(EMPTY_FORM);
        setShowForm(false);
        fetchUsers();
      } catch (e: any) {
        toast.error(e?.message ?? 'Could not register responder.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!form.username.trim() || !form.password.trim()) {
      toast.error('Username and password are required for official/admin accounts.');
      return;
    }
    setSaving(true);
    try {
      const uid = `user_${form.username.trim().toLowerCase()}`;
      const { hash: passwordHash, salt: passwordSalt } = await hashPassword(form.password);
      await setDoc(doc(db, 'users', uid), {
        role: effectiveRole,
        displayName: form.displayName.trim(),
        phoneNumber: form.phoneNumber.trim() || '',
        username: form.username.trim().toLowerCase(),
        passwordHash,
        passwordSalt,
        createdAt: serverTimestamp(),
      });
      toast.success(`Account "${form.username}" created.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create account.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete account ────────────────────────────────────────────────────────
  const handleDelete = (uid: string, username: string) => {
    toast.custom((t) => (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-5 py-4 flex flex-col gap-3 w-72">
        <p className="text-sm font-semibold text-gray-800">Delete "{username}"?</p>
        <p className="text-xs text-gray-500">This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteDoc(doc(db, 'users', uid));
                toast.success(`"${username}" deleted.`);
                fetchUsers();
              } catch (e: any) {
                toast.error(e?.message ?? 'Could not delete account.');
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  // ─── Reset password ────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setResetting(true);
    try {
      const { hash: passwordHash, salt: passwordSalt } = await hashPassword(newPassword);
      await setDoc(doc(db, 'users', resetUid!), { passwordHash, passwordSalt }, { merge: true });
      toast.success('Password updated.');
      setResetUid(null);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not reset password.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar active="accounts" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-500">Manage official and admin dashboard accounts</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> New Account
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Display Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No accounts found.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.uid} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700">{u.username || <span className="text-gray-400 italic font-sans text-xs">Mobile OTP</span>}</td>
                      <td className="px-4 py-3 text-gray-700">{u.displayName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'responder' || u.role === 'tanod'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                          }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.phoneNumber || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {isAdmin && u.role !== 'responder' && u.role !== 'tanod' && (
                            <button
                              onClick={() => { setResetUid(u.uid); setNewPassword(''); }}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg"
                              title="Reset password"
                            >
                              <KeyRound size={13} /> Reset
                            </button>
                          )}
                          {(isAdmin || u.role === 'responder' || u.role === 'tanod') && (
                            <button
                              onClick={() => handleDelete(u.uid, u.username || u.displayName)}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg"
                              title="Delete account"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create account modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">New Account</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={isAdmin ? form.role : 'responder'}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'official' | 'admin' | 'responder' })}
                  className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400 disabled:bg-gray-100"
                >
                  <option value="responder">Responder (Mobile App)</option>
                  {isAdmin && <option value="official">Official (Dashboard)</option>}
                  {isAdmin && <option value="admin">Admin (Dashboard)</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                />
              </div>
              {(isAdmin ? form.role : 'responder') === 'responder' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    placeholder="09171234567 or +639171234567"
                    className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Responders sign in on the Emergo mobile app using this number + SMS OTP.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="e.g. brgy_captain"
                      className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min. 6 characters"
                      className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                    <input
                      type="text"
                      value={form.phoneNumber}
                      onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                      placeholder="+639..."
                      className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUid && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
              <button onClick={() => setResetUid(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm outline-none focus:border-red-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setResetUid(null)}
                  className="flex-1 h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="flex-1 h-10 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {resetting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
