import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

export function createAuthScreens(deps) {
  const {
    DEMO_ACCOUNT,
    Icons,
    RatingStars,
    TUTOR_DATA_FORM_URL,
    USE_SUPABASE,
    courseTitleByCode,
    findLecturerById,
    getPlottedCourseCounts,
    getTermScopedLecturers,
    signIn,
  } = deps;

  const CHIP_TONES = [
    { bg: "#e3edfb", text: "#1d4e89", border: "#cadcf4" }, // blue
    { bg: "#fbeccb", text: "#86610f", border: "#f0dca6" }, // gold
    { bg: "#d9f0e3", text: "#1f6b4c", border: "#bfe5d0" }, // green
    { bg: "#ece7fb", text: "#4a3da0", border: "#dad2f3" }, // indigo
    { bg: "#fce0e7", text: "#9f3454", border: "#f6cbd6" }, // rose
    { bg: "#d6eef5", text: "#1a6982", border: "#bfe2ec" }, // cyan
    { bg: "#fbe5d6", text: "#9a4a1f", border: "#f3d2bd" }, // terracotta
  ];
  const EXPERTISE_TONE_INDEX = {
    "english linguistics": 0,
    "english language teaching": 2,
    "translation studies": 1,
    "indonesian linguistics": 5,
    "literary studies": 4,
    philosophy: 3,
  };
  function chipTone(label) {
    const key = String(label || "")
      .trim()
      .toLowerCase();
    if (key in EXPERTISE_TONE_INDEX)
      return CHIP_TONES[EXPERTISE_TONE_INDEX[key]];
    let hash = 0;
    for (let i = 0; i < key.length; i += 1)
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return CHIP_TONES[hash % CHIP_TONES.length];
  }

  function LandingScreen({
    sampleLecturers,
    lecturers = [],
    courses = [],
    terms = [],
    termPlottings = [],
    selectedTermCode = "",
    realtimeStats,
    onPublicMode,
    onLoginMode,
    onOpenTutorForm,
    promptInstall,
    isInstalled,
    isOnline = true,
  }) {
    const ease = [0.22, 1, 0.36, 1];

    const previewLecturer =
      (sampleLecturers && sampleLecturers[0]) ||
      (lecturers && lecturers[0]) || {
        id: "FKIP001",
        name: "Alya Prameswari",
        degree: "Ph.D. · Pendidikan Bahasa Inggris",
        available: 4,
        plotted: ["PDGK4105", "IDIK4008"],
        expertise: ["English Linguistics", "Language Teaching"],
      };

    const initials = previewLecturer?.name
      ? previewLecturer.name
          .replace(/^(Dr\.|Prof\.|Drs\.|Ir\.|H\.|Hj\.)\s+/i, "")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase() || "AP"
      : "AP";

    const plottedCount = Array.isArray(previewLecturer.plotted)
      ? previewLecturer.plotted.length
      : 2;
    const availableSlots = Number(previewLecturer.available ?? 4);

    const activeTerm = terms.find((term) => term.active) || terms[0] || null;
    const statTotalDosen = realtimeStats?.totalDosen ?? (lecturers.length || 12);
    const statTotalCourses = realtimeStats?.totalCourses ?? (courses.length || 10);
    const statActiveTerm = realtimeStats?.activeTerm ?? activeTerm;
    const statTotalSlots = realtimeStats?.totalSlots ?? 20;

    return (
      <div className="min-h-screen bg-mesh-pattern bg-[#f8fbff] px-5 text-[#0f1e36] sm:px-8 lg:px-10">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="sticky top-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-md shadow-2xs sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Universitas Terbuka logo"
                className="h-10 w-10 rounded-[11px] object-contain drop-shadow-xs"
              />
              <div className="leading-tight">
                <p className="font-display text-lg font-bold tracking-tight text-[#102f52]">
                  Universitas Terbuka
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6678]">
                  Program Studi FKIP
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-2">
              {statActiveTerm && (
                <div className="hidden items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs md:inline-flex">
                  <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span>{statActiveTerm.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onPublicMode?.()}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#102f52] cursor-pointer"
              >
                Cari Tutor
              </button>
              <button
                type="button"
                onClick={onLoginMode}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#005baa] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#004887] cursor-pointer"
              >
                <Icons.dashboard className="h-4 w-4" />
                Masuk
              </button>
            </nav>
          </motion.header>

          {/* Main Hero (2 Columns Side-by-Side) */}
          <main className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-8">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-[#005baa] shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f4b000]" />
                Portal Dosen & Tutor · Program Studi FKIP
              </span>
              <h1 className="mt-5 font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-[#102f52] sm:mt-6 sm:text-5xl sm:leading-[1.05] lg:text-6xl">
                Tutor dan kegiatan perkuliahan Program Studi FKIP.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-7 text-slate-600 sm:mt-6 sm:text-base">
                Akses profil kepakaran dosen, pantau jadwal dan kuota tutorial semester aktif, serta kelola plotting akademik dari satu dashboard terpadu.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-9">
                <button
                  type="button"
                  onClick={() => onPublicMode?.()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#004984] sm:w-auto sm:py-3 cursor-pointer"
                >
                  <Icons.search className="h-4 w-4" />
                  Cari Tutor
                </button>
                <button
                  type="button"
                  onClick={onLoginMode}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 sm:w-auto sm:py-3 cursor-pointer"
                >
                  <Icons.dashboard className="h-4 w-4 text-[#005baa]" />
                  Masuk Dashboard
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenTutorForm}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#005baa] underline-offset-4 transition hover:text-[#003e7a] hover:underline sm:mt-6 cursor-pointer"
              >
                <Icons.file className="h-4 w-4" />
                Tutor baru? Isi formulir kesediaan mengajar →
              </button>
            </motion.section>

            {/* Right Column: Sample Tutor Profile Card */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className="relative"
            >
              <div className="rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-[0_1px_2px_rgba(20,20,19,0.04),0_18px_40px_-20px_rgba(20,20,19,0.12)]">
                <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-[#f8fbff] to-[#f0f6fc] p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#005baa]">
                      Contoh Profil Tutor
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {availableSlots > 0 ? `${availableSlots} Slot Tersedia` : "Tersedia"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-[#005baa] shadow-xs">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold text-[#102f52] truncate">
                        {previewLecturer.name}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {previewLecturer.degree || "Dosen Pengampu"}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between border-t border-slate-200/70 pt-3">
                      <dt className="text-slate-500">ID Tutor</dt>
                      <dd className="font-mono font-bold text-slate-700">{previewLecturer.id || "FKIP001"}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Mata kuliah terplot</dt>
                      <dd className="font-semibold text-slate-800">{plottedCount} Kelas</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Slot tersedia</dt>
                      <dd className="font-semibold text-emerald-600">{availableSlots} dari 4</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(previewLecturer.expertise || ["English Linguistics", "Language Teaching"]).slice(0, 3).map((exp) => (
                      <span
                        key={exp}
                        className="rounded-md border border-blue-100 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onPublicMode?.(previewLecturer.id)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005baa] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-[#004887] cursor-pointer"
                  >
                    <Icons.search className="h-4 w-4" />
                    Lihat Profil Lengkap
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                Contoh tampilan hasil pencarian profil publik
              </p>
            </motion.section>
          </main>

          {/* Live Stat Badges Strip (Pelengkap Bagian Bawah) */}
          <section className="mb-10 pt-8 border-t border-slate-200/80">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {/* Total Dosen */}
              <motion.div
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-blue-200 hover:shadow-xs group"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-[#0070d2]" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6a829a] leading-tight">
                    TOTAL<br />DOSEN
                  </p>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f1fa] text-[#005baa] shadow-2xs group-hover:bg-[#005baa] group-hover:text-white transition-colors duration-200">
                    <Icons.graduation className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#0f2a4a]">
                  {statTotalDosen}+
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#005baa]/60" />
                  Tutor Terdaftar
                </p>
              </motion.div>

              {/* Mata Kuliah */}
              <motion.div
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-blue-200 hover:shadow-xs group"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-[#6366f1]" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6a829a] leading-tight">
                    MATA KULIAH
                  </p>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef4ff] text-blue-600 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                    <Icons.file className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#0f2a4a]">
                  {statTotalCourses}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                  Mata Kuliah FKIP
                </p>
              </motion.div>

              {/* Semester */}
              <motion.div
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-blue-200 hover:shadow-xs group"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-[#f97316]" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6a829a] leading-tight">
                    SEMESTER
                  </p>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef7e6] text-amber-700 shadow-2xs group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200">
                    <Icons.calendar className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 font-display text-lg font-extrabold tracking-tight text-[#0f2a4a] truncate">
                  {statActiveTerm ? statActiveTerm.ay : "2026/2027"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {statActiveTerm?.semester?.replace("Semester ", "") || "Ganjil"}
                </p>
              </motion.div>

              {/* Kapasitas Slot */}
              <motion.div
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-emerald-300 hover:shadow-xs group"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-[#10b981]" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#065f46] leading-tight">
                    KAPASITAS<br />SLOT
                  </p>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ecfdf5] text-emerald-700 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
                    <Icons.check className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <p className="font-display text-2xl font-extrabold tracking-tight text-emerald-600">
                    {statTotalSlots}
                  </p>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Slot Terbuka · Live
                </p>
              </motion.div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
            © 2026 Universitas Terbuka — Program Studi FKIP
            <span className="mx-1">·</span>
            Dikembangkan oleh{" "}
            <span className="font-semibold text-slate-700">
              Muhammad Yahya Fadillah
            </span>
          </footer>
        </div>
      </div>
    );
  }

  function PublicLookupScreen({
    lecturers,
    courses,
    terms,
    termPlottings,
    selectedTermCode,
    setSelectedTermCode,
    dbStatus,
    isHydrated,
    initialId = "",
    onBack,
    onLogin,
    onRefresh,
  }) {
    const [idInput, setIdInput] = useState(initialId);
    const [submittedId, setSubmittedId] = useState(initialId);

    useEffect(() => {
      if (initialId) {
        setIdInput(initialId);
        setSubmittedId(initialId);
      }
    }, [initialId]);
    const activeTermCode = terms.find((term) => term.active)?.code || "";
    const effectiveTermCode = terms.some(
      (term) => term.code === selectedTermCode,
    )
      ? selectedTermCode
      : activeTermCode || terms[0]?.code || "";
    const validTermPlottings = useMemo(() => {
      const lecturerIds = new Set(lecturers.map((lecturer) => lecturer.id));
      return termPlottings.filter((row) => lecturerIds.has(row.lecturer_id));
    }, [lecturers, termPlottings]);
    const termScopedLecturers = useMemo(
      () =>
        getTermScopedLecturers(
          lecturers,
          validTermPlottings,
          effectiveTermCode,
        ),
      [lecturers, validTermPlottings, effectiveTermCode],
    );
    const lecturer = findLecturerById(termScopedLecturers, submittedId);
    const submitted = Boolean(submittedId.trim());
    const publicDirectoryEmpty =
      USE_SUPABASE && isHydrated && lecturers.length === 0;
    const termSelectValue = terms.some(
      (term) => term.code === effectiveTermCode,
    )
      ? effectiveTermCode
      : "";
    const submit = (event) => {
      event.preventDefault();
      setSubmittedId(idInput);
    };
    const refreshPublicDirectory = async () => {
      setIdInput("");
      setSubmittedId("");
      await onRefresh?.();
    };

    return (
      <div className="min-h-screen bg-mesh-pattern bg-[#f8fbff] px-5 text-[#0f1e36] sm:px-8 lg:px-10">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-20 -mx-5 flex flex-col items-center gap-3 border-b border-slate-200/80 bg-white/95 px-5 py-3.5 backdrop-blur-md shadow-2xs sm:-mx-8 sm:flex-row sm:justify-between sm:gap-4 sm:px-8 sm:py-4 lg:-mx-10 lg:px-10"
          >
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <img
                src="/logo.png"
                alt="Universitas Terbuka logo"
                className="h-10 w-10 rounded-[11px] object-contain"
              />
              <div className="leading-tight">
                <p className="font-display text-lg font-bold tracking-tight text-[#102f52]">
                  Universitas Terbuka
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6678]">
                  Program Studi FKIP
                </p>
              </div>
            </button>
            <nav className="flex flex-wrap items-center justify-center gap-1.5">
              <span
                title={dbStatus}
                role="status"
                className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex ${isHydrated ? "border-[#CBE0CF] bg-[#EAF3EC] text-[#3F8A5E]" : "border-[#E8DDC0] bg-[#F6EFD9] text-[#8A6D2F]"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isHydrated ? "bg-[#3F8A5E]" : "bg-[#C79A3A]"}`}
                />
                {isHydrated ? "Terhubung" : "Menghubungkan"}
              </span>
              <button
                type="button"
                onClick={refreshPublicDirectory}
                disabled={!USE_SUPABASE}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#0f1e36] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Muat Ulang
              </button>
              <button
                type="button"
                onClick={onLogin}
                className="rounded-lg bg-[#005baa] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#004887] sm:px-4 cursor-pointer"
              >
                Masuk
              </button>
            </nav>
          </motion.header>

          <main className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-10">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d7e6f7] bg-white px-3 py-1 text-xs font-medium text-[#6f8aa3]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f4b000]" />
                Profil Dosen & Tutor
              </span>
              <h1 className="mt-5 font-display text-[1.9rem] font-bold leading-[1.08] tracking-[-0.02em] text-[#102f52] sm:mt-6 sm:text-4xl">
                Cari tutor berdasarkan ID.
              </h1>
              <p className="mt-3 max-w-sm text-[15px] leading-7 text-[#44607a] sm:mt-4 sm:text-base">
                Masukkan ID tutor untuk melihat profil publik, bidang keahlian, dan
                ketersediaan mengajar saat ini.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4 sm:mt-8">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#6f8aa3]">
                    ID Tutor
                  </span>
                  <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#ccdcef] bg-white px-3.5 transition focus-within:border-[#005baa]">
                    <Icons.search className="h-4 w-4 text-[#93a7bc]" />
                    <input
                      value={idInput}
                      onChange={(event) => setIdInput(event.target.value)}
                      placeholder="Contoh: D001"
                      className="w-full bg-transparent text-sm text-[#102f52] outline-none placeholder:text-[#9db1c6]"
                    />
                  </div>
                </label>
                {terms.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#6f8aa3]">
                      Semester
                    </span>
                    <div className="relative">
                      <select
                        value={termSelectValue}
                        onChange={(event) =>
                          setSelectedTermCode(event.target.value)
                        }
                        className="w-full appearance-none rounded-xl border border-[#ccdcef] bg-white px-3.5 py-2.5 pr-9 text-sm text-[#102f52] outline-none transition focus:border-[#005baa]"
                      >
                        {terms.map((term) => (
                          <option key={term.code} value={term.code}>
                            {term.name}
                          </option>
                        ))}
                      </select>
                      <Icons.chevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#93a7bc]" />
                    </div>
                  </label>
                )}
                <button
                  type="submit"
                  disabled={!idInput.trim() || !isHydrated}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#004984] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lihat Profil
                </button>
              </form>
              {isHydrated && !publicDirectoryEmpty && (
                <p className="mt-4 text-sm text-[#6f8aa3]">
                  {termScopedLecturers.length} profil publik{" "}
                  dimuat{effectiveTermCode ? " untuk semester terpilih" : ""}.
                </p>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {!USE_SUPABASE && (
                <PublicNotice title="Supabase belum terkonfigurasi" tone="error">
                  Atur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY untuk mengaktifkan
                  pencarian profil publik.
                </PublicNotice>
              )}
              {USE_SUPABASE && !isHydrated && (
                <PublicNotice title={dbStatus} tone="warn">
                  Pencarian profil akan tersedia setelah direktori publik selesai dimuat.
                </PublicNotice>
              )}
              {USE_SUPABASE &&
                isHydrated &&
                !submitted &&
                !publicDirectoryEmpty && (
                  <PublicNotice title="Siap Digunakan">
                    Masukkan ID tutor untuk melihat profil yang sesuai.
                  </PublicNotice>
                )}
              {publicDirectoryEmpty && (
                <PublicNotice title="Belum ada profil publik" tone="warn">
                  Koneksi ke Supabase berhasil, tetapi view public_lecturer_profiles tidak mengembalikan data.
                </PublicNotice>
              )}
              {USE_SUPABASE &&
                isHydrated &&
                submitted &&
                !lecturer &&
                !publicDirectoryEmpty && (
                  <PublicNotice title="Profil tidak ditemukan" tone="error">
                    Tidak ada profil tutor yang cocok dengan ID tersebut. Periksa kembali ID tutor dan coba lagi.
                  </PublicNotice>
                )}
              {USE_SUPABASE && isHydrated && lecturer && (
                <PublicProfileCard lecturer={lecturer} courses={courses} />
              )}
            </motion.section>
          </main>

          <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
            © 2026 Universitas Terbuka — Program Studi FKIP
            <span className="mx-1">·</span>
            Dikembangkan oleh{" "}
            <span className="font-semibold text-slate-700">
              Muhammad Yahya Fadillah
            </span>
          </footer>
        </div>
      </div>
    );
  }

  function PublicNotice({ title, children, tone = "muted" }) {
    const dot =
      { muted: "#93a7bc", warn: "#C79A3A", error: "#B0492E" }[tone] ||
      "#93a7bc";
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dot }}
          />
          <p className="font-semibold text-[#102f52]">{title}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
      </div>
    );
  }

  function PublicProfileCard({ lecturer, courses }) {
    const available = Number(lecturer.available ?? 0);
    const availColor = available > 0 ? "#3F8A5E" : "#B0492E";
    const initials =
      lecturer.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "—";
    const hasContact = Boolean(lecturer.email || lecturer.phone);
    const warning = String(lecturer.warning_note || "").trim();
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xs">
        <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-[#f8fbff] to-[#f0f6fc] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#005baa]">
              Profil Tutor FKIP
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: availColor }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: availColor }}
              />
              {available} slot tersedia
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-[#005baa]">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold text-[#102f52]">
                {lecturer.name}
              </p>
              <p className="text-sm text-[#6f8aa3]">
                {lecturer.degree} · ID{" "}
                <span className="font-mono">{lecturer.id}</span>
              </p>
            </div>
          </div>
          {(lecturer.rating > 0 || warning) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {lecturer.rating > 0 && <RatingStars rating={lecturer.rating} />}
              {warning && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E7C9A3] bg-[#FBF1E3] px-2.5 py-1 text-xs font-medium text-[#9A6A2B]"
                  title={warning}
                >
                  <Icons.warning className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[14rem] truncate">{warning}</span>
                </span>
              )}
            </div>
          )}
          {hasContact && (
            <dl className="mt-5 space-y-3 border-t border-[#e3edf8] pt-4 text-sm">
              {lecturer.email && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#6f8aa3]">Email</dt>
                  <dd className="truncate text-[#2f4a63]">{lecturer.email}</dd>
                </div>
              )}
              {lecturer.phone && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#6f8aa3]">No. Telepon / WA</dt>
                  <dd className="text-[#2f4a63]">{lecturer.phone}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-5 border-t border-[#e3edf8] pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#93a7bc]">
              Bidang Keahlian
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {lecturer.expertise.length ? (
                lecturer.expertise.map((item) => {
                  const tone = chipTone(item);
                  return (
                    <span
                      key={item}
                      style={{
                        backgroundColor: tone.bg,
                        color: tone.text,
                        borderColor: tone.border,
                      }}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium"
                    >
                      {item}
                    </span>
                  );
                })
              ) : (
                <span className="text-sm text-[#93a7bc]">
                  Belum ada keahlian tercatat
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-[#e3edf8] pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#93a7bc]">
              Mata Kuliah Terplot
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {lecturer.plotted.length ? (
                getPlottedCourseCounts(lecturer.plotted).map(
                  ({ code, count }, index) => {
                    const tone = CHIP_TONES[index % CHIP_TONES.length];
                    return (
                      <span
                        key={code}
                        style={{
                          backgroundColor: tone.bg,
                          color: tone.text,
                          borderColor: tone.border,
                        }}
                        className="rounded-md border px-2.5 py-1 text-xs font-medium"
                      >
                        {courseTitleByCode(courses, code)}
                        {count > 1 ? ` ×${count}` : ""}
                      </span>
                    );
                  },
                )
              ) : (
                <span className="text-sm text-[#93a7bc]">
                  Belum ada mata kuliah terplot
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

const SAVED_CREDENTIALS_STORAGE_KEY = "ut_saved_login_credentials_v1";

function getStoredSavedCredentials() {
  if (typeof localStorage === "undefined") {
    return { email: "", password: "", remember: true };
  }
  try {
    const raw = localStorage.getItem(SAVED_CREDENTIALS_STORAGE_KEY);
    if (!raw) return { email: "", password: "", remember: true };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed?.email === "string" ? parsed.email : "",
      password: typeof parsed?.password === "string" ? parsed.password : "",
      remember: parsed?.remember !== false,
    };
  } catch {
    return { email: "", password: "", remember: true };
  }
}

function persistSavedCredentials(email, password, remember = true) {
  if (typeof localStorage === "undefined") return;
  try {
    if (remember && (email || password)) {
      localStorage.setItem(
        SAVED_CREDENTIALS_STORAGE_KEY,
        JSON.stringify({
          email: String(email || "").trim(),
          password: String(password || ""),
          remember: true,
          savedAt: new Date().toISOString(),
        }),
      );
    }
  } catch (err) {
    console.warn("Unable to save credentials:", err);
  }
}

function clearStoredSavedCredentials() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SAVED_CREDENTIALS_STORAGE_KEY);
  } catch (err) {
    console.warn("Unable to clear credentials:", err);
  }
}

  function LoginScreen({
    onLogin,
    onBack,
    onDemoLogin,
    isInstallable,
    promptInstall,
    isInstalled,
    isOnline = true,
  }) {
    const saved = useMemo(() => getStoredSavedCredentials(), []);
    const [email, setEmail] = useState(() => saved.email);
    const [password, setPassword] = useState(() => saved.password);
    const [remember, setRemember] = useState(() => saved.remember);
    const [showPassword, setShowPassword] = useState(false);
    const [hasSavedCreds, setHasSavedCreds] = useState(() =>
      Boolean(saved.email && saved.password),
    );
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const isDemoCredentials =
      (email.trim().toLowerCase() === DEMO_ACCOUNT.email ||
        email.trim().toLowerCase() === "demo@fkip.ut.ac.id") &&
      password === DEMO_ACCOUNT.password;

    const handleEmailChange = (val) => {
      setEmail(val);
      if (remember) {
        persistSavedCredentials(val, password, true);
        setHasSavedCreds(Boolean(val.trim() && password));
      }
    };

    const handlePasswordChange = (val) => {
      setPassword(val);
      if (remember) {
        persistSavedCredentials(email, val, true);
        setHasSavedCreds(Boolean(email.trim() && val));
      }
    };

    const handleRememberChange = (checked) => {
      setRemember(checked);
      if (checked) {
        persistSavedCredentials(email, password, true);
        setHasSavedCreds(Boolean(email.trim() && password));
      } else {
        clearStoredSavedCredentials();
        setHasSavedCreds(false);
      }
    };

    const handleClearSaved = () => {
      clearStoredSavedCredentials();
      setEmail("");
      setPassword("");
      setHasSavedCreds(false);
    };

    const submit = async () => {
      setError("");
      if (remember) {
        persistSavedCredentials(email, password, true);
        setHasSavedCreds(true);
      } else {
        clearStoredSavedCredentials();
        setHasSavedCreds(false);
      }

      if (isDemoCredentials) {
        onDemoLogin();
        return;
      }
      setBusy(true);
      try {
        const loggedInEmail = await signIn(email, password);
        onLogin(loggedInEmail);
      } catch (err) {
        setError(err.message || "Authentication failed.");
      } finally {
        setBusy(false);
      }
    };

    const useDemoAccount = () => {
      setEmail(DEMO_ACCOUNT.email);
      setPassword(DEMO_ACCOUNT.password);
      setError("");
      if (remember) {
        persistSavedCredentials(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password, true);
        setHasSavedCreds(true);
      }
      onDemoLogin();
    };

    return (
      <div className="min-h-screen bg-mesh-pattern bg-[#f8fbff] px-5 text-[#0f1e36] sm:px-8 lg:px-10">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-md shadow-2xs sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
          >
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <img
                src="/logo.png"
                alt="Universitas Terbuka logo"
                className="h-10 w-10 rounded-[11px] object-contain"
              />
              <div className="leading-tight">
                <p className="font-display text-lg font-bold tracking-tight text-[#102f52]">
                  Universitas Terbuka
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6678]">
                  Program Studi FKIP
                </p>
              </div>
            </button>
            <nav className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#0f1e36] cursor-pointer"
              >
                Cari Tutor
              </button>
              <span className="hidden rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#005baa] sm:inline-block">
                Masuk
              </span>
            </nav>
          </motion.header>

          <main className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16 lg:py-10">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-[#005baa]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f4b000]" />
                Akses Administrator
              </span>
              <h1 className="mt-5 font-display text-[1.95rem] font-bold leading-[1.08] tracking-[-0.02em] text-[#102f52] sm:mt-6 sm:text-5xl sm:leading-[1.06]">
                Kelola Program Studi dalam Satu Tempat.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-7 text-slate-600 sm:mt-6 sm:text-base">
                Masuk untuk mengelola dosen, mata kuliah, plotting semester, dan
                ketersediaan mengajar di lingkungan Program Studi FKIP.
              </p>
              <ul className="mt-7 hidden space-y-3 text-sm text-slate-600 sm:mt-8 sm:block">
                {[
                  "Direktori dosen, bidang keahlian & penilaian kinerja",
                  "Plotting mata kuliah berdasarkan semester akademik",
                  "Ringkasan beban mengajar & ketersediaan kelas",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5effa] text-[#005baa]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(20,20,19,0.04),0_18px_40px_-20px_rgba(20,20,19,0.12)] sm:p-8 lg:ml-auto lg:max-w-md"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#005baa]">
                Akses Terbatas
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.01em] text-[#102f52]">
                Masuk
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#44607a]">
                {USE_SUPABASE
                  ? "Selamat datang kembali. Silakan masuk untuk mengelola program studi."
                  : "Supabase belum terkonfigurasi. Hubungi administrator untuk mengatur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY."}
              </p>

              {!isOnline && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200/90 p-3 text-xs font-semibold text-amber-900">
                  <Icons.cloudOff className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Mode Offline aktif. Gunakan akun demo untuk mengelola data secara lokal tanpa koneksi internet.</span>
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    !busy &&
                    email &&
                    password &&
                    (USE_SUPABASE || isDemoCredentials)
                  )
                    submit();
                }}
                className="mt-6 space-y-4"
              >
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#6f8aa3]">
                    Email / Nama Pengguna
                  </span>
                  <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#ccdcef] bg-white px-3.5 transition focus-within:border-[#005baa]">
                    <Icons.users className="h-4 w-4 text-[#93a7bc]" />
                    <input
                      id="login-email"
                      name="email"
                      value={email}
                      onChange={(event) => handleEmailChange(event.target.value)}
                      type="email"
                      autoComplete="username email"
                      placeholder="admin.fkip@ecampus.ut.ac.id"
                      className="w-full bg-transparent text-sm text-[#102f52] outline-none placeholder:text-[#9db1c6]"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#6f8aa3]">
                    Kata Sandi
                  </span>
                  <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#ccdcef] bg-white px-3.5 transition focus-within:border-[#005baa]">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-[#93a7bc]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="login-password"
                      name="password"
                      value={password}
                      onChange={(event) => handlePasswordChange(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Kata Sandi"
                      className="w-full bg-transparent text-sm text-[#102f52] outline-none placeholder:text-[#9db1c6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                      title={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                      className="rounded-lg p-1 text-[#93a7bc] transition hover:bg-[#eff5fc] hover:text-[#102f52] focus:outline-none"
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[#5b6678] hover:text-[#1f2a3d]">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => handleRememberChange(event.target.checked)}
                      className="h-4 w-4 rounded border-[#ccdcef] text-[#005baa] accent-[#005baa] focus:ring-[#005baa] cursor-pointer"
                    />
                    <span className="font-medium">Ingat saya (Simpan login otomatis)</span>
                  </label>
                  {hasSavedCreds && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c6e3d1] bg-[#dff3e6] px-2.5 py-0.5 text-[11px] font-medium text-[#255d3e]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2da462]" />
                        Autosave aktif
                      </span>
                      <button
                        type="button"
                        onClick={handleClearSaved}
                        className="text-[11px] text-[#8a93a3] underline-offset-2 transition hover:text-[#b0492e] hover:underline"
                        title="Hapus username dan password tersimpan"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-xl border border-[#E8C4B8] bg-[#F8EAE4] px-3 py-2.5 text-sm font-medium text-[#A8431F]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !email ||
                    !password ||
                    (!USE_SUPABASE && !isDemoCredentials)
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#004984] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Sedang masuk…" : "Masuk"}
                </button>
                <button
                  type="button"
                  onClick={useDemoAccount}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[#ccdcef] bg-white px-5 py-3 text-sm font-medium text-[#102f52] transition hover:bg-[#eaf2fb]"
                >
                  Gunakan akun demo
                </button>
              </form>
              <p className="mt-4 text-center text-xs leading-5 text-[#93a7bc]">
                Akun demo: {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
              </p>
            </motion.section>
          </main>

          <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
            © 2026 Universitas Terbuka — Program Studi FKIP
            <span className="mx-1">·</span>
            Dikembangkan oleh{" "}
            <span className="font-semibold text-slate-700">
              Muhammad Yahya Fadillah
            </span>
          </footer>
        </div>
      </div>
    );
  }

  return { LandingScreen, PublicLookupScreen, LoginScreen };
}
