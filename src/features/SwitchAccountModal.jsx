import { useState, useEffect, useMemo } from "react";

const RECENT_ACCOUNTS_KEY = "ut_recent_accounts_v1";
const SAVED_CREDENTIALS_KEY = "ut_saved_login_credentials_v1";

export function getStoredRecentAccounts() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentAccount(account) {
  if (typeof localStorage === "undefined" || !account?.email) return;
  try {
    const recents = getStoredRecentAccounts().filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    recents.unshift({
      email: account.email,
      name: account.name || account.email.split("@")[0] || "Administrator",
      role: account.role || "Administrator Program Studi",
      type: account.type || (account.email.includes("demo") ? "demo" : "cloud"),
      lastUsed: new Date().toISOString(),
    });
    // Keep up to 6 recent accounts
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(recents.slice(0, 6)));
  } catch (err) {
    console.warn("Failed to save recent account:", err);
  }
}

export function removeRecentAccount(email) {
  if (typeof localStorage === "undefined" || !email) return;
  try {
    const recents = getStoredRecentAccounts().filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase()
    );
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(recents));
  } catch (err) {
    console.warn("Failed to remove recent account:", err);
  }
}

function getStoredSavedCredentials() {
  if (typeof localStorage === "undefined") return { email: "", password: "" };
  try {
    const raw = localStorage.getItem(SAVED_CREDENTIALS_KEY);
    if (!raw) return { email: "", password: "" };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === "string" ? parsed.email : "",
      password: typeof parsed?.password === "string" ? parsed.password : "",
    };
  } catch {
    return { email: "", password: "" };
  }
}

function SwitchAccountDialog({
  onClose,
  currentUserEmail,
  isDemoSession,
  demoAccount = { email: "demo@fkip.ut.ac.id", password: "Demo@12345" },
  onSwitchToDemo,
  onSwitchToCloud,
  onLogoutAndLoginMode,
}) {
  const [recentAccounts, setRecentAccounts] = useState(() => getStoredRecentAccounts());
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [inlinePasswordEmail, setInlinePasswordEmail] = useState("");
  const [inlinePassword, setInlinePassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Known default accounts list (Cloud Admin & Demo)
  const defaultAccounts = useMemo(() => {
    const savedCreds = getStoredSavedCredentials();
    const cloudEmail = savedCreds.email || "admin.fkip@ecampus.ut.ac.id";

    return [
      {
        email: cloudEmail,
        name: "Administrator FKIP",
        role: "Administrator Program Studi (Cloud)",
        type: "cloud",
        savedPassword: savedCreds.email === cloudEmail ? savedCreds.password : "",
      },
      {
        email: demoAccount.email,
        name: "Admin Demo",
        role: "Administrator Program Studi (Lokal)",
        type: "demo",
        savedPassword: demoAccount.password,
      },
    ];
  }, [demoAccount]);

  // Combined accounts list without duplicate emails
  const allAccounts = useMemo(() => {
    const seen = new Set();
    const list = [];

    // Add default accounts first
    defaultAccounts.forEach((acc) => {
      seen.add(acc.email.toLowerCase());
      list.push(acc);
    });

    // Add any recent accounts not in default
    recentAccounts.forEach((acc) => {
      if (!seen.has(acc.email.toLowerCase())) {
        seen.add(acc.email.toLowerCase());
        list.push(acc);
      }
    });

    return list;
  }, [defaultAccounts, recentAccounts]);

  const handleSelectAccount = async (targetAccount) => {
    setErrorMsg("");
    if (
      targetAccount.email.toLowerCase() === currentUserEmail.toLowerCase() &&
      ((isDemoSession && targetAccount.type === "demo") || (!isDemoSession && targetAccount.type === "cloud"))
    ) {
      // Already on this account
      onClose();
      return;
    }

    if (targetAccount.type === "demo" || targetAccount.email.toLowerCase() === demoAccount.email.toLowerCase()) {
      // Direct switch to Demo (no password required)
      saveRecentAccount({
        email: demoAccount.email,
        name: "Admin Demo",
        role: "Administrator Program Studi (Lokal)",
        type: "demo",
      });
      onSwitchToDemo();
      onClose();
      return;
    }

    // Cloud Account: check if we have saved password
    const savedCreds = getStoredSavedCredentials();
    const passwordToUse =
      targetAccount.savedPassword ||
      (savedCreds.email.toLowerCase() === targetAccount.email.toLowerCase() ? savedCreds.password : "");

    if (passwordToUse) {
      setIsSubmitting(true);
      try {
        await onSwitchToCloud(targetAccount.email, passwordToUse);
        saveRecentAccount(targetAccount);
        onClose();
      } catch (err) {
        // If saved password fails, prompt for password
        setInlinePasswordEmail(targetAccount.email);
        setErrorMsg(err?.message || "Kata sandi tersimpan tidak valid. Masukkan kata sandi.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Need password: show inline password input for this account
      setInlinePasswordEmail(targetAccount.email);
      setInlinePassword("");
    }
  };

  const handleInlineLoginSubmit = async (e) => {
    e.preventDefault();
    if (!inlinePasswordEmail || !inlinePassword) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await onSwitchToCloud(inlinePasswordEmail, inlinePassword);
      saveRecentAccount({
        email: inlinePasswordEmail,
        name: inlinePasswordEmail.split("@")[0] || "Administrator",
        role: "Administrator Program Studi (Cloud)",
        type: "cloud",
      });
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Autentikasi gagal. Periksa kembali kata sandi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewAccountSubmit = async (e) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const isDemo =
      newEmail.trim().toLowerCase() === demoAccount.email.toLowerCase() &&
      newPassword === demoAccount.password;

    if (isDemo) {
      saveRecentAccount({
        email: demoAccount.email,
        name: "Admin Demo",
        role: "Administrator Program Studi (Lokal)",
        type: "demo",
      });
      onSwitchToDemo();
      onClose();
      setIsSubmitting(false);
      return;
    }

    try {
      await onSwitchToCloud(newEmail.trim(), newPassword);
      saveRecentAccount({
        email: newEmail.trim(),
        name: newEmail.trim().split("@")[0] || "Administrator",
        role: "Administrator Program Studi",
        type: "cloud",
      });
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Gagal masuk. Periksa kembali email dan kata sandi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAccount = (e, email) => {
    e.stopPropagation();
    removeRecentAccount(email);
    setRecentAccounts(getStoredRecentAccounts());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-account-title"
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#005baa] border border-blue-100 shadow-2xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
            </div>
            <div>
              <h3 id="switch-account-title" className="font-display text-lg font-extrabold text-[#102f52]">
                Beralih Akun (Switch Account)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Pilih sesi administrator yang ingin digunakan atau masuk dengan akun lain
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Tutup dialog"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 text-rose-600 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Current Active Account Card */}
        <div className="mt-4 rounded-2xl border-2 border-[#005baa]/30 bg-blue-50/40 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#005baa]">
              Akun yang Sedang Aktif
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Sedang Aktif
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#005baa] text-sm font-black text-white shadow-xs uppercase shrink-0">
              {currentUserEmail?.[0] || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#102f52] truncate" title={currentUserEmail}>
                {currentUserEmail || "demo@fkip.ut.ac.id"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-500 font-medium">Administrator Program Studi</span>
                <span className="text-slate-300">·</span>
                <span className={`text-[10px] font-bold ${isDemoSession ? "text-amber-700" : "text-emerald-700"}`}>
                  {isDemoSession ? "Mode Demo (Lokal)" : "Cloud Supabase (Live)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts List to Switch to */}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Pilih Akun untuk Beralih
          </p>
          <div className="space-y-2">
            {allAccounts.map((account) => {
              const isActive =
                account.email.toLowerCase() === currentUserEmail.toLowerCase() &&
                ((isDemoSession && account.type === "demo") || (!isDemoSession && account.type === "cloud"));
              const isInlinePasswordTarget = inlinePasswordEmail.toLowerCase() === account.email.toLowerCase();

              return (
                <div
                  key={`${account.email}-${account.type}`}
                  className={`rounded-2xl border transition-all ${
                    isActive
                      ? "border-slate-200 bg-slate-50/70 opacity-70"
                      : "border-slate-200/90 bg-white hover:border-[#005baa] hover:shadow-sm"
                  } p-3`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => !isActive && handleSelectAccount(account)}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold uppercase shadow-2xs shrink-0 ${
                          account.type === "demo"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-blue-100 text-[#005baa] border border-blue-200"
                        }`}
                      >
                        {account.email[0] || "A"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[#102f52] truncate" title={account.email}>
                            {account.email}
                          </p>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              account.type === "demo"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-[#005baa] border border-blue-200"
                            }`}
                          >
                            {account.type === "demo" ? "Demo" : "Cloud"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {account.role || (account.type === "demo" ? "Simulasi Cepat Lokal" : "Database Cloud")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <span className="text-[11px] font-bold text-slate-400 px-2 py-1">Aktif</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectAccount(account)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-[#005baa] hover:text-white px-3 py-1.5 text-xs font-bold text-[#005baa] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {isSubmitting && isInlinePasswordTarget ? (
                            <span>Memproses...</span>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3 w-3"
                              >
                                <path d="m16 3 4 4-4 4" />
                                <path d="M20 7H4" />
                                <path d="m8 21-4-4 4-4" />
                                <path d="M4 17h16" />
                              </svg>
                              <span>Beralih</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Remove custom account if not a default one */}
                      {account.email !== demoAccount.email &&
                        account.email !== "admin.fkip@ecampus.ut.ac.id" && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveAccount(e, account.email)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus dari daftar riwayat akun"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-3.5 w-3.5"
                            >
                              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Inline password form if password required */}
                  {isInlinePasswordTarget && (
                    <form
                      onSubmit={handleInlineLoginSubmit}
                      className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2"
                    >
                      <input
                        type="password"
                        autoFocus
                        value={inlinePassword}
                        onChange={(e) => setInlinePassword(e.target.value)}
                        placeholder={`Masukkan kata sandi untuk ${account.email}`}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-[#102f52] outline-none focus:border-[#005baa]"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !inlinePassword}
                        className="rounded-xl bg-[#005baa] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#004887] transition disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? "Masuk..." : "Masuk"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlinePasswordEmail("")}
                        className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Tambah Akun Lain */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          {!showNewAccountForm ? (
            <button
              type="button"
              onClick={() => setShowNewAccountForm(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 hover:border-[#005baa] hover:bg-blue-50/50 p-3 text-xs font-bold text-[#005baa] transition cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Masuk dengan Akun Lain</span>
            </button>
          ) : (
            <form onSubmit={handleNewAccountSubmit} className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#102f52]">Masuk Akun Baru</span>
                <button
                  type="button"
                  onClick={() => setShowNewAccountForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Tutup
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Email Akun
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin.fkip@ecampus.ut.ac.id"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#102f52] outline-none focus:border-[#005baa]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-xs text-[#102f52] outline-none focus:border-[#005baa]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-slate-300 text-[#005baa] focus:ring-[#005baa]"
                  />
                  <span>Ingat akun ini</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !newEmail || !newPassword}
                  className="rounded-xl bg-[#005baa] hover:bg-[#004887] text-white px-4 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Sedang Masuk..." : "Masuk & Beralih"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onLogoutAndLoginMode) onLogoutAndLoginMode();
            }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
          >
            Keluar dari Sesi Ini
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SwitchAccountModal(props) {
  if (!props.isOpen) return null;
  return <SwitchAccountDialog {...props} />;
}

