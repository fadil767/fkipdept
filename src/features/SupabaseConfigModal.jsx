import React, { useState } from "react";

export function SupabaseConfigModal({
  isOpen,
  onClose,
  currentUrl = "",
  currentAnonKey = "",
  isOffline = false,
  onSaveConfig,
  onSetOfflineMode,
  onResetDefault,
}) {
  const [urlInput, setUrlInput] = useState(currentUrl || "");
  const [anonKeyInput, setAnonKeyInput] = useState(currentAnonKey || "");
  const [testStatus, setTestStatus] = useState(null); // { loading, success, message }

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const testUrl = (urlInput || "").trim().replace(/\/$/, "");
    if (!testUrl) {
      setTestStatus({
        loading: false,
        success: false,
        message: "Masukkan URL Supabase terlebih dahulu.",
      });
      return;
    }

    setTestStatus({ loading: true, success: null, message: "Menguji koneksi ke server Supabase..." });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${testUrl}/auth/v1/health`, {
        signal: controller.signal,
        headers: anonKeyInput ? { apikey: anonKeyInput } : {},
      });
      clearTimeout(timer);

      if (res.ok) {
        setTestStatus({
          loading: false,
          success: true,
          message: "Koneksi berhasil! Server Supabase Cloud aktif & merespons normal.",
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: `Server merespons dengan status HTTP ${res.status}. Periksa Anon Key atau izin project.`,
        });
      }
    } catch (err) {
      const isTimeout = err.name === "AbortError";
      setTestStatus({
        loading: false,
        success: false,
        message: isTimeout
          ? "Koneksi timeout. Server Supabase tidak merespons dalam 6 detik."
          : `Gagal terhubung (${err.message || "Failed to fetch"}). Project kemungkinan sedang dijeda (paused) di Supabase atau domain tidak valid.`,
      });
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (onSaveConfig) {
      onSaveConfig(urlInput.trim(), anonKeyInput.trim());
    }
    onClose();
  };

  const handleSwitchToOffline = () => {
    if (onSetOfflineMode) {
      onSetOfflineMode();
    }
    onClose();
  };

  const handleReset = () => {
    if (onResetDefault) {
      onResetDefault();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 transition-all text-[#102f52]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#005baa]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-[#102f52]">
                Konfigurasi Koneksi Supabase & Database
              </h3>
              <p className="text-xs text-slate-500">
                Atur URL server cloud atau beralih ke Mode Lokal Offline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            aria-label="Tutup"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Status Mode Saat Ini */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">Status Operasional:</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ${
              isOffline
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-blue-100 text-[#005baa] border border-blue-300"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-amber-600" : "bg-blue-600 animate-pulse"}`} />
              {isOffline ? "Mode Lokal (Offline Mandiri)" : "Mode Cloud (Supabase)"}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
            {isOffline
              ? "Aplikasi berjalan tanpa sinkronisasi internet. Data tersimpan aman di browser/komputer ini dan tidak terpengaruh jika Supabase dijeda (paused)."
              : "Aplikasi mencoba sinkronisasi langsung ke server Supabase Cloud untuk kolaborasi multi-perangkat."}
          </p>
        </div>

        {/* Form URL & Key */}
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-[#102f52] focus:border-[#005baa] focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supabase Anon Public Key
            </label>
            <textarea
              rows={2}
              value={anonKeyInput}
              onChange={(e) => setAnonKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#102f52] focus:border-[#005baa] focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Test Status Feedback */}
          {testStatus && (
            <div className={`rounded-xl p-3 text-xs border ${
              testStatus.loading
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : testStatus.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              <div className="flex items-start gap-2">
                {testStatus.loading && (
                  <svg className="h-4 w-4 animate-spin shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {!testStatus.loading && testStatus.success && (
                  <span className="text-base shrink-0">✅</span>
                )}
                {!testStatus.loading && !testStatus.success && (
                  <span className="text-base shrink-0">⚠️</span>
                )}
                <div>
                  <p className="font-semibold">{testStatus.message}</p>
                  {!testStatus.success && !testStatus.loading && (
                    <p className="mt-1 text-[11px] opacity-90">
                      💡 Jika project Supabase gratis Anda telah melewati 7 hari tidak aktif, Supabase menjedanya (paused). Silakan buka{" "}
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold hover:text-rose-950"
                      >
                        dashboard Supabase
                      </a>{" "}
                      lalu klik tombol <strong>Restore / Unpause project</strong>. Atau beralihlah ke <strong>Mode Lokal</strong> di bawah ini.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus?.loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                🔍 Tes Koneksi
              </button>
              <button
                type="button"
                onClick={handleSwitchToOffline}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                title="Nonaktifkan koneksi internet Supabase dan operasikan secara mandiri"
              >
                ⚡ Beralih ke Mode Lokal
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Hapus pengaturan lokal dan gunakan bawaan sistem"
              >
                Reset Default
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#005baa] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#004984] shadow-xs transition cursor-pointer"
              >
                Simpan & Terapkan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
