import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/**
 * TermComparison Feature
 * Compares academic workloads, plotted counts, and lecturer mobility between two semesters
 */
export default function TermComparison({
  terms = [],
  termPlottings = [],
  lecturers = [],
  directoryLecturers = [],
  courses = [],
  selectedTermCode = "",
}) {
  // Master list of lecturers
  const allLecturers = directoryLecturers.length ? directoryLecturers : lecturers;

  // Ensure available terms
  const availableTerms = useMemo(() => {
    if (terms && terms.length) return terms;
    return [
      { code: "2025-2", name: "2025/2026 Ganjil (2025.2)", active: false },
      { code: "2026-1", name: "2025/2026 Genap (2026.1)", active: true },
    ];
  }, [terms]);

  // Default selection: Term A = previous (or index 1), Term B = active or latest
  const [termACode, setTermACode] = useState(() => {
    if (availableTerms.length >= 2) return availableTerms[1].code;
    return availableTerms[0]?.code || "";
  });

  const [termBCode, setTermBCode] = useState(() => {
    if (selectedTermCode && availableTerms.some((t) => t.code === selectedTermCode)) {
      return selectedTermCode;
    }
    return availableTerms[0]?.code || "";
  });

  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'new' | 'inactive' | 'changed' | 'same'
  const [searchQuery, setSearchQuery] = useState("");

  const termA = availableTerms.find((t) => t.code === termACode) || availableTerms[0];
  const termB = availableTerms.find((t) => t.code === termBCode) || availableTerms[1] || availableTerms[0];

  // Map courses for SKS lookups
  const courseMap = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => {
      map.set(c.code, c);
      map.set(c.id, c);
    });
    return map;
  }, [courses]);

  const getCourseSks = useCallback((courseCode) => {
    const found = courseMap.get(courseCode);
    return found?.sks ? Number(found.sks) : 3; // Default to 3 SKS if unspecified
  }, [courseMap]);

  // Helper to extract plotted records for a given term
  const getTermData = useCallback((termCode) => {
    const plottings = termPlottings.filter((tp) => tp.term_code === termCode);
    const lecturerMap = new Map();

    // Index existing plottings
    plottings.forEach((p) => {
      const plottedList = Array.isArray(p.plotted) ? p.plotted : [];
      lecturerMap.set(p.lecturer_id, {
        lecturer_id: p.lecturer_id,
        plotted: plottedList,
        available: Number(p.available || 0),
      });
    });

    // Merge with master lecturer names
    const activeList = [];
    let totalClasses = 0;
    let totalSks = 0;

    allLecturers.forEach((lec) => {
      const record = lecturerMap.get(lec.id);
      const plotted = record ? record.plotted : [];
      const available = record ? record.available : lec.available || 0;
      const sks = plotted.reduce((acc, code) => acc + getCourseSks(code), 0);

      const item = {
        ...lec,
        plotted,
        available,
        sks,
        isActive: plotted.length > 0,
      };

      if (plotted.length > 0) {
        activeList.push(item);
        totalClasses += plotted.length;
        totalSks += sks;
      }
    });

    return {
      activeList,
      totalLecturers: activeList.length,
      totalClasses,
      totalSks,
      avgClasses: activeList.length ? (totalClasses / activeList.length).toFixed(1) : "0",
      avgSks: activeList.length ? (totalSks / activeList.length).toFixed(1) : "0",
      lecturerMap,
    };
  }, [allLecturers, getCourseSks, termPlottings]);

  const dataA = useMemo(() => getTermData(termACode), [getTermData, termACode]);
  const dataB = useMemo(() => getTermData(termBCode), [getTermData, termBCode]);

  // Comparative calculations
  const comparisonResults = useMemo(() => {
    const activeMapA = new Map(dataA.activeList.map((l) => [l.id, l]));
    const activeMapB = new Map(dataB.activeList.map((l) => [l.id, l]));

    const allKeys = new Set([...activeMapA.keys(), ...activeMapB.keys()]);
    const comparisonRows = [];

    allKeys.forEach((id) => {
      const inA = activeMapA.get(id);
      const inB = activeMapB.get(id);
      const baseLecturer = allLecturers.find((l) => l.id === id) || inA || inB;

      let status = "same";
      let statusLabel = "Beban Tetap";
      let statusBadge = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

      const countA = inA ? inA.plotted.length : 0;
      const countB = inB ? inB.plotted.length : 0;
      const sksA = inA ? inA.sks : 0;
      const sksB = inB ? inB.sks : 0;
      const deltaClasses = countB - countA;
      const deltaSks = sksB - sksA;

      if (!inA && inB) {
        status = "new";
        statusLabel = "🟢 Baru Mengajar";
        statusBadge = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
      } else if (inA && !inB) {
        status = "inactive";
        statusLabel = "🔴 Tidak Aktif";
        statusBadge = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
      } else if (deltaClasses !== 0 || deltaSks !== 0) {
        status = "changed";
        statusLabel = deltaClasses > 0 ? "🟡 Beban Naik" : "🟠 Beban Turun";
        statusBadge = deltaClasses > 0
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300";
      }

      comparisonRows.push({
        id,
        name: baseLecturer?.name || `Dosen ${id}`,
        degree: baseLecturer?.degree || "",
        expertise: baseLecturer?.expertise || [],
        countA,
        countB,
        sksA,
        sksB,
        deltaClasses,
        deltaSks,
        status,
        statusLabel,
        statusBadge,
        plottedA: inA ? inA.plotted : [],
        plottedB: inB ? inB.plotted : [],
      });
    });

    // Sort by largest absolute delta first
    comparisonRows.sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1;
      if (b.status === "new" && a.status !== "new") return 1;
      return Math.abs(b.deltaClasses) - Math.abs(a.deltaClasses) || a.name.localeCompare(b.name);
    });

    const newCount = comparisonRows.filter((r) => r.status === "new").length;
    const inactiveCount = comparisonRows.filter((r) => r.status === "inactive").length;
    const changedCount = comparisonRows.filter((r) => r.status === "changed").length;
    const sameCount = comparisonRows.filter((r) => r.status === "same").length;

    return {
      rows: comparisonRows,
      newCount,
      inactiveCount,
      changedCount,
      sameCount,
    };
  }, [dataA, dataB, allLecturers]);

  // Filtered rows for the table
  const filteredRows = useMemo(() => {
    return comparisonResults.rows.filter((r) => {
      if (activeTab !== "all" && r.status !== activeTab) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesId = r.id.toLowerCase().includes(query);
        const matchesExp = r.expertise.some((e) => e.toLowerCase().includes(query));
        return matchesName || matchesId || matchesExp;
      }
      return true;
    });
  }, [comparisonResults.rows, activeTab, searchQuery]);

  // Semester by semester trend chart
  const trendData = useMemo(() => {
    return availableTerms.map((t) => {
      const plottings = termPlottings.filter((tp) => tp.term_code === t.code);
      const activeIds = new Set();
      let totalClasses = 0;
      plottings.forEach((p) => {
        if (p.plotted && p.plotted.length > 0) {
          activeIds.add(p.lecturer_id);
          totalClasses += p.plotted.length;
        }
      });
      return {
        termCode: t.code,
        name: t.code,
        fullName: t.name,
        dosenAktif: activeIds.size,
        kelasTerplot: totalClasses,
      };
    });
  }, [availableTerms, termPlottings]);

  // Comparison Bar Chart data for side-by-side view
  const sideBySideChartData = useMemo(() => {
    return [
      {
        kategori: "Dosen Aktif",
        [termA.code]: dataA.totalLecturers,
        [termB.code]: dataB.totalLecturers,
      },
      {
        kategori: "Kelas Terplot",
        [termA.code]: dataA.totalClasses,
        [termB.code]: dataB.totalClasses,
      },
      {
        kategori: "Total SKS",
        [termA.code]: dataA.totalSks,
        [termB.code]: dataB.totalSks,
      },
      {
        kategori: "Rata-rata Beban (x10)",
        [termA.code]: Math.round(Number(dataA.avgClasses) * 10),
        [termB.code]: Math.round(Number(dataB.avgClasses) * 10),
      },
    ];
  }, [termA, termB, dataA, dataB]);

  // Swap terms
  const handleSwapTerms = () => {
    const temp = termACode;
    setTermACode(termBCode);
    setTermBCode(temp);
  };

  // Export comparison table to CSV
  const handleExportCSV = () => {
    const headers = [
      "ID Dosen",
      "Nama Dosen",
      "Gelar",
      `Kelas (${termA.code})`,
      `Kelas (${termB.code})`,
      "Selisih Kelas",
      `SKS (${termA.code})`,
      `SKS (${termB.code})`,
      "Selisih SKS",
      "Status Mobilitas",
    ];

    const rows = comparisonResults.rows.map((r) => [
      `"${r.id}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.degree || ""}"`,
      r.countA,
      r.countB,
      r.deltaClasses > 0 ? `+${r.deltaClasses}` : r.deltaClasses,
      r.sksA,
      r.sksB,
      r.deltaSks > 0 ? `+${r.deltaSks}` : r.deltaSks,
      `"${r.statusLabel}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Perbandingan_Semester_${termA.code}_vs_${termB.code}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Deltas
  const deltaLecturers = dataB.totalLecturers - dataA.totalLecturers;
  const deltaClasses = dataB.totalClasses - dataA.totalClasses;
  const deltaSks = dataB.totalSks - dataA.totalSks;
  const deltaAvg = (Number(dataB.avgClasses) - Number(dataA.avgClasses)).toFixed(1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-linear-to-r from-blue-900 via-[#005baa] to-cyan-700 p-6 text-white shadow-xl dark:border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
              Komparasi & Analitika Semester
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              Perbandingan Antar Semester
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-blue-100/90">
              Evaluasi dinamika alokasi mengajar, retensi dosen, dan pergeseran beban SKS antara dua periode akademik secara akurat.
            </p>
          </div>

          {/* Term Selector Controls */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-black/20 p-2.5 backdrop-blur-md border border-white/10">
            {/* Term A */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                Semester Acuan (A)
              </span>
              <select
                value={termACode}
                onChange={(e) => setTermACode(e.target.value)}
                className="mt-1 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-cyan-400 dark:bg-slate-900 dark:text-white"
              >
                {availableTerms.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              type="button"
              onClick={handleSwapTerms}
              title="Tukar Posisi Semester"
              className="mt-4 self-center rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition-transform active:scale-95 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            {/* Term B */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                Semester Pembanding (B)
              </span>
              <select
                value={termBCode}
                onChange={(e) => setTermBCode(e.target.value)}
                className="mt-1 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-xs focus:ring-2 focus:ring-cyan-400 dark:bg-slate-900 dark:text-white"
              >
                {availableTerms.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Delta Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Dosen Aktif */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dosen Aktif Mengajar
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                deltaLecturers > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : deltaLecturers < 0
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {deltaLecturers > 0 ? `+${deltaLecturers}` : deltaLecturers} Dosen
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-black text-[#102f52] dark:text-slate-100">
              {dataB.totalLecturers}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              vs {dataA.totalLecturers} di ({termA.code})
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-[#005baa] transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((dataB.totalLecturers / Math.max(1, allLecturers.length)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {comparisonResults.newCount} dosen baru, {comparisonResults.inactiveCount} rehat semester ini
          </p>
        </div>

        {/* Card 2: Total Kelas Terplot */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Kelas Terplot
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                deltaClasses > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : deltaClasses < 0
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {deltaClasses > 0 ? `+${deltaClasses}` : deltaClasses} Kelas
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-black text-[#102f52] dark:text-slate-100">
              {dataB.totalClasses}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              vs {dataA.totalClasses} di ({termA.code})
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-cyan-600 transition-all duration-500"
              style={{
                width: `${Math.min(100, (dataB.totalClasses / Math.max(1, dataA.totalClasses, dataB.totalClasses)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {deltaClasses >= 0 ? "Peningkatan kapasitas plotting" : "Penurunan alokasi rombel"}
          </p>
        </div>

        {/* Card 3: Total SKS Terplot */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Beban SKS
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                deltaSks > 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : deltaSks < 0
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {deltaSks > 0 ? `+${deltaSks}` : deltaSks} SKS
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-black text-[#102f52] dark:text-slate-100">
              {dataB.totalSks}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              vs {dataA.totalSks} SKS ({termA.code})
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{
                width: `${Math.min(100, (dataB.totalSks / Math.max(1, dataA.totalSks, dataB.totalSks)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Rata-rata {dataB.avgSks} SKS per dosen aktif
          </p>
        </div>

        {/* Card 4: Rata-rata Beban Mengajar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rata-rata Kelas / Dosen
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
                Number(deltaAvg) > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : Number(deltaAvg) < 0
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {Number(deltaAvg) > 0 ? `+${deltaAvg}` : deltaAvg}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-black text-[#102f52] dark:text-slate-100">
              {dataB.avgClasses}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              vs {dataA.avgClasses} kelas ({termA.code})
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, (Number(dataB.avgClasses) / 4) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Batas wajar: 1–4 kelas tutorial per semester
          </p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Perbandingan Langsung Matriks A vs B */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#102f52] dark:text-slate-100">
                Komparasi Langsung Matriks
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Perbandingan kuantitatif ({termA.code} vs {termB.code})
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#005baa] dark:text-cyan-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#005baa]" />
                {termA.code}
              </span>
              <span className="inline-flex items-center gap-1.5 text-cyan-600 dark:text-cyan-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
                {termB.code}
              </span>
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sideBySideChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="kategori" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey={termA.code} fill="#005baa" radius={[4, 4, 0, 0]} />
                <Bar dataKey={termB.code} fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Tren Multisemester */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#102f52] dark:text-slate-100">
                Tren Historis Antar Semester
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pertumbuhan jumlah dosen aktif dan total kelas terplot
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                Dosen Aktif
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Kelas Terplot
              </span>
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="dosenAktif"
                  name="Dosen Aktif"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#4f46e5" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="kelasTerplot"
                  name="Kelas Terplot"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparison Detail Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Table Header & Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-[#102f52] dark:text-slate-100">
              Rincian Perubahan Dosen & Beban Mengajar
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar mobilitas dosen antara semester {termA.code} dan {termB.code}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama / ID / keahlian..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#005baa] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <svg className="h-4 w-4 text-[#005baa] dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Mobility Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-4 border-b border-slate-100 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-[#005baa] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            Semua Perubahan ({comparisonResults.rows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "new"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            🟢 Dosen Baru ({comparisonResults.newCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inactive")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "inactive"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            🔴 Tidak Aktif ({comparisonResults.inactiveCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("changed")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "changed"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            🟡 Beban Berubah ({comparisonResults.changedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("same")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "same"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            ⚪ Beban Tetap ({comparisonResults.sameCount})
          </button>
        </div>

        {/* Table Content */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Dosen</th>
                <th className="px-4 py-3 text-center">Kelas ({termA.code})</th>
                <th className="px-4 py-3 text-center">Kelas ({termB.code})</th>
                <th className="px-4 py-3 text-center">Selisih Kelas</th>
                <th className="px-4 py-3 text-center">Beban SKS</th>
                <th className="px-4 py-3">Status Mobilitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada dosen yang cocok dengan filter atau pencarian.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#102f52] dark:text-slate-100">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.degree} · ID {r.id}
                      </div>
                      {r.expertise && r.expertise.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.expertise.slice(0, 2).map((exp) => (
                            <span
                              key={exp}
                              className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            >
                              {exp}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {r.countA}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-[#102f52] dark:text-slate-100">
                      {r.countB}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          r.deltaClasses > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : r.deltaClasses < 0
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {r.deltaClasses > 0 ? `+${r.deltaClasses}` : r.deltaClasses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {r.sksA} → <strong className="text-[#005baa] dark:text-cyan-400">{r.sksB} SKS</strong>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.statusBadge}`}>
                        {r.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
