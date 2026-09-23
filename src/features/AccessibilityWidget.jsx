import React, { useEffect, useState, useCallback } from "react";

const A11Y_STORAGE_KEY = "ut_fkip_a11y_settings";

const DEFAULT_SETTINGS = {
  theme: "light", // 'light' | 'dark' | 'auto'
  scale: "normal", // 'normal' | 'large' | 'xlarge'
  contrast: "normal", // 'normal' | 'high' | 'soft'
  dyslexic: false,
  reducedMotion: false,
  highFocus: false,
  highlightLinks: false,
};

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn("Failed to load a11y settings:", err);
  }
  return DEFAULT_SETTINGS;
}

export default function AccessibilityWidget({ onNavigate, activeTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [settings, setSettings] = useState(getStoredSettings);

  // Apply settings to document.documentElement
  useEffect(() => {
    try {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Failed to save a11y settings:", err);
    }

    const root = document.documentElement;

    // Scale
    root.setAttribute("data-a11y-scale", settings.scale);

    // Contrast
    root.setAttribute("data-a11y-contrast", settings.contrast);

    // Theme
    root.setAttribute("data-theme", settings.theme);

    // Classes for booleans
    root.classList.toggle("a11y-dyslexic", settings.dyslexic);
    root.classList.toggle("a11y-reduced-motion", settings.reducedMotion);
    root.classList.toggle("a11y-high-focus", settings.highFocus);
    root.classList.toggle("a11y-highlight-links", settings.highlightLinks);
  }, [settings]);

  // Count active non-default features
  const activeCount = [
    settings.theme !== "light",
    settings.scale !== "normal",
    settings.contrast !== "normal",
    settings.dyslexic,
    settings.reducedMotion,
    settings.highFocus,
    settings.highlightLinks,
  ].filter(Boolean).length;

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger when user is typing in form inputs, textareas, or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        document.activeElement?.isContentEditable;

      // Close open modals on Escape
      if (e.key === "Escape") {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (isOpen) {
          setIsOpen(false);
          return;
        }
      }

      // Alt + A: Toggle Accessibility Panel
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Alt + / or ?: Open Shortcuts modal
      if ((e.altKey && e.key === "/") || (e.shiftKey && e.key === "?" && !isInput)) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Alt + 1..5 for Navigation
      if (e.altKey && onNavigate && !isInput) {
        const navMap = {
          "1": "dashboard",
          "2": "directory",
          "3": "plotting",
          "4": "courses",
          "5": "approvals",
        };
        if (navMap[e.key]) {
          e.preventDefault();
          onNavigate(navMap[e.key]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showShortcutsModal, onNavigate]);

  return (
    <>
      {/* Floating Accessibility Trigger Button (Bottom-Left) */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-5 left-3 sm:left-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#005baa] to-[#0072cb] text-white shadow-xl shadow-[#005baa]/35 hover:scale-105 hover:shadow-2xl hover:shadow-[#005baa]/45 active:scale-95 transition-all duration-200 border-2 border-white/60 focus:outline-none focus:ring-4 focus:ring-[#005baa]/40 cursor-pointer"
          title="Buka Menu Aksesibilitas (Pintasan: Alt + A)"
          aria-label="Pengaturan Aksesibilitas"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          {/* Universal Accessibility Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 transition-transform group-hover:rotate-6"
          >
            <circle cx="12" cy="4.5" r="2.2" />
            <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
            <path d="M12 9v11" />
            <path d="M9 20l3-5 3 5" />
          </svg>

          {/* Active Features Count Badge */}
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f59e0b] text-[10px] font-black text-white shadow-md border-2 border-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Accessibility Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-start p-0 sm:p-6 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          {/* Backdrop dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-panel-title"
            className="relative z-10 w-full sm:w-[420px] max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl shadow-slate-900/20 text-[#102f52] overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#005baa] shadow-2xs">
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
                    <circle cx="12" cy="4.5" r="2.2" />
                    <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
                    <path d="M12 9v11" />
                    <path d="M9 20l3-5 3 5" />
                  </svg>
                </div>
                <div>
                  <h2
                    id="a11y-panel-title"
                    className="text-base font-extrabold text-[#102f52] tracking-tight leading-snug"
                  >
                    Menu Aksesibilitas
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Penyesuaian visual & kenyamanan membaca
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={resetSettings}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Kembalikan semua ke setelan awal"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                  aria-label="Tutup panel aksesibilitas"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1" style={{ scrollbarWidth: "thin" }}>
              {/* 0. Tema Tampilan (Dark Mode) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Tema Tampilan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "light",
                      label: "Terang",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <circle cx="12" cy="12" r="5" />
                          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                      ),
                      desc: "Mode Siang",
                    },
                    {
                      id: "dark",
                      label: "Gelap",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      ),
                      desc: "Mode Malam",
                    },
                    {
                      id: "auto",
                      label: "Otomatis",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      ),
                      desc: "Ikuti Sistem",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateSetting("theme", item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        settings.theme === item.id
                          ? "border-[#005baa] bg-blue-50/70 text-[#005baa] font-bold shadow-xs ring-2 ring-[#005baa]/20"
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-medium"
                      }`}
                    >
                      {item.icon}
                      <span className="text-xs mt-1.5">{item.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Ukuran Teks */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Ukuran Teks (*Text Scaling*)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "normal", label: "Normal", preview: "A", desc: "100%" },
                    { id: "large", label: "Besar", preview: "A+", desc: "112%" },
                    { id: "xlarge", label: "Ekstra", preview: "A++", desc: "125%" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateSetting("scale", item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        settings.scale === item.id
                          ? "border-[#005baa] bg-blue-50/70 text-[#005baa] font-bold shadow-xs ring-2 ring-[#005baa]/20"
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-medium"
                      }`}
                    >
                      <span className="text-lg font-black">{item.preview}</span>
                      <span className="text-xs mt-1">{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Mode Kontras Tampilan */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Kontras Tampilan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "normal",
                      label: "Standar",
                      color: "bg-blue-600",
                      desc: "Tampilan UT",
                    },
                    {
                      id: "high",
                      label: "Kontras Tinggi",
                      color: "bg-black text-yellow-300",
                      desc: "WCAG AAA",
                    },
                    {
                      id: "soft",
                      label: "Ramah Mata",
                      color: "bg-[#fef8ea] text-amber-900 border border-amber-300",
                      desc: "Suhu Hangat",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateSetting("contrast", item.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                        settings.contrast === item.id
                          ? "border-[#005baa] bg-blue-50/70 text-[#005baa] font-bold shadow-xs ring-2 ring-[#005baa]/20"
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-medium"
                      }`}
                    >
                      <span
                        className={`h-4 w-7 rounded-md mb-1.5 shadow-xs flex items-center justify-center text-[9px] font-bold ${item.color}`}
                      >
                        Abc
                      </span>
                      <span className="text-xs text-center leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Kenyamanan Membaca & Motorik */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Keterbacaan & Navigasi
                </label>

                {/* Spasi Ramah Disleksia */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Spasi Huruf Renggang
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Memudahkan pembacaan teks bagi pengguna disleksia
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.dyslexic}
                    onChange={(e) => updateSetting("dyslexic", e.target.checked)}
                    className="h-5 w-5 rounded text-[#005baa] focus:ring-[#005baa] cursor-pointer"
                  />
                </div>

                {/* Indikator Fokus Tebal */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Penanda Fokus Jelas (*Focus Ring*)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Garis tepi tegas saat navigasi tombol & input dengan `Tab`
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.highFocus}
                    onChange={(e) => updateSetting("highFocus", e.target.checked)}
                    className="h-5 w-5 rounded text-[#005baa] focus:ring-[#005baa] cursor-pointer"
                  />
                </div>

                {/* Sorot Tautan & Tombol */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Garis Bawah Tautan Interaktif
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Menandai seluruh teks tombol dan link yang dapat diklik
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.highlightLinks}
                    onChange={(e) =>
                      updateSetting("highlightLinks", e.target.checked)
                    }
                    className="h-5 w-5 rounded text-[#005baa] focus:ring-[#005baa] cursor-pointer"
                  />
                </div>

                {/* Kurangi Animasi */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Matikan Animasi (*Reduced Motion*)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Hentikan gerakan grafik & transisi bagi pengguna rentan pusing
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion}
                    onChange={(e) =>
                      updateSetting("reducedMotion", e.target.checked)
                    }
                    className="h-5 w-5 rounded text-[#005baa] focus:ring-[#005baa] cursor-pointer"
                  />
                </div>
              </div>

              {/* 4. Tombol Pintasan Keyboard */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[#005baa] hover:bg-blue-100/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⌨️</span>
                    <span className="text-xs font-bold">
                      Panduan Pintasan Tombol Keyboard
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded shadow-2xs border border-blue-200">
                    Alt + /
                  </span>
                </button>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Pintasan: <strong>Alt + A</strong></span>
              <span>Tersimpan Otomatis</span>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Guide Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          <div
            className="absolute inset-0"
            onClick={() => setShowShortcutsModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
            className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-[#102f52] animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#005baa]">
                  <span className="text-base">⌨️</span>
                </div>
                <div>
                  <h3
                    id="shortcuts-modal-title"
                    className="text-base font-extrabold text-[#102f52]"
                  >
                    Pintasan Tombol Keyboard
                  </h3>
                  <p className="text-xs text-slate-500">
                    Akses cepat menu dashboard tanpa mouse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup panduan pintasan"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-2">
                  Navigasi Halaman
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "Alt + 1", desc: "Halaman Dashboard" },
                    { key: "Alt + 2", desc: "Direktori Dosen" },
                    { key: "Alt + 3", desc: "Plotting Kelas" },
                    { key: "Alt + 4", desc: "Mata Kuliah" },
                    { key: "Alt + 5", desc: "Pengajuan Tutor" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <span className="font-medium text-slate-600">{item.desc}</span>
                      <kbd className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-2">
                  Aksesibilitas & Kontrol
                </h4>
                <div className="space-y-1.5">
                  {[
                    {
                      key: "Alt + A",
                      desc: "Buka / Tutup Menu Aksesibilitas",
                    },
                    {
                      key: "Alt + /",
                      desc: "Tampilkan Bantuan Pintasan Tombol",
                    },
                    {
                      key: "Esc",
                      desc: "Tutup Modal / Drawer Aktif",
                    },
                    {
                      key: "Tab",
                      desc: "Pindah Fokus ke Elemen Berikutnya",
                    },
                    {
                      key: "Shift + Tab",
                      desc: "Pindah Fokus ke Elemen Sebelumnya",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <span className="font-medium text-slate-600">{item.desc}</span>
                      <kbd className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#005baa] to-[#006ec9] text-white text-xs font-bold shadow-sm hover:opacity-95 cursor-pointer"
              >
                Tutup Panduan (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
