import React, { useEffect, useState } from "react";
import {
  fetchAllUserRoles,
  saveUserRole,
  deleteUserRole,
  ROLE_CONFIG,
  ROLES,
} from "../lib/rbac.js";
import { logAction } from "../lib/auditLog.js";

export default function UserManagementModal({
  isOpen,
  onClose,
  currentUserEmail = "",
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState(ROLES.ADMIN);
  const [editingEmail, setEditingEmail] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAllUserRoles();
      setUsers(data);
    } catch (err) {
      setError("Gagal memuat daftar pengguna: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSuccess("");
      setError("");
      setEditingEmail(null);
      setFormEmail("");
      setFormName("");
      setFormRole(ROLES.ADMIN);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      setError("Email pengguna wajib diisi.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await saveUserRole(formEmail.trim(), formRole, formName.trim());
      logAction(
        currentUserEmail,
        editingEmail ? "update" : "create",
        "auth",
        formEmail.trim(),
        formName.trim() || formEmail.trim(),
        { role: formRole },
      );
      setSuccess(
        editingEmail
          ? `Hak akses ${formEmail} berhasil diperbarui.`
          : `Pengguna ${formEmail} berhasil ditambahkan sebagai ${ROLE_CONFIG[formRole]?.label}.`,
      );
      setFormEmail("");
      setFormName("");
      setFormRole(ROLES.ADMIN);
      setEditingEmail(null);
      await loadUsers();
    } catch (err) {
      setError("Gagal menyimpan pengguna: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (u) => {
    setEditingEmail(u.user_email);
    setFormEmail(u.user_email);
    setFormName(u.display_name || "");
    setFormRole(u.role || ROLES.ADMIN);
    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingEmail(null);
    setFormEmail("");
    setFormName("");
    setFormRole(ROLES.ADMIN);
  };

  const handleDelete = async (email) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus hak akses khusus untuk ${email}? Pengguna akan kembali ke peran 'Hanya Lihat' secara default.`,
      )
    ) {
      return;
    }

    try {
      await deleteUserRole(email);
      logAction(currentUserEmail, "delete", "auth", email, email, {
        action: "revoke_role",
      });
      setSuccess(`Hak akses untuk ${email} berhasil dihapus.`);
      await loadUsers();
    } catch (err) {
      setError("Gagal menghapus: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-mgmt-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 mb-1">
              Super Admin Feature
            </div>
            <h2
              id="user-mgmt-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight"
            >
              Manajemen Akses & Hak Peran Pengguna
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atur hak akses pengguna ke sistem FKIP Dashboard (Super Admin, Admin, atau Hanya Lihat).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Form Add / Edit */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {editingEmail ? `Edit Hak Akses: ${editingEmail}` : "Tambah / Tetapkan Hak Akses Pengguna"}
              </h3>
              {editingEmail && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-[#005baa] hover:underline"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Email Akun UT / Google *
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingEmail)}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contoh@ecampus.ut.ac.id"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama Lengkap / Jabatan"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Peran (Role) *
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value={ROLES.SUPER_ADMIN}>Super Admin (Semua Hak Akses)</option>
                  <option value={ROLES.ADMIN}>Admin Akademik (Kelola Data & Plotting)</option>
                  <option value={ROLES.VIEWER}>Hanya Lihat (Viewer)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#005baa] hover:bg-[#004887] text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? "Menyimpan..."
                  : editingEmail
                  ? "Simpan Perubahan"
                  : "+ Tetapkan Hak Akses"}
              </button>
            </div>
          </form>

          {/* Table of Users */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Daftar Pengguna Terdaftar ({users.length})
              </h3>
              <button
                type="button"
                onClick={loadUsers}
                className="text-xs text-[#005baa] hover:underline"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Memuat data pengguna...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Belum ada pengguna terdaftar.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        Pengguna
                      </th>
                      <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        Peran (Role)
                      </th>
                      <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u) => {
                      const roleMeta = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
                      const isProtected =
                        u.user_email === "demo@fkip.ut.ac.id" ||
                        u.user_email === "fkip@ecampus.ut.ac.id";
                      return (
                        <tr
                          key={u.user_email}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {u.display_name || u.user_email.split("@")[0]}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.user_email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeColor}`}
                            >
                              {roleMeta.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditClick(u)}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium"
                              >
                                Edit
                              </button>
                              {!isProtected && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(u.user_email)}
                                  className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-medium"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
