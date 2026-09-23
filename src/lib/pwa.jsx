import { useState, useEffect, useCallback } from "react";

/**
 * Trigger download of the standalone Windows .exe installer
 */
export function downloadDesktopExe() {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = "./downloads/UT_FKIP_Setup.exe";
  link.download = "UT_FKIP_Setup.exe";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Register Service Worker for offline capability
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered with scope:", registration.scope);
          resolve(registration);
        })
        .catch((error) => {
          console.warn("[PWA] Service Worker registration failed:", error);
          resolve(null);
        });
    });
  });
}

/**
 * React hook to track online/offline status, desktop environment, and install actions
 */
export function usePWA() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" && "onLine" in navigator ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.electronAPI?.isElectron);
  });
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      Boolean(window.electronAPI?.isElectron) ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen to PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstallModal(false);
      console.log("[PWA] App successfully installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const downloadInstaller = useCallback(() => {
    downloadDesktopExe();
    setShowInstallModal(true);
  }, []);

  const promptInstall = useCallback(async () => {
    // Open install & download modal
    setShowInstallModal(true);
    // Also trigger the .exe download directly for instant feedback
    downloadDesktopExe();

    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choiceResult = await installPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsInstalled(true);
        }
        setInstallPrompt(null);
        return choiceResult;
      } catch (err) {
        console.warn("[PWA] Error displaying install prompt:", err);
      }
    }
    return { outcome: "guide" };
  }, [installPrompt]);

  return {
    isOnline,
    isDesktopApp,
    isInstallable: Boolean(installPrompt),
    isInstalled,
    promptInstall,
    downloadInstaller,
    showInstallModal,
    setShowInstallModal,
  };
}

/**
 * Visual modal for downloading and installing the Windows .EXE application
 */
export function InstallGuideModal({ isOpen, onClose, onDirectInstall, hasPrompt }) {
  const [showPwaAlt, setShowPwaAlt] = useState(false);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#005baa] border border-blue-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Windows .EXE Installer Resmi
            </div>
            <h3 className="mt-1 text-lg font-bold text-[#102f52]">
              Unduh & Pasang Aplikasi UT FKIP
            </h3>
            <p className="text-xs text-[#5b6678]">
              Format <code className="font-semibold text-[#005baa]">.exe</code> mandiri untuk Windows 10 & 11 (Akses Cepat & 100% Offline)
            </p>
          </div>
        </div>

        {/* Steps Card */}
        <div className="mt-5 space-y-3.5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs font-bold text-[#005baa] mb-2.5 flex items-center gap-1.5">
              <span>🚀</span> Langkah Pemasangan Sangat Mudah:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 font-medium leading-relaxed">
              <li>
                Berkas <strong>UT_FKIP_Setup.exe</strong> otomatis terunduh ke folder <strong>Downloads</strong> laptop/PC Anda.
              </li>
              <li>
                Buka / klik dua kali berkas <strong>UT_FKIP_Setup.exe</strong> untuk memasang.
              </li>
              <li>
                Aplikasi langsung terpasang untuk akun Anda <em>(tidak membutuhkan izin administrator / UAC)</em>.
              </li>
              <li>
                Ikon <strong>UT FKIP</strong> akan otomatis tersedia di <strong>Desktop</strong> & <strong>Start Menu</strong>.
              </li>
            </ol>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <span>Nama Berkas: <strong>UT_FKIP_Setup.exe</strong> (~110 MB)</span>
            </span>
            <button
              type="button"
              onClick={downloadDesktopExe}
              className="font-bold text-[#005baa] hover:underline cursor-pointer"
            >
              Unduh Ulang ⬇
            </button>
          </div>

          {/* Browser PWA alternative toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowPwaAlt(!showPwaAlt)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showPwaAlt ? "▲ Sembunyikan" : "▼ Ingin pasang versi web browser (PWA)?"}</span>
            </button>
            {showPwaAlt && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 leading-relaxed animate-in fade-in duration-100">
                <p className="mb-1 font-semibold text-slate-700">Pasang langsung di Browser Chrome/Edge:</p>
                <p>Klik ikon <strong>Install (📥)</strong> di sebelah kanan bilah URL browser atau gunakan tombol <strong>Pasang via Browser</strong> di bawah jika didukung.</p>
                {hasPrompt && (
                  <button
                    type="button"
                    onClick={onDirectInstall}
                    className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                  >
                    Pasang via Browser Sekarang
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={downloadDesktopExe}
            className="inline-flex items-center gap-2 rounded-xl bg-[#005baa] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#004b8d] active:scale-98 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Unduh File .EXE</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
