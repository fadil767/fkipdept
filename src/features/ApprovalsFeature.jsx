import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function createApprovalsFeature({
  Badge,
  Button,
  Card,
  Icons,
  courseTitleByCode,
}) {
  return function Approvals({
    submissions = [],
    courses = [],
    terms = [],
    selectedTermCode = "",
    onApproveSubmission,
    onRejectSubmission,
    onDeleteSubmission,
    onSyncApprovedToDirectory,
    canEdit = true,
    readOnly = false,
  }) {
    const [filterStatus, setFilterStatus] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [rejectingItem, setRejectingItem] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [syncToast, setSyncToast] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkRejectModalOpen, setBulkRejectModalOpen] = useState(false);
    const [bulkRejectReason, setBulkRejectReason] = useState("");

    const pendingCount = submissions.filter((s) => s.status === "pending").length;
    const approvedCount = submissions.filter((s) => s.status === "approved").length;
    const rejectedCount = submissions.filter((s) => s.status === "rejected").length;

    const handleSyncAllApproved = () => {
      if (onSyncApprovedToDirectory) {
        const count = onSyncApprovedToDirectory();
        setSyncToast(
          count > 0
            ? `${count} data tutor yang disetujui berhasil disinkronkan ke Direktori Dosen & Plotting!`
            : "Belum ada pengajuan dengan status disetujui untuk disinkronkan.",
        );
        setTimeout(() => setSyncToast(""), 4500);
      }
    };

    const filteredSubmissions = submissions.filter((sub) => {
      if (filterStatus !== "all" && sub.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          sub.name?.toLowerCase().includes(q) ||
          sub.id?.toLowerCase().includes(q) ||
          sub.email?.toLowerCase().includes(q) ||
          sub.expertise?.some((e) => e.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const toggleSelect = (id) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const isAllSelected =
      filteredSubmissions.length > 0 &&
      filteredSubmissions.every((s) => selectedIds.has(s.id));

    const toggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredSubmissions.map((s) => s.id)));
      }
    };

    const handleBulkApprove = () => {
      const targets = submissions.filter((s) => selectedIds.has(s.id));
      if (!targets.length) return;
      targets.forEach((sub) => {
        onApproveSubmission(sub);
      });
      const count = targets.length;
      setSelectedIds(new Set());
      setSyncToast({
        text: `Berhasil menyetujui ${count} pengajuan calon tutor dan mensinkronkan ke direktori!`,
        type: "approved",
      });
      setTimeout(() => setSyncToast(""), 7000);
    };

    const handleBulkReject = () => {
      const targets = submissions.filter((s) => selectedIds.has(s.id));
      if (!targets.length) return;
      targets.forEach((sub) => {
        onRejectSubmission(sub.id, bulkRejectReason || "Kuota kelas tutorial semester ini telah terpenuhi.");
      });
      const count = targets.length;
      setSelectedIds(new Set());
      setBulkRejectModalOpen(false);
      setBulkRejectReason("");
      setSyncToast({
        text: `Berhasil menolak ${count} pengajuan calon tutor.`,
        type: "rejected",
      });
      setTimeout(() => setSyncToast(""), 7000);
    };

    const handleBulkDelete = () => {
      if (!onDeleteSubmission) return;
      const targets = Array.from(selectedIds);
      if (!targets.length) return;
      if (window.confirm(`Hapus permanen ${targets.length} riwayat pengajuan calon tutor yang dipilih?`)) {
        targets.forEach((id) => onDeleteSubmission(id));
        setSelectedIds(new Set());
        setSyncToast({
          text: `Berhasil menghapus ${targets.length} pengajuan.`,
          type: "rejected",
        });
        setTimeout(() => setSyncToast(""), 5000);
      }
    };

    const handleSendWhatsAppNotification = (sub, statusType = "approved") => {
      const rawPhone = String(sub?.phone || "").replace(/\D/g, "");
      if (!rawPhone) {
        setSyncToast(`Nomor telepon / WhatsApp untuk "${sub?.name}" belum terdaftar.`);
        setTimeout(() => setSyncToast(""), 4000);
        return;
      }
      const cleanPhone = rawPhone.startsWith("0")
        ? "62" + rawPhone.slice(1)
        : rawPhone.startsWith("62")
        ? rawPhone
        : "62" + rawPhone;

      const termObj = terms.find((t) => t.code === selectedTermCode) || terms[0];
      const termLabel = termObj ? `${termObj.ay} (${termObj.semester})` : "Semester 2026/2027 Ganjil";

      let message = "";
      if (statusType === "approved") {
        const plottedList = (sub.plotted || [])
          .map((code) => {
            const title = courseTitleByCode ? courseTitleByCode(courses, code) : "";
            return title ? `• ${code} - ${title}` : `• ${code}`;
          })
          .join("\n");

        message =
          `Yth. Bapak/Ibu ${sub.name},\n\n` +
          `Kami dari Pengelola Program Studi FKIP Universitas Terbuka menginformasikan bahwa Pengajuan Kesediaan Mengajar Tutorial Anda untuk periode *${termLabel}* telah *DISETUJUI*.\n\n` +
          (plottedList ? `*Mata Kuliah Siap Diampu:*\n${plottedList}\n\n` : "") +
          `Data Anda telah berhasil disinkronkan ke dalam sistem direktori plotting semester ini. Tim prodi akan segera berkoordinasi lebih lanjut terkait kelas dan jadwal tutorial.\n\n` +
          `Terima kasih atas dedikasi dan kesediaan Bapak/Ibu.\n\n` +
          `Salam hormat,\n` +
          `*Pengelola Program Studi FKIP Universitas Terbuka*`;
      } else if (statusType === "rejected") {
        const reasonText = sub.rejectionReason || rejectionReason;
        message =
          `Yth. Bapak/Ibu ${sub.name},\n\n` +
          `Terima kasih atas pengajuan kesediaan mengajar Tutorial Program Studi FKIP Universitas Terbuka periode *${termLabel}*.\n\n` +
          `Mohon maaf, saat ini pengajuan kesediaan Anda belum dapat kami setujui` +
          (reasonText ? ` dengan catatan: "${reasonText}".\n\n` : ` dikarenakan kuota kelas tutorial telah terpenuhi.\n\n`) +
          `Silakan menghubungi prodi apabila terdapat hal yang ingin dikonfirmasi lebih lanjut.\n\n` +
          `Salam hormat,\n` +
          `*Pengelola Program Studi FKIP Universitas Terbuka*`;
      } else {
        message =
          `Yth. Bapak/Ibu ${sub.name},\n\n` +
          `Kami dari Pengelola Program Studi FKIP Universitas Terbuka mengonfirmasi bahwa formulir kesediaan mengajar Anda untuk periode *${termLabel}* telah *diterima* dan saat ini sedang dalam proses verifikasi tim prodi.\n\n` +
          `Salam hormat,\n` +
          `*Pengelola Program Studi FKIP Universitas Terbuka*`;
      }

      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    };

    const handleConfirmReject = () => {
      if (!rejectingItem) return;
      onRejectSubmission(rejectingItem.id, rejectionReason);
      const itemToNotify = { ...rejectingItem, rejectionReason };
      setRejectingItem(null);
      setRejectionReason("");
      setSyncToast({
        text: `Pengajuan "${itemToNotify.name}" ditolak.`,
        sub: itemToNotify,
        type: "rejected",
      });
      setTimeout(() => setSyncToast(""), 6000);
    };

    return (
      <div className="space-y-6">
        {readOnly && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            {Icons.eye && <Icons.eye className="h-4 w-4 text-slate-500 shrink-0" />}
            <span><strong>Mode Hanya Lihat:</strong> Anda sedang melihat daftar pengajuan calon tutor dalam mode pengamat. Persetujuan, penolakan, dan sinkronisasi data dibatasi untuk peran Administrator.</span>
          </div>
        )}
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#627d98]">
                  Total Pengajuan
                </p>
                <p className="font-display mt-1 text-2xl font-extrabold text-[#102f52]">
                  {submissions.length}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#005baa]">
                <Icons.file className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#fffdf5] to-[#fff9df] p-4 shadow-xs">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-400" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a6d2f]">
                  Menunggu Review
                </p>
                <p className="font-display mt-1 text-2xl font-extrabold text-[#102f52]">
                  {pendingCount}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffd23f] text-[#102f52] shadow-2xs">
                <Icons.inbox className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-xs">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Telah Disetujui
                </p>
                <p className="font-display mt-1 text-2xl font-extrabold text-emerald-950">
                  {approvedCount}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
                <Icons.check className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-slate-400 to-slate-500" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Ditolak / Arsip
                </p>
                <p className="font-display mt-1 text-2xl font-extrabold text-slate-800">
                  {rejectedCount}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Icons.x className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "pending", label: "Menunggu Approval", count: pendingCount, color: "text-[#8A6D2F]" },
              { id: "approved", label: "Disetujui", count: approvedCount, color: "text-emerald-700" },
              { id: "rejected", label: "Ditolak", count: rejectedCount, color: "text-slate-600" },
              { id: "all", label: "Semua", count: submissions.length, color: "text-[#005BAA]" },
            ].map((tab) => {
              const active = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-[#005BAA] text-white shadow-sm"
                      : "border border-[#CCDCEF] bg-white text-[#44607A] hover:bg-[#F2F7FC]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[#E5EEF8] text-[#005BAA]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!readOnly && canEdit && filteredSubmissions.length > 0 && (
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs select-none">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-[#005baa]/20 cursor-pointer"
                />
                <span>Pilih Semua ({filteredSubmissions.length})</span>
              </label>
            )}

            {!readOnly && canEdit && (
              <button
                type="button"
                onClick={handleSyncAllApproved}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                title="Sinkronkan data pengajuan yang disetujui ke Direktori Dosen & Plotting"
              >
                <Icons.check className="h-4 w-4" />
                <span>Sinkronkan ke Direktori</span>
                {approvedCount > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black">
                    {approvedCount}
                  </span>
                )}
              </button>
            )}

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, ID, kepakaran..."
                className="w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2 pl-9 text-xs text-[#102F52] focus:border-[#005BAA] focus:outline-none"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-[#8FA5BD]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Sync Toast Feedback Banner */}
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-bold shadow-sm ${
              typeof syncToast === "object" && syncToast.type === "rejected"
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  typeof syncToast === "object" && syncToast.type === "rejected"
                    ? "bg-rose-600"
                    : "bg-emerald-600"
                }`}
              />
              <span>{typeof syncToast === "object" ? syncToast.text : syncToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncToast("")}
              className={`rounded p-1 ${
                typeof syncToast === "object" && syncToast.type === "rejected"
                  ? "text-rose-700 hover:bg-rose-100 hover:text-rose-900"
                  : "text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
              }`}
            >
              <Icons.x className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {/* Submissions List */}
        {filteredSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CCDCEF] bg-[#F9FBFE] p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E5EEF8] text-[#005BAA]">
              <Icons.inbox className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#102F52]">
              Tidak Ada Pengajuan
            </h3>
            <p className="mt-1 text-xs text-[#7B8B9E]">
              {filterStatus === "pending"
                ? "Semua formulir pengajuan kesediaan tutor telah diproses."
                : "Tidak ditemukan data pengajuan dengan filter yang dipilih."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredSubmissions.map((sub) => {
                const isPending = sub.status === "pending";
                const isApproved = sub.status === "approved";
                const isRejected = sub.status === "rejected";

                return (
                  <motion.div
                    key={sub.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`overflow-hidden rounded-2xl border bg-white transition hover:shadow-md ${
                      isPending
                        ? "border-[#FFD23F]/70 bg-gradient-to-r from-white via-white to-[#FFFDF5]"
                        : isApproved
                        ? "border-[#CBE0CF]"
                        : "border-slate-200 opacity-80"
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: Tutor Main Info */}
                      <div className="flex items-start gap-3 sm:max-w-xl">
                        {!readOnly && canEdit && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            className="mt-3.5 h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-[#005baa]/20 cursor-pointer shrink-0"
                            aria-label={`Pilih ${sub.name}`}
                          />
                        )}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#005BAA] to-sky-400 text-sm font-extrabold text-white shadow-2xs">
                          {sub.name
                            ? sub.name
                                .replace(/^(Dr\.|Drs\.|Dra\.|Prof\.)\s+/i, "")
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((p) => p[0]?.toUpperCase() || "")
                                .join("") || "TU"
                            : "TU"}
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#005BAA] bg-[#E5EEF8] px-2 py-0.5 rounded">
                              {sub.id}
                            </span>
                            {sub.degree && (
                              <span className="text-xs font-bold uppercase tracking-wider text-[#44607A]">
                                [{sub.degree}]
                              </span>
                            )}
                            <h4 className="text-base font-extrabold text-[#102F52]">
                              {sub.name}
                            </h4>
                            {/* Status Badge */}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0C2] px-2.5 py-0.5 text-[11px] font-black text-[#71540F]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#F4B000]" />
                                Menunggu Review
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                Disetujui
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                Ditolak
                              </span>
                            )}
                          </div>

                          {/* Contacts & Availability */}
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[#5B6678]">
                            {sub.email && (
                              <span className="inline-flex items-center gap-1">
                                <svg className="h-3.5 w-3.5 text-[#8FA5BD]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {sub.email}
                              </span>
                            )}
                            {sub.phone && (
                              <a
                                href={`https://wa.me/${String(sub.phone).replace(/\D/g, "").replace(/^0/, "62")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium hover:underline"
                                title="Chat via WhatsApp"
                              >
                                <svg className="h-3.5 w-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"/>
                                </svg>
                                {sub.phone}
                              </a>
                            )}
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200/70 px-2 py-0.5 font-bold text-[#005BAA]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#005BAA]" />
                              Kesediaan: {sub.available} Kelas
                            </span>
                          </div>

                        {/* Expertise Chips */}
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[11px] font-semibold text-[#7B8B9E]">
                            Kepakaran:
                          </span>
                          {sub.expertise?.map((exp) => (
                            <span
                              key={exp}
                              className="rounded bg-[#F2F6FA] px-2 py-0.5 text-[11px] font-medium text-[#2C4863]"
                            >
                              {exp}
                            </span>
                          ))}
                        </div>

                        {/* Plotted / Selected Courses */}
                        {sub.plotted && sub.plotted.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[11px] font-semibold text-[#7B8B9E]">
                              Minat Matkul:
                            </span>
                            {sub.plotted.map((code) => (
                              <span
                                key={code}
                                title={courseTitleByCode(courses, code)}
                                className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-[#005BAA]"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Notes */}
                        {sub.warning_note && (
                          <p className="rounded-lg bg-amber-50/70 p-2 text-xs italic text-[#71540F] border border-amber-100">
                            <strong>Catatan Tutor:</strong> "{sub.warning_note}"
                          </p>
                        )}
                        {sub.rejectionReason && (
                          <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700 border border-rose-100">
                            <strong>Alasan Penolakan:</strong> {sub.rejectionReason}
                          </p>
                        )}

                        <div className="text-[10px] text-[#8FA5BD]">
                          Diajukan pada: {new Date(sub.submittedAt || Date.now()).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                      {/* Right: Actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        {!readOnly && canEdit && isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onApproveSubmission(sub);
                                setSyncToast({
                                  text: `Tutor "${sub.name}" berhasil disetujui & tersimpan di Direktori Dosen!`,
                                  sub,
                                  type: "approved",
                                });
                                setTimeout(() => setSyncToast(""), 8000);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#005BAA] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#004A8A]"
                            >
                              <Icons.check className="h-4 w-4" />
                              Setujui & Sinkronkan
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingItem(sub);
                                setRejectionReason("");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <Icons.x className="h-4 w-4" />
                              Tolak
                            </button>
                          </>
                        )}

                        {isApproved && (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <Icons.check className="h-3.5 w-3.5" />
                              Tersinkron di Direktori
                            </span>
                            {!readOnly && canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  onApproveSubmission(sub);
                                  setSyncToast({
                                    text: `Data "${sub.name}" berhasil disinkronkan ulang ke Direktori Dosen!`,
                                    sub,
                                    type: "approved",
                                  });
                                  setTimeout(() => setSyncToast(""), 8000);
                                }}
                                className="text-[11px] text-[#005BAA] hover:underline font-medium"
                                title="Perbarui data tutor ini di direktori"
                              >
                                Sinkronkan Ulang
                              </button>
                            )}
                          </div>
                        )}

                        {!readOnly && canEdit && isRejected && (
                          <button
                            type="button"
                            onClick={() => {
                              onApproveSubmission(sub);
                              setSyncToast({
                                text: `Tutor "${sub.name}" disetujui kembali & disinkronkan ke Direktori Dosen!`,
                                sub,
                                type: "approved",
                              });
                              setTimeout(() => setSyncToast(""), 8000);
                            }}
                            className="text-xs font-medium text-[#005BAA] hover:underline"
                          >
                            Setujui Ulang
                          </button>
                        )}

                        {/* One-Click WhatsApp Notification Button */}
                        {sub.phone && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSendWhatsAppNotification(
                                sub,
                                isApproved ? "approved" : isRejected ? "rejected" : "pending"
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs transition hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                            title={`Kirim notifikasi WhatsApp resmi ke ${sub.name}`}
                          >
                            <svg className="h-3.5 w-3.5 text-emerald-600 fill-current" viewBox="0 0 24 24">
                              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"/>
                            </svg>
                            Kirim Notifikasi WA
                          </button>
                        )}

                        {!readOnly && canEdit && onDeleteSubmission && (
                          <button
                            type="button"
                            onClick={() => onDeleteSubmission(sub.id)}
                            className="text-[11px] text-[#A0B0C0] hover:text-rose-600 transition"
                            title="Hapus riwayat pengajuan"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Bulk Reject Modal */}
        {bulkRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                  <Icons.alert className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#102F52]">
                  Tolak Massal ({selectedIds.size} Pengajuan)
                </h3>
              </div>
              <p className="mt-2 text-xs text-[#5B6678]">
                Anda akan menolak <strong>{selectedIds.size} pengajuan calon tutor</strong> sekaligus. Seluruh data yang dipilih tidak akan dimasukkan ke direktori tutor aktif.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#44607A] mb-1">
                  Alasan Penolakan Bersama:
                </label>
                <textarea
                  rows={3}
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="Contoh: Kuota kelas tutorial untuk kepakaran ini telah terpenuhi pada semester berjalan."
                  className="w-full rounded-xl border border-[#CCDCEF] p-3 text-xs text-[#102F52] focus:border-rose-500 focus:outline-none"
                />
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkRejectModalOpen(false);
                    setBulkRejectReason("");
                  }}
                  className="rounded-xl border border-[#CCDCEF] px-4 py-2 text-xs font-semibold text-[#44607A] hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkReject}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                >
                  Konfirmasi Tolak Massal
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Bulk Actions Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && !readOnly && canEdit && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="fixed bottom-6 inset-x-0 mx-auto z-40 max-w-xl px-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/95 text-white p-3.5 shadow-2xl backdrop-blur-md border border-slate-700/80">
                <div className="flex items-center gap-2.5 pl-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/30 text-blue-400 font-black text-xs">
                    {selectedIds.size}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    Pengajuan Dipilih
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-2xs cursor-pointer"
                  >
                    <Icons.check className="h-3.5 w-3.5" />
                    Setujui Semua ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkRejectModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow-2xs cursor-pointer"
                  >
                    <Icons.x className="h-3.5 w-3.5" />
                    Tolak Semua
                  </button>
                  {onDeleteSubmission && (
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-rose-950/80 hover:text-rose-300 transition cursor-pointer"
                    >
                      <Icons.trash className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-xl px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Rejection Note */}
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                  <Icons.alert className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#102F52]">
                  Tolak Pengajuan Tutor
                </h3>
              </div>
              <p className="mt-2 text-xs text-[#5B6678]">
                Anda akan menolak pengajuan dari <strong>{rejectingItem.name}</strong>. Data tidak akan dimasukkan ke direktori tutor aktif.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#44607A] mb-1">
                  Alasan Penolakan (Opsional, dapat dikirim via WhatsApp):
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Kuota kelas tutorial untuk kepakaran ini telah terpenuhi pada semester berjalan."
                  className="w-full rounded-xl border border-[#CCDCEF] p-3 text-xs text-[#102F52] focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="rounded-xl border border-[#CCDCEF] px-4 py-2 text-xs font-semibold text-[#44607A] hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Interactive Toast with Direct WA Trigger */}
        <AnimatePresence>
          {syncToast && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
                typeof syncToast === "object" && syncToast.type === "rejected"
                  ? "border-rose-200 bg-white/95"
                  : "border-[#bbf7d0] bg-white/95"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  typeof syncToast === "object" && syncToast.type === "rejected"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {typeof syncToast === "object" && syncToast.type === "rejected" ? (
                  <Icons.x className="h-5 w-5" />
                ) : (
                  <Icons.check className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-[#102F52]">
                  {typeof syncToast === "object" ? syncToast.text : syncToast}
                </p>
                {typeof syncToast === "object" && syncToast.sub?.phone && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSendWhatsAppNotification(
                        syncToast.sub,
                        syncToast.type || "approved"
                      )
                    }
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold text-white shadow-2xs transition cursor-pointer ${
                      syncToast.type === "rejected"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"/>
                    </svg>
                    {syncToast.type === "rejected"
                      ? "Kirim Notifikasi Penolakan via WA →"
                      : "Kirim Pesan WhatsApp Sekarang →"}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSyncToast("")}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <Icons.x className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
}
