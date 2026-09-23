import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FKIP_EXPERTISE_PRESETS = [
  "Strategi Pembelajaran di SD",
  "Evaluasi Pembelajaran",
  "Penelitian Tindakan Kelas (PTK)",
  "Perkembangan Peserta Didik",
  "Profesi Keguruan",
  "Pembelajaran Terpadu di SD",
  "Keterampilan Berbahasa Indonesia SD",
  "Pembelajaran Matematika SD",
  "Pembelajaran PKn di SD",
  "Media & Teknologi Pembelajaran",
  "Kurikulum & Bahan Belajar",
  "Manajemen Pendidikan & Sekolah",
];

const DEFAULT_DEGREES = [
  "Dr.",
  "M.Pd.",
  "M.Si.",
  "M.Ed.",
  "S.Pd.",
  "Prof. Dr.",
  "Ph.D.",
];

export function TutorFormScreen({
  courses = [],
  terms = [],
  onRegisterTutor,
  onBack,
  onGoToDashboard,
}) {
  const activeTerm = terms.find((t) => t.active) || terms[0] || {
    code: "2026-1",
    name: "2026/2027 Ganjil",
  };

  // Form states
  const [tutorId, setTutorId] = useState(() => `FKIP${Math.floor(100 + Math.random() * 900)}`);
  const [name, setName] = useState("");
  const [degree, setDegree] = useState("M.Pd.");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState([
    "Strategi Pembelajaran di SD",
    "Evaluasi Pembelajaran",
  ]);
  const [customExpertise, setCustomExpertise] = useState("");
  const [availableClasses, setAvailableClasses] = useState(2);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [error, setError] = useState("");

  const toggleExpertise = (exp) => {
    setSelectedExpertise((prev) =>
      prev.includes(exp) ? prev.filter((item) => item !== exp) : [...prev, exp]
    );
  };

  const addCustomExpertise = () => {
    const trimmed = customExpertise.trim();
    if (trimmed && !selectedExpertise.includes(trimmed)) {
      setSelectedExpertise((prev) => [...prev, trimmed]);
      setCustomExpertise("");
    }
  };

  const toggleCourse = (code) => {
    setSelectedCourses((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Mohon masukkan nama lengkap beserta gelar.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Mohon masukkan alamat email yang valid.");
      return;
    }
    if (!phone.trim()) {
      setError("Mohon masukkan nomor telepon/WhatsApp.");
      return;
    }
    if (selectedExpertise.length === 0) {
      setError("Pilih minimal satu bidang kepakaran bidang studi FKIP.");
      return;
    }

    const payload = {
      id: tutorId.trim().toUpperCase() || `FKIP${Date.now().toString().slice(-4)}`,
      degree: degree.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      expertise: selectedExpertise,
      plotted: selectedCourses,
      available: Number(availableClasses) || 0,
      rating: 5,
      warning_note: notes.trim(),
    };

    setSubmitting(true);
    try {
      if (onRegisterTutor) {
        await onRegisterTutor(payload);
      }
      setSubmittedData(payload);
    } catch (err) {
      setError(err.message || "Gagal menyimpan data tutor. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTutorId(`FKIP${Math.floor(100 + Math.random() * 900)}`);
    setName("");
    setEmail("");
    setPhone("");
    setSelectedCourses([]);
    setNotes("");
    setSubmittedData(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-4 py-8 text-[#102F52] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Navigation Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex items-center gap-2 rounded-xl border border-[#D7E4F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#44607A] shadow-sm transition hover:border-[#005BAA] hover:text-[#005BAA]"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali ke Portal
          </button>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#E5EEF8] px-3 py-1 text-xs font-medium text-[#005BAA]">
              Semester Aktif: {activeTerm.name}
            </span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {!submittedData ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_10px_35px_-10px_rgba(16,47,82,0.08)]"
            >
              {/* Header Card */}
              <div className="border-b border-[#E3EDF8] bg-gradient-to-r from-[#005BAA] to-[#0A3D73] px-6 py-8 text-white sm:px-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FFD23F]">
                      Universitas Terbuka — Program Studi FKIP
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Formulir Kesediaan Mengajar Tutor
                    </h1>
                  </div>
                </div>
                <p className="mt-3 text-sm text-blue-100/90 leading-relaxed">
                  Silakan lengkapi data profil, bidang kepakaran, dan kesediaan alokasi kelas tutorial Anda.
                  Data ini akan langsung terhubung secara otomatis ke sistem plotting dashboard akademik.
                </p>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-8">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
                    <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* 1. Data Diri */}
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-[#102F52]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5EEF8] text-xs text-[#005BAA]">
                      1
                    </span>
                    Identitas & Kontak Tutor
                  </h3>
                  <p className="mt-1 text-xs text-[#5B6678]">
                    Informasi utama yang akan ditampilkan pada direktori dan profil tutor.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        ID Tutor / NIP <span className="text-[#005BAA]">*</span>
                      </label>
                      <input
                        type="text"
                        value={tutorId}
                        onChange={(e) => setTutorId(e.target.value)}
                        placeholder="Contoh: FKIP009"
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-[#F9FBFE] px-3.5 py-2.5 text-sm font-semibold uppercase text-[#102F52] focus:border-[#005BAA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005BAA]/20"
                        required
                      />
                      <span className="mt-1 block text-[11px] text-[#7B8B9E]">
                        Kode unik tutor dalam sistem (dapat disesuaikan jika ada NIP).
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Gelar Akademik Tertinggi <span className="text-[#005BAA]">*</span>
                      </label>
                      <select
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2.5 text-sm font-medium text-[#102F52] focus:border-[#005BAA] focus:outline-none focus:ring-2 focus:ring-[#005BAA]/20"
                      >
                        {DEFAULT_DEGREES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Nama Lengkap beserta Gelar <span className="text-[#005BAA]">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Dra. Rina Sulistiyowati, M.Ak., B.K.P."
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2.5 text-sm text-[#102F52] focus:border-[#005BAA] focus:outline-none focus:ring-2 focus:ring-[#005BAA]/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Email Aktif (@ecampus.ut.ac.id / Pribadi) <span className="text-[#005BAA]">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rina.s@ecampus.ut.ac.id"
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2.5 text-sm text-[#102F52] focus:border-[#005BAA] focus:outline-none focus:ring-2 focus:ring-[#005BAA]/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Nomor WhatsApp / HP <span className="text-[#005BAA]">*</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812-3456-7890"
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2.5 text-sm text-[#102F52] focus:border-[#005BAA] focus:outline-none focus:ring-2 focus:ring-[#005BAA]/20"
                        required
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-[#E5EEF8]" />

                {/* 2. Kepakaran FKIP */}
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-[#102F52]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5EEF8] text-xs text-[#005BAA]">
                      2
                    </span>
                    Bidang Kepakaran Bidang Ilmu Pendidikan (FKIP)
                  </h3>
                  <p className="mt-1 text-xs text-[#5B6678]">
                    Pilih bidang kepakaran yang relevan dengan kompetensi Anda untuk penentuan plotting mata kuliah.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {FKIP_EXPERTISE_PRESETS.map((exp) => {
                      const isSelected = selectedExpertise.includes(exp);
                      return (
                        <button
                          key={exp}
                          type="button"
                          onClick={() => toggleExpertise(exp)}
                          className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                            isSelected
                              ? "border-[#005BAA] bg-[#005BAA] text-white shadow-sm"
                              : "border-[#D7E4F2] bg-white text-[#44607A] hover:border-[#96BFE6] hover:bg-[#F2F7FC]"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {exp}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tambah Kepakaran Kustom */}
                  <div className="mt-3 flex max-w-md gap-2">
                    <input
                      type="text"
                      value={customExpertise}
                      onChange={(e) => setCustomExpertise(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomExpertise();
                        }
                      }}
                      placeholder="Tambah kepakaran lain..."
                      className="flex-1 rounded-xl border border-[#CCDCEF] bg-white px-3 py-1.5 text-xs text-[#102F52] focus:border-[#005BAA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomExpertise}
                      className="rounded-xl bg-[#E5EEF8] px-3 py-1.5 text-xs font-semibold text-[#005BAA] hover:bg-[#D5E6F7]"
                    >
                      Tambah
                    </button>
                  </div>
                </div>

                <hr className="border-[#E5EEF8]" />

                {/* 3. Kesediaan Mengajar & Pilihan Matkul */}
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-[#102F52]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5EEF8] text-xs text-[#005BAA]">
                      3
                    </span>
                    Kesediaan & Minat Mata Kuliah
                  </h3>
                  <p className="mt-1 text-xs text-[#5B6678]">
                    Tentukan jumlah kelas tutorial yang siap diampu dan mata kuliah FKIP yang diminati.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Kesediaan Jumlah Kelas Tutorial:{" "}
                        <span className="font-bold text-[#005BAA]">{availableClasses} Kelas</span>
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setAvailableClasses(count)}
                            className={`flex h-10 w-12 items-center justify-center rounded-xl border text-sm font-bold transition ${
                              availableClasses === count
                                ? "border-[#005BAA] bg-[#005BAA] text-white shadow-sm"
                                : "border-[#CCDCEF] bg-white text-[#44607A] hover:bg-[#F2F7FC]"
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>

                    {courses.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-[#44607A]">
                          Pilih Mata Kuliah FKIP yang Siap Diampu:
                        </label>
                        <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-[#D7E4F2] bg-[#F9FBFE] p-3 sm:grid-cols-2">
                          {courses.map((course) => {
                            const isChecked = selectedCourses.includes(course.code);
                            return (
                              <label
                                key={course.code}
                                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition ${
                                  isChecked
                                    ? "border-[#005BAA] bg-white font-semibold text-[#005BAA] shadow-sm"
                                    : "border-transparent bg-transparent text-[#44607A] hover:bg-white"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCourse(course.code)}
                                  className="mt-0.5 h-4 w-4 rounded border-[#CCDCEF] text-[#005BAA] focus:ring-[#005BAA]"
                                />
                                <div>
                                  <div className="font-mono text-[11px] font-bold text-[#005BAA]">
                                    {course.code} ({course.credits} SKS)
                                  </div>
                                  <div className="leading-snug text-[#102F52]">{course.title}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#44607A]">
                        Catatan Jadwal / Ketersediaan Tutorial (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Contoh: Bersedia di jadwal Sabtu pagi atau Minggu siang (Tuweb)."
                        className="mt-1.5 w-full rounded-xl border border-[#CCDCEF] bg-white px-3.5 py-2.5 text-sm text-[#102F52] focus:border-[#005BAA] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005BAA] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#004A8A] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Mengirimkan Pengajuan...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Kirim Formulir untuk Ditinjau & Disetujui
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-xs text-[#7B8B9E]">
                    Data akan masuk ke antrean verifikasi (approval) admin Program Studi sebelum aktif dalam plotting perkuliahan.
                  </p>
                </div>
              </form>
            </motion.div>
          ) : (
            /* Success State */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-[#D7E4F2] bg-white p-8 text-center shadow-[0_10px_35px_-10px_rgba(16,47,82,0.08)]"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0C2] text-[#71540F]">
                <svg className="h-8 w-8 text-[#B48200]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <span className="mt-4 inline-block rounded-full bg-[#FFF0C2] px-3.5 py-1 text-xs font-bold text-[#71540F]">
                🟡 Menunggu Review Admin
              </span>

              <h2 className="mt-2 text-2xl font-bold text-[#102F52]">
                Pengajuan Kesediaan Berhasil Dikirim!
              </h2>
              <p className="mt-2 text-sm text-[#44607A]">
                Terima kasih, <strong>{submittedData.name}</strong>. Formulir kesediaan mengajar Anda telah masuk ke sistem dan akan segera diverifikasi oleh tim pengelola Program Studi FKIP.
              </p>

              <div className="mx-auto mt-6 max-w-md rounded-xl border border-[#E3EDF8] bg-[#F7FAFD] p-5 text-left text-xs leading-relaxed text-[#44607A]">
                <div className="flex justify-between border-b border-[#E3EDF8] pb-2">
                  <span className="text-[#7B8B9E]">ID Tutor:</span>
                  <span className="font-mono font-bold text-[#005BAA]">{submittedData.id}</span>
                </div>
                <div className="flex justify-between border-b border-[#E3EDF8] py-2">
                  <span className="text-[#7B8B9E]">Email:</span>
                  <span className="font-medium text-[#102F52]">{submittedData.email}</span>
                </div>
                <div className="flex justify-between border-b border-[#E3EDF8] py-2">
                  <span className="text-[#7B8B9E]">Kesediaan Kelas:</span>
                  <span className="font-bold text-[#102F52]">{submittedData.available} Kelas</span>
                </div>
                <div className="py-2">
                  <span className="text-[#7B8B9E]">Kepakaran:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {submittedData.expertise.map((exp) => (
                      <span key={exp} className="rounded bg-[#E5EEF8] px-2 py-0.5 text-[11px] font-medium text-[#005BAA]">
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
                {submittedData.plotted.length > 0 && (
                  <div className="pt-2 border-t border-[#E3EDF8]">
                    <span className="text-[#7B8B9E]">Pilihan Mata Kuliah:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {submittedData.plotted.map((code) => (
                        <span key={code} className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="rounded-xl bg-[#005BAA] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#004A8A]"
                >
                  Buka Dashboard FKIP
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-[#CCDCEF] bg-white px-5 py-2.5 text-sm font-medium text-[#102F52] hover:bg-[#F2F7FC]"
                >
                  Daftarkan Tutor Lain
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
