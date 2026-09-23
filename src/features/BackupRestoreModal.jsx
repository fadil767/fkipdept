import React, { useState, useEffect } from "react";
import {
  buildBackupData,
  downloadBackupFile,
  parseAndValidateBackupFile,
  saveSemesterSnapshot,
  listSavedSnapshots,
  deleteSavedSnapshot,
} from "../lib/backup.js";

/**
 * BackupRestoreModal Component
 * Provides complete data backup, local snapshot management, and restore capabilities.
 */
export default function BackupRestoreModal({
  isOpen,
  onClose,
  lecturers = [],
  courses = [],
  terms = [],
  termPlottings = [],
  courseClassPlans = {},
  auditLogs = [],
  userEmail = "",
  selectedTermCode = "",
  onApplyRestore,
}) {
  const [activeTab, setActiveTab] = useState("backup"); // 'backup' | 'snapshot' | 'restore'
  const [compressGzip, setCompressGzip] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState("");

  // Snapshot states
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotSuccessMessage, setSnapshotSuccessMessage] = useState("");

  // Restore states
  const [restoreFile, setRestoreFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSnapshots(listSavedSnapshots());
      setDownloadSuccessMessage("");
      setSnapshotSuccessMessage("");
      setValidationResult(null);
      setRestoreFile(null);
      setConfirmedRisk(false);
      setRestoreError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Handle Backup Download
  const handleDownloadBackup = () => {
    try {
      const payload = buildBackupData({
        lecturers,
        courses,
        terms,
        termPlottings,
        courseClassPlans,
        auditLogs,
        userEmail,
      });

      const result = downloadBackupFile(payload, compressGzip);
      setDownloadSuccessMessage(
        `Berkas cadangan "${result.filename}" (${(result.size / 1024).toFixed(1)} KB) berhasil diunduh ke komputer Anda.`,
      );
    } catch (err) {
      console.error("Backup download error:", err);
      setDownloadSuccessMessage(`Gagal membuat cadangan: ${err.message}`);
    }
  };

  // 2. Handle Local Snapshot
  const handleCreateSnapshot = () => {
    const currentTerm = terms.find((t) => t.code === selectedTermCode) || terms[0];
    const termCode = currentTerm ? currentTerm.code : "CURRENT";
    const termName = currentTerm ? currentTerm.name : "Semester Aktif";

    const snapshotData = {
      lecturers,
      courses,
      terms,
      termPlottings: termPlottings.filter((tp) => tp.term_code === termCode),
      courseClassPlans,
    };

    const ok = saveSemesterSnapshot(termCode, termName, snapshotData);
    if (ok) {
      setSnapshots(listSavedSnapshots());
      setSnapshotSuccessMessage(`Snapshot untuk "${termName}" berhasil disimpan di browser.`);
      setTimeout(() => setSnapshotSuccessMessage(""), 4000);
    }
  };

  const handleDeleteSnapshot = (key) => {
    deleteSavedSnapshot(key);
    setSnapshots(listSavedSnapshots());
  };

  const handleApplySnapshot = (snapshot) => {
    if (!snapshot || !snapshot.data) return;
    const confirmRestore = window.confirm(
      `Apakah Anda yakin ingin memulihkan data semester dari snapshot "${snapshot.termName}" yang dibuat pada ${new Date(
        snapshot.timestamp,
      ).toLocaleString("id-ID")}? Data saat ini untuk semester tersebut akan digantikan.`,
    );
    if (!confirmRestore) return;

    if (typeof onApplyRestore === "function") {
      onApplyRestore(snapshot.data);
      onClose();
    }
  };

  // 3. Handle File Selection for Restore
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setParsing(true);
    setRestoreError("");
    setValidationResult(null);

    const result = await parseAndValidateBackupFile(file);
    setParsing(false);
    setValidationResult(result);
  };

  // 4. Handle Execute Restore
  const handleExecuteRestore = () => {
    if (!validationResult || !validationResult.valid || !validationResult.data) {
      setRestoreError("Berkas cadangan tidak valid.");
      return;
    }
    if (!confirmedRisk) {
      setRestoreError("Mohon centang kotak persetujuan konfirmasi risiko sebelum melanjutkan.");
      return;
    }

    setRestoreBusy(true);
    try {
      if (typeof onApplyRestore === "function") {
        onApplyRestore(validationResult.data);
      }
      setRestoreBusy(false);
      onClose();
    } catch (err) {
      setRestoreBusy(false);
      setRestoreError(`Gagal memulihkan data: ${err.message}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#005baa] dark:bg-blue-950/60 dark:text-cyan-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16m-5 4v6m-4-6v6"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102f52] dark:text-slate-100">
                Cadangkan & Pulihkan Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keamanan dan portabilitas data akademik program studi FKIP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-6 pt-2 dark:border-slate-800 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "backup"
                ? "border-[#005baa] text-[#005baa] dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Unduh Cadangan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("snapshot")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "snapshot"
                ? "border-[#005baa] text-[#005baa] dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Snapshot Semester ({snapshots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("restore")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "restore"
                ? "border-[#005baa] text-[#005baa] dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Pulihkan Data</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="max-h-[68vh] overflow-y-auto p-6">
          {/* TAB 1: BACKUP DOWNLOAD */}
          {activeTab === "backup" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-950/80 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#005baa] dark:bg-blue-900/60 dark:text-cyan-400">
                    ℹ️
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-[#102f52] dark:text-cyan-300">
                      Cadangan Lengkap Sistem
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      Mencakup seluruh basis data: direktori dosen, katalog mata kuliah, seluruh semester, riwayat plotting, rencana rombel, dan log audit.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Summary Counter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-lg font-black text-[#102f52] dark:text-slate-100">{lecturers.length}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dosen</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-lg font-black text-[#102f52] dark:text-slate-100">{courses.length}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mata Kuliah</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-lg font-black text-[#102f52] dark:text-slate-100">{terms.length}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Semester</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-lg font-black text-[#102f52] dark:text-slate-100">{termPlottings.length}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Plotting</span>
                </div>
              </div>

              {/* Compression Option */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compressGzip}
                    onChange={(e) => setCompressGzip(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#102f52] dark:text-slate-200">
                      Kompresi GZIP (.json.gz)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mengompres ukuran berkas hingga 80% lebih kecil menggunakan fflate. Sangat cocok untuk arsip periodik.
                    </p>
                  </div>
                </label>
              </div>

              {/* Download CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#005baa] hover:bg-[#004a8c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Unduh Berkas Cadangan ({compressGzip ? ".json.gz" : ".json"})</span>
                </button>
              </div>

              {downloadSuccessMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✓ {downloadSuccessMessage}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCAL SEMESTER SNAPSHOT */}
          {activeTab === "snapshot" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 dark:border-amber-950/80 dark:bg-amber-950/20">
                <div>
                  <h3 className="text-xs font-bold text-[#102f52] dark:text-amber-200">
                    Snapshot Cepat Browser
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    Simpan titik pemulihan instan untuk semester {selectedTermCode || "aktif"} di memori peramban tanpa perlu mengunduh berkas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
                >
                  + Buat Snapshot Sekarang
                </button>
              </div>

              {snapshotSuccessMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✓ {snapshotSuccessMessage}
                </div>
              )}

              {/* Snapshot List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Daftar Snapshot Tersimpan ({snapshots.length})
                </h4>

                {snapshots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                    <p className="text-xs text-slate-400">
                      Belum ada snapshot lokal tersimpan. Klik tombol di atas untuk membuat snapshot pertama.
                    </p>
                  </div>
                ) : (
                  snapshots.map((snap) => (
                    <div
                      key={snap.key}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div>
                        <span className="font-bold text-xs text-[#102f52] dark:text-slate-100">
                          {snap.termName} ({snap.termCode})
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Dibuat: {new Date(snap.timestamp).toLocaleString("id-ID")} · {snap.itemCount} Dosen
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplySnapshot(snap)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-[#005baa] hover:bg-blue-100 dark:bg-blue-950 dark:text-cyan-300 cursor-pointer"
                        >
                          Pulihkan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshot(snap.key)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400 cursor-pointer"
                          title="Hapus Snapshot"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RESTORE FROM FILE */}
          {activeTab === "restore" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-950/80 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                    ⚠️
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-rose-900 dark:text-rose-300">
                      Perhatian: Pemulihan Data
                    </h3>
                    <p className="mt-0.5 text-xs text-rose-800/80 dark:text-rose-200/80">
                      Memulihkan data cadangan akan memperbarui direktori, katalog, dan alokasi semester sesuai dengan isi berkas cadangan. Pastikan Anda telah membuat cadangan terbaru sebelum melanjutkan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:border-[#005baa] dark:border-slate-700 dark:hover:border-cyan-400">
                <input
                  type="file"
                  id="backup-file-input"
                  accept=".json,.gz"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="backup-file-input"
                  className="flex flex-col items-center justify-center cursor-pointer select-none"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#005baa] dark:bg-slate-800 dark:text-cyan-400 mb-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-[#102f52] dark:text-slate-100">
                    {restoreFile ? restoreFile.name : "Klik atau seret berkas cadangan (.json / .json.gz) ke sini"}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">
                    Mendukung berkas cadangan resmi Universitas Terbuka FKIP
                  </span>
                </label>
              </div>

              {/* Validation Parsing Indicator */}
              {parsing && (
                <div className="text-center text-xs font-semibold text-slate-500 animate-pulse py-2">
                  Memvalidasi struktur dan tanda tangan berkas cadangan...
                </div>
              )}

              {/* Validation Result Preview */}
              {validationResult && (
                <div
                  className={`rounded-2xl border p-4 ${
                    validationResult.valid
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                  }`}
                >
                  {validationResult.valid ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Berkas Terverifikasi Valid
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Versi Skema: {validationResult.version}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <div>
                          <strong>Dibuat pada:</strong>{" "}
                          {new Date(validationResult.timestamp).toLocaleString("id-ID")}
                        </div>
                        <div>
                          <strong>Oleh:</strong> {validationResult.created_by}
                        </div>
                      </div>

                      {/* Content summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                        <div className="text-center">
                          <span className="block font-bold text-xs text-emerald-950 dark:text-emerald-200">
                            {validationResult.summary?.total_lecturers || 0}
                          </span>
                          <span className="text-[10px] text-slate-500">Dosen</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-xs text-emerald-950 dark:text-emerald-200">
                            {validationResult.summary?.total_courses || 0}
                          </span>
                          <span className="text-[10px] text-slate-500">Mata Kuliah</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-xs text-emerald-950 dark:text-emerald-200">
                            {validationResult.summary?.total_terms || 0}
                          </span>
                          <span className="text-[10px] text-slate-500">Semester</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-bold text-xs text-emerald-950 dark:text-emerald-200">
                            {validationResult.summary?.total_plottings || 0}
                          </span>
                          <span className="text-[10px] text-slate-500">Plotting</span>
                        </div>
                      </div>

                      {/* Confirmation Checkbox */}
                      <div className="pt-2">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={confirmedRisk}
                            onChange={(e) => setConfirmedRisk(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Saya mengonfirmasi untuk memulihkan basis data sistem dari berkas cadangan ini.
                          </span>
                        </label>
                      </div>

                      {/* Execute Restore CTA */}
                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        disabled={!confirmedRisk || restoreBusy}
                        className={`w-full rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all ${
                          confirmedRisk && !restoreBusy
                            ? "bg-rose-600 hover:bg-rose-700 cursor-pointer"
                            : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                        }`}
                      >
                        {restoreBusy ? "Memproses Pemulihan..." : "Terapkan Pemulihan Sekarang"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-800 dark:text-rose-300">
                      <strong>Gagal Memvalidasi:</strong> {validationResult.error}
                    </div>
                  )}
                </div>
              )}

              {restoreError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {restoreError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
