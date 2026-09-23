import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildLecturerImportReview,
  readImportFile,
} from "../lib/importExport.js";

const DEGREE_COLORS = [
  "#005baa", // UT Primary Cobalt Blue
  "#0284c7", // Bright Sky Blue
  "#003e7a", // UT Deep Navy
  "#d97706", // Warm Amber Accent
  "#0d9488", // Academic Teal
  "#475569", // Slate Neutral
  "#2563eb", // Royal Blue
  "#b45309", // Deep Gold / Ochre
];

export function createDirectoryFeatures(deps) {
  const {
    Badge,
    Button,
    Card,
    DEFAULT_DEGREE_OPTIONS,
    DEFAULT_EXPERTISE_OPTIONS,
    DeleteConfirmation,
    ExpertiseSelect,
    FormGrid,
    Icons,
    ImportReviewModal,
    Modal,
    NativeFilterIconSelect,
    PlainInput,
    PlainSelect,
    PlainTextarea,
    PlottedCourseBadges,
    RatingStars,
    SelectBox,
    Stat,
    TextInput,
    USE_SUPABASE,
    WarningNotice,
    availabilityTone,
    buildTermPlottingRow,
    clampRating,
    courseTitleByCode,
    dashboardPalette,
    dedupeImportedLecturers,
    exportLecturerTemplateToXLSX,
    exportLecturersToXLSX,
    exportSuratTugasPDF,
    getPlottedCountData,
    includes,
    mapImportedLecturers,
    mergeImportedLecturer,
    normalizeTermPlotting,
    plottedCourseTitles,
    rowsToObjects,
    parseCSV,
    parseXLSX,
    serializeLecturersForDatabase,
    splitList,
    uniq,
    upsertRows,
  } = deps;

  function CustomYAxisTick({ x, y, payload }) {
    const text = String(payload?.value || "");
    const maxChars =
      typeof window !== "undefined" && window.innerWidth < 640 ? 18 : 28;
    const isTruncated = text.length > maxChars;
    const displayText = isTruncated ? `${text.slice(0, maxChars - 1)}…` : text;

    return (
      <g transform={`translate(${x},${y})`}>
        <title>{text}</title>
        <text
          x={-10}
          y={4}
          textAnchor="end"
          fill="#334155"
          fontSize={11}
          fontWeight={600}
          className="select-none"
        >
          {displayText}
        </text>
      </g>
    );
  }

  function CustomExpertiseTooltip({ active, payload, totalLecturers }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const count = data.value;
    const percent =
      totalLecturers > 0 ? Math.round((count / totalLecturers) * 100) : 0;
    const lecturerNames = data.lecturers || [];

    return (
      <div className="rounded-xl border border-slate-200/90 bg-white/98 p-3.5 shadow-xl backdrop-blur-md ring-1 ring-black/5 min-w-[230px] max-w-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005baa] text-xs font-bold">
            ★
          </span>
          <p className="text-xs font-bold text-slate-800 leading-snug">
            {data.name}
          </p>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Jumlah Dosen:</span>
            <span className="font-bold text-[#005baa] text-sm">
              {count} Dosen
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Porsi Direktori:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md text-[11px]">
              {percent}% dari total
            </span>
          </div>
          {lecturerNames.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">
                Dosen Terdaftar:
              </p>
              <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                {lecturerNames.slice(0, 5).join(", ")}
                {lecturerNames.length > 5 &&
                  ` +${lecturerNames.length - 5} lainnya`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function CustomLoadTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    const plotted = data.plotted ?? 0;
    const available = data.available ?? 0;
    const diff = available - plotted;

    return (
      <div className="rounded-xl border border-slate-200/90 bg-white/98 p-3.5 shadow-xl backdrop-blur-md ring-1 ring-black/5 min-w-[230px] max-w-xs">
        <div className="border-b border-slate-100 pb-2 mb-2">
          <p className="text-xs font-bold text-slate-900 leading-snug">
            {data.fullName}
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            ID: {data.id} {data.degree ? `• ${data.degree}` : ""}
          </p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#005baa]" />
              Kelas Terplot:
            </span>
            <span className="font-bold text-[#005baa] text-sm">
              {plotted} Kelas
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              Kapasitas Slot:
            </span>
            <span className="font-bold text-amber-600 text-sm">
              {available} Slot
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Status Alokasi:</span>
            {diff === 0 && available > 0 ? (
              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded text-[10px]">
                Optimal (Pas Kuota)
              </span>
            ) : diff > 0 ? (
              <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded text-[10px]">
                Sisa {diff} Slot
              </span>
            ) : available === 0 ? (
              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                Tanpa Kuota
              </span>
            ) : (
              <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded text-[10px]">
                Kelebihan {Math.abs(diff)} Kelas
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function CustomDonutTooltip({ active, payload, total }) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    const count = data.value;
    const percent =
      data.percent ?? (total > 0 ? Math.round((count / total) * 100) : 0);
    const lecturerNames = data.lecturers || [];

    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xl ring-1 ring-slate-900/10 min-w-[220px] max-w-[260px] z-50 select-none">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-3 w-3 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: data.color || payload[0]?.color }}
            />
            <span className="text-xs font-bold text-[#102f52] truncate">
              {data.name}
            </span>
            {data.sublabel && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded shrink-0">
                {data.sublabel}
              </span>
            )}
          </div>
          <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-100/80 px-2 py-0.5 text-[11px] font-bold text-[#005baa] shrink-0">
            {percent}%
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100/80 px-2.5 py-1.5 mb-2.5">
          <span className="text-[11px] font-medium text-slate-500">Jumlah Dosen</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-extrabold text-[#102f52]">{count}</span>
            <span className="text-[10px] font-medium text-slate-400">/ {total} dosen</span>
          </div>
        </div>

        {/* Lecturer List */}
        {lecturerNames.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                Contoh Dosen
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {lecturerNames.length > 3 ? `3 dari ${lecturerNames.length}` : `${lecturerNames.length} dosen`}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {lecturerNames.slice(0, 3).map((name, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-md bg-slate-50/80 border border-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  <span className="truncate">{name}</span>
                </div>
              ))}
              {lecturerNames.length > 3 && (
                <span className="text-[10px] text-center font-semibold text-[#005baa] bg-blue-50/70 border border-blue-100/60 py-0.5 rounded mt-0.5">
                  +{lecturerNames.length - 3} dosen lainnya
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function Dashboard({ lecturers, courses }) {
    const [filters, setFilters] = useState({
      degree: "All",
      expertise: "All",
      plotted: "All",
      available: "All",
    });
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [mobileFiltersVisible, setMobileFiltersVisible] = useState(true);
    const chartTooltipStyle = {
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
      fontWeight: 600,
      fontSize: "12px",
      color: "#102f52",
      backgroundColor: "rgba(255,255,255,0.96)",
    };
    const scrollTimerRef = useRef(null);
    const filtered = useMemo(
      () =>
        lecturers.filter(
          (lecturer) =>
            (filters.degree === "All" || lecturer.degree === filters.degree) &&
            (filters.expertise === "All" ||
              lecturer.expertise.includes(filters.expertise)) &&
            (filters.plotted === "All" ||
              lecturer.plotted.some(
                (code) => courseTitleByCode(courses, code) === filters.plotted,
              )) &&
            (filters.available === "All" ||
              String(lecturer.available) === filters.available),
        ),
      [lecturers, courses, filters],
    );

    // KPI Metrics calculation for academic monitoring
    const kpiData = useMemo(() => {
      // 1. Top 5 highest workload
      const topLoad = [...filtered]
        .sort((a, b) => b.plotted.length - a.plotted.length || (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);

      // 2. Top 5 highest ratings
      const topRated = [...filtered]
        .filter((l) => (l.rating || 0) > 0)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.plotted.length - a.plotted.length)
        .slice(0, 5);

      // 3. Overload alerts
      const overloads = filtered.filter(
        (l) => l.plotted.length > 4 || (l.available > 0 && l.plotted.length > l.available),
      );

      // 4. Expertise match calculation
      let totalPlotted = 0;
      let matchedCount = 0;
      filtered.forEach((lec) => {
        const exps = (lec.expertise || []).map((e) => String(e).toLowerCase());
        (lec.plotted || []).forEach((cCode) => {
          totalPlotted += 1;
          const cObj = courses.find((c) => c.code === cCode || c.id === cCode);
          if (cObj) {
            const title = (cObj.title || cObj.name || "").toLowerCase();
            const match = exps.some((exp) => {
              const tokens = exp.split(/\s+/).filter((t) => t.length > 2);
              return tokens.some((tok) => title.includes(tok));
            });
            if (match || exps.length === 0) matchedCount += 1;
          } else {
            matchedCount += 1;
          }
        });
      });

      const expertiseMatchPct = totalPlotted > 0 ? Math.round((matchedCount / totalPlotted) * 100) : 100;
      const averageRating = filtered.filter((l) => (l.rating || 0) > 0).length
        ? (
            filtered.reduce((sum, l) => sum + (l.rating || 0), 0) /
            filtered.filter((l) => (l.rating || 0) > 0).length
          ).toFixed(1)
        : "5.0";

      return {
        topLoad,
        topRated,
        overloads,
        expertiseMatchPct,
        averageRating,
      };
    }, [filtered, courses]);

    const [expertiseViewMode, setExpertiseViewMode] = useState("top10");

    const expertiseStats = useMemo(() => {
      const map = new Map();
      filtered.forEach((lecturer) => {
        (lecturer.expertise || []).forEach((exp) => {
          const trimmed = String(exp || "").trim();
          if (!trimmed) return;
          if (!map.has(trimmed)) {
            map.set(trimmed, { name: trimmed, value: 0, lecturers: [] });
          }
          const item = map.get(trimmed);
          item.value += 1;
          item.lecturers.push(lecturer.name);
        });
      });
      return Array.from(map.values()).sort(
        (a, b) => b.value - a.value || a.name.localeCompare(b.name),
      );
    }, [filtered]);

    const displayExpertiseData = useMemo(() => {
      if (expertiseViewMode === "top10" && expertiseStats.length > 10) {
        return expertiseStats.slice(0, 10);
      }
      return expertiseStats;
    }, [expertiseStats, expertiseViewMode]);

    const expertiseChartHeight = Math.max(
      320,
      displayExpertiseData.length * 36,
    );
    const yAxisWidth =
      typeof window !== "undefined" && window.innerWidth < 640 ? 140 : 210;
    const degreeData = useMemo(() => {
      const map = {};
      filtered.forEach((lecturer) => {
        const deg = lecturer.degree || "Lainnya";
        if (!map[deg]) {
          map[deg] = { name: deg, value: 0, lecturers: [] };
        }
        map[deg].value += 1;
        map[deg].lecturers.push(lecturer.name);
      });
      const total = filtered.length || 1;
      return Object.values(map)
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .map((item, idx) => ({
          ...item,
          percent: Math.round((item.value / total) * 100),
          color: DEGREE_COLORS[idx % DEGREE_COLORS.length],
        }));
    }, [filtered]);

    const plottedCountData = getPlottedCountData(filtered);

    const plottedDistributionData = useMemo(() => {
      const counts = {};
      filtered.forEach((l) => {
        const cnt = l.plotted ? l.plotted.length : 0;
        counts[cnt] = (counts[cnt] || 0) + 1;
      });

      const colorMap = {
        0: "#94a3b8", // Slate (Belum Terplot)
        1: "#38bdf8", // Sky Blue
        2: "#005baa", // UT Blue (Beban Normal)
        3: "#6366f1", // Indigo
        4: "#f59e0b", // Amber (Beban Penuh)
        5: "#ef4444", // Red (Overload)
      };
      const fallbackColors = ["#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

      const sortedKeys = Object.keys(counts)
        .map(Number)
        .sort((a, b) => a - b);

      const total = filtered.length || 1;
      return sortedKeys.map((cnt, idx) => {
        const lecturerNames = filtered
          .filter((l) => (l.plotted ? l.plotted.length : 0) === cnt)
          .map((l) => l.name);

        const color =
          colorMap[cnt] ||
          fallbackColors[idx % fallbackColors.length];

        const sublabel =
          cnt === 0
            ? "Belum Terplot"
            : cnt === 1
            ? "Beban Ringan"
            : cnt === 2
            ? "Beban Normal"
            : cnt === 3
            ? "Beban Tinggi"
            : "Beban Penuh";

        return {
          name: `${cnt} Kelas`,
          sublabel,
          value: counts[cnt],
          lecturers: lecturerNames,
          color,
          percent: Math.round((counts[cnt] / total) * 100),
        };
      });
    }, [filtered]);
    const cleanLecturerName = (fullName) => {
      if (!fullName) return "";
      let s = String(fullName).trim();
      s = s.replace(/^(prof\.|dr\.|dra\.|drs\.|ir\.|hj\.|h\.|dr\b)\s*/gi, "").trim();
      s = s.replace(/^(prof\.|dr\.|dra\.|drs\.|ir\.|hj\.|h\.|dr\b)\s*/gi, "").trim();
      s = s.split(",")[0].trim();
      const parts = s.split(/\s+/).filter((w) => !/^(prof|dr|dra|drs|ir|hj|h)\.?$/i.test(w));
      if (parts.length === 0) return fullName.split(" ")[0];
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[1][0]}.`;
    };

    const [loadFilterMode, setLoadFilterMode] = useState("all");

    const availableData = useMemo(() => {
      return filtered.map((lecturer) => {
        const plottedCount = lecturer.plotted ? lecturer.plotted.length : 0;
        const availableCount = Number(lecturer.available) || 0;
        return {
          id: lecturer.id,
          fullName: lecturer.name,
          shortName: cleanLecturerName(lecturer.name),
          name: cleanLecturerName(lecturer.name),
          email: lecturer.email,
          degree: lecturer.degree,
          available: availableCount,
          plotted: plottedCount,
          plottedCourses: lecturer.plotted || [],
        };
      });
    }, [filtered]);

    const displayAvailableData = useMemo(() => {
      let list = [...availableData];
      if (loadFilterMode === "available") {
        list = list.filter((item) => item.plotted < item.available);
      } else if (loadFilterMode === "full") {
        list = list.filter((item) => item.plotted >= item.available && item.available > 0);
      }
      return list;
    }, [availableData, loadFilterMode]);

    const totalPlottedClasses = useMemo(
      () => availableData.reduce((sum, item) => sum + item.plotted, 0),
      [availableData],
    );
    const totalAvailableSlots = useMemo(
      () => availableData.reduce((sum, item) => sum + item.available, 0),
      [availableData],
    );
    const fulfillmentRate = totalAvailableSlots > 0
      ? Math.min(100, Math.round((totalPlottedClasses / totalAvailableSlots) * 100))
      : (totalPlottedClasses > 0 ? 100 : 0);
    useEffect(() => {
      const handleScroll = () => {
        if (
          document.activeElement?.closest?.(
            ".mobile-filter-fab, .mobile-search-modal",
          )
        )
          return;
        setMobileFiltersOpen(false);
        setMobileFiltersVisible(false);
        window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(
          () => setMobileFiltersVisible(true),
          220,
        );
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        window.clearTimeout(scrollTimerRef.current);
      };
    }, []);
    const filterControls = (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SelectBox
          label="Gelar Akademik"
          value={filters.degree}
          onChange={(value) => setFilters({ ...filters, degree: value })}
          options={uniq(lecturers.map((lecturer) => lecturer.degree))}
        />
        <SelectBox
          label="Bidang Keahlian"
          value={filters.expertise}
          onChange={(value) => setFilters({ ...filters, expertise: value })}
          options={uniq(lecturers.flatMap((lecturer) => lecturer.expertise))}
        />
        <SelectBox
          label="Mata Kuliah Terplot"
          value={filters.plotted}
          onChange={(value) => setFilters({ ...filters, plotted: value })}
          options={courses.map((course) => course.title)}
        />
        <SelectBox
          label="Ketersediaan Slot"
          value={filters.available}
          onChange={(value) => setFilters({ ...filters, available: value })}
          options={["0", "1", "2", "3", "4"]}
        />
      </div>
    );
    const mobileFilterRail = (
      <div className="mobile-filter-fab__rail">
        <NativeFilterIconSelect
          label="Gelar Akademik"
          value={filters.degree}
          onChange={(value) => setFilters({ ...filters, degree: value })}
          options={uniq(lecturers.map((lecturer) => lecturer.degree))}
          icon={Icons.graduation}
        />
        <NativeFilterIconSelect
          label="Bidang Keahlian"
          value={filters.expertise}
          onChange={(value) => setFilters({ ...filters, expertise: value })}
          options={uniq(lecturers.flatMap((lecturer) => lecturer.expertise))}
          icon={Icons.book}
        />
      </div>
    );
    return (
      <div className="space-y-6">
        {/* Streamlined Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#005baa]">
              <Icons.filter className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Saring Data Infografis
            </span>
            {Object.values(filters).some((v) => v !== "All") ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[#005baa] px-2.5 py-0.5 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-[#005baa]" />
                Filter Aktif ({Object.values(filters).filter((v) => v !== "All").length})
              </span>
            ) : (
              <span className="text-xs text-slate-400">Semua Dosen Ditampilkan</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Object.values(filters).some((v) => v !== "All") && (
              <button
                type="button"
                onClick={() => setFilters({ degree: "All", expertise: "All", plotted: "All", available: "All" })}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterPanelOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <span>{filterPanelOpen ? "Sembunyikan Panel" : "Sesuaikan Parameter"}</span>
              <Icons.chevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${filterPanelOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {filterPanelOpen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all">
            {filterControls}
          </div>
        )}

        {/* Academic Hero Section: Plotting Fulfillment & Capacity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Featured Hero Card (Spans 5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-blue-200/90 bg-gradient-to-br from-[#005baa] via-[#004b8d] to-[#003e7a] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-[#ffb800]/15 blur-xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-sky-100 backdrop-blur-xs border border-white/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ffb800] animate-pulse" />
                  Kesehatan & Keterisian Semester
                </span>
                <span className="text-xs font-semibold text-white/80">
                  {totalPlottedClasses} / {totalAvailableSlots || totalPlottedClasses} Kelas
                </span>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                    {fulfillmentRate}%
                  </span>
                  <span className="text-sm font-medium text-sky-200">
                    kapasitas teralokasi
                  </span>
                </div>

                {/* Fulfillment Progress Bar */}
                <div className="mt-3.5 h-2.5 w-full rounded-full bg-black/25 overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ffd23f] to-[#ffb800] transition-all duration-500"
                    style={{ width: `${fulfillmentRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-sky-100">
              <span>Status Alokasi:</span>
              <span className={`font-semibold px-2 py-0.5 rounded-md ${
                fulfillmentRate >= 90
                  ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/30"
                  : fulfillmentRate >= 70
                  ? "bg-amber-500/25 text-amber-200 border border-amber-400/30"
                  : "bg-white/15 text-sky-100"
              }`}>
                {fulfillmentRate >= 95 ? "Plotting Lengkap" : fulfillmentRate >= 70 ? "Plotting Berjalan" : "Perlu Alokasi Lanjutan"}
              </span>
            </div>
          </div>

          {/* Secondary Stat Cards (Spans 7 cols on lg in a 3-col grid) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600">Total Dosen</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#005baa]">
                    <Icons.users className="h-4 w-4" />
                  </span>
                </div>
                <p className="font-display text-3xl font-extrabold text-[#102f52] tracking-tight">
                  {filtered.length}
                </p>
              </div>
              <p className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Dosen terdaftar di direktori
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-600">Slot Tersedia</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Icons.chart className="h-4 w-4" />
                  </span>
                </div>
                <p className="font-display text-3xl font-extrabold text-[#102f52] tracking-tight">
                  {totalAvailableSlots}
                </p>
              </div>
              <p className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                Batas kesediaan tutor
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-amber-200/70 bg-gradient-to-br from-[#fffdf5] to-[#fff9df] p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-amber-900">Rata-rata Beban</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffb800]/25 text-amber-800">
                    <Icons.check className="h-4 w-4" />
                  </span>
                </div>
                <p className="font-display text-3xl font-extrabold text-[#102f52] tracking-tight">
                  {filtered.length
                    ? (totalPlottedClasses / filtered.length).toFixed(1)
                    : "0"}
                </p>
              </div>
              <p className="mt-3 pt-2.5 border-t border-amber-200/50 text-[11px] text-amber-800/80">
                Kelas per dosen (target ≤ 4)
              </p>
            </div>
          </div>
        </div>

        {/* Section: Indikator Kinerja Dosen (KPI) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-[#005baa] dark:bg-blue-950 dark:text-cyan-400">
                <Icons.chart className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-bold text-[#102f52] dark:text-slate-100">
                Indikator Kinerja & Beban Dosen (KPI)
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-[#005baa] dark:bg-blue-950/60 dark:text-cyan-300">
                Kesesuaian Keahlian: {kpiData.expertiseMatchPct}%
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                Rating Rata-rata: {kpiData.averageRating} ★
              </span>
            </div>
          </div>

          {/* Overload Alert (if any) */}
          {kpiData.overloads.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 max-w-4xl">
              <Icons.warning className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-amber-900 dark:text-amber-200">
                  Perhatian Beban Berlebih ({kpiData.overloads.length} Dosen):
                </strong>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed max-w-prose">
                  Dosen berikut memiliki alokasi di atas batas standar ({kpiData.overloads.map((l) => `${l.name} (${l.plotted.length} kelas)`).join(", ")}). Pertimbangkan untuk mendistribusikan kelas ke dosen lain.
                </p>
              </div>
            </div>
          )}

          {/* Top 5 Load & Top 5 Rating Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top 5 Beban Mengajar */}
            <Card className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <Icons.book className="h-3.5 w-3.5" />
                    </span>
                    <h4 className="text-xs font-bold text-[#102f52] dark:text-slate-100">
                      Top 5 Dosen Beban Mengajar
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Berdasarkan kelas terplot
                  </span>
                </div>

                <div className="space-y-2.5">
                  {kpiData.topLoad.map((lec, idx) => {
                    const maxCap = Math.max(4, lec.available || 4);
                    const pct = Math.min(100, Math.round((lec.plotted.length / maxCap) * 100));
                    return (
                      <div key={lec.id} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="w-4 shrink-0 text-xs font-bold text-slate-400 text-right">
                              {idx + 1}.
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {lec.name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {lec.degree}
                            </span>
                          </div>
                          <span className="shrink-0 font-black text-[#005baa] dark:text-cyan-400">
                            {lec.plotted.length} Kelas
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              lec.plotted.length > 4
                                ? "bg-rose-500"
                                : lec.plotted.length === 4
                                ? "bg-amber-500"
                                : "bg-indigo-600"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Top 5 Rating Evaluasi */}
            <Card className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                      <Icons.star className="h-3.5 w-3.5" />
                    </span>
                    <h4 className="text-xs font-bold text-[#102f52] dark:text-slate-100">
                      Top 5 Rating Kepuasan & Kinerja
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Evaluasi mahasiswa & prodi
                  </span>
                </div>

                <div className="space-y-2.5">
                  {kpiData.topRated.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Belum ada penilaian rating tersimpan
                    </p>
                  ) : (
                    kpiData.topRated.map((lec, idx) => (
                      <div key={lec.id} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-4 shrink-0 text-xs font-bold text-slate-400 text-right">
                            {idx + 1}.
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {lec.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({lec.plotted.length} kelas)
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                          {Number(lec.rating || 0).toFixed(1)} ★
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Berdasarkan Gelar Akademik */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 mb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#005baa]">
                    <Icons.graduation className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#102f52] text-sm sm:text-base leading-tight">
                      Berdasarkan Gelar Akademik
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Distribusi kualifikasi & jenjang gelar dosen
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#005baa]" />
                  {degreeData.length} Kategori Gelar
                </span>
              </div>

              {degreeData.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                    <Icons.graduation className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Tidak ada data gelar dosen
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sesuaikan filter untuk melihat data
                  </p>
                </div>
              ) : (
                <div className="relative h-64 w-full flex items-center justify-center">
                  {/* Centered Stat in Donut Hole - Placed BEFORE ResponsiveContainer and z-0 */}
                  <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center select-none">
                    <span className="text-2xl font-black tracking-tight text-[#102f52]">
                      {filtered.length}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Total Dosen
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} className="relative z-10">
                    <RePieChart>
                      <Pie
                        data={degreeData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={3}
                        cornerRadius={5}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {degreeData.map((entry, index) => (
                          <Cell
                            key={`degree-cell-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<CustomDonutTooltip total={filtered.length} />}
                        wrapperStyle={{ zIndex: 100 }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {degreeData.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-slate-100">
                {degreeData.map((item, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 transition-colors shadow-2xs cursor-default"
                    title={`${item.name}: ${item.value} dosen (${item.percent}%)`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-800">
                      {item.name}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card 2: Berdasarkan Jumlah Kelas Terplot */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 mb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icons.book className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#102f52] text-sm sm:text-base leading-tight">
                      Berdasarkan Jumlah Kelas Terplot
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Distribusi alokasi beban mengajar dosen
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  {totalPlottedClasses} Kelas Terplot
                </span>
              </div>

              {plottedDistributionData.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                    <Icons.book className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Tidak ada data alokasi kelas
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sesuaikan filter untuk melihat data
                  </p>
                </div>
              ) : (
                <div className="relative h-64 w-full flex items-center justify-center">
                  {/* Centered Stat in Donut Hole - Placed BEFORE ResponsiveContainer and z-0 */}
                  <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center select-none">
                    <span className="text-2xl font-black tracking-tight text-[#102f52]">
                      {filtered.length}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Total Dosen
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} className="relative z-10">
                    <RePieChart>
                      <Pie
                        data={plottedDistributionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={3}
                        cornerRadius={5}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {plottedDistributionData.map((entry, index) => (
                          <Cell
                            key={`plotted-cell-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<CustomDonutTooltip total={filtered.length} />}
                        wrapperStyle={{ zIndex: 100 }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {plottedDistributionData.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-slate-100">
                {plottedDistributionData.map((item, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 transition-colors shadow-2xs cursor-default"
                    title={`${item.name} (${item.sublabel}): ${item.value} dosen (${item.percent}%)`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-800">
                      {item.name}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5 md:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#005baa]">
                    <Icons.chart className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-[#102f52] text-base">
                    Distribusi Bidang Keahlian Dosen
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Pemetaan kompetensi dosen pengampu untuk akurasi plotting mata kuliah
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#005baa]" />
                  {expertiseStats.length} Bidang Terdata
                </span>

                {expertiseStats.length > 8 && (
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setExpertiseViewMode("top10")}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        expertiseViewMode === "top10"
                          ? "bg-white text-[#005baa] shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Top 10
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpertiseViewMode("all")}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        expertiseViewMode === "all"
                          ? "bg-white text-[#005baa] shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Semua ({expertiseStats.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {displayExpertiseData.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                  <Icons.chart className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada data bidang keahlian
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Sesuaikan filter direktori atau lengkapi data keahlian dosen.
                </p>
              </div>
            ) : (
              <div
                className="w-full overflow-y-auto max-h-[540px] pr-1"
                style={{ scrollbarWidth: "thin" }}
              >
                <ResponsiveContainer
                  width="100%"
                  height={expertiseChartHeight}
                  minWidth={0}
                  minHeight={expertiseChartHeight}
                >
                  <BarChart
                    data={displayExpertiseData}
                    layout="vertical"
                    margin={{ top: 8, right: 85, left: 10, bottom: 8 }}
                    barCategoryGap="22%"
                  >
                    <defs>
                      <linearGradient
                        id="expertiseBarGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#005baa" />
                        <stop offset="70%" stopColor="#0072cb" />
                        <stop offset="100%" stopColor="#0284c7" />
                      </linearGradient>
                      <linearGradient
                        id="expertiseBarHover"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#004684" />
                        <stop offset="100%" stopColor="#005baa" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      horizontal={false}
                      stroke="#f1f5f9"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={{ stroke: "#e2e8f0" }}
                      tick={{
                        fontSize: 11,
                        fill: "#64748b",
                        fontWeight: 500,
                      }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={yAxisWidth}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      tick={<CustomYAxisTick />}
                      interval={0}
                    />
                    <Tooltip
                      content={
                        <CustomExpertiseTooltip
                          totalLecturers={filtered.length}
                        />
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#expertiseBarGradient)"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                      activeBar={{ fill: "url(#expertiseBarHover)" }}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        offset={12}
                        formatter={(val) => `${val} dosen`}
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          fill: "#0369a1",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icons.users className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-[#102f52] text-base">
                  Beban dan Ketersediaan Dosen
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Perbandingan alokasi kelas tutorial aktif (terplot) terhadap kapasitas kuota slot dosen
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#005baa]" />
                Terplot: {totalPlottedClasses} Kelas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                Kuota: {totalAvailableSlots} Slot
              </span>

              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLoadFilterMode("all")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    loadFilterMode === "all"
                      ? "bg-white text-[#005baa] shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semua ({availableData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoadFilterMode("available")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    loadFilterMode === "available"
                      ? "bg-white text-amber-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tersedia Slot
                </button>
                <button
                  type="button"
                  onClick={() => setLoadFilterMode("full")}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    loadFilterMode === "full"
                      ? "bg-white text-emerald-700 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Penuh
                </button>
              </div>
            </div>
          </div>

          {displayAvailableData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                <Icons.users className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Tidak ada dosen yang cocok dengan filter status beban
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Gunakan tab "Semua" untuk melihat keseluruhan beban dosen.
              </p>
            </div>
          ) : (
            <div
              className="w-full overflow-x-auto pb-2"
              style={{ scrollbarWidth: "thin" }}
            >
              <div
                style={{
                  minWidth: `${Math.max(680, displayAvailableData.length * 48)}px`,
                  height: "350px",
                }}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={displayAvailableData}
                    margin={{ top: 25, right: 20, left: -15, bottom: 50 }}
                    barGap={3}
                  >
                    <defs>
                      <linearGradient
                        id="plottedBarGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#0284c7" />
                        <stop offset="100%" stopColor="#005baa" />
                      </linearGradient>
                      <linearGradient
                        id="availableBarGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="#f1f5f9"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shortName"
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={55}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={{ stroke: "#e2e8f0" }}
                      tick={{
                        fontSize: 11,
                        fill: "#475569",
                        fontWeight: 600,
                      }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={{ stroke: "#e2e8f0" }}
                      tick={{
                        fontSize: 11,
                        fill: "#64748b",
                        fontWeight: 500,
                      }}
                    />
                    <Tooltip content={<CustomLoadTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{
                        paddingBottom: "14px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                      formatter={(val) =>
                        val === "plotted"
                          ? "Kelas Terplot (Beban)"
                          : "Kapasitas Slot (Kuota)"
                      }
                    />
                    <Bar
                      dataKey="plotted"
                      name="plotted"
                      fill="url(#plottedBarGradient)"
                      radius={[6, 6, 0, 0]}
                      barSize={14}
                    >
                      <LabelList
                        dataKey="plotted"
                        position="top"
                        formatter={(val) => (val > 0 ? val : "")}
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          fill: "#0369a1",
                        }}
                      />
                    </Bar>
                    <Bar
                      dataKey="available"
                      name="available"
                      fill="url(#availableBarGradient)"
                      radius={[6, 6, 0, 0]}
                      barSize={14}
                    >
                      <LabelList
                        dataKey="available"
                        position="top"
                        formatter={(val) => (val > 0 ? val : "")}
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          fill: "#b45309",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  function LecturerForm({
    initial,
    onSave,
    onClose,
    expertiseOptions = DEFAULT_EXPERTISE_OPTIONS,
  }) {
    const degreeOptions = initial?.degreeOptions || DEFAULT_DEGREE_OPTIONS;
    const [form, setForm] = useState(() => {
      const base = initial || {
        id: String(Date.now()).slice(-8),
        degree: "M.A.",
        name: "",
        email: "",
        phone: "",
        plotted: [],
        available: 0,
        rating: 0,
        warning_note: "",
      };
      return {
        ...base,
        degree: degreeOptions.includes(base.degree)
          ? base.degree
          : degreeOptions[0],
        expertise: Array.isArray(base.expertise)
          ? base.expertise
          : splitList(base.expertiseText),
        rating: clampRating(base.rating),
        warning_note: String(base.warning_note || ""),
      };
    });
    const save = () => {
      onSave({
        id: form.id,
        degree: form.degree,
        name: form.name,
        email: form.email,
        phone: form.phone,
        available: Number(form.available ?? 0),
        rating: clampRating(form.rating),
        warning_note: String(form.warning_note || "").trim(),
        expertise: uniq(form.expertise),
        plotted: Array.isArray(form.plotted) ? form.plotted : [],
      });
    };
    return (
      <div className="space-y-4">
        <FormGrid>
          <PlainInput
            label="ID Dosen"
            value={form.id}
            onChange={(value) => setForm({ ...form, id: value })}
          />
          <PlainSelect
            label="Gelar"
            value={form.degree}
            onChange={(value) => setForm({ ...form, degree: value })}
            options={degreeOptions}
          />
        </FormGrid>
        <PlainInput
          label="Nama Lengkap"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
        />
        <FormGrid>
          <PlainInput
            label="Email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <PlainInput
            label="Nomor Telepon"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </FormGrid>
        <FormGrid>
          <ExpertiseSelect
            label="Bidang Keahlian"
            value={form.expertise}
            onChange={(value) => setForm({ ...form, expertise: value })}
            options={expertiseOptions}
          />
          <PlainInput
            label="Slot Tersedia (0-4)"
            type="number"
            value={form.available}
            onChange={(value) => setForm({ ...form, available: value })}
          />
        </FormGrid>
        <FormGrid>
          <PlainSelect
            label="Penilaian Kinerja Mengajar"
            value={String(form.rating)}
            onChange={(value) => setForm({ ...form, rating: Number(value) })}
            options={["0", "1", "2", "3", "4", "5"]}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-normal text-[#53616c]">
              Pratinjau Penilaian
            </span>
            <div className="flex h-11 items-center rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3">
              <RatingStars
                rating={form.rating}
                onChange={(value) => setForm({ ...form, rating: value })}
              />
            </div>
          </div>
        </FormGrid>
        <PlainTextarea
          label="Catatan Peringatan / Evaluasi"
          value={form.warning_note}
          onChange={(value) => setForm({ ...form, warning_note: value })}
          placeholder="Kosongkan jika tidak ada catatan evaluasi khusus."
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={!form.id}>
            Simpan Data Dosen
          </Button>
        </div>
      </div>
    );
  }

  function LecturerInfoCard({ lecturer, courses, onRatingChange, selectedTermCode = "2026-1" }) {
    const hasContact = Boolean(lecturer.email || lecturer.phone);
    const totalSksLecturer = (lecturer.plotted || []).reduce((sum, code) => {
      const found = courses.find((c) => c.code === code || c.id === code);
      return sum + (found?.sks ? Number(found.sks) : 3);
    }, 0);
    const maxSlots = Math.max(1, lecturer.available || 4);
    const utilizationPct = Math.round(((lecturer.plotted?.length || 0) / maxSlots) * 100);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-blue-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#005baa]">
                Profil Dosen
              </p>
              <h3 className="mt-2 text-2xl font-medium text-slate-950">
                {lecturer.name}
              </h3>
              <p className="mt-1 text-sm font-normal text-slate-600">
                {lecturer.degree} · ID {lecturer.id}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RatingStars
                  rating={lecturer.rating}
                  onChange={onRatingChange}
                />{" "}
                <WarningNotice note={lecturer.warning_note} />
              </div>
            </div>
            <Badge tone={availabilityTone(lecturer.available)}>
              {lecturer.available} slot tersedia
            </Badge>
          </div>
        </div>

        {/* KPI Workload & Capacity Card */}
        <div className="rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/70 to-slate-50 p-4 dark:border-slate-800 dark:from-slate-800/60 dark:to-slate-900/60">
          <div className="flex items-center justify-between border-b border-blue-100/60 pb-2.5 mb-3 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Indikator Kinerja & Beban (KPI)
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                lecturer.plotted.length > 4
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : lecturer.plotted.length >= 1
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {lecturer.plotted.length > 4
                ? "⚠️ Overload (>4 Kelas)"
                : lecturer.plotted.length >= 1
                ? "✓ Beban Wajar"
                : "Belum Ada Beban"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/80 p-2 shadow-2xs dark:bg-slate-800/80">
              <span className="block text-base font-black text-[#102f52] dark:text-slate-100">
                {lecturer.plotted.length}
              </span>
              <span className="text-[10px] text-slate-500">Kelas Terplot</span>
            </div>
            <div className="rounded-xl bg-white/80 p-2 shadow-2xs dark:bg-slate-800/80">
              <span className="block text-base font-black text-[#102f52] dark:text-slate-100">
                {totalSksLecturer}
              </span>
              <span className="text-[10px] text-slate-500">Total SKS</span>
            </div>
            <div className="rounded-xl bg-white/80 p-2 shadow-2xs dark:bg-slate-800/80">
              <span className="block text-base font-black text-amber-600 dark:text-amber-400">
                {lecturer.rating ? `${Number(lecturer.rating).toFixed(1)} ★` : "5.0 ★"}
              </span>
              <span className="text-[10px] text-slate-500">Evaluasi Kinerja</span>
            </div>
          </div>

          {/* Workload utilization bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              <span>Utilisasi Kapasitas Mengajar</span>
              <span>{Math.round(((lecturer.plotted?.length || 0) / Math.max(1, lecturer.available || 4)) * 100)}% ({lecturer.plotted.length} / {lecturer.available || 4} slot)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
              <div
                className={`h-full transition-all duration-500 ${
                  lecturer.plotted.length > 4
                    ? "bg-rose-500"
                    : lecturer.plotted.length >= 3
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(((lecturer.plotted?.length || 0) / Math.max(1, lecturer.available || 4)) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {hasContact && (
          <div className="grid gap-4 sm:grid-cols-2">
            {lecturer.email && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-slate-600">
                  Email
                </p>
                <p className="mt-2 text-sm font-normal text-slate-800">
                  {lecturer.email}
                </p>
              </Card>
            )}
            {lecturer.phone && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-slate-600">
                  Nomor Telepon
                </p>
                <p className="mt-2 text-sm font-normal text-slate-800">
                  {lecturer.phone}
                </p>
              </Card>
            )}
          </div>
        )}
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-600">
            Bidang Keahlian
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lecturer.expertise.length ? (
              lecturer.expertise.map((item) => <Badge key={item}>{item}</Badge>)
            ) : (
              <span className="text-sm text-slate-500">
                Belum ada keahlian tercatat
              </span>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-600">
            Mata Kuliah Terplot
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lecturer.plotted.length ? (
              <PlottedCourseBadges
                plotted={lecturer.plotted}
                courses={courses}
              />
            ) : (
              <span className="text-sm text-slate-500">
                Belum ada mata kuliah terplot
              </span>
            )}
          </div>
        </Card>
        <div className="flex justify-end pt-2">
          <Button
            variant="secondary"
            className="border-[#005baa]/30 text-[#005baa] hover:bg-blue-50 text-xs font-bold"
            onClick={() => {
              if (typeof exportSuratTugasPDF === "function") {
                exportSuratTugasPDF(lecturer, courses, { code: selectedTermCode });
              }
            }}
          >
            <Icons.file className="h-4 w-4 mr-1.5 text-[#005baa]" />
            Unduh Surat Tugas PDF
          </Button>
        </div>
      </div>
    );
  }

  function BulkDeleteConfirmationModal({
    selectedCount,
    selectedLecturers,
    selectedTermCode,
    onConfirm,
    onClose,
  }) {
    const preview = selectedLecturers.slice(0, 5);
    const remaining = selectedCount - preview.length;

    return (
      <Modal title="Konfirmasi Hapus Massal" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-rose-50 border border-rose-200/80 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <Icons.trash className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">
                Hapus {selectedCount} Dosen Terpilih?
              </h4>
              <p className="mt-1 text-xs text-rose-700 leading-relaxed">
                Tindakan ini akan menghapus permanen <strong>{selectedCount} dosen</strong> dari Direktori Dosen serta mencopot penugasan kelas mereka dari semester {selectedTermCode || "aktif"}.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">
              Daftar Dosen yang akan dihapus:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5">
              {preview.map((lecturer) => (
                <div
                  key={lecturer.id}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 border border-slate-200/60 text-xs"
                >
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">
                    {lecturer.name || "(Nama Kosong)"}
                  </span>
                  <span className="font-mono text-[11px] text-[#005baa] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                    {lecturer.id}
                  </span>
                </div>
              ))}
              {remaining > 0 && (
                <p className="text-center text-xs text-slate-500 py-1 font-medium">
                  ...dan {remaining} dosen lainnya
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              <Icons.trash className="h-4 w-4" />
              Ya, Hapus {selectedCount} Dosen
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  function BulkEditModal({
    selectedCount,
    expertiseOptions,
    onSave,
    onClose,
  }) {
    const [availableMode, setAvailableMode] = useState("keep");
    const [ratingMode, setRatingMode] = useState("keep");
    const [degreeMode, setDegreeMode] = useState("keep");
    const [addExpertiseText, setAddExpertiseText] = useState("");
    const [warningNoteMode, setWarningNoteMode] = useState("keep");
    const [customWarningNote, setCustomWarningNote] = useState("");

    const handleSubmit = (e) => {
      e.preventDefault();
      const updates = {};
      if (availableMode !== "keep") {
        updates.available = Number(availableMode);
      }
      if (ratingMode !== "keep") {
        updates.rating = Number(ratingMode);
      }
      if (degreeMode !== "keep") {
        updates.degree = degreeMode;
      }
      if (addExpertiseText.trim()) {
        updates.addExpertise = splitList(addExpertiseText);
      }
      if (warningNoteMode === "clear") {
        updates.warning_note = "";
      } else if (warningNoteMode === "set") {
        updates.warning_note = customWarningNote.trim();
      }

      onSave(updates);
    };

    return (
      <Modal title={`Edit Massal (${selectedCount} Dosen)`} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3 text-xs text-[#005baa]">
            Perubahan yang Anda pilih di bawah ini akan diterapkan sekaligus ke <strong>{selectedCount} dosen terpilih</strong>. Kolom bertanda "Jangan Ubah" tidak akan memengaruhi data dosen yang sudah ada.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Slot Tersedia (Available)
              </label>
              <select
                value={availableMode}
                onChange={(e) => setAvailableMode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#005baa] focus:outline-none"
              >
                <option value="keep">— Jangan Ubah —</option>
                <option value="0">0 Slot (Penuh / Tidak Tersedia)</option>
                <option value="1">1 Slot</option>
                <option value="2">2 Slot</option>
                <option value="3">3 Slot</option>
                <option value="4">4 Slot</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rating Pengajaran
              </label>
              <select
                value={ratingMode}
                onChange={(e) => setRatingMode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#005baa] focus:outline-none"
              >
                <option value="keep">— Jangan Ubah —</option>
                <option value="1">★ 1 Bintang</option>
                <option value="2">★★ 2 Bintang</option>
                <option value="3">★★★ 3 Bintang</option>
                <option value="4">★★★★ 4 Bintang</option>
                <option value="5">★★★★★ 5 Bintang</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gelar Pendidikan
              </label>
              <select
                value={degreeMode}
                onChange={(e) => setDegreeMode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#005baa] focus:outline-none"
              >
                <option value="keep">— Jangan Ubah —</option>
                <option value="S1">S1</option>
                <option value="S2">S2</option>
                <option value="S3">S3</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Peringatan / Evaluasi
              </label>
              <select
                value={warningNoteMode}
                onChange={(e) => setWarningNoteMode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#005baa] focus:outline-none"
              >
                <option value="keep">— Jangan Ubah —</option>
                <option value="clear">Kosongkan Catatan</option>
                <option value="set">Tentukan Catatan Baru</option>
              </select>
            </div>
          </div>

          {warningNoteMode === "set" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Isi Catatan Peringatan Baru
              </label>
              <input
                type="text"
                value={customWarningNote}
                onChange={(e) => setCustomWarningNote(e.target.value)}
                placeholder="Contoh: Evaluasi kinerja semester genap..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#005baa] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tambah Bidang Keahlian (Tambahkan ke yang sudah ada)
            </label>
            <input
              type="text"
              value={addExpertiseText}
              onChange={(e) => setAddExpertiseText(e.target.value)}
              placeholder="Pisahkan dengan koma atau titik koma (misal: Kurikulum & Pembelajaran, Evaluasi Pembelajaran SD)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#005baa] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button variant="primary" type="submit">
              <Icons.check className="h-4 w-4" />
              Terapkan ke {selectedCount} Dosen
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  function Lecturers({
    lecturers,
    directoryLecturers,
    setLecturers,
    setTermLecturers,
    courses,
    terms = [],
    selectedTermCode,
    canSyncData = true,
    canEdit = true,
    readOnly = false,
    onLecturerLabelChange,
    onDiscardLecturerLabelChange,
    onDeleteLecturer,
    onBulkDeleteLecturers,
    onBulkEditLecturers,
    onSaveLecturer,
  }) {
    const importInputRef = useRef(null);
    const [query, setQuery] = useState("");
    const [degree, setDegree] = useState("All");
    const [expertise, setExpertise] = useState("All");
    const [available, setAvailable] = useState("All");
    const [plottedClasses, setPlottedClasses] = useState("All");
    const [sort, setSort] = useState("name");
    const [sortDirection, setSortDirection] = useState("asc");
    const [modal, setModal] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [importMessage, setImportMessage] = useState("");
    const [importReview, setImportReview] = useState(null);
    const [importBusy, setImportBusy] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);
    const [fileMenuOpen, setFileMenuOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [mobileFiltersVisible, setMobileFiltersVisible] = useState(true);
    const scrollTimerRef = useRef(null);
    const mobileSearchInputRef = useRef(null);
    const tableContainerRef = useRef(null);
    const topScrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [tableScrollWidth, setTableScrollWidth] = useState(1150);
    const [tableViewMode, setTableViewMode] = useState("unified"); // "unified" (1 Layar Penuh) | "spreadsheet" (10 Kolom)

    const updateTableScrollMetrics = () => {
      const el = tableContainerRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
      setTableScrollWidth(el.scrollWidth);
    };

    const handleTopScroll = (e) => {
      if (
        tableContainerRef.current &&
        Math.abs(tableContainerRef.current.scrollLeft - e.target.scrollLeft) > 2
      ) {
        tableContainerRef.current.scrollLeft = e.target.scrollLeft;
      }
    };

    const scrollTable = (direction) => {
      const el = tableContainerRef.current;
      if (!el) return;
      const amount = direction === "left" ? -320 : 320;
      el.scrollBy({ left: amount, behavior: "smooth" });
    };
    const directoryById = useMemo(
      () =>
        new Map(directoryLecturers.map((lecturer) => [lecturer.id, lecturer])),
      [directoryLecturers],
    );
    const expertiseOptions = useMemo(
      () =>
        uniq(
          [...directoryLecturers, ...lecturers].flatMap(
            (lecturer) => lecturer.expertise,
          ),
        ),
      [directoryLecturers, lecturers],
    );
    const sortBy = (value) => {
      setSortDirection((current) =>
        sort === value ? (current === "asc" ? "desc" : "asc") : "asc",
      );
      setSort(value);
    };
    const sortHeader = (label, value) => (
      <button
        type="button"
        onClick={() => sortBy(value)}
        className="inline-flex items-center gap-1 font-medium uppercase tracking-[0.15em] text-slate-500 hover:text-blue-700"
      >
        {label}
        {sort === value && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
    const rows = useMemo(
      () =>
        lecturers
          .filter((lecturer) =>
            [
              lecturer.id,
              lecturer.name,
              lecturer.email,
              lecturer.phone,
              lecturer.degree,
              lecturer.rating,
              lecturer.warning_note,
              lecturer.expertise.join(" "),
              lecturer.plotted.join(" "),
              plottedCourseTitles(lecturer, courses).join(" "),
            ].some((value) => includes(value, query)),
          )
          .filter((lecturer) => degree === "All" || lecturer.degree === degree)
          .filter(
            (lecturer) =>
              expertise === "All" || lecturer.expertise.includes(expertise),
          )
          .filter(
            (lecturer) =>
              available === "All" || String(lecturer.available) === available,
          )
          .filter(
            (lecturer) =>
              plottedClasses === "All" ||
              String(lecturer.plotted.length) === plottedClasses,
          )
          .sort((a, b) => {
            const result =
              sort === "plotted" || sort === "available" || sort === "rating"
                ? Number(
                    a[sort === "plotted" ? "plotted" : sort]?.length ??
                      a[sort] ??
                      0,
                  ) -
                  Number(
                    b[sort === "plotted" ? "plotted" : sort]?.length ??
                      b[sort] ??
                      0,
                  )
                : String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""));
            return sortDirection === "asc" ? result : -result;
          }),
      [
        lecturers,
        courses,
        query,
        degree,
        expertise,
        available,
        plottedClasses,
        sort,
        sortDirection,
      ],
    );

    const visibleRowIds = useMemo(() => rows.map((r) => r.id), [rows]);
    const isAllSelected =
      visibleRowIds.length > 0 &&
      visibleRowIds.every((id) => selectedIds.has(id));
    const isSomeSelected =
      visibleRowIds.some((id) => selectedIds.has(id)) && !isAllSelected;

    const toggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          visibleRowIds.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          visibleRowIds.forEach((id) => next.add(id));
          return next;
        });
      }
    };

    const toggleSelectRow = (id) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const clearSelection = () => {
      setSelectedIds(new Set());
    };

    const selectedLecturersList = useMemo(() => {
      const byId = new Map(lecturers.map((l) => [l.id, l]));
      return Array.from(selectedIds)
        .map((id) => byId.get(id))
        .filter(Boolean);
    }, [lecturers, selectedIds]);

    const handleExecuteBulkDelete = async () => {
      const idsToDelete = Array.from(selectedIds);
      if (!idsToDelete.length) return;

      if (onBulkDeleteLecturers) {
        await onBulkDeleteLecturers(idsToDelete);
      } else {
        idsToDelete.forEach((id) => {
          if (onDiscardLecturerLabelChange?.(id) !== false) {
            onDeleteLecturer?.(id);
          }
        });
      }

      const idSet = new Set(idsToDelete);
      setLecturers((prev) => prev.filter((l) => !idSet.has(l.id)));
      setTermLecturers((prev) => prev.filter((l) => !idSet.has(l.id)));

      setImportMessage(`Berhasil menghapus ${idsToDelete.length} dosen terpilih.`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    };

    const handleExecuteBulkEdit = async (updates) => {
      const targetIds = Array.from(selectedIds);
      if (!targetIds.length) return;

      if (onBulkEditLecturers) {
        await onBulkEditLecturers(targetIds, updates);
      }

      const targetSet = new Set(targetIds);
      setLecturers((prev) =>
        prev.map((l) => {
          if (!targetSet.has(l.id)) return l;
          const next = { ...l };
          if (updates.available !== undefined) next.available = updates.available;
          if (updates.rating !== undefined) next.rating = updates.rating;
          if (updates.degree !== undefined && updates.degree !== "")
            next.degree = updates.degree;
          if (updates.addExpertise && Array.isArray(updates.addExpertise)) {
            const expSet = new Set(next.expertise || []);
            updates.addExpertise.forEach((exp) => expSet.add(exp));
            next.expertise = Array.from(expSet);
          }
          if (updates.warning_note !== undefined)
            next.warning_note = updates.warning_note;
          return next;
        }),
      );
      setTermLecturers((prev) =>
        prev.map((l) => {
          if (!targetSet.has(l.id)) return l;
          const next = { ...l };
          if (updates.available !== undefined) next.available = updates.available;
          if (updates.rating !== undefined) next.rating = updates.rating;
          if (updates.degree !== undefined && updates.degree !== "")
            next.degree = updates.degree;
          if (updates.addExpertise && Array.isArray(updates.addExpertise)) {
            const expSet = new Set(next.expertise || []);
            updates.addExpertise.forEach((exp) => expSet.add(exp));
            next.expertise = Array.from(expSet);
          }
          if (updates.warning_note !== undefined)
            next.warning_note = updates.warning_note;
          return next;
        }),
      );

      targetIds.forEach((id) => {
        const labels = {};
        if (updates.rating !== undefined) labels.rating = updates.rating;
        if (updates.warning_note !== undefined)
          labels.warning_note = updates.warning_note;
        if (Object.keys(labels).length) {
          onLecturerLabelChange?.(id, labels);
        }
      });

      setImportMessage(
        `Berhasil memperbarui ${targetIds.length} dosen terpilih.`,
      );
      setSelectedIds(new Set());
      setBulkEditOpen(false);
    };

    const save = (item) => {
      onSaveLecturer?.(item);
      const existing = directoryById.get(item.id);
      const labelPatch = {};
      const nextRating = clampRating(item.rating);
      const nextWarningNote = String(item.warning_note || "").trim();
      if (!existing || nextRating !== clampRating(existing.rating))
        labelPatch.rating = nextRating;
      if (
        !existing ||
        nextWarningNote !== String(existing.warning_note || "").trim()
      )
        labelPatch.warning_note = nextWarningNote;
      if (
        Object.keys(labelPatch).length &&
        onLecturerLabelChange?.(item.id, labelPatch) === false
      )
        return;

      const availableSlots = Math.max(
        0,
        Math.min(4, Number(item.available) || 0),
      );
      setLecturers((prev) =>
        prev.some((lecturer) => lecturer.id === item.id)
          ? prev.map((lecturer) =>
              lecturer.id === item.id
                ? {
                    ...lecturer,
                    ...item,
                    available: lecturer.available,
                    plotted: lecturer.plotted,
                  }
                : lecturer,
            )
          : [{ ...item, available: availableSlots, plotted: [] }, ...prev],
      );
      setTermLecturers((prev) =>
        prev.some((lecturer) => lecturer.id === item.id)
          ? prev.map((lecturer) =>
              lecturer.id === item.id
                ? {
                    ...lecturer,
                    ...item,
                    available: availableSlots,
                    plotted: lecturer.plotted,
                  }
                : lecturer,
            )
          : [{ ...item, available: availableSlots, plotted: [] }, ...prev],
      );
      setModal(null);
    };
    const rateLecturer = (id, rating) => {
      const nextRating = clampRating(rating);
      if (onLecturerLabelChange) {
        if (onLecturerLabelChange(id, { rating: nextRating }) === false) return;
      } else
        setLecturers((prev) =>
          prev.map((lecturer) =>
            lecturer.id === id ? { ...lecturer, rating: nextRating } : lecturer,
          ),
        );
      setViewing((prev) =>
        prev?.id === id ? { ...prev, rating: nextRating } : prev,
      );
    };
    const importRows = async (items) => {
      if (!selectedTermCode)
        throw new Error(
          "Create or select a term before importing lecturer data.",
        );
      const uniqueItems = dedupeImportedLecturers(items);
      const scopedById = new Map(
        lecturers.map((lecturer) => [lecturer.id, lecturer]),
      );
      const directoryRows = uniqueItems.map((item) => {
        const existing = directoryById.get(item.id);
        return mergeImportedLecturer(existing, item);
      });
      const plottingRows = uniqueItems.map((item) => {
        const existing = scopedById.get(item.id);
        return normalizeTermPlotting(
          buildTermPlottingRow(selectedTermCode, {
            ...item,
            plotted: existing?.plotted || item.plotted || [],
            available: item._hasImportedAvailable
              ? item.available
              : (existing?.available ?? item.available),
          }),
        );
      });
      if (USE_SUPABASE && canSyncData) {
        await upsertRows(
          "lecturers",
          serializeLecturersForDatabase(directoryRows, false),
          "id",
        );
        await upsertRows("term_plottings", plottingRows, "id");
      }
      setLecturers((prev) => {
        const byId = new Map(prev.map((lecturer) => [lecturer.id, lecturer]));
        directoryRows.forEach((item) => byId.set(item.id, item));
        return Array.from(byId.values());
      });
      setTermLecturers((prev) => {
        const byId = new Map(prev.map((lecturer) => [lecturer.id, lecturer]));
        uniqueItems.forEach((item) =>
          byId.set(item.id, mergeImportedLecturer(byId.get(item.id), item)),
        );
        return Array.from(byId.values());
      });
      uniqueItems.forEach((item) => {
        const labels = {};
        if (item._hasImportedRating) labels.rating = item.rating;
        if (item._hasImportedWarningNote)
          labels.warning_note = item.warning_note;
        if (Object.keys(labels).length)
          onLecturerLabelChange?.(item.id, labels);
      });
    };
    const handleImport = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setImportMessage("");
      try {
        const rawRows = await readImportFile(file, {
          parseCSV,
          rowsToObjects,
          parseXLSX,
        });
        const imported = mapImportedLecturers(rawRows, courses);
        if (!imported.length)
          throw new Error(
            "Tidak ditemukan baris data dosen yang valid. Harap gunakan kolom sesuai template XLSX yang diunduh.",
          );
        setImportReview(buildLecturerImportReview(rawRows, imported));
      } catch (error) {
        setImportMessage(error.message || "Impor data gagal.");
      } finally {
        event.target.value = "";
      }
    };
    const applyImportReview = async () => {
      if (!importReview) return;
      setImportBusy(true);
      try {
        importReview.imported.forEach((item) => onSaveLecturer?.(item));
        await importRows(importReview.imported);
        setImportMessage(
          `Berhasil mengimpor ${importReview.imported.length} data dosen.`,
        );
        setImportReview(null);
      } catch (error) {
        setImportMessage(error.message || "Impor data gagal.");
      } finally {
        setImportBusy(false);
      }
    };
    useEffect(() => {
      const handleScroll = () => {
        const activeElement = document.activeElement;
        if (
          activeElement?.closest?.(".mobile-filter-fab, .mobile-search-modal")
        )
          return;
        if (
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            activeElement?.tagName || "",
          ) ||
          activeElement?.isContentEditable
        )
          return;
        setMobileFiltersOpen(false);
        setMobileSearchOpen(false);
        setMobileFiltersVisible(false);
        window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(
          () => setMobileFiltersVisible(true),
          220,
        );
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        window.clearTimeout(scrollTimerRef.current);
      };
    }, []);
    useEffect(() => {
      if (!mobileSearchOpen) return;
      const focusTimer = window.setTimeout(
        () => mobileSearchInputRef.current?.focus(),
        80,
      );
      return () => window.clearTimeout(focusTimer);
    }, [mobileSearchOpen]);

    useEffect(() => {
      const el = tableContainerRef.current;
      if (!el) return;
      updateTableScrollMetrics();
      const onScroll = () => {
        updateTableScrollMetrics();
        if (
          topScrollRef.current &&
          Math.abs(topScrollRef.current.scrollLeft - el.scrollLeft) > 2
        ) {
          topScrollRef.current.scrollLeft = el.scrollLeft;
        }
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", updateTableScrollMetrics);
      return () => {
        el.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", updateTableScrollMetrics);
      };
    }, [rows]);
    const lecturerFilterControls = (
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SelectBox
            label="Gelar"
            value={degree}
            onChange={setDegree}
            options={uniq(lecturers.map((lecturer) => lecturer.degree))}
          />
          <SelectBox
            label="Bidang Keahlian"
            value={expertise}
            onChange={setExpertise}
            options={uniq(lecturers.flatMap((lecturer) => lecturer.expertise))}
          />
          <SelectBox
            label="Ketersediaan Slot"
            value={available}
            onChange={setAvailable}
            options={["0", "1", "2", "3", "4"]}
          />
          <SelectBox
            label="Kelas Terplot"
            value={plottedClasses}
            onChange={setPlottedClasses}
            options={["0", "1", "2", "3", "4"]}
          />
          <SelectBox
            label="Urutkan"
            value={sort}
            onChange={(value) => {
              setSort(value);
              setSortDirection("asc");
            }}
            options={["name", "id", "degree", "rating", "plotted", "available"]}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDegree("All");
                setExpertise("All");
                setAvailable("All");
                setPlottedClasses("All");
                setSort("name");
                setSortDirection("asc");
              }}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icons.x className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-[#627d98] mr-1">Filter Cepat:</span>
          <button
            type="button"
            onClick={() => {
              setAvailable("All");
              setDegree("All");
              setExpertise("All");
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              available === "All" && degree === "All" && expertise === "All"
                ? "bg-[#005baa] text-white shadow-2xs"
                : "bg-slate-100 text-[#4f6478] hover:bg-slate-200"
            }`}
          >
            Semua ({lecturers.length})
          </button>
          <button
            type="button"
            onClick={() => setAvailable("1")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              available === "1"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100"
            }`}
          >
            Tersedia 1 Slot
          </button>
          <button
            type="button"
            onClick={() => setAvailable("2")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              available === "2"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100"
            }`}
          >
            Tersedia 2+ Slot
          </button>
          <button
            type="button"
            onClick={() => setAvailable("0")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              available === "0"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Beban Penuh (0)
          </button>
        </div>

        {/* FKIP Expertise Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-[#627d98] mr-1 flex items-center gap-1">
            <Icons.graduation className="h-3 w-3 text-[#005baa]" />
            Kepakaran FKIP:
          </span>
          {[
            "Semua",
            "Kurikulum & Teknologi Pendidikan",
            "Evaluasi Pembelajaran",
            "Strategi Pembelajaran di SD",
            "Pendidikan Bahasa",
            "Matematika SD",
            "Pembelajaran PKn",
            "Pembelajaran Terpadu",
            "Penelitian Tindakan Kelas (PTK)",
            "Profesi Keguruan",
          ].map((item) => {
            const isActive =
              item === "Semua"
                ? expertise === "All"
                : String(expertise).toLowerCase().includes(item.toLowerCase());
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  if (item === "Semua") {
                    setExpertise("All");
                  } else {
                    const allExp = uniq(lecturers.flatMap((l) => l.expertise));
                    const match = allExp.find((e) =>
                      String(e).toLowerCase().includes(item.toLowerCase())
                    );
                    setExpertise(match || item);
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-[#005baa] text-white shadow-2xs"
                    : "bg-blue-50/70 text-[#1d4e89] border border-blue-200/70 hover:bg-blue-100/70"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    );
    const mobileLecturerFilterRail = (
      <div className="mobile-filter-fab__rail">
        <NativeFilterIconSelect
          label="Gelar"
          value={degree}
          onChange={setDegree}
          options={uniq(lecturers.map((lecturer) => lecturer.degree))}
          icon={Icons.graduation}
        />
        <NativeFilterIconSelect
          label="Bidang Keahlian"
          value={expertise}
          onChange={setExpertise}
          options={uniq(lecturers.flatMap((lecturer) => lecturer.expertise))}
          icon={Icons.book}
        />
        <NativeFilterIconSelect
          label="Urutkan"
          value={sort}
          onChange={(value) => {
            setSort(value);
            setSortDirection("asc");
          }}
          options={["name", "id", "degree", "rating", "plotted", "available"]}
          includeAll={false}
          icon={Icons.chart}
        />
        <button
          type="button"
          title="Reset Filter"
          aria-label="Reset filter"
          onClick={() => {
            setQuery("");
            setDegree("All");
            setExpertise("All");
            setAvailable("All");
            setPlottedClasses("All");
            setSort("name");
            setSortDirection("asc");
          }}
        >
          <Icons.x className="h-4 w-4" />
        </button>
      </div>
    );
    const openMobileSearch = () => {
      setMobileFiltersOpen(false);
      setMobileSearchOpen(true);
    };
    const remove = (id) => {
      if (onDiscardLecturerLabelChange?.(id) === false) return;
      onDeleteLecturer?.(id);
      setLecturers((prev) => prev.filter((lecturer) => lecturer.id !== id));
      setTermLecturers((prev) => prev.filter((lecturer) => lecturer.id !== id));
      setDeleteTarget(null);
    };
    const runExport = async (exporter) => {
      if (exportBusy) return;
      setExportBusy(true);
      setImportMessage("");
      try {
        const result = await exporter();
        if (!result) throw new Error("Tidak ada data untuk diekspor.");
        setImportMessage(
          result.cancelled
            ? "Ekspor dibatalkan."
            : `Ekspor dimulai: ${result.filename}`,
        );
      } catch (error) {
        setImportMessage(`Ekspor gagal: ${error.message || "Kesalahan tidak diketahui"}`);
      } finally {
        setExportBusy(false);
      }
    };
    return (
      <div className="space-y-5">
        <div className={`flex flex-wrap items-center justify-between gap-3 relative transition-all ${fileMenuOpen ? "z-50" : "z-20"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#4f6478]">
              Menampilkan <strong className="text-[#005baa]">{rows.length}</strong> dari {lecturers.length} Dosen
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleImport}
            />

            {/* Dropdown Menu: Aksi Berkas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFileMenuOpen((prev) => !prev)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                  fileMenuOpen
                    ? "border-[#005baa] bg-blue-50/70 text-[#005baa] ring-2 ring-[#005baa]/20 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-[#102f52]"
                }`}
                aria-expanded={fileMenuOpen}
              >
                <Icons.download className="h-4 w-4 text-[#005baa]" />
                <span>Aksi Berkas</span>
                <Icons.chevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${fileMenuOpen ? "rotate-180 text-[#005baa]" : "text-slate-400"}`} />
              </button>

              {fileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setFileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl shadow-slate-900/20 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-600">Impor & Ekspor Data</p>
                    </div>
                    <div className="p-1 space-y-1">
                      {!readOnly && canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setFileMenuOpen(false);
                            importInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#005baa] transition-colors cursor-pointer text-left group"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#005baa] group-hover:text-white transition-colors">
                            <Icons.upload className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 group-hover:text-[#005baa]">Impor CSV / XLSX</p>
                            <p className="text-[11px] font-normal text-slate-400 truncate">Unggah daftar dosen dari spreadsheet</p>
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setFileMenuOpen(false);
                          runExport(() => exportLecturersToXLSX(rows, courses));
                        }}
                        disabled={rows.length === 0 || exportBusy}
                        className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 cursor-pointer text-left group"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <Icons.file className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 group-hover:text-emerald-700">
                            {exportBusy ? "Menyiapkan ekspor..." : "Ekspor Data ke Excel"}
                          </p>
                          <p className="text-[11px] font-normal text-slate-400 truncate">Unduh seluruh profil & keahlian dosen</p>
                        </div>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setFileMenuOpen(false);
                          runExport(exportLecturerTemplateToXLSX);
                        }}
                        disabled={exportBusy}
                        className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-[#005baa] bg-blue-50/70 hover:bg-blue-100/90 transition-colors disabled:opacity-50 cursor-pointer text-left group"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#005baa] text-white shadow-2xs">
                          <Icons.download className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#005baa]">Unduh Template Excel</p>
                          <p className="text-[11px] font-normal text-blue-600/75 truncate">Format standar impor direktori dosen</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!readOnly && canEdit && (
              <Button
                className="h-11 px-4 font-bold shadow-xs"
                onClick={() => setModal({})}
              >
                <Icons.plus className="h-4 w-4" />
                Tambah Dosen
              </Button>
            )}
          </div>
        </div>
        {readOnly && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <Icons.eye className="h-4 w-4 text-slate-500 shrink-0" />
            <span><strong>Mode Hanya Lihat:</strong> Anda sedang melihat direktori dosen dalam mode pengamat. Penambahan, pengeditan, atau penghapusan data dibatasi untuk peran Administrator.</span>
          </div>
        )}
        {importMessage && (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-normal ${/^(Berhasil|Ekspor dimulai|Imported|Export started)/.test(importMessage) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
          >
            {importMessage}
          </p>
        )}
        <Card className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TextInput
                icon={Icons.search}
                value={query}
                onChange={setQuery}
                placeholder="Cari berdasarkan ID, nama, email, kepakaran, atau mata kuliah..."
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className={`sm:hidden flex items-center justify-center h-11 w-11 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                mobileFiltersOpen || degree !== "All" || expertise !== "All" || available !== "All" || plottedClasses !== "All"
                  ? "border-[#005baa] bg-blue-50 text-[#005baa] shadow-2xs font-bold"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title="Filter Lanjutan"
              aria-label="Filter Lanjutan"
            >
              <Icons.chart className="h-5 w-5" />
            </button>
          </div>
          <div className={mobileFiltersOpen ? "block" : "hidden sm:block"}>
            {lecturerFilterControls}
          </div>
        </Card>

        {/* Floating / Sticky Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/95 via-sky-50/95 to-indigo-50/95 px-4 py-3 shadow-md backdrop-blur-xs transition-all">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#005baa] text-xs font-bold text-white shadow-2xs">
                {selectedIds.size}
              </span>
              <div>
                <p className="text-xs font-bold text-[#102f52]">
                  {selectedIds.size} Dosen Terpilih
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isAllSelected
                    ? `Semua ${visibleRowIds.length} dosen pada filter saat ini telah dipilih.`
                    : `${selectedIds.size} dari ${visibleRowIds.length} dosen yang tampil telah dipilih.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={toggleSelectAll}
                className="!py-1.5 !px-3 !text-xs font-bold"
              >
                {isAllSelected ? "Batal Pilih Semua" : `Pilih Semua (${visibleRowIds.length})`}
              </Button>
              <Button
                variant="primary"
                onClick={() => setBulkEditOpen(true)}
                className="!py-1.5 !px-3 !text-xs font-bold"
              >
                <Icons.edit className="h-3.5 w-3.5" />
                Edit Terpilih ({selectedIds.size})
              </Button>
              <Button
                variant="danger"
                onClick={() => setBulkDeleteOpen(true)}
                className="!py-1.5 !px-3 !text-xs font-bold"
              >
                <Icons.trash className="h-3.5 w-3.5" />
                Hapus Terpilih ({selectedIds.size})
              </Button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
                title="Batalkan semua pilihan"
                aria-label="Batalkan pilihan"
              >
                <Icons.x className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <Card className="overflow-hidden border border-slate-200/80 shadow-xs">
          {/* Top Quick Scroll Control & View Mode Switcher (Desktop/Tablet) */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-xs font-bold text-[#005baa]">
                <Icons.users className="h-3.5 w-3.5" /> Tabel Dosen
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {tableViewMode === "unified"
                  ? "• 1 Layar Penuh: Semua data, keahlian & mata kuliah terplot tampil langsung tanpa geser"
                  : "• Format Spreadsheet 10 kolom (geser kanan/kiri)"}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTableViewMode("unified")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                    tableViewMode === "unified"
                      ? "bg-[#005baa] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#005baa]"
                  }`}
                  title="Tampilkan semua kolom dalam 1 layar tanpa menggeser tabel"
                >
                  <span>1 Layar Penuh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableViewMode("spreadsheet")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                    tableViewMode === "spreadsheet"
                      ? "bg-[#005baa] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#005baa]"
                  }`}
                  title="Tampilkan format tabel spreadsheet 10 kolom terpisah"
                >
                  <span>Spreadsheet (10 Kolom)</span>
                </button>
              </div>

              {tableViewMode === "spreadsheet" && (
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => scrollTable("left")}
                    disabled={!canScrollLeft}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      canScrollLeft
                        ? "text-[#005baa] hover:bg-blue-50"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                    title="Geser tabel ke kiri"
                    aria-label="Geser ke kiri"
                  >
                    <Icons.chevronLeft className="h-4 w-4" />
                    <span>Kiri</span>
                  </button>
                  <div className="h-3.5 w-px bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => scrollTable("right")}
                    disabled={!canScrollRight}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      canScrollRight
                        ? "text-[#005baa] hover:bg-blue-50"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                    title="Geser tabel ke kanan"
                    aria-label="Geser ke kanan"
                  >
                    <span>Kanan</span>
                    <Icons.chevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Card List (< 640px) */}
          <div className="block sm:hidden divide-y divide-slate-100 bg-white">
            {rows.map((lecturer) => {
              const initials =
                lecturer.name
                  .replace(/^(Dr\.|Drs\.|Dra\.|Prof\.)\s+/i, "")
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() || "")
                  .join("") || "DS";
              const isAvailable = Number(lecturer.available) > 0;
              const isSelected = selectedIds.has(lecturer.id);
              return (
                <div
                  key={lecturer.id}
                  className={`p-3.5 transition-colors ${
                    isSelected ? "bg-blue-50/70" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(lecturer.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-blue-500 cursor-pointer shrink-0"
                      aria-label={`Pilih ${lecturer.name}`}
                    />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#005baa] to-sky-400 text-xs font-bold text-white shadow-2xs">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-[#005baa] bg-blue-50 px-1.5 py-0.5 rounded">
                          {lecturer.id}
                        </span>
                        <Badge tone="slate" className="text-[10px] truncate max-w-[130px]">
                          {lecturer.degree || "-"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-bold text-sm text-[#102f52] leading-snug">
                        {lecturer.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 pl-6.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <RatingStars
                        rating={lecturer.rating}
                        onChange={(rating) => rateLecturer(lecturer.id, rating)}
                      />
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {lecturer.rating ? Number(lecturer.rating).toFixed(1) : "0.0"}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isAvailable
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {lecturer.plotted?.length || 0} Terplot · {lecturer.available || 0} Sedia
                    </span>
                  </div>

                  {lecturer.expertise && lecturer.expertise.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-6.5">
                      {lecturer.expertise.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {lecturer.plotted && lecturer.plotted.length > 0 && (
                    <div className="mt-1.5 pl-6.5">
                      <PlottedCourseBadges plotted={lecturer.plotted} courses={courses} />
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100/80 pt-2">
                    <button
                      type="button"
                      title="Lihat profil detail dosen"
                      onClick={() => setViewing(lecturer)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                    >
                      <Icons.eye className="h-4 w-4" />
                      <span>Profil</span>
                    </button>
                    <button
                      type="button"
                      title="Unduh Surat Tugas Tutorial PDF"
                      onClick={() => {
                        const currentTerm = (terms || []).find((t) => t.code === selectedTermCode) || terms?.[0];
                        if (typeof exportSuratTugasPDF === "function") {
                          exportSuratTugasPDF(lecturer, courses, currentTerm);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#005baa] hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Icons.file className="h-4 w-4" />
                      <span>Surat Tugas</span>
                    </button>
                    {!readOnly && canEdit && (
                      <>
                        <button
                          type="button"
                          title="Edit data dosen"
                          onClick={() => {
                            const directoryLecturer = directoryById.get(lecturer.id) || lecturer;
                            setModal({
                              ...directoryLecturer,
                              available: lecturer.available,
                              plotted: lecturer.plotted,
                              expertiseText: directoryLecturer.expertise.join(", "),
                            });
                          }}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Icons.edit className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          title="Hapus dosen"
                          onClick={() => setDeleteTarget(lecturer)}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                        >
                          <Icons.trash className="h-4 w-4" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Table Views (hidden on mobile) */}
          <div className="hidden sm:block">
            {tableViewMode === "unified" ? (
            <div className="w-full overflow-hidden">
              <table className="w-full text-left text-sm table-auto">
                <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600 border-b border-slate-200/80">
                  <tr>
                    <th className="px-3 py-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-blue-500 cursor-pointer"
                        title={isAllSelected ? "Batalkan pilihan semua" : "Pilih semua dosen tampil"}
                        aria-label="Pilih semua dosen"
                      />
                    </th>
                    <th className="px-4 py-3.5 w-[27%]">{sortHeader("Dosen & Profil", "name")}</th>
                    <th className="px-4 py-3.5 w-[16%]">{sortHeader("Status & Rating", "available")}</th>
                    <th className="px-4 py-3.5 w-[25%] font-bold">Bidang Keahlian</th>
                    <th className="px-4 py-3.5 w-[24%] font-bold">Mata Kuliah Terplot</th>
                    <th className="px-4 py-3.5 w-[8%] font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((lecturer) => {
                    const initials =
                      lecturer.name
                        .replace(/^(Dr\.|Drs\.|Dra\.|Prof\.)\s+/i, "")
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase() || "")
                        .join("") || "DS";
                    const isAvailable = Number(lecturer.available) > 0;
                    const isSelected = selectedIds.has(lecturer.id);
                    return (
                      <tr
                        key={lecturer.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50/70 hover:bg-blue-50/90"
                            : "hover:bg-blue-50/30"
                        }`}
                      >
                        {/* Checkbox per baris */}
                        <td className="px-3 py-3.5 align-top text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(lecturer.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-blue-500 cursor-pointer"
                            title={`Pilih ${lecturer.name || lecturer.id}`}
                            aria-label={`Pilih ${lecturer.name || lecturer.id}`}
                          />
                        </td>
                        {/* 1. Dosen & Profil */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#005baa] to-sky-400 text-xs font-bold text-white shadow-2xs mt-0.5">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-bold text-[#102f52] leading-snug text-sm">
                                  {lecturer.name}
                                </p>
                                {lecturer.degree && (
                                  <Badge tone="slate">{lecturer.degree}</Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#627d98]">
                                <span className="font-mono font-bold text-[#005baa] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60">
                                  {lecturer.id}
                                </span>
                                {lecturer.email && (
                                  <span className="truncate max-w-[160px]" title={lecturer.email}>
                                    {lecturer.email}
                                  </span>
                                )}
                                {lecturer.phone && (
                                  <span className="text-slate-400">• {lecturer.phone}</span>
                                )}
                              </div>
                              {lecturer.warning_note && (
                                <div className="mt-1.5">
                                  <WarningNotice note={lecturer.warning_note} />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Status & Rating */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold shadow-2xs ${
                                  isAvailable
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isAvailable ? "bg-emerald-500" : "bg-slate-400"
                                  }`}
                                />
                                {lecturer.available} Slot
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                ({lecturer.plotted.length} Terplot)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <RatingStars
                                rating={lecturer.rating}
                                onChange={(rating) => rateLecturer(lecturer.id, rating)}
                              />
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shadow-2xs">
                                {lecturer.rating ? `${Number(lecturer.rating).toFixed(1)}` : "0.0"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Bidang Keahlian */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {lecturer.expertise && lecturer.expertise.length > 0 ? (
                              lecturer.expertise.map((item) => (
                                <span
                                  key={item}
                                  className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-2xs leading-tight"
                                >
                                  {item}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">Belum diisi</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Mata Kuliah Terplot */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {lecturer.plotted && lecturer.plotted.length > 0 ? (
                              <PlottedCourseBadges
                                plotted={lecturer.plotted}
                                courses={courses}
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-2 py-0.5 text-xs text-slate-400 font-medium italic">
                                Belum ada alokasi
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Aksi */}
                        <td className="px-4 py-3.5 align-top text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title="Lihat profil detail dosen"
                              onClick={() => setViewing(lecturer)}
                              className="rounded-lg p-1.5 text-[#005baa] hover:bg-blue-50 transition"
                            >
                              <Icons.eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Unduh Surat Tugas Tutorial PDF"
                              onClick={() => {
                                const currentTerm = (terms || []).find((t) => t.code === selectedTermCode) || terms?.[0];
                                if (typeof exportSuratTugasPDF === "function") {
                                  exportSuratTugasPDF(lecturer, courses, currentTerm);
                                }
                              }}
                              className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition"
                            >
                              <Icons.file className="h-4 w-4" />
                            </button>
                            {!readOnly && canEdit && (
                              <>
                                <button
                                  type="button"
                                  title="Edit data dosen"
                                  onClick={() => {
                                    const directoryLecturer =
                                      directoryById.get(lecturer.id) || lecturer;
                                    setModal({
                                      ...directoryLecturer,
                                      available: lecturer.available,
                                      plotted: lecturer.plotted,
                                      expertiseText:
                                        directoryLecturer.expertise.join(", "),
                                    });
                                  }}
                                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                                >
                                  <Icons.edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Hapus dosen"
                                  onClick={() => setDeleteTarget(lecturer)}
                                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                                >
                                  <Icons.trash className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Spreadsheet 10-Column Mode with Horizontal Scroll & Sticky Aksi Column */
            <>
              {/* Synchronized Top Scrollbar */}
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-auto overflow-y-hidden border-b border-slate-200/70 bg-slate-100/50 [scrollbar-width:thin]"
                style={{ height: "12px" }}
                title="Geser kolom tabel (Scroll Bar Atas)"
              >
                <div style={{ width: `${tableScrollWidth}px`, height: "1px" }} />
              </div>

              {/* Table Container */}
              <div ref={tableContainerRef} className="overflow-x-auto relative">
                <table className="w-full min-w-[1060px] text-left text-sm">
                  <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600 border-b border-slate-200/80">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isSomeSelected;
                          }}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-blue-500 cursor-pointer"
                          title={isAllSelected ? "Batalkan pilihan semua" : "Pilih semua dosen tampil"}
                          aria-label="Pilih semua dosen"
                        />
                      </th>
                      <th className="px-3.5 py-3 w-20">{sortHeader("ID", "id")}</th>
                      <th className="px-3.5 py-3 w-16">{sortHeader("Gelar", "degree")}</th>
                      <th className="px-3.5 py-3 min-w-[190px]">{sortHeader("Nama Lengkap", "name")}</th>
                      <th className="px-3.5 py-3 w-28">{sortHeader("Rating", "rating")}</th>
                      <th className="px-3.5 py-3 min-w-[140px] font-bold">Catatan</th>
                      <th className="px-3.5 py-3 w-16 text-center">{sortHeader("Terplot", "plotted")}</th>
                      <th className="px-3.5 py-3 w-24 text-center">{sortHeader("Tersedia", "available")}</th>
                      <th className="px-3.5 py-3 min-w-[150px] font-bold">Keahlian</th>
                      <th className="px-3.5 py-3 min-w-[180px] font-bold">Mata Kuliah Terplot</th>
                      <th className="sticky right-0 z-20 bg-slate-50/98 backdrop-blur-xs px-3.5 py-3 w-28 font-bold text-center border-l border-slate-200/80 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)]">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((lecturer) => {
                      const initials =
                        lecturer.name
                          .replace(/^(Dr\.|Drs\.|Dra\.|Prof\.)\s+/i, "")
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase() || "")
                          .join("") || "DS";
                      const isAvailable = Number(lecturer.available) > 0;
                      const isSelected = selectedIds.has(lecturer.id);
                      return (
                        <tr
                          key={lecturer.id}
                          className={`group transition-colors ${
                            isSelected
                              ? "bg-blue-50/70 hover:bg-blue-50/90"
                              : "hover:bg-blue-50/30"
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(lecturer.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-blue-500 cursor-pointer"
                              title={`Pilih ${lecturer.name || lecturer.id}`}
                              aria-label={`Pilih ${lecturer.name || lecturer.id}`}
                            />
                          </td>
                          <td className="px-3.5 py-3 font-mono text-xs font-bold text-[#005baa]">
                            {lecturer.id}
                          </td>
                          <td className="px-3.5 py-3">
                            <Badge tone="slate">{lecturer.degree || "-"}</Badge>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#005baa] to-sky-400 text-xs font-bold text-white shadow-2xs">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-[#102f52] leading-snug">{lecturer.name}</p>
                                {(lecturer.email || lecturer.phone) && (
                                  <p className="text-[11px] text-[#627d98] font-normal">
                                    {lecturer.email || lecturer.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3">
                            <RatingStars
                              rating={lecturer.rating}
                              onChange={(rating) => rateLecturer(lecturer.id, rating)}
                            />
                          </td>
                          <td className="px-3.5 py-3">
                            <WarningNotice note={lecturer.warning_note} />
                          </td>
                          <td className="px-3.5 py-3 text-center font-semibold text-slate-700">
                            {lecturer.plotted.length}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold shadow-2xs ${
                                isAvailable
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isAvailable ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              {lecturer.available} Slot
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {lecturer.expertise.map((item) => (
                                <Badge key={item}>{item}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-xs font-normal text-slate-600">
                            <div className="flex max-w-xs flex-wrap gap-1">
                              <PlottedCourseBadges
                                plotted={lecturer.plotted}
                                courses={courses}
                              />
                            </div>
                          </td>
                          <td className="sticky right-0 z-10 bg-white/98 backdrop-blur-xs px-3.5 py-3 border-l border-slate-100 group-hover:bg-blue-50/98 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                title="Lihat profil detail dosen"
                                onClick={() => setViewing(lecturer)}
                                className="rounded-lg p-1.5 text-[#005baa] hover:bg-blue-50 transition"
                              >
                                <Icons.eye className="h-4 w-4" />
                              </button>
                              {!readOnly && canEdit && (
                                <>
                                  <button
                                    type="button"
                                    title="Edit data dosen"
                                    onClick={() => {
                                      const directoryLecturer =
                                        directoryById.get(lecturer.id) || lecturer;
                                      setModal({
                                        ...directoryLecturer,
                                        available: lecturer.available,
                                        plotted: lecturer.plotted,
                                        expertiseText:
                                          directoryLecturer.expertise.join(", "),
                                      });
                                    }}
                                    className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                                  >
                                    <Icons.edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Hapus dosen"
                                    onClick={() => setDeleteTarget(lecturer)}
                                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                                  >
                                    <Icons.trash className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
          {rows.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#005baa]">
                <Icons.search className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-[#102f52]">Tidak ada dosen yang cocok</h4>
              <p className="mt-1 text-xs text-[#627d98]">
                {query
                  ? `Tidak ditemukan data dosen dengan kata kunci "${query}".`
                  : "Silakan sesuaikan opsi filter untuk menampilkan data dosen."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDegree("All");
                  setExpertise("All");
                  setAvailable("All");
                  setPlottedClasses("All");
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#005baa] hover:bg-blue-100 transition"
              >
                <Icons.x className="h-3.5 w-3.5" />
                Reset Semua Filter
              </button>
            </div>
          )}
        </Card>
        {viewing && (
          <Modal title="Informasi Profil Dosen" onClose={() => setViewing(null)}>
            <LecturerInfoCard
              lecturer={viewing}
              courses={courses}
              selectedTermCode={selectedTermCode}
              onRatingChange={(rating) => rateLecturer(viewing.id, rating)}
            />
          </Modal>
        )}
        {modal && (
          <Modal
            title={modal.id ? "Edit Data Dosen" : "Tambah Dosen Baru"}
            onClose={() => setModal(null)}
          >
            <LecturerForm
              initial={modal.id ? modal : null}
              expertiseOptions={expertiseOptions}
              onSave={save}
              onClose={() => setModal(null)}
            />
          </Modal>
        )}
        {importReview && (
          <ImportReviewModal
            title="Tinjau Impor Data Dosen"
            summary={importReview.summary}
            issues={importReview.issues}
            previewRows={importReview.previewRows}
            onApply={applyImportReview}
            onClose={() => setImportReview(null)}
            busy={importBusy}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmation
            itemType="dosen"
            itemLabel={`${deleteTarget.name} (${deleteTarget.id})`}
            detail={`Tindakan ini akan menghapus dosen dari direktori dan dari alokasi plotting semester ${selectedTermCode || "aktif"}.`}
            onConfirm={() => remove(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
        {bulkDeleteOpen && (
          <BulkDeleteConfirmationModal
            selectedCount={selectedIds.size}
            selectedLecturers={selectedLecturersList}
            selectedTermCode={selectedTermCode}
            onConfirm={handleExecuteBulkDelete}
            onClose={() => setBulkDeleteOpen(false)}
          />
        )}
        {bulkEditOpen && (
          <BulkEditModal
            selectedCount={selectedIds.size}
            expertiseOptions={expertiseOptions}
            onSave={handleExecuteBulkEdit}
            onClose={() => setBulkEditOpen(false)}
          />
        )}
      </div>
    );
  }

  return { Dashboard, Lecturers };
}
