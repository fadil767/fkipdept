import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createAuthScreens } from "./features/AuthScreens.jsx";
import { TutorFormScreen } from "./features/TutorFormScreen.jsx";
import { createApprovalsFeature } from "./features/ApprovalsFeature.jsx";
import { createCatalogFeatures } from "./features/CatalogFeatures.jsx";
import { createDirectoryFeatures } from "./features/DirectoryFeatures.jsx";
import { createPlottingComponent } from "./features/Plotting.jsx";
import AccessibilityWidget from "./features/AccessibilityWidget.jsx";
import {
  LECTURER_CLASS_LIMIT,
  buildAutoPilotPlotting,
  buildRebalancedPlotting,
  calculatePlottingHealth,
  expertiseMatchesCourse,
  getLecturerRatingClassLimit,
} from "./lib/autoPilot.js";
import {
  USE_SUPABASE,
  PENDING_LECTURER_LABELS_STORAGE_KEY,
  applyTableChanges,
  buildTableChanges,
  clearPendingSync,
  clearStoredLecturerLabelChanges,
  createDatabaseSnapshotTools,
  discardStoredLecturerLabelChange,
  getAccessToken,
  getStoredLecturerLabelChanges,
  getStoredPendingSync,
  getStoredUserEmail,
  queueLecturerLabelChange,
  signIn,
  signOut,
  storePendingSync,
  syncTableChanges,
  updateLecturerLabels,
  upsertRows,
} from "./lib/database.js";
import { createImportExportTools } from "./lib/importExport.js";
import { runSelfTests } from "./lib/selfTests.js";
import { usePWA, InstallGuideModal } from "./lib/pwa.jsx";
import {
  initRealtimeManager,
  broadcastLocalChange,
  IS_SUPABASE_CONFIGURED,
} from "./lib/realtime.js";

function IconBase({ children, className = "h-5 w-5", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const Icons = {
  book: (p) => (
    <IconBase {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
    </IconBase>
  ),
  calendar: (p) => (
    <IconBase {...p}>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </IconBase>
  ),
  chevronDown: (p) => (
    <IconBase {...p}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  ),
  chevronLeft: (p) => (
    <IconBase {...p}>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  ),
  chevronRight: (p) => (
    <IconBase {...p}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  ),
  download: (p) => (
    <IconBase {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </IconBase>
  ),
  edit: (p) => (
    <IconBase {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  ),
  eye: (p) => (
    <IconBase {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  ),
  file: (p) => (
    <IconBase {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8" />
    </IconBase>
  ),
  graduation: (p) => (
    <IconBase {...p}>
      <path d="m22 10-10-5-10 5 10 5 10-5Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
      <path d="M22 10v6" />
    </IconBase>
  ),
  dashboard: (p) => (
    <IconBase {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </IconBase>
  ),
  logout: (p) => (
    <IconBase {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  ),
  cloud: (p) => (
    <IconBase {...p}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </IconBase>
  ),
  cloudOff: (p) => (
    <IconBase {...p}>
      <path d="m2 2 20 20M5.78 5.78a7 7 0 0 0-.78 3.22H9M12.5 19H9a7 7 0 0 1-5-2.09M22.61 16.9a4.5 4.5 0 0 0-4.83-5.83 7 7 0 0 0-7.39-4.85" />
    </IconBase>
  ),
  appInstall: (p) => (
    <IconBase {...p}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01M12 7v6M9 10l3 3 3-3" />
    </IconBase>
  ),
  menu: (p) => (
    <IconBase {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </IconBase>
  ),
  plus: (p) => (
    <IconBase {...p}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  ),
  search: (p) => (
    <IconBase {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </IconBase>
  ),
  star: (p) => (
    <IconBase {...p}>
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1L12 2Z" />
    </IconBase>
  ),
  swap: (p) => (
    <IconBase {...p}>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </IconBase>
  ),
  trash: (p) => (
    <IconBase {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </IconBase>
  ),
  users: (p) => (
    <IconBase {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  ),
  warning: (p) => (
    <IconBase {...p}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </IconBase>
  ),
  x: (p) => (
    <IconBase {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </IconBase>
  ),
  chart: (p) => (
    <IconBase {...p}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="5" width="3" height="12" />
    </IconBase>
  ),
  check: (p) => (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-5" />
    </IconBase>
  ),
  inbox: (p) => (
    <IconBase {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </IconBase>
  ),
  upload: (p) => (
    <IconBase {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </IconBase>
  ),
};

const department = {
  name: "Program Studi FKIP",
  email: "fkip@ecampus.ut.ac.id",
  subtitle: "Fakultas Keguruan & Ilmu Pendidikan",
};
const TUTOR_DATA_FORM_URL = "https://sl.ut.ac.id/kepakaran_fkip";
const DEMO_ACCOUNT = { email: "demo@fkip.ut.ac.id", password: "Demo@12345" };

const nav = [
  { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
  { id: "approvals", label: "Persetujuan", icon: Icons.inbox },
  { id: "lecturers", label: "Dosen", icon: Icons.users },
  { id: "plotting", label: "Plotting", icon: Icons.file },
  { id: "courses", label: "Mata Kuliah", icon: Icons.book },
  { id: "terms", label: "Semester", icon: Icons.calendar },
];
const dashboardPalette = [
  "#005baa",
  "#ffd23f",
  "#3d8bd6",
  "#f4b000",
  "#8fbbe8",
];
const DEFAULT_DEGREE_OPTIONS = ["Dr.", "M.Pd.", "M.Si.", "M.Ed.", "S.Pd.", "Prof. Dr.", "Ph.D."];
const DEFAULT_EXPERTISE_OPTIONS = [];

const uniq = (items) => [...new Set(items.filter(Boolean))];
const includes = (value, query) =>
  String(value || "")
    .toLowerCase()
    .includes(String(query || "").toLowerCase());
const lookupKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const compactLookupKey = (value) => lookupKey(value).replace(/[\s_-]+/g, "");
const findLecturerById = (lecturers, id) => {
  const normalizedId = lookupKey(id);
  const compactId = compactLookupKey(id);
  if (!normalizedId) return null;
  return (
    lecturers.find(
      (lecturer) =>
        lookupKey(lecturer.id) === normalizedId ||
        compactLookupKey(lecturer.id) === compactId,
    ) || null
  );
};
const courseTitleByCode = (courses, code) =>
  courses.find((course) => course.code === code)?.title || code;
const plottedCourseTitles = (lecturer, courses) =>
  lecturer.plotted.map((code) => courseTitleByCode(courses, code));
const plottedCourseCountLabel = (count) =>
  `${count} plotted ${count === 1 ? "course" : "courses"}`;
const termPlottingId = (termCode, lecturerId) => `${termCode}::${lecturerId}`;
const MAX_CLASS_ASSIGNMENTS_PER_COURSE = 999;
const COURSE_CLASS_PLANS_STORAGE_KEY = "ut_course_class_plans";
const SYNC_RETRY_INITIAL_DELAY = 2_000;
const SYNC_RETRY_MAX_DELAY = 60_000;

const DEMO_COURSES = [
  { code: "MKDK4001", title: "Pengantar Pendidikan", credits: 3 },
  { code: "MKDK4002", title: "Perkembangan Peserta Didik", credits: 2 },
  { code: "MKDK4005", title: "Profesi Keguruan", credits: 2 },
  { code: "PDGK4101", title: "Keterampilan Berbahasa Indonesia", credits: 3 },
  { code: "PDGK4105", title: "Strategi Pembelajaran di SD", credits: 3 },
  { code: "PDGK4108", title: "Matematika", credits: 4 },
  { code: "PDGK4201", title: "Pembelajaran PKn di SD", credits: 3 },
  { code: "PDGK4205", title: "Pembelajaran Terpadu di SD", credits: 2 },
  { code: "PDGK4301", title: "Evaluasi Pembelajaran di SD", credits: 2 },
  { code: "IDIK4008", title: "Penelitian Tindakan Kelas (PTK)", credits: 2 },
];
const DEMO_LECTURERS = [
  {
    id: "FKIP001",
    degree: "Prof. Dr.",
    name: "Prof. Dr. Hendra Setiawan, M.Pd.",
    email: "hendra.setiawan@fkip.ut.ac.id",
    phone: "0812-1100-2001",
    expertise: ["Strategi Pembelajaran di SD", "Penelitian Tindakan Kelas (PTK)", "Kurikulum & Pembelajaran"],
    plotted: ["PDGK4105", "IDIK4008"],
    available: 2,
    rating: 5,
    warning_note: "",
  },
  {
    id: "FKIP002",
    degree: "M.Pd.",
    name: "Dian Kartika Putri, S.Pd., M.Pd.",
    email: "dian.kartika@fkip.ut.ac.id",
    phone: "0812-1100-2002",
    expertise: ["Evaluasi Pembelajaran", "Profesi Keguruan"],
    plotted: ["MKDK4005", "PDGK4301"],
    available: 2,
    rating: 4,
    warning_note: "",
  },
  {
    id: "FKIP003",
    degree: "M.Ed.",
    name: "Bambang Prasetyo, M.Ed., Ph.D.",
    email: "bambang.prasetyo@fkip.ut.ac.id",
    phone: "0812-1100-2003",
    expertise: ["Pembelajaran Terpadu di SD", "Media & Teknologi Pembelajaran"],
    plotted: ["PDGK4205", "MKDK4001"],
    available: 2,
    rating: 4,
    warning_note: "",
  },
  {
    id: "FKIP004",
    degree: "Dr.",
    name: "Dr. Hj. Sri Wahyuni, M.Pd.",
    email: "sri.wahyuni@fkip.ut.ac.id",
    phone: "0812-1100-2004",
    expertise: ["Perkembangan Peserta Didik", "Pembelajaran PKn di SD"],
    plotted: ["MKDK4002", "PDGK4201"],
    available: 2,
    rating: 5,
    warning_note: "",
  },
  {
    id: "FKIP005",
    degree: "M.Si.",
    name: "Rizky Ramadhan, S.Pd., M.Si.",
    email: "rizky.ramadhan@fkip.ut.ac.id",
    phone: "0812-1100-2005",
    expertise: ["Pendidikan Matematika", "Evaluasi Pembelajaran"],
    plotted: ["PDGK4108", "PDGK4301"],
    available: 2,
    rating: 4,
    warning_note: "",
  },
  {
    id: "FKIP006",
    degree: "M.Pd.",
    name: "Anita Rahmawati, S.Pd., M.Pd.",
    email: "anita.rahmawati@fkip.ut.ac.id",
    phone: "0812-1100-2006",
    expertise: ["Keterampilan Berbahasa Indonesia SD", "Strategi Pembelajaran di SD"],
    plotted: ["PDGK4101", "PDGK4105"],
    available: 2,
    rating: 3,
    warning_note: "Perlu konfirmasi jadwal tutorial sebelum penambahan kelas.",
  },
  {
    id: "FKIP007",
    degree: "M.Pd.",
    name: "Ahmad Fauzi, S.Pd., M.Pd.",
    email: "ahmad.fauzi@fkip.ut.ac.id",
    phone: "0812-1100-2007",
    expertise: ["Profesi Keguruan", "Penelitian Tindakan Kelas (PTK)"],
    plotted: ["MKDK4005", "IDIK4008"],
    available: 2,
    rating: 4,
    warning_note: "",
  },
  {
    id: "FKIP008",
    degree: "M.Ed.",
    name: "Maya Anggraini, S.Pd., M.Ed.",
    email: "maya.anggraini@fkip.ut.ac.id",
    phone: "0812-1100-2008",
    expertise: ["Pembelajaran Terpadu di SD", "Pengantar Pendidikan"],
    plotted: ["MKDK4001", "PDGK4205"],
    available: 2,
    rating: 5,
    warning_note: "",
  },
];
const DEMO_TERMS = [
  {
    code: "DEMO-2026-1",
    name: "2026/2027 Ganjil - FKIP",
    ay: "2026/2027",
    semester: "Semester Ganjil",
    active: true,
  },
  {
    code: "DEMO-2025-2",
    name: "2025/2026 Genap - FKIP",
    ay: "2025/2026",
    semester: "Semester Genap",
    active: false,
  },
];
const DEMO_TERM_PLOTTINGS = DEMO_LECTURERS.map((lecturer) =>
  buildDemoTermPlotting("DEMO-2026-1", lecturer),
).concat([
  buildDemoTermPlotting("DEMO-2025-2", {
    ...DEMO_LECTURERS[0],
    plotted: ["PDGK4105"],
    available: 3,
  }),
  buildDemoTermPlotting("DEMO-2025-2", {
    ...DEMO_LECTURERS[1],
    plotted: ["PDGK4301"],
    available: 3,
  }),
  buildDemoTermPlotting("DEMO-2025-2", {
    ...DEMO_LECTURERS[2],
    plotted: ["PDGK4205"],
    available: 3,
  }),
  buildDemoTermPlotting("DEMO-2025-2", {
    ...DEMO_LECTURERS[3],
    plotted: ["MKDK4001"],
    available: 3,
  }),
]);
const DEMO_COURSE_CLASS_PLANS = {
  "DEMO-2026-1": {
    counts: {
      MKDK4001: 2,
      MKDK4002: 1,
      MKDK4005: 2,
      PDGK4101: 1,
      PDGK4105: 2,
      PDGK4108: 1,
      PDGK4201: 1,
      PDGK4205: 2,
      PDGK4301: 2,
      IDIK4008: 2,
    },
    assignments: {
      MKDK4001: ["FKIP003", "FKIP008"],
      MKDK4002: ["FKIP004"],
      MKDK4005: ["FKIP002", "FKIP007"],
      PDGK4101: ["FKIP006"],
      PDGK4105: ["FKIP001", "FKIP006"],
      PDGK4108: ["FKIP005"],
      PDGK4201: ["FKIP004"],
      PDGK4205: ["FKIP003", "FKIP008"],
      PDGK4301: ["FKIP002", "FKIP005"],
      IDIK4008: ["FKIP001", "FKIP007"],
    },
  },
  "DEMO-2025-2": {
    counts: { MKDK4001: 1, PDGK4105: 1, PDGK4205: 1, PDGK4301: 1 },
    assignments: {
      MKDK4001: ["FKIP003"],
      PDGK4105: ["FKIP001"],
      PDGK4205: ["FKIP003"],
      PDGK4301: ["FKIP002"],
    },
  },
};

function buildDemoTermPlotting(termCode, lecturer) {
  return {
    id: `${termCode}::${lecturer.id}`,
    term_code: termCode,
    lecturer_id: lecturer.id,
    plotted: Array.isArray(lecturer.plotted) ? lecturer.plotted : [],
    available: Number(lecturer.available ?? 0),
  };
}

function cloneDemoSnapshot() {
  return {
    lecturers: DEMO_LECTURERS.map(normalizeLecturer),
    courses: DEMO_COURSES.map((course) => ({ ...course })),
    terms: DEMO_TERMS.map((term) => ({ ...term })),
    termPlottings: DEMO_TERM_PLOTTINGS.map(normalizeTermPlotting),
  };
}

function cloneDemoCourseClassPlans() {
  return JSON.parse(JSON.stringify(DEMO_COURSE_CLASS_PLANS));
}

function toClassCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.min(
    MAX_CLASS_ASSIGNMENTS_PER_COURSE,
    Math.max(0, Math.floor(count)),
  );
}

function resizeCourseAssignments(assignments = [], value = 0) {
  const count = toClassCount(value);
  return Array.from({ length: count }, (_, index) => assignments[index] || "");
}

function swapAssignmentSlots(assignmentMap = {}, source, target) {
  const sourceAssignments = [...(assignmentMap[source.courseCode] || [])];
  const sameCourse = source.courseCode === target.courseCode;
  const targetAssignments = sameCourse
    ? sourceAssignments
    : [...(assignmentMap[target.courseCode] || [])];
  const sourceLecturerId = sourceAssignments[source.classIndex] || "";
  const targetLecturerId = targetAssignments[target.classIndex] || "";
  if (!sourceLecturerId || !targetLecturerId) return assignmentMap;

  sourceAssignments[source.classIndex] = targetLecturerId;
  targetAssignments[target.classIndex] = sourceLecturerId;
  return {
    ...assignmentMap,
    [source.courseCode]: sourceAssignments,
    [target.courseCode]: targetAssignments,
  };
}

function getPlottedCourseCounts(plotted = []) {
  return Object.entries(
    plotted.reduce((acc, code) => {
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {}),
  ).map(([code, count]) => ({ code, count }));
}

function PlottedCourseBadges({ plotted, courses }) {
  return getPlottedCourseCounts(plotted).map(({ code, count }) => (
    <Badge key={code} tone="slate">
      {courseTitleByCode(courses, code)}
      {count > 1 ? ` x${count}` : ""}
    </Badge>
  ));
}

function getStoredCourseClassPlans() {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(
      localStorage.getItem(COURSE_CLASS_PLANS_STORAGE_KEY) || "{}",
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeCourseClassPlans(rows = []) {
  return Object.fromEntries(
    rows
      .map((row) => [
        String(row.term_code || ""),
        {
          counts:
            row.counts && typeof row.counts === "object" ? row.counts : {},
          assignments:
            row.assignments && typeof row.assignments === "object"
              ? row.assignments
              : {},
        },
      ])
      .filter(([termCode]) => termCode),
  );
}

function serializeCourseClassPlans(courseClassPlans = {}, terms = []) {
  const termCodes = new Set(terms.map((term) => term.code));
  return Object.entries(courseClassPlans)
    .filter(([termCode]) => termCode && termCodes.has(termCode))
    .map(([termCode, plan]) => {
      const { counts, assignments } = getCoursePlanParts(
        { [termCode]: plan },
        termCode,
      );
      return { term_code: termCode, counts, assignments };
    });
}

function getCourseClassPlan(courseClassPlans, termCode) {
  const plan = courseClassPlans?.[termCode] || {};
  const counts =
    plan.counts && typeof plan.counts === "object" ? plan.counts : plan;
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([code]) => code !== "assignments")
      .map(([code, count]) => [code, toClassCount(count)]),
  );
}

function getCoursePlanParts(courseClassPlans, termCode) {
  const current = courseClassPlans?.[termCode] || {};
  return {
    counts:
      current.counts && typeof current.counts === "object"
        ? current.counts
        : Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== "assignments"),
          ),
    assignments:
      current.assignments && typeof current.assignments === "object"
        ? current.assignments
        : {},
  };
}

function countAssignmentsByCourse(lecturers, courses) {
  const courseCodes = new Set(courses.map((course) => course.code));
  return lecturers.reduce((acc, lecturer) => {
    lecturer.plotted
      .filter((code) => courseCodes.has(code))
      .forEach((code) => {
        acc[code] = (acc[code] || 0) + 1;
      });
    return acc;
  }, {});
}

function getCourseClassCounts(
  lecturers,
  courses,
  plannedCounts = {},
  assignmentMap = null,
) {
  const assignedCounts = countAssignmentsByCourse(lecturers, courses);
  return Object.fromEntries(
    courses.map((course) => [
      course.code,
      Math.max(
        toClassCount(plannedCounts[course.code]),
        assignedCounts[course.code] || 0,
        assignmentMap?.[course.code]?.length || 0,
      ),
    ]),
  );
}

function getCourseAssignmentMap(lecturers, courses) {
  const assignments = Object.fromEntries(
    courses.map((course) => [course.code, []]),
  );
  lecturers.forEach((lecturer) => {
    lecturer.plotted.forEach((code) => {
      if (assignments[code]) assignments[code].push(lecturer.id);
    });
  });
  return assignments;
}

function countLecturerAssignments(assignmentMap = {}, lecturerId) {
  if (!lecturerId) return 0;
  return Object.values(assignmentMap).reduce(
    (sum, ids) =>
      sum +
      (Array.isArray(ids) ? ids.filter((id) => id === lecturerId).length : 0),
    0,
  );
}

function getLecturerClassLimitLookup(lecturers = []) {
  return new Map(
    lecturers.map((lecturer) => [
      lecturer.id,
      getLecturerRatingClassLimit(lecturer),
    ]),
  );
}

function limitAssignmentMapByLecturer(assignmentMap = {}, lecturers = []) {
  const lecturerClassLimits = getLecturerClassLimitLookup(lecturers);
  const lecturerCounts = {};
  return Object.fromEntries(
    Object.entries(assignmentMap).map(([courseCode, ids]) => [
      courseCode,
      (Array.isArray(ids) ? ids : []).map((lecturerId) => {
        if (!lecturerId) return "";
        lecturerCounts[lecturerId] = lecturerCounts[lecturerId] || 0;
        if (
          lecturerCounts[lecturerId] >=
          (lecturerClassLimits.get(lecturerId) || LECTURER_CLASS_LIMIT)
        )
          return "";
        lecturerCounts[lecturerId] += 1;
        return lecturerId;
      }),
    ]),
  );
}

function mergeAssignmentMapWithLecturerLimit(
  baseAssignmentMap = {},
  incomingAssignmentMap = {},
  lecturers = [],
) {
  const incomingCourseCodes = new Set(Object.keys(incomingAssignmentMap));
  const lecturerClassLimits = getLecturerClassLimitLookup(lecturers);
  const lecturerCounts = {};
  Object.entries(baseAssignmentMap).forEach(([courseCode, ids]) => {
    if (incomingCourseCodes.has(courseCode)) return;
    (Array.isArray(ids) ? ids : []).forEach((lecturerId) => {
      if (lecturerId)
        lecturerCounts[lecturerId] = (lecturerCounts[lecturerId] || 0) + 1;
    });
  });
  const limitedIncoming = Object.fromEntries(
    Object.entries(incomingAssignmentMap).map(([courseCode, ids]) => [
      courseCode,
      (Array.isArray(ids) ? ids : []).map((lecturerId) => {
        if (!lecturerId) return "";
        lecturerCounts[lecturerId] = lecturerCounts[lecturerId] || 0;
        if (
          lecturerCounts[lecturerId] >=
          (lecturerClassLimits.get(lecturerId) || LECTURER_CLASS_LIMIT)
        )
          return "";
        lecturerCounts[lecturerId] += 1;
        return lecturerId;
      }),
    ]),
  );
  return { ...baseAssignmentMap, ...limitedIncoming };
}

function getCourseClassAssignmentPlan(
  courseClassPlans,
  termCode,
  lecturers,
  courses,
) {
  const plan = courseClassPlans?.[termCode] || {};
  const storedAssignments =
    plan.assignments && typeof plan.assignments === "object"
      ? plan.assignments
      : {};
  const fallbackAssignments = getCourseAssignmentMap(lecturers, courses);
  const lecturerIds = new Set(lecturers.map((lecturer) => lecturer.id));
  return Object.fromEntries(
    courses.map((course) => {
      const stored = Array.isArray(storedAssignments[course.code])
        ? storedAssignments[course.code]
            .map((id) => String(id || ""))
            .filter((id) => !id || lecturerIds.has(id))
        : null;
      return [
        course.code,
        stored?.some(Boolean)
          ? stored
          : fallbackAssignments[course.code] || stored || [],
      ];
    }),
  );
}

function applyCourseAssignmentsToLecturers(lecturers, courses, assignmentMap) {
  const courseCodes = new Set(courses.map((course) => course.code));
  const plottedByLecturer = new Map(
    lecturers.map((lecturer) => [
      lecturer.id,
      lecturer.plotted.filter((code) => !courseCodes.has(code)),
    ]),
  );
  courses.forEach((course) => {
    (assignmentMap[course.code] || []).forEach((lecturerId) => {
      if (!lecturerId || !plottedByLecturer.has(lecturerId)) return;
      plottedByLecturer.get(lecturerId).push(course.code);
    });
  });
  return lecturers.map((lecturer) => ({
    ...lecturer,
    plotted: plottedByLecturer.get(lecturer.id) || [],
  }));
}

function buildPlottingExportRows(
  lecturers,
  courses,
  plannedCounts = {},
  assignmentMap = null,
) {
  const assignments =
    assignmentMap || getCourseAssignmentMap(lecturers, courses);
  const counts = getCourseClassCounts(
    lecturers,
    courses,
    plannedCounts,
    assignments,
  );
  const lecturersById = new Map(
    lecturers.map((lecturer) => [lecturer.id, lecturer]),
  );
  return courses.flatMap((course) =>
    Array.from({ length: counts[course.code] || 0 }, (_, index) => {
      const lecturer = lecturersById.get(assignments[course.code]?.[index]);
      return {
        "": "",
        Idtutor: lecturer?.id || "",
        Nama: lecturer?.name || "",
        Kelas: `${course.code}.${index + 1}`,
        "Nama MK": course.title,
      };
    }),
  );
}

function getCourseCodeFromClass(value) {
  return String(value || "")
    .trim()
    .split(".")[0];
}

function mapImportedPlottingRows(rows, lecturers, courses) {
  const lecturerIds = new Set(lecturers.map((lecturer) => lecturer.id));
  const lecturersByName = new Map(
    lecturers.map((lecturer) => [lecturer.name.toLowerCase(), lecturer]),
  );
  const coursesByCode = new Map(courses.map((course) => [course.code, course]));
  const coursesByTitle = new Map(
    courses.map((course) => [course.title.toLowerCase(), course]),
  );
  const assignments = {};
  const counts = {};
  const ignored = { courses: new Set(), lecturers: new Set() };

  rows
    .filter((row) => !isImportRowBlank(row))
    .forEach((row) => {
      const className = String(
        getImportedValue(row, ["Kelas", "Class"]),
      ).trim();
      const importedCourseCode = String(
        getImportedValue(row, [
          "Course_Code",
          "Course Code",
          "CourseCode",
          "Code",
          "Course",
        ]),
      ).trim();
      const courseName = String(
        getImportedValue(row, [
          "Nama MK",
          "Course Name",
          "Course Title",
          "Course",
        ]),
      ).trim();
      const importedLecturerId = String(
        getImportedValue(row, ["Idtutor", "Lecturer_ID", "Lecturer ID", "ID"]),
      ).trim();
      const lecturerName = String(
        getImportedValue(row, ["Nama", "Name", "Full Name"]),
      ).trim();
      const lecturerId = lecturerIds.has(importedLecturerId)
        ? importedLecturerId
        : lecturersByName.get(lecturerName.toLowerCase())?.id ||
          importedLecturerId;
      const courseCode =
        getCourseCodeFromClass(className) || importedCourseCode;
      const course =
        coursesByCode.get(courseCode) ||
        coursesByCode.get(courseName) ||
        coursesByTitle.get(courseName.toLowerCase());
      if (!course) {
        ignored.courses.add(courseCode || courseName || "blank course");
        return;
      }
      if (lecturerId && !lecturerIds.has(lecturerId)) {
        ignored.lecturers.add(lecturerId);
        return;
      }
      const classNumber = Number(className.split(".")[1]);
      const index =
        Number.isFinite(classNumber) && classNumber > 0
          ? Math.floor(classNumber) - 1
          : (assignments[course.code] || []).length;
      assignments[course.code] = assignments[course.code] || [];
      assignments[course.code][index] = lecturerId;
      counts[course.code] = Math.max(counts[course.code] || 0, index + 1);
    });

  return {
    assignments: Object.fromEntries(
      Object.entries(assignments).map(([code, ids]) => [
        code,
        Array.from(
          { length: counts[code] || ids.length },
          (_, index) => ids[index] || "",
        ),
      ]),
    ),
    counts,
    ignoredCourses: Array.from(ignored.courses),
    ignoredLecturers: Array.from(ignored.lecturers),
  };
}

function normalizeLecturer(row) {
  return {
    id: String(row.id || "").trim(),
    degree: String(row.degree || "").trim(),
    name: String(row.name || "").trim(),
    email: String(row.email || "").trim(),
    phone: String(row.phone || "").trim(),
    expertise: Array.isArray(row.expertise) ? row.expertise : [],
    plotted: Array.isArray(row.plotted) ? row.plotted : [],
    available: Number(row.available ?? 0),
    rating: clampRating(row.rating),
    warning_note: String(row.warning_note || row.warningNote || "").trim(),
  };
}

function mergeImportedLecturer(existing = {}, imported = {}) {
  return normalizeLecturer({
    ...existing,
    id: imported.id || existing.id,
    degree: imported.degree || existing.degree,
    name: imported.name || existing.name,
    email: imported.email || existing.email,
    phone: imported.phone || existing.phone,
    expertise: imported.expertise?.length
      ? imported.expertise
      : existing.expertise,
    plotted: imported.plotted?.length ? imported.plotted : existing.plotted,
    available: imported._hasImportedAvailable
      ? imported.available
      : (existing.available ?? imported.available),
    rating: imported._hasImportedRating
      ? imported.rating
      : (existing.rating ?? imported.rating),
    warning_note: imported._hasImportedWarningNote
      ? imported.warning_note
      : (existing.warning_note ?? imported.warning_note),
  });
}

function dedupeImportedLecturers(items) {
  const byId = new Map();
  items.forEach((item) => {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }
    const merged = normalizeLecturer({
      ...existing,
      degree: item.degree || existing.degree,
      name: item.name || existing.name,
      email: item.email || existing.email,
      phone: item.phone || existing.phone,
      expertise: uniq([
        ...(existing.expertise || []),
        ...(item.expertise || []),
      ]),
      plotted: uniq([...(existing.plotted || []), ...(item.plotted || [])]),
      available: item._hasImportedAvailable
        ? item.available
        : existing.available,
      rating: item._hasImportedRating ? item.rating : existing.rating,
      warning_note: item._hasImportedWarningNote
        ? item.warning_note
        : existing.warning_note,
    });
    byId.set(item.id, {
      ...merged,
      _hasImportedAvailable:
        existing._hasImportedAvailable || item._hasImportedAvailable,
      _hasImportedRating:
        existing._hasImportedRating || item._hasImportedRating,
      _hasImportedWarningNote:
        existing._hasImportedWarningNote || item._hasImportedWarningNote,
    });
  });
  return Array.from(byId.values());
}

function normalizeTermPlotting(row) {
  return {
    id: row.id || termPlottingId(row.term_code, row.lecturer_id),
    term_code: row.term_code,
    lecturer_id: row.lecturer_id,
    plotted: Array.isArray(row.plotted) ? row.plotted : [],
    available: Number(row.available ?? 0),
  };
}

function buildTermPlottingRow(termCode, lecturer) {
  return {
    id: termPlottingId(termCode, lecturer.id),
    term_code: termCode,
    lecturer_id: lecturer.id,
    plotted: Array.isArray(lecturer.plotted) ? lecturer.plotted : [],
    available: Number(lecturer.available ?? 0),
  };
}

function getTermScopedLecturers(lecturers, termPlottings, termCode) {
  const rows = new Map(
    termPlottings
      .filter((row) => row.term_code === termCode)
      .map((row) => [row.lecturer_id, row]),
  );
  return lecturers.map((lecturer) => {
    const termRow = rows.get(lecturer.id);
    return {
      ...lecturer,
      plotted: termRow?.plotted || lecturer.plotted || [],
      available: Number(termRow?.available ?? lecturer.available ?? 0),
    };
  });
}

function availabilityTone(value) {
  const n = Number(value);
  if (n <= 0) return "red";
  if (n === 1) return "orange";
  if (n === 2) return "amber";
  if (n === 3) return "blue";
  return "green";
}

function clampRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

function serializeLecturersForDatabase(lecturers, includeLabels = false) {
  return lecturers.map((lecturer) => {
    const row = { ...lecturer };
    if (!includeLabels) {
      delete row.rating;
      delete row.warning_note;
    }
    return row;
  });
}

function mergeRowsByKey(serverRows = [], localRows = [], key) {
  const merged = new Map(serverRows.map((row) => [row[key], row]));
  localRows.forEach((row) => merged.set(row[key], row));
  return Array.from(merged.values());
}

function createSyncSnapshot({
  lecturers = [],
  courses = [],
  terms = [],
  termPlottings = [],
  courseClassPlans = {},
}) {
  return {
    lecturers: serializeLecturersForDatabase(lecturers, false),
    courses,
    terms,
    termPlottings,
    courseClassPlans: serializeCourseClassPlans(courseClassPlans, terms),
  };
}

function buildSyncChanges(baseline, snapshot) {
  return {
    lecturers: buildTableChanges(
      baseline?.lecturers,
      snapshot.lecturers,
      "id",
    ),
    courses: buildTableChanges(baseline?.courses, snapshot.courses, "code"),
    terms: buildTableChanges(baseline?.terms, snapshot.terms, "code"),
    termPlottings: buildTableChanges(
      baseline?.termPlottings,
      snapshot.termPlottings,
      "id",
    ),
    courseClassPlans: buildTableChanges(
      baseline?.courseClassPlans,
      snapshot.courseClassPlans,
      "term_code",
    ),
  };
}

function hasSyncChanges(changes = {}) {
  return Object.values(changes).some(
    (change) =>
      change?.creates?.length ||
      change?.updates?.length ||
      change?.deletes?.length,
  );
}

function restorePendingSnapshot(serverSnapshot, pendingPayload) {
  if (pendingPayload?.version === 2 && pendingPayload.changes) {
    const serverSyncSnapshot = createSyncSnapshot(serverSnapshot);
    const restoredLecturerCore = applyTableChanges(
      serverSyncSnapshot.lecturers,
      pendingPayload.changes.lecturers,
      "id",
    );
    return {
      lecturers: mergeServerLecturerLabels(
        restoredLecturerCore.map(normalizeLecturer),
        serverSnapshot.lecturers,
      ),
      courses: applyTableChanges(
        serverSnapshot.courses,
        pendingPayload.changes.courses,
        "code",
      ),
      terms: applyTableChanges(
        serverSnapshot.terms,
        pendingPayload.changes.terms,
        "code",
      ),
      termPlottings: applyTableChanges(
        serverSnapshot.termPlottings,
        pendingPayload.changes.termPlottings,
        "id",
      ),
      courseClassPlans: normalizeCourseClassPlans(
        applyTableChanges(
          serverSyncSnapshot.courseClassPlans,
          pendingPayload.changes.courseClassPlans,
          "term_code",
        ),
      ),
    };
  }

  const legacy = pendingPayload || {};
  return {
    lecturers: mergeServerLecturerLabels(
      mergeRowsByKey(
        serverSnapshot.lecturers,
        legacy.lecturers || [],
        "id",
      ),
      serverSnapshot.lecturers,
    ),
    courses: mergeRowsByKey(
      serverSnapshot.courses,
      legacy.courses || [],
      "code",
    ),
    terms: mergeRowsByKey(
      serverSnapshot.terms,
      legacy.terms || [],
      "code",
    ),
    termPlottings: mergeRowsByKey(
      serverSnapshot.termPlottings,
      legacy.termPlottings || [],
      "id",
    ),
    courseClassPlans: {
      ...serverSnapshot.courseClassPlans,
      ...(legacy.courseClassPlans || {}),
    },
  };
}

function applyLecturerLabelChanges(lecturers = [], changes = {}) {
  return lecturers.map((lecturer) => {
    const pending = changes[lecturer.id];
    if (!pending) return lecturer;
    return {
      ...lecturer,
      ...(Object.hasOwn(pending, "rating")
        ? { rating: clampRating(pending.rating) }
        : {}),
      ...(Object.hasOwn(pending, "warning_note")
        ? { warning_note: String(pending.warning_note || "").trim() }
        : {}),
    };
  });
}

function mergeServerLecturerLabels(lecturers = [], serverLecturers = []) {
  const serverById = new Map(
    serverLecturers.map((lecturer) => [lecturer.id, lecturer]),
  );
  return lecturers.map((lecturer) => {
    const server = serverById.get(lecturer.id);
    return server
      ? {
          ...lecturer,
          rating: server.rating,
          warning_note: server.warning_note,
        }
      : lecturer;
  });
}

function buildLecturerExportRows(lecturers, courses) {
  return lecturers.map((lecturer) => ({
    Lecturer_ID: lecturer.id,
    Name: lecturer.name,
    Degree: lecturer.degree,
    Email: lecturer.email,
    Phone: lecturer.phone,
    Rating: lecturer.rating,
    Warning_Note: lecturer.warning_note,
    Expertise: lecturer.expertise.join("; "),
    Plotted_Course_Codes: lecturer.plotted.join("; "),
    Plotted_Course_Names: plottedCourseTitles(lecturer, courses).join("; "),
    Available_Slots: lecturer.available,
  }));
}

const LECTURER_EXPORT_COLUMNS = [
  "Lecturer_ID",
  "Name",
  "Degree",
  "Email",
  "Phone",
  "Rating",
  "Warning_Note",
  "Expertise",
  "Plotted_Course_Codes",
  "Plotted_Course_Names",
  "Available_Slots",
];

function buildLecturerTemplateRows() {
  return [
    Object.fromEntries(LECTURER_EXPORT_COLUMNS.map((column) => [column, ""])),
  ];
}

function buildPlottingTemplateRows() {
  return [
    {
      Idtutor: "FKIP001",
      Nama: "Prof. Dr. Hendra Setiawan, M.Pd.",
      Kelas: "PDGK4105.1",
      "Nama MK": "Strategi Pembelajaran di SD",
    },
    {
      Idtutor: "FKIP002",
      Nama: "Dian Kartika Putri, S.Pd., M.Pd.",
      Kelas: "MKDK4005.1",
      "Nama MK": "Profesi Keguruan",
    },
    {
      Idtutor: "",
      Nama: "",
      Kelas: "MKDK4001.1",
      "Nama MK": "Pengantar Pendidikan",
    },
  ];
}

const {
  exportLecturersToXLSX,
  exportLecturerTemplateToXLSX,
  exportPlottingToXLSX,
  exportPlottingTemplateToXLSX,
  exportPlottingToPDF,
  parseCSV,
  rowsToObjects,
  parseXLSX,
  splitList,
  getImportedValue,
  isImportRowBlank,
  mapImportedLecturers,
} = createImportExportTools({
  buildLecturerExportRows,
  buildLecturerTemplateRows,
  buildPlottingExportRows,
  buildPlottingTemplateRows,
  normalizeLecturer,
});

const {
  fetchDatabaseSnapshot,
  fetchPublicDatabaseSnapshot,
  fetchLecturerLabelColumnSupport,
} = createDatabaseSnapshotTools({
  normalizeCourseClassPlans,
  normalizeLecturer,
  normalizeTermPlotting,
});

runSelfTests({
  LECTURER_CLASS_LIMIT,
  LECTURER_EXPORT_COLUMNS,
  USE_SUPABASE,
  applyTableChanges,
  applyLecturerLabelChanges,
  availabilityTone,
  buildAutoPilotPlotting,
  buildRebalancedPlotting,
  buildTableChanges,
  buildLecturerExportRows,
  buildLecturerTemplateRows,
  buildPlottingExportRows,
  buildTermPlottingRow,
  calculatePlottingHealth,
  cloneDemoSnapshot,
  countLecturerAssignments,
  dedupeImportedLecturers,
  expertiseMatchesCourse,
  findLecturerById,
  getCourseAssignmentMap,
  getCourseClassCounts,
  getPlottedCountData,
  getTermScopedLecturers,
  limitAssignmentMapByLecturer,
  mapImportedPlottingRows,
  mergeImportedLecturer,
  mergeServerLecturerLabels,
  normalizeCourseClassPlans,
  plottedCourseCountLabel,
  plottedCourseTitles,
  resizeCourseAssignments,
  serializeCourseClassPlans,
  serializeLecturersForDatabase,
  swapAssignmentSlots,
});

function getPlottedCountData(lecturers) {
  return Object.entries(
    lecturers.reduce((acc, lecturer) => {
      const label = plottedCourseCountLabel(lecturer.plotted.length);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
}

function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-[#005baa] to-[#006ec9] text-white hover:from-[#004a8a] hover:to-[#005baa] shadow-sm shadow-[#005baa]/25 hover:shadow-md hover:shadow-[#005baa]/30 active:scale-[0.98]",
    secondary:
      "bg-white text-[#102f52] border border-slate-200/90 hover:bg-[#f4f9ff] hover:border-blue-200 hover:text-[#005baa] shadow-2xs active:scale-[0.98]",
    ghost:
      "bg-transparent text-[#315577] hover:bg-[#eef5ff] hover:text-[#005baa] active:scale-[0.98]",
    danger:
      "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-[0.98]",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "blue" }) {
  const tones = {
    red: "bg-rose-50 text-rose-700 border-rose-200/80 font-medium",
    orange: "bg-orange-50 text-orange-700 border-orange-200/80 font-medium",
    amber: "bg-amber-50 text-amber-800 border-amber-200/80 font-medium",
    blue: "bg-sky-50 text-[#005baa] border-sky-200/80 font-medium",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200/80 font-medium",
    slate: "bg-slate-100/90 text-slate-700 border-slate-200 font-medium",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs tracking-wide shadow-2xs ${tones[tone] || tones.blue}`}
    >
      {children}
    </span>
  );
}

function RatingStars({ rating = 0, showEmpty = true, onChange }) {
  const value = clampRating(rating);
  if (!showEmpty && value === 0) return null;
  const stars = Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    const selected = index < value;
    const star = (
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 drop-shadow-2xs transition-transform ${selected ? "text-[#f59e0b] scale-105" : "text-slate-200"}`}
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1L12 2Z"
        />
      </svg>
    );
    if (!onChange) return <span key={starValue}>{star}</span>;
    const nextValue = value === starValue ? 0 : starValue;
    return (
      <button
        key={starValue}
        type="button"
        onClick={() => onChange(nextValue)}
        className="rounded p-0.5 transition hover:bg-amber-50 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label={
          value === starValue
            ? "Clear rating"
            : `Set rating to ${starValue} of 5`
        }
        title={
          value === starValue ? "Clear rating" : `Set rating to ${starValue}`
        }
      >
        {star}
      </button>
    );
  });
  return (
    <span
      className="rating-stars inline-flex items-center gap-0.5"
      aria-label={`${value} of 5 rating`}
    >
      {stars}
    </span>
  );
}

function WarningNotice({ note }) {
  if (!String(note || "").trim()) return null;
  return (
    <span
      className="inline-flex max-w-xs items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-800 shadow-2xs"
      title={note}
    >
      <Icons.warning className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      <span className="truncate">{note}</span>
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/95 shadow-xs shadow-slate-900/3 backdrop-blur-xs transition-shadow duration-200 hover:shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function TextInput({
  icon: Icon,
  value = "",
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 shadow-2xs transition-colors focus-within:border-[#005baa] focus-within:ring-2 focus-within:ring-[#005baa]/15">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[#6f90af]" />}
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        type={type}
        className="w-full bg-transparent text-sm font-medium text-[#102f52] outline-none placeholder:text-[#8aa0b6]"
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.("")}
          className="rounded p-0.5 text-slate-400 hover:text-slate-600"
          title="Clear"
        >
          <Icons.x className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const FILTER_OPTION_TRANSLATIONS = {
  All: "Semua",
  name: "Nama",
  id: "ID",
  degree: "Gelar",
  rating: "Penilaian",
  plotted: "Terplot",
  available: "Tersedia",
  code: "Kode",
  title: "Judul",
  credits: "SKS",
  ay: "Tahun Akademik",
  semester: "Semester",
  active: "Aktif",
  inactive: "Tidak Aktif",
};

function SelectBox({ label, value, onChange, options = [] }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f6478]">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
        >
          <option value="All">Semua</option>
          {options
            .filter((option) => option !== "All")
            .map((option) => (
              <option key={option} value={option}>
                {FILTER_OPTION_TRANSLATIONS[option] || option}
              </option>
            ))}
        </select>
        <Icons.chevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#6f90af]" />
      </div>
    </label>
  );
}

const filterOptionLabel = (option) =>
  FILTER_OPTION_TRANSLATIONS[option] ||
  (String(option) === "id"
    ? "ID"
    : String(option).replace(/\b\w/g, (char) => char.toUpperCase()));

function NativeFilterIconSelect({
  label,
  value,
  onChange,
  options = [],
  includeAll = true,
  icon: Icon,
}) {
  const items = uniq([...(includeAll ? ["All"] : []), ...options]);
  return (
    <span
      className={`mobile-native-filter-select ${String(value) !== "All" ? "is-active" : ""}`}
      title={label}
      aria-label={label}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {items.map((option) => (
          <option key={option} value={option}>
            {filterOptionLabel(option)}
          </option>
        ))}
      </select>
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="mobile-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="mobile-modal__panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-900/15"
      >
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-3.5">
          <h2 className="font-display text-xl font-extrabold text-[#102f52]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icons.x className="h-5 w-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function DeleteConfirmation({
  itemType,
  itemLabel,
  detail,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={`Hapus ${itemType}?`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4">
          <p className="font-bold text-rose-900">{itemLabel}</p>
          <p className="mt-1 text-sm leading-6 text-rose-700">
            {detail ||
              "Tindakan ini akan menghapus data dan relasi plotting terkait."}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 font-medium">
          Tindakan ini disinkronkan ke database dan tidak dapat dibatalkan dari
          halaman ini.
        </p>
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            <Icons.trash className="h-4 w-4" />
            Hapus {itemType}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportReviewModal({
  title,
  summary,
  issues = [],
  previewRows = [],
  onApply,
  onClose,
  busy = false,
}) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {summary.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border p-4 ${item.tone === "error" ? "border-rose-200 bg-rose-50" : item.tone === "warn" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 font-display">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        {issues.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
              Rincian Validasi
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs leading-5 text-amber-900 font-medium">
              {issues.map((issue, index) => (
                <li
                  key={`${issue}-${index}`}
                  className="rounded-lg bg-white/80 border border-amber-200/50 px-3 py-2 shadow-2xs"
                >
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Baris data siap diterapkan
            </p>
          </div>
          <div className="max-h-56 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  {Object.keys(previewRows[0] || {}).map((key) => (
                    <th key={key} className="px-3 py-2.5 font-bold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.slice(0, 20).map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    {Object.values(row).map((value, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="max-w-56 truncate px-3 py-2 text-slate-700"
                      >
                        {Array.isArray(value)
                          ? value.join(", ")
                          : String(value ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!previewRows.length && (
              <p className="p-4 text-xs text-slate-500">
                Tidak ada baris data valid yang dapat diterapkan.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button onClick={onApply} disabled={busy || !previewRows.length}>
            {busy ? "Menerapkan..." : "Terapkan baris data"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PlainInput({
  label,
  value = "",
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-bold text-[#4f6478]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
      />
    </label>
  );
}

function PlainTextarea({ label, value = "", onChange, placeholder }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-bold text-[#4f6478]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
      />
    </label>
  );
}

function PlainSelect({ label, value = "", onChange, options = [] }) {
  const items = uniq(options);
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-bold text-[#4f6478]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm font-medium text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
        >
          {items.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Icons.chevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#6f90af]" />
      </div>
    </label>
  );
}

function ExpertiseSelect({ label, value = [], onChange, options = [] }) {
  const selected = Array.isArray(value) ? value : splitList(value);
  const [baseOptions] = useState(() => uniq([...options, ...selected]));
  const available = uniq([...baseOptions, ...options, ...selected]);
  const remaining = available.filter((option) => !selected.includes(option));
  const addExpertise = (item) => {
    if (!item) return;
    onChange(uniq([...selected, item]));
  };
  const removeExpertise = (item) =>
    onChange(selected.filter((option) => option !== item));
  return (
    <div className="space-y-2">
      <label className="space-y-1.5 block">
        <span className="text-xs font-bold text-[#4f6478]">{label}</span>
        <div className="relative">
          <select
            value=""
            onChange={(event) => addExpertise(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm font-medium text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
          >
            <option value="" disabled>
              {remaining.length ? "Pilih keahlian" : "Semua keahlian telah dipilih"}
            </option>
            {remaining.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Icons.chevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#6f90af]" />
        </div>
      </label>
      <div className="flex min-h-9 flex-wrap gap-1.5">
        {selected.length ? (
          selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-2xs"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeExpertise(item)}
                aria-label={`Hapus ${item}`}
                className="rounded text-sky-600 hover:text-sky-900 transition-colors cursor-pointer"
              >
                <Icons.x className="h-3 w-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-400 italic">Belum ada keahlian dipilih</span>
        )}
      </div>
    </div>
  );
}

function FormGrid({ children }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function TopNavigation({
  active,
  setActive,
  onLogout,
  pendingCount = 0,
  terms = [],
  selectedTermCode,
  setSelectedTermCode,
  dbStatus,
  syncState,
  userEmail,
  isDemoSession,
  handleSaveNow,
  saveNowDisabled,
  pendingLecturerLabelCount = 0,
  isOnline = true,
  realtimeStatus = { status: "CONNECTED", mode: "local" },
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const termSelectValue = terms.some((term) => term.code === selectedTermCode)
    ? selectedTermCode
    : terms[0]?.code || "";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-1.5 sm:gap-2 lg:gap-3 2xl:gap-4 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <img
            src="/logo.png"
            alt="Universitas Terbuka"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 object-contain drop-shadow-2xs"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs sm:text-sm 2xl:text-base font-extrabold tracking-tight text-[#102f52] whitespace-nowrap">
                {department.name}
              </span>
              <span className="rounded-full bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 text-[9px] font-extrabold text-[#005baa]">
                S1
              </span>
            </div>
            <p className="hidden 2xl:block text-[9px] font-bold uppercase tracking-[0.14em] text-[#005baa] whitespace-nowrap">
              {department.subtitle}
            </p>
          </div>
        </div>

        {/* Center: Desktop Navigation Segmented Tabs */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-0.5 xl:p-1 shadow-2xs shrink-0">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            const isApprovals = item.id === "approvals";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`relative flex items-center gap-1 xl:gap-1.5 rounded-xl px-2 xl:px-2.5 2xl:px-3 py-1.5 text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                  selected
                    ? "bg-[#005baa] text-white shadow-xs"
                    : "text-[#334e68] hover:bg-white hover:text-[#005baa]"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 xl:h-4 xl:w-4 ${selected ? "text-white" : "text-[#627d98]"}`} />
                <span>{item.label}</span>
                {isApprovals && pendingCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Controls & User Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2 shrink-0 ml-auto lg:ml-0">
          {/* Term Switcher */}
          {terms.length > 0 && (
            <div
              className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-2xs max-w-[110px] lg:max-w-[125px] xl:max-w-[145px] 2xl:max-w-[180px]"
              title={terms.find((t) => t.code === termSelectValue)?.name || "Pilih semester"}
            >
              <Icons.calendar className="h-3.5 w-3.5 text-[#005baa] shrink-0" />
              <select
                aria-label="Pilih semester"
                value={termSelectValue}
                onChange={(e) => setSelectedTermCode(e.target.value)}
                className="w-full truncate bg-transparent text-xs font-bold text-[#102f52] outline-none cursor-pointer"
              >
                {terms.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Network & Sync Status Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs shadow-2xs shrink-0 transition-colors ${
              !isOnline
                ? "border-amber-300 bg-amber-50/90 text-amber-900"
                : "border-slate-200 bg-white"
            }`}
            title={
              !isOnline
                ? "Mode Offline: Internet terputus. Semua perubahan data tersimpan aman di perangkat ini."
                : isDemoSession
                  ? "Realtime Lokal: Multi-tab & jendela saling tersinkron otomatis. Hubungkan Supabase untuk multi-perangkat."
                  : `Realtime Cloud (Supabase): ${realtimeStatus.status === "CONNECTED" ? "Terhubung Langsung" : realtimeStatus.status}`
            }
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                !isOnline
                  ? "bg-amber-500 ring-2 ring-amber-300 animate-pulse"
                  : isDemoSession
                    ? "bg-blue-500 ring-2 ring-blue-200 animate-pulse"
                    : realtimeStatus.status === "CONNECTED"
                      ? "bg-emerald-500 ring-2 ring-emerald-200 animate-pulse"
                      : "bg-amber-400 ring-2 ring-amber-200"
              }`}
            />
            <span className="hidden 2xl:inline max-w-[95px] truncate text-[11px] font-bold text-[#4f6478]">
              {!isOnline
                ? "Offline"
                : isDemoSession
                  ? "Lokal"
                  : realtimeStatus.status === "CONNECTED"
                    ? "Live"
                    : syncState === "saved"
                      ? "Online"
                      : dbStatus}
            </span>
          </div>

          {/* Save Now Button if Supabase */}
          {!isDemoSession && (
            <button
              type="button"
              onClick={handleSaveNow}
              disabled={saveNowDisabled}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-2 xl:px-2.5 py-1.5 text-xs font-bold text-[#005baa] hover:bg-blue-100 disabled:opacity-40 shadow-2xs shrink-0 cursor-pointer"
              title="Upload perubahan data"
            >
              <Icons.check className="h-3.5 w-3.5" />
              {pendingLecturerLabelCount > 0 ? `Simpan (${pendingLecturerLabelCount})` : "Simpan"}
            </button>
          )}

          {/* Accessibility Quick Button in Navbar */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "a", altKey: true, bubbles: true })
              );
            }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-white hover:border-[#005baa] hover:text-[#005baa] px-2 xl:px-2.5 py-1.5 text-xs font-semibold text-[#102f52] shadow-2xs transition-all cursor-pointer"
            title="Menu Aksesibilitas (Pintasan: Alt + A)"
            aria-label="Buka Pengaturan Aksesibilitas"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 text-[#005baa]"
            >
              <circle cx="12" cy="4.5" r="2.2" />
              <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
              <path d="M12 9v11" />
              <path d="M9 20l3-5 3 5" />
            </svg>
            <span className="hidden 2xl:inline text-xs font-semibold">Aksesibilitas</span>
          </button>

          {/* User Profile & Actions Dropdown */}
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 xl:gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-white hover:border-slate-300 px-2 xl:px-2.5 py-1.5 text-xs font-semibold text-[#102f52] shadow-2xs transition-all cursor-pointer"
              title={`Akun: ${userEmail || "Administrator"}`}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#005baa] text-[10px] font-bold text-white uppercase shadow-2xs shrink-0">
                {userEmail?.[0] || "A"}
              </div>
              <span className="hidden 2xl:inline max-w-[120px] truncate text-xs font-bold text-[#102f52]">
                {userEmail?.split("@")[0] || "Admin"}
              </span>
              <Icons.chevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 backdrop-blur-md">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#005baa]">Masuk Sebagai</p>
                    <p className="mt-0.5 text-xs font-bold text-[#102f52] truncate" title={userEmail}>
                      {userEmail || "Administrator"}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">Administrator Program Studi</p>
                  </div>
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Icons.logout className="h-4 w-4 text-rose-600" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex lg:hidden items-center justify-center rounded-xl border border-slate-200 p-2 text-[#102f52] hover:bg-slate-100 shrink-0"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <Icons.x className="h-5 w-5" /> : <Icons.menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Nav Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {nav.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              const isApprovals = item.id === "approvals";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActive(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold transition ${
                    selected
                      ? "bg-[#005baa] text-white shadow-xs"
                      : "bg-slate-50 text-[#102f52] hover:bg-blue-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {isApprovals && pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {terms.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="font-semibold text-slate-500">Semester:</span>
              <select
                value={termSelectValue}
                onChange={(e) => setSelectedTermCode(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white p-1 font-bold text-[#102f52]"
              >
                {terms.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isOnline && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-amber-50 p-2 text-xs font-semibold text-amber-800 border border-amber-200">
              <Icons.cloudOff className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Mode Offline: Data tersimpan di perangkat ini</span>
            </div>
          )}
          {/* User Profile & Logout in Mobile Drawer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3">
            <div className="flex items-center gap-2 truncate text-xs font-semibold text-slate-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#005baa] text-[11px] font-bold text-white uppercase shrink-0">
                {userEmail?.[0] || "A"}
              </div>
              <span className="truncate max-w-[160px] sm:max-w-[240px]">{userEmail || "Admin"}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 cursor-pointer"
            >
              <Icons.logout className="h-3.5 w-3.5 text-rose-600" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function Header({ active, terms, selectedTermCode, setSelectedTermCode }) {
  const titles = {
    dashboard: [
      "Ringkasan & Analitik",
      "Dashboard Program Studi",
      "Infografis real-time sebaran dosen, keahlian, beban pengajaran, dan ketersediaan kelas.",
    ],
    approvals: [
      "Review & Verifikasi",
      "Persetujuan Kesediaan Tutor",
      "Tinjau data formulir kesediaan mengajar dari tutor dan setujui untuk sinkronisasi otomatis ke direktori & plotting.",
    ],
    lecturers: [
      "Direktori Dosen",
      "Direktori Dosen",
      "Cari, filter, urutkan, tambah, edit, atau kelola data profil dosen dan keahlian secara terpusat.",
    ],
    plotting: [
      "Alokasi Pengajaran",
      "Plotting Mata Kuliah",
      "Atur jumlah kelas per mata kuliah, plot dosen berdasarkan keahlian, dan ekspor hasil alokasi semester.",
    ],
    courses: [
      "Katalog Akademik",
      "Katalog Mata Kuliah",
      "Katalog mata kuliah Program Studi FKIP untuk alokasi pengajaran dan kelas per semester.",
    ],
    terms: [
      "Kalender Akademik",
      "Semester & Kalender",
      "Kelola periode semester akademik dan tentukan semester aktif yang digunakan untuk proses plotting.",
    ],
  };
  const [eyebrow, title, desc] = titles[active] || [
    "Dashboard",
    "Department",
    "",
  ];
  return (
    <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#005baa]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#005baa]" />
          {eyebrow}
        </div>
        <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-[#102f52] sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#4f6478]">
          {desc}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "blue", note }) {
  const isAmber = tone === "amber";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isAmber
          ? "border-amber-200/90 bg-gradient-to-br from-[#fffdf5] to-[#fff9df]"
          : "border-slate-200/80 bg-white"
      }`}
    >
      <div
        className={`absolute top-0 inset-x-0 h-1 ${
          isAmber
            ? "bg-gradient-to-r from-amber-400 to-yellow-400"
            : "bg-gradient-to-r from-[#005baa] to-sky-400"
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4f6478]">
            {label}
          </p>
          <p className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[#102f52]">
            {value}
          </p>
          {note && (
            <p className="mt-1.5 text-xs font-medium text-[#627d98]">{note}</p>
          )}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-xs ${
            isAmber
              ? "bg-[#ffd23f]/80 text-[#102f52]"
              : "bg-sky-50 text-[#005baa] border border-sky-100"
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function SupabaseStatusIcon({ state = "idle", label }) {
  const isSaved = state === "saved";
  const isError = state === "error" || state === "offline";
  const className = isSaved
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : isError
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const Icon = isSaved ? Icons.check : isError ? Icons.warning : Icons.chart;
  return (
    <span
      title={label}
      aria-label={label}
      role="status"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${className} shadow-2xs`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

const { LandingScreen, PublicLookupScreen, LoginScreen } = createAuthScreens({
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
});

const { Dashboard, Lecturers } = createDirectoryFeatures({
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
  getPlottedCountData,
  getPlottedCourseCounts,
  includes,
  mapImportedLecturers,
  mergeImportedLecturer,
  normalizeTermPlotting,
  parseCSV,
  parseXLSX,
  plottedCourseTitles,
  rowsToObjects,
  serializeLecturersForDatabase,
  splitList,
  uniq,
  upsertRows,
});

const Plotting = createPlottingComponent({
  Badge,
  Button,
  Card,
  Icons,
  ImportReviewModal,
  LECTURER_CLASS_LIMIT,
  MAX_CLASS_ASSIGNMENTS_PER_COURSE,
  Modal,
  PlottedCourseBadges,
  Stat,
  TextInput,
  applyCourseAssignmentsToLecturers,
  availabilityTone,
  buildAutoPilotPlotting,
  buildRebalancedPlotting,
  calculatePlottingHealth,
  countLecturerAssignments,
  expertiseMatchesCourse,
  exportPlottingToXLSX,
  exportPlottingTemplateToXLSX,
  exportPlottingToPDF,
  getCourseClassAssignmentPlan,
  getCourseClassCounts,
  getCourseClassPlan,
  getCoursePlanParts,
  getLecturerRatingClassLimit,
  getPlottedCourseCounts,
  includes,
  mapImportedPlottingRows,
  mergeAssignmentMapWithLecturerLimit,
  parseCSV,
  parseXLSX,
  plottedCourseTitles,
  resizeCourseAssignments,
  rowsToObjects,
  swapAssignmentSlots,
  toClassCount,
});

const { Courses, Terms } = createCatalogFeatures({
  Button,
  Card,
  DeleteConfirmation,
  FormGrid,
  Icons,
  Modal,
  PlainInput,
  SelectBox,
  TextInput,
  includes,
});

const Approvals = createApprovalsFeature({
  Badge,
  Button,
  Card,
  Icons,
  courseTitleByCode,
});

const INITIAL_SUBMISSIONS = [
  {
    id: "FKIP009",
    degree: "M.Pd.",
    name: "Dra. Rina Sulistiyowati, M.Pd.",
    email: "rina.sulistiyowati@ecampus.ut.ac.id",
    phone: "0812-8899-7711",
    expertise: ["Strategi Pembelajaran di SD", "Evaluasi Pembelajaran"],
    plotted: ["PDGK4105", "PDGK4301"],
    available: 2,
    warning_note: "Bersedia mengampu tutorial online (Tuweb) hari Sabtu.",
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "FKIP010",
    degree: "M.Pd.",
    name: "Fajar Nugraha, S.Pd., M.Pd.",
    email: "fajar.nugraha@ecampus.ut.ac.id",
    phone: "0813-4455-6677",
    expertise: ["Profesi Keguruan", "Penelitian Tindakan Kelas (PTK)"],
    plotted: ["MKDK4005", "IDIK4008"],
    available: 2,
    warning_note: "Instruktur Nasional & Guru Penggerak Bersertifikat.",
    status: "pending",
    submittedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

const STORED_CUSTOM_LECTURERS_KEY = "ut_stored_custom_lecturers_v1";
const STORED_CUSTOM_PLOTTINGS_KEY = "ut_stored_custom_plottings_v1";
const STORED_DELETED_LECTURER_IDS_KEY = "ut_stored_deleted_lecturer_ids_v1";

function getStoredDeletedLecturerIds() {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORED_DELETED_LECTURER_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function storeDeletedLecturerId(id) {
  if (typeof localStorage === "undefined" || !id) return;
  try {
    const set = getStoredDeletedLecturerIds();
    set.add(id);
    localStorage.setItem(
      STORED_DELETED_LECTURER_IDS_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {}
}

function unstoreDeletedLecturerId(id) {
  if (typeof localStorage === "undefined" || !id) return;
  try {
    const set = getStoredDeletedLecturerIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(
        STORED_DELETED_LECTURER_IDS_KEY,
        JSON.stringify(Array.from(set)),
      );
    }
  } catch {}
}

function getStoredCustomLecturers() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORED_CUSTOM_LECTURERS_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeLecturer) : null;
  } catch (err) {
    void err;
    return null;
  }
}

function getStoredCustomPlottings() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORED_CUSTOM_PLOTTINGS_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTermPlotting) : null;
  } catch (err) {
    void err;
    return null;
  }
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
              <Icons.warning className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold text-[#102f52]">
              Terjadi Kendala Tampilan
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              {this.state.error?.message ||
                "Modul ini mengalami kendala tak terduga. Silakan muat ulang halaman untuk melanjutkan."}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#005baa] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#004984] transition cursor-pointer"
              >
                Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function submissionToLecturer(sub) {
  const tutorId = sub.id || sub.tutorId;
  return normalizeLecturer({
    id: tutorId,
    degree: sub.degree || "",
    name: sub.name || "",
    email: sub.email || "",
    phone: sub.phone || "",
    expertise: Array.isArray(sub.expertise) ? sub.expertise : [],
    plotted: Array.isArray(sub.plotted) ? sub.plotted : [],
    available: Number(sub.available ?? 0),
    rating: clampRating(sub.rating ?? 5),
    warning_note: String(sub.warning_note || "").trim(),
  });
}

function mergeApprovedSubmissionsIntoLecturers(
  baseLecturers = [],
  submissionsList = [],
) {
  const byId = new Map(baseLecturers.map((l) => [l.id, l]));
  submissionsList
    .filter((s) => s.status === "approved")
    .forEach((sub) => {
      const tutorId = sub.id || sub.tutorId;
      const converted = submissionToLecturer(sub);
      const existing = byId.get(tutorId);
      byId.set(tutorId, {
        ...(existing || {}),
        ...converted,
        name: sub.name || existing?.name || converted.name,
        degree: sub.degree || existing?.degree || converted.degree,
        email: sub.email || existing?.email || converted.email,
        phone: sub.phone || existing?.phone || converted.phone,
        expertise:
          Array.isArray(sub.expertise) && sub.expertise.length
            ? sub.expertise
            : existing?.expertise || [],
        plotted:
          Array.isArray(sub.plotted) && sub.plotted.length
            ? sub.plotted
            : existing?.plotted || [],
        available: Number(sub.available ?? existing?.available ?? 0),
        rating: clampRating(existing?.rating ?? sub.rating ?? 5),
        warning_note: String(
          sub.warning_note || existing?.warning_note || "",
        ).trim(),
      });
    });
  return Array.from(byId.values());
}

function mergeApprovedSubmissionsIntoTermPlottings(
  basePlottings = [],
  submissionsList = [],
  termsList = [],
) {
  const byId = new Map(basePlottings.map((p) => [p.id, p]));
  const effectiveTerms = termsList.length ? termsList : DEMO_TERMS;
  submissionsList
    .filter((s) => s.status === "approved")
    .forEach((sub) => {
      const tutorId = sub.id || sub.tutorId;
      effectiveTerms.forEach((term) => {
        const id = `${term.code}::${tutorId}`;
        const existing = byId.get(id);
        byId.set(id, {
          id,
          term_code: term.code,
          lecturer_id: tutorId,
          plotted:
            Array.isArray(sub.plotted) && sub.plotted.length
              ? sub.plotted
              : existing?.plotted || [],
          available: Number(sub.available ?? existing?.available ?? 0),
        });
      });
    });
  return Array.from(byId.values());
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [submissions, setSubmissions] = useState(() => {
    try {
      const stored = localStorage.getItem("ut_tutor_submissions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return INITIAL_SUBMISSIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ut_tutor_submissions", JSON.stringify(submissions));
    } catch {}
  }, [submissions]);

  const [session, setSession] = useState(() => {
    const initialEmail = getStoredUserEmail();
    let isDemoStored = false;
    try {
      isDemoStored = localStorage.getItem("ut_is_demo_session") === "true";
    } catch (err) {
      void err;
    }
    const email = initialEmail || (isDemoStored ? DEMO_ACCOUNT.email : "");
    return {
      userEmail: email,
      entryMode: email ? "admin" : "landing",
      isDemo: Boolean(!initialEmail && isDemoStored),
    };
  });
  const userEmail = session.userEmail;
  const entryMode = session.entryMode;
  const isDemoSession = Boolean(session.isDemo);
  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [termPlottings, setTermPlottings] = useState([]);
  const [courseClassPlans, setCourseClassPlans] = useState(
    getStoredCourseClassPlans,
  );
  const [selectedTermCode, setSelectedTermCode] = useState("");
  const [dbStatus, setDbStatus] = useState(
    USE_SUPABASE ? "Signed out" : "Supabase not configured",
  );
  const [syncState, setSyncState] = useState("idle");
  const [isHydrated, setIsHydrated] = useState(false);
  const [canSyncLecturerLabels, setCanSyncLecturerLabels] = useState(false);
  const [canSyncCourseClassPlans, setCanSyncCourseClassPlans] = useState(false);
  const [pendingLecturerLabelChanges, setPendingLecturerLabelChanges] =
    useState({});
  const [syncWakeSignal, setSyncWakeSignal] = useState(0);
  const [saveNowSignal, setSaveNowSignal] = useState(0);
  const [initialPublicLookupId, setInitialPublicLookupId] = useState("");

  const {
    isOnline,
    isInstallable,
    isInstalled,
    promptInstall,
    showInstallModal,
    setShowInstallModal,
  } = usePWA();
  const [networkToast, setNetworkToast] = useState(null);
  const [realtimeToast, setRealtimeToast] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState({
    status: "CONNECTING",
    mode: IS_SUPABASE_CONFIGURED ? "cloud" : "local",
  });
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (!realtimeToast) return;
    const timer = setTimeout(() => setRealtimeToast(null), 4500);
    return () => clearTimeout(timer);
  }, [realtimeToast]);

  // Realtime Sync Manager (Supabase WebSocket multi-perangkat + BroadcastChannel multi-tab)
  useEffect(() => {
    const cleanup = initRealtimeManager({
      onLecturerChange: (event) => {
        if (event.eventType === "DELETE") {
          const id = event.id;
          if (!id) return;
          storeDeletedLecturerId(id);
          setLecturers((prev) => prev.filter((l) => l.id !== id));
          setTermPlottings((prev) => prev.filter((tp) => tp.lecturer_id !== id));
          setSubmissions((prev) => prev.filter((s) => (s.id || s.tutorId) !== id));
          setRealtimeToast({
            type: "info",
            message: `Dosen (${id}) dihapus oleh pengguna lain.`,
          });
        } else if (event.eventType === "INSERT") {
          if (!event.new) return;
          const row = normalizeLecturer(event.new);
          unstoreDeletedLecturerId(row.id);
          setLecturers((prev) => {
            const filtered = prev.filter((l) => l.id !== row.id);
            return [row, ...filtered];
          });
          setRealtimeToast({
            type: "info",
            message: `Dosen baru (${row.name}) ditambahkan secara real-time.`,
          });
        } else if (event.eventType === "UPDATE") {
          if (!event.new) return;
          const row = normalizeLecturer(event.new);
          unstoreDeletedLecturerId(row.id);
          setLecturers((prev) =>
            prev.map((l) => (l.id === row.id ? { ...l, ...row } : l)),
          );
          setRealtimeToast({
            type: "info",
            message: `Data dosen (${row.name}) diperbarui secara real-time.`,
          });
        }
      },
      onPlottingChange: (event) => {
        if (event.eventType === "DELETE") {
          const id = event.id;
          if (!id) return;
          setTermPlottings((prev) => prev.filter((tp) => tp.id !== id));
        } else if (event.new) {
          const row = normalizeTermPlotting(event.new);
          setTermPlottings((prev) => {
            const filtered = prev.filter((tp) => tp.id !== row.id);
            return [...filtered, row];
          });
          setRealtimeToast({
            type: "info",
            message: `Plotting kelas semester diperbarui secara real-time.`,
          });
        }
      },
      onSubmissionChange: (event) => {
        if (event.eventType === "DELETE") {
          const id = event.id;
          if (!id) return;
          setSubmissions((prev) => prev.filter((s) => (s.id || s.tutorId) !== id));
        } else if (event.eventType === "INSERT") {
          if (!event.new) return;
          const newSub = event.new;
          setSubmissions((prev) => {
            const filtered = prev.filter((s) => s.id !== newSub.id);
            return [newSub, ...filtered];
          });
          setRealtimeToast({
            type: "success",
            message: `Pengajuan tutor baru masuk: ${newSub.name}`,
          });
        } else if (event.eventType === "UPDATE") {
          if (!event.new) return;
          const updatedSub = event.new;
          setSubmissions((prev) =>
            prev.map((s) => (s.id === updatedSub.id ? { ...s, ...updatedSub } : s)),
          );
          setRealtimeToast({
            type: "info",
            message: `Status pengajuan tutor (${updatedSub.name}): ${updatedSub.status}`,
          });
        }
      },
      onCourseClassPlansChange: (event) => {
        if (event.new?.term_code) {
          const plans = event.new;
          setCourseClassPlans((prev) => ({
            ...prev,
            [plans.term_code]: {
              counts: plans.counts || {},
              assignments: plans.assignments || {},
            },
          }));
          setRealtimeToast({
            type: "info",
            message: `Rencana kelas semester (${plans.term_code}) diperbarui.`,
          });
        }
      },
      onStatusChange: (statusObj) => {
        setRealtimeStatus(statusObj);
      },
    });

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        setNetworkToast({
          type: "online",
          message: "Koneksi internet kembali terhubung. Memeriksa sinkronisasi...",
        });
        if (userEmail && !isDemoSession) {
          setSyncWakeSignal((v) => v + 1);
        }
      } else {
        setNetworkToast({
          type: "offline",
          message: "Koneksi internet terputus. Mode offline aktif (perubahan tersimpan lokal).",
        });
      }
      prevOnlineRef.current = isOnline;
      const timer = setTimeout(() => setNetworkToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, userEmail, isDemoSession]);
  const hydratedRef = useRef(false);
  const syncingRef = useRef(false);
  const syncPayloadRef = useRef(null);
  const syncRevisionRef = useRef(0);
  const syncedRevisionRef = useRef(0);
  const syncBaselineRef = useRef(null);
  const syncConflictRef = useRef(false);
  const syncTimerRef = useRef(null);
  const syncRetryDelayRef = useRef(SYNC_RETRY_INITIAL_DELAY);
  const handledSaveNowSignalRef = useRef(0);
  const setHydrated = useCallback((value) => {
    hydratedRef.current = value;
    setIsHydrated(value);
  }, []);
  const setUserEmail = useCallback((email) => {
    setSession((prev) => ({
      ...prev,
      userEmail: typeof email === "function" ? email(prev.userEmail) : email,
    }));
  }, []);
  const setEntryMode = useCallback((entryMode) => {
    setSession((prev) => ({ ...prev, entryMode }));
  }, []);
  const applyDatabaseSnapshot = useCallback((snapshot, labelChanges = {}) => {
    setLecturers(
      applyLecturerLabelChanges(snapshot.lecturers, labelChanges),
    );
    setCourses(snapshot.courses);
    setTerms(snapshot.terms);
    setTermPlottings(snapshot.termPlottings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDatabase() {
      if (isDemoSession) {
        const demoSnapshot = cloneDemoSnapshot();
        const deletedIds = getStoredDeletedLecturerIds();
        const storedCustomLecturers = getStoredCustomLecturers();
        const storedCustomPlottings = getStoredCustomPlottings();

        // 1. Filter out deleted lecturer IDs from demo snapshot
        const activeDemoLecturers = demoSnapshot.lecturers.filter(
          (l) => !deletedIds.has(l.id),
        );
        const activeDemoPlottings = demoSnapshot.termPlottings.filter(
          (tp) => !deletedIds.has(tp.lecturer_id),
        );

        // 2. Base lecturers & plottings: prefer saved localStorage if available
        let baseLecturers = activeDemoLecturers;
        if (storedCustomLecturers !== null) {
          baseLecturers = storedCustomLecturers.filter(
            (l) => !deletedIds.has(l.id),
          );
        }

        let basePlottings = activeDemoPlottings;
        if (storedCustomPlottings !== null) {
          basePlottings = storedCustomPlottings.filter(
            (tp) => !deletedIds.has(tp.lecturer_id),
          );
        }

        // 3. Exclude deleted IDs from submissions
        const activeSubmissions = submissions.filter(
          (s) => !deletedIds.has(s.id || s.tutorId),
        );

        // 4. Merge approved submissions
        const finalLecturers = mergeApprovedSubmissionsIntoLecturers(
          baseLecturers,
          activeSubmissions,
        );
        const finalPlottings = mergeApprovedSubmissionsIntoTermPlottings(
          basePlottings,
          activeSubmissions,
          demoSnapshot.terms,
        );
        applyDatabaseSnapshot({
          ...demoSnapshot,
          lecturers: finalLecturers,
          termPlottings: finalPlottings,
        });
        setCourseClassPlans(cloneDemoCourseClassPlans());
        setPendingLecturerLabelChanges({});
        setSelectedTermCode("DEMO-2026-1");
        setCanSyncLecturerLabels(true);
        setCanSyncCourseClassPlans(true);
        setHydrated(true);
        setSyncState("saved");
        setDbStatus("Demo data loaded");
        return;
      }
      if (!USE_SUPABASE || !userEmail || !getAccessToken()) {
        setHydrated(false);
        if (userEmail) {
          signOut();
          setUserEmail("");
        }
        return;
      }
      try {
        setHydrated(false);
        setSyncState("loading");
        setDbStatus("Loading database...");
        const [snapshot, lecturerLabelsSupported] = await Promise.all([
          fetchDatabaseSnapshot(),
          fetchLecturerLabelColumnSupport(),
        ]);
        if (cancelled) return;
        syncBaselineRef.current = createSyncSnapshot(snapshot);
        setCanSyncLecturerLabels(lecturerLabelsSupported);
        setCanSyncCourseClassPlans(snapshot.courseClassPlansSupported);
        const pendingSync = getStoredPendingSync(userEmail);
        const lecturerLabelChanges = getStoredLecturerLabelChanges(userEmail);
        setPendingLecturerLabelChanges(lecturerLabelChanges);
        if (pendingSync?.payload) {
          const restoredSnapshot = restorePendingSnapshot(
            snapshot,
            pendingSync.payload,
          );
          applyDatabaseSnapshot(restoredSnapshot, lecturerLabelChanges);
          setCourseClassPlans(restoredSnapshot.courseClassPlans);
        } else {
          applyDatabaseSnapshot(snapshot, lecturerLabelChanges);
          setCourseClassPlans(
            snapshot.courseClassPlansSupported
              ? snapshot.courseClassPlans
              : getStoredCourseClassPlans(),
          );
        }
        setHydrated(true);
        const hasPendingLabels = Object.keys(lecturerLabelChanges).length > 0;
        setSyncState(pendingSync || hasPendingLabels ? "pending" : "saved");
        const setupNotes = [
          !lecturerLabelsSupported
            ? "Run lecturer labels SQL to save ratings and warning notes."
            : "",
          !snapshot.courseClassPlansSupported
            ? "Run course class plans SQL to sync plotting plans."
            : "",
        ].filter(Boolean);
        setDbStatus(
          pendingSync || hasPendingLabels
            ? "Unsaved changes restored. Saving..."
            : setupNotes.length
              ? `Supabase connected. ${setupNotes.join(" ")}`
              : "All changes saved",
        );
      } catch (error) {
        setHydrated(false);
        setSyncState("error");
        if (error.status === 401 || error.status === 403) {
          signOut();
          setUserEmail("");
          setLecturers([]);
          setCourses([]);
          setTerms([]);
          setTermPlottings([]);
          setSelectedTermCode("");
          setCanSyncLecturerLabels(false);
          setCanSyncCourseClassPlans(false);
          setDbStatus("Session expired. Please sign in again.");
          return;
        }
        setDbStatus(error.message || "Database load failed");
      }
    }
    loadDatabase();
    return () => {
      cancelled = true;
    };
  }, [
    applyDatabaseSnapshot,
    isDemoSession,
    setHydrated,
    setUserEmail,
    userEmail,
  ]);

  const loadPublicDirectory = useCallback(async () => {
    if (!USE_SUPABASE) {
      setHydrated(false);
      setDbStatus("Supabase not configured");
      return;
    }
    try {
      setHydrated(false);
      setSyncState("loading");
      setDbStatus("Loading public directory...");
      const snapshot = await fetchPublicDatabaseSnapshot();
      applyDatabaseSnapshot(snapshot);
      setHydrated(true);
      setSyncState("saved");
      setDbStatus("Public directory ready");
    } catch (error) {
      setHydrated(false);
      setSyncState("error");
      setDbStatus(error.message || "Public directory load failed");
    }
  }, [applyDatabaseSnapshot, setHydrated]);

  useEffect(() => {
    if (entryMode !== "public" && entryMode !== "landing") return undefined;
    const timer = window.setTimeout(() => {
      loadPublicDirectory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entryMode, loadPublicDirectory]);

  useEffect(() => {
    if (userEmail || entryMode !== "admin") return undefined;
    const timer = window.setTimeout(() => {
      setEntryMode("login");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entryMode, setEntryMode, userEmail]);

  // Automatically ensure any approved submission in submissions is synced into lecturers & plottings
  useEffect(() => {
    const deletedIds = getStoredDeletedLecturerIds();
    const approved = submissions.filter(
      (s) => s.status === "approved" && !deletedIds.has(s.id || s.tutorId),
    );
    if (!approved.length) return;

    setLecturers((prev) => {
      const next = mergeApprovedSubmissionsIntoLecturers(prev, approved).filter(
        (l) => !deletedIds.has(l.id),
      );
      const isSame =
        next.length === prev.length &&
        next.every(
          (l, i) =>
            l.id === prev[i]?.id &&
            l.name === prev[i]?.name &&
            l.available === prev[i]?.available &&
            l.rating === prev[i]?.rating &&
            (l.plotted || []).join(",") === (prev[i]?.plotted || []).join(","),
        );
      if (isSame) return prev;
      try {
        localStorage.setItem(
          STORED_CUSTOM_LECTURERS_KEY,
          JSON.stringify(next),
        );
      } catch (err) {
        void err;
      }
      return next;
    });

    setTermPlottings((prev) => {
      const termList = terms.length ? terms : DEMO_TERMS;
      const next = mergeApprovedSubmissionsIntoTermPlottings(
        prev,
        approved,
        termList,
      ).filter((tp) => !deletedIds.has(tp.lecturer_id));
      const isSame =
        next.length === prev.length &&
        next.every(
          (p, i) =>
            p.id === prev[i]?.id &&
            p.available === prev[i]?.available &&
            (p.plotted || []).join(",") === (prev[i]?.plotted || []).join(","),
        );
      if (isSame) return prev;
      try {
        localStorage.setItem(
          STORED_CUSTOM_PLOTTINGS_KEY,
          JSON.stringify(next),
        );
      } catch (err) {
        void err;
      }
      return next;
    });
  }, [submissions, terms]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORED_CUSTOM_LECTURERS_KEY,
        JSON.stringify(lecturers),
      );
    } catch {}
  }, [lecturers, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORED_CUSTOM_PLOTTINGS_KEY,
        JSON.stringify(termPlottings),
      );
    } catch {}
  }, [termPlottings, isHydrated]);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (isDemoSession) return;
    let warningTimer;
    try {
      localStorage.setItem(
        COURSE_CLASS_PLANS_STORAGE_KEY,
        JSON.stringify(courseClassPlans),
      );
    } catch {
      if (userEmail) {
        warningTimer = window.setTimeout(() => {
          setSyncState("error");
          setDbStatus(
            "This device could not store a local plotting backup. Keep the app open and use Save now.",
          );
        }, 0);
      }
    }
    return () => window.clearTimeout(warningTimer);
  }, [courseClassPlans, isDemoSession, userEmail]);

  const queueLecturerLabels = useCallback(
    (lecturerId, patch) => {
      if (!isDemoSession && userEmail) {
        try {
          setPendingLecturerLabelChanges(
            queueLecturerLabelChange(userEmail, lecturerId, patch),
          );
        } catch (error) {
          setSyncState("error");
          setDbStatus(
            `${error.message || "The rating could not be queued locally."} The visible rating was not changed.`,
          );
          return false;
        }
      }
      setLecturers((prev) =>
        prev.map((lecturer) =>
          lecturer.id === lecturerId ? { ...lecturer, ...patch } : lecturer,
        ),
      );
      return true;
    },
    [isDemoSession, userEmail],
  );

  const discardLecturerLabels = useCallback(
    (lecturerId) => {
      if (isDemoSession || !userEmail) return true;
      try {
        setPendingLecturerLabelChanges(
          discardStoredLecturerLabelChange(userEmail, lecturerId),
        );
        return true;
      } catch (error) {
        setSyncState("error");
        setDbStatus(error.message || "The local label queue could not be updated.");
        return false;
      }
    },
    [isDemoSession, userEmail],
  );

  useEffect(() => {
    if (isDemoSession || !userEmail) return undefined;
    const handleStorage = (event) => {
      if (!event.key?.startsWith(`${PENDING_LECTURER_LABELS_STORAGE_KEY}:`))
        return;
      const changes = getStoredLecturerLabelChanges(userEmail);
      setPendingLecturerLabelChanges(changes);
      setLecturers((prev) => applyLecturerLabelChanges(prev, changes));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isDemoSession, userEmail]);

  useEffect(() => {
    if (!Object.keys(pendingLecturerLabelChanges).length) return undefined;
    const warnAboutPendingChanges = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutPendingChanges);
    return () => window.removeEventListener("beforeunload", warnAboutPendingChanges);
  }, [pendingLecturerLabelChanges]);

  const refreshDatabaseOnResume = useCallback(async () => {
    if (
      isDemoSession ||
      !USE_SUPABASE ||
      !userEmail ||
      !hydratedRef.current ||
      syncingRef.current
    )
      return;
    if (
      syncRevisionRef.current > syncedRevisionRef.current ||
      Object.keys(pendingLecturerLabelChanges).length
    ) {
      if (syncConflictRef.current) return;
      syncRetryDelayRef.current = SYNC_RETRY_INITIAL_DELAY;
      setSyncWakeSignal((value) => value + 1);
      return;
    }

    const revisionAtStart = syncRevisionRef.current;
    try {
      setDbStatus("Checking Supabase for newer changes...");
      const snapshot = await fetchDatabaseSnapshot();
      if (
        syncingRef.current ||
        revisionAtStart !== syncRevisionRef.current
      )
        return;
      syncBaselineRef.current = createSyncSnapshot(snapshot);
      applyDatabaseSnapshot(snapshot);
      setCourseClassPlans(
        snapshot.courseClassPlansSupported
          ? snapshot.courseClassPlans
          : getStoredCourseClassPlans(),
      );
      setCanSyncCourseClassPlans(snapshot.courseClassPlansSupported);
      setSyncState("saved");
      setDbStatus("All changes saved");
    } catch (error) {
      setSyncState(navigator.onLine ? "error" : "offline");
      setDbStatus(
        navigator.onLine
          ? `${error.message || "Could not refresh Supabase data"}. Existing data has not been replaced.`
          : "Offline. Existing data remains available on this device.",
      );
    }
  }, [
    applyDatabaseSnapshot,
    isDemoSession,
    pendingLecturerLabelChanges,
    userEmail,
  ]);

  useEffect(() => {
    let timer;
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshDatabaseOnResume, 150);
    };
    const handleOnline = () => {
      syncRetryDelayRef.current = SYNC_RETRY_INITIAL_DELAY;
      setSyncWakeSignal((value) => value + 1);
      resume();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refreshDatabaseOnResume]);

  const activeTermCode = terms.find((term) => term.active)?.code || "";
  const effectiveSelectedTermCode = terms.some(
    (term) => term.code === selectedTermCode,
  )
    ? selectedTermCode
    : activeTermCode || terms[0]?.code || "";
  const validTermPlottings = useMemo(() => {
    const lecturerIds = new Set(lecturers.map((lecturer) => lecturer.id));
    return termPlottings.filter((row) => lecturerIds.has(row.lecturer_id));
  }, [lecturers, termPlottings]);

  useEffect(() => {
    if (isDemoSession || !USE_SUPABASE || !userEmail || !hydratedRef.current)
      return undefined;

    const snapshot = createSyncSnapshot({
      lecturers,
      courses,
      terms,
      termPlottings: validTermPlottings,
      courseClassPlans,
    });
    const baseline = syncBaselineRef.current || snapshot;
    const changes = buildSyncChanges(baseline, snapshot);
    const hasCoreChanges = hasSyncChanges(changes);
    const hasPendingLabels = Object.keys(pendingLecturerLabelChanges).length > 0;
    if (!hasCoreChanges && !hasPendingLabels) {
      clearPendingSync(userEmail);
      setSyncState("saved");
      setDbStatus("All changes saved");
      return undefined;
    }

    syncConflictRef.current = false;
    syncRevisionRef.current += 1;
    syncPayloadRef.current = {
      snapshot,
      changes,
      canSyncLecturerLabels,
      canSyncCourseClassPlans,
    };
    let localBackupStored = true;
    if (hasCoreChanges) {
      try {
        storePendingSync(userEmail, { version: 2, changes });
      } catch {
        localBackupStored = false;
      }
    }
    setSyncState(navigator.onLine ? "pending" : "offline");
    setDbStatus(
      navigator.onLine
        ? localBackupStored
          ? "Unsaved changes queued"
          : "Local backup failed. Keep the app open while changes are uploaded."
        : localBackupStored
          ? "Offline. Changes are safely queued on this device."
          : "Offline, and this device could not store a local backup. Keep the app open.",
    );
    const scheduledRevision = syncRevisionRef.current;

    const runSync = async () => {
      if (syncingRef.current) return;
      const payload = syncPayloadRef.current;
      const startedRevision = syncRevisionRef.current;
      if (!payload || startedRevision <= syncedRevisionRef.current) return;
      if (!navigator.onLine) {
        setSyncState("offline");
        setDbStatus(
          localBackupStored
            ? "Offline. Changes are safely queued on this device."
            : "Offline, and this device could not store a local backup. Keep the app open.",
        );
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = window.setTimeout(
          runSync,
          syncRetryDelayRef.current,
        );
        syncRetryDelayRef.current = Math.min(
          syncRetryDelayRef.current * 2,
          SYNC_RETRY_MAX_DELAY,
        );
        return;
      }

      let failed = false;
      let conflicted = false;
      try {
        syncingRef.current = true;
        setSyncState("saving");
        setDbStatus("Saving changes...");
        await Promise.all([
          syncTableChanges("lecturers", payload.changes.lecturers, "id"),
          syncTableChanges("courses", payload.changes.courses, "code"),
          syncTableChanges("academic_terms", payload.changes.terms, "code"),
        ]);
        const dependentSyncOperations = [
          syncTableChanges(
            "term_plottings",
            payload.changes.termPlottings,
            "id",
          ),
        ];
        if (payload.canSyncCourseClassPlans) {
          dependentSyncOperations.push(
            syncTableChanges(
              "course_class_plans",
              payload.changes.courseClassPlans,
              "term_code",
            ),
          );
        }
        await Promise.all(dependentSyncOperations);
        const currentLabelChanges = getStoredLecturerLabelChanges(userEmail);
        let remainingLabelChanges = currentLabelChanges;
        if (
          payload.canSyncLecturerLabels &&
          Object.keys(currentLabelChanges).length
        ) {
          await Promise.all(
            Object.entries(currentLabelChanges).map(([lecturerId, change]) =>
              updateLecturerLabels(lecturerId, change),
            ),
          );
          remainingLabelChanges = clearStoredLecturerLabelChanges(
            userEmail,
            currentLabelChanges,
          );
          setPendingLecturerLabelChanges(remainingLabelChanges);
        }
        syncBaselineRef.current = {
          ...payload.snapshot,
          courseClassPlans: payload.canSyncCourseClassPlans
            ? payload.snapshot.courseClassPlans
            : baseline.courseClassPlans,
        };
        syncedRevisionRef.current = startedRevision;
        syncRetryDelayRef.current = SYNC_RETRY_INITIAL_DELAY;
        if (syncRevisionRef.current === startedRevision) {
          const allDataTypesSupported =
            payload.canSyncLecturerLabels &&
            payload.canSyncCourseClassPlans &&
            Object.keys(remainingLabelChanges).length === 0;
          if (allDataTypesSupported) clearPendingSync(userEmail);
          setSyncState(allDataTypesSupported ? "saved" : "pending");
          setDbStatus(
            allDataTypesSupported
              ? "All changes saved"
              : "Core data saved; unsupported fields remain queued until the required Supabase SQL is installed.",
          );
        }
      } catch (error) {
        conflicted = error.code === "SYNC_CONFLICT";
        failed = !conflicted;
        if (conflicted) syncConflictRef.current = true;
        setSyncState(navigator.onLine ? "error" : "offline");
        setDbStatus(
          navigator.onLine
            ? conflicted
              ? error.message ||
                "A newer Supabase change was preserved. Review this record before saving again."
              : `${error.message || "Database sync failed"}. Retrying automatically...`
            : localBackupStored
              ? "Offline. Changes are safely queued on this device."
              : "Offline, and this device could not store a local backup. Keep the app open.",
        );
      } finally {
        syncingRef.current = false;
        if (failed) {
          window.clearTimeout(syncTimerRef.current);
          syncTimerRef.current = window.setTimeout(
            runSync,
            syncRetryDelayRef.current,
          );
          syncRetryDelayRef.current = Math.min(
            syncRetryDelayRef.current * 2,
            SYNC_RETRY_MAX_DELAY,
          );
        } else if (
          !conflicted &&
          syncRevisionRef.current > syncedRevisionRef.current
        ) {
          window.clearTimeout(syncTimerRef.current);
          syncTimerRef.current = window.setTimeout(runSync, 0);
        }
      }
    };

    const saveImmediately =
      saveNowSignal > handledSaveNowSignalRef.current;
    if (saveImmediately) handledSaveNowSignalRef.current = saveNowSignal;
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(
      runSync,
      saveImmediately ? 0 : 500,
    );
    return () => {
      if (syncRevisionRef.current === scheduledRevision)
        window.clearTimeout(syncTimerRef.current);
    };
  }, [
    lecturers,
    courses,
    terms,
    validTermPlottings,
    courseClassPlans,
    userEmail,
    isDemoSession,
    canSyncLecturerLabels,
    canSyncCourseClassPlans,
    pendingLecturerLabelChanges,
    saveNowSignal,
    syncWakeSignal,
  ]);

  const handleLogin = (email) => {
    try {
      localStorage.removeItem("ut_is_demo_session");
    } catch (err) {
      void err;
    }
    syncBaselineRef.current = null;
    syncConflictRef.current = false;
    syncRevisionRef.current = 0;
    syncedRevisionRef.current = 0;
    setHydrated(false);
    setSession({ userEmail: email, entryMode: "admin", isDemo: false });
  };

  const handleDemoLogin = () => {
    signOut();
    try {
      localStorage.setItem("ut_is_demo_session", "true");
    } catch (err) {
      void err;
    }
    syncBaselineRef.current = null;
    syncConflictRef.current = false;
    syncRevisionRef.current = 0;
    syncedRevisionRef.current = 0;
    setActive("dashboard");
    setHydrated(false);
    setSession({
      userEmail: DEMO_ACCOUNT.email,
      entryMode: "admin",
      isDemo: true,
    });
  };

  const handleLogout = () => {
    signOut();
    try {
      localStorage.removeItem("ut_is_demo_session");
    } catch (err) {
      void err;
    }
    syncBaselineRef.current = null;
    syncConflictRef.current = false;
    syncRevisionRef.current = 0;
    syncedRevisionRef.current = 0;
    setHydrated(false);
    setSession({ userEmail: "", entryMode: "landing", isDemo: false });
    setLecturers([]);
    setCourses([]);
    setTerms([]);
    setTermPlottings([]);
    setCourseClassPlans(getStoredCourseClassPlans());
    setCanSyncLecturerLabels(false);
    setCanSyncCourseClassPlans(false);
    setPendingLecturerLabelChanges({});
    setSelectedTermCode("");
    setSyncState("idle");
    setDbStatus(USE_SUPABASE ? "Signed out" : "Supabase not configured");
  };

  const handleSaveNow = () => {
    syncRetryDelayRef.current = SYNC_RETRY_INITIAL_DELAY;
    setSaveNowSignal((value) => value + 1);
  };

  const Page = {
    dashboard: Dashboard,
    approvals: Approvals,
    lecturers: Lecturers,
    plotting: Plotting,
    courses: Courses,
    terms: Terms,
  }[active];
  const termScopedLecturers = useMemo(
    () =>
      getTermScopedLecturers(
        lecturers,
        validTermPlottings,
        effectiveSelectedTermCode,
      ),
    [lecturers, validTermPlottings, effectiveSelectedTermCode],
  );
  const setTermScopedLecturers = useCallback(
    (updater) => {
      if (!effectiveSelectedTermCode) return;
      setTermPlottings((prev) => {
        const scoped = getTermScopedLecturers(
          lecturers,
          prev,
          effectiveSelectedTermCode,
        );
        const nextScoped =
          typeof updater === "function" ? updater(scoped) : updater;
        const nextRows = nextScoped.map((lecturer) =>
          buildTermPlottingRow(effectiveSelectedTermCode, lecturer),
        );
        return prev
          .filter((row) => row.term_code !== effectiveSelectedTermCode)
          .concat(nextRows);
      });
    },
    [lecturers, effectiveSelectedTermCode],
  );
  const pageLecturers =
    active === "dashboard" || active === "lecturers" || active === "plotting"
      ? termScopedLecturers
      : lecturers;
  const pageSetLecturers =
    active === "plotting" ? setTermScopedLecturers : setLecturers;

  const handleApproveSubmission = useCallback(
    async (sub) => {
      const tutorId = sub.id || sub.tutorId;
      unstoreDeletedLecturerId(tutorId);
      const approvedLecturer = submissionToLecturer(sub);

      // 1. Masukkan dan simpan ke direktori dosen
      setLecturers((prev) => {
        const filtered = prev.filter((l) => l.id !== tutorId);
        const next = [approvedLecturer, ...filtered];
        try {
          localStorage.setItem(
            STORED_CUSTOM_LECTURERS_KEY,
            JSON.stringify(next),
          );
        } catch (err) {
          void err;
        }
        return next;
      });

      // 2. Plotting ke seluruh semester (agar muncul di semua pilihan filter semester)
      const termList = terms.length ? terms : DEMO_TERMS;
      const newPlottings = termList.map((t) => ({
        id: `${t.code}::${tutorId}`,
        term_code: t.code,
        lecturer_id: tutorId,
        plotted: approvedLecturer.plotted,
        available: approvedLecturer.available,
      }));
      setTermPlottings((prev) => {
        const filtered = prev.filter((tp) => tp.lecturer_id !== tutorId);
        const next = [...newPlottings, ...filtered];
        try {
          localStorage.setItem(
            STORED_CUSTOM_PLOTTINGS_KEY,
            JSON.stringify(next),
          );
        } catch (err) {
          void err;
        }
        return next;
      });

      // 3. Update status submission menjadi approved
      setSubmissions((prev) => {
        const next = prev.map((s) =>
          s.id === sub.id
            ? { ...s, status: "approved", reviewedAt: new Date().toISOString() }
            : s,
        );
        try {
          localStorage.setItem(
            "ut_tutor_submissions",
            JSON.stringify(next),
          );
        } catch (err) {
          void err;
        }
        return next;
      });

      // Siarkan ke tab/jendela lain secara real-time
      broadcastLocalChange("SUBMISSION_MUTATION", {
        eventType: "UPDATE",
        id: sub.id,
        new: { ...sub, status: "approved" },
      });
      broadcastLocalChange("LECTURER_MUTATION", {
        eventType: "INSERT",
        id: approvedLecturer.id,
        new: approvedLecturer,
      });

      // 4. Jika Supabase aktif, simpan ke Supabase
      if (USE_SUPABASE) {
        try {
          await upsertRows("lecturers", [approvedLecturer], "id");
          await upsertRows("term_plottings", newPlottings, "id");
          await upsertRows(
            "tutor_submissions",
            [{ ...sub, status: "approved", reviewed_at: new Date().toISOString() }],
            "id",
          );
        } catch (err) {
          console.warn("Supabase upsert on approve:", err);
        }
      }
    },
    [terms],
  );

  const handleSyncApprovedToDirectory = useCallback(() => {
    const deletedIds = getStoredDeletedLecturerIds();
    const approved = submissions.filter(
      (s) => s.status === "approved" && !deletedIds.has(s.id || s.tutorId),
    );
    if (!approved.length) return 0;
    approved.forEach((s) => unstoreDeletedLecturerId(s.id || s.tutorId));
    const termList = terms.length ? terms : DEMO_TERMS;
    setLecturers((prev) => {
      const next = mergeApprovedSubmissionsIntoLecturers(prev, approved).filter(
        (l) => !deletedIds.has(l.id),
      );
      try {
        localStorage.setItem(
          STORED_CUSTOM_LECTURERS_KEY,
          JSON.stringify(next),
        );
      } catch (err) {
        void err;
      }
      return next;
    });
    setTermPlottings((prev) => {
      const next = mergeApprovedSubmissionsIntoTermPlottings(
        prev,
        approved,
        termList,
      ).filter((tp) => !deletedIds.has(tp.lecturer_id));
      try {
        localStorage.setItem(
          STORED_CUSTOM_PLOTTINGS_KEY,
          JSON.stringify(next),
        );
      } catch (err) {
        void err;
      }
      return next;
    });
    return approved.length;
  }, [submissions, terms]);

  const handleRejectSubmission = useCallback(async (subId, reason) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              status: "rejected",
              rejectionReason: reason,
              reviewedAt: new Date().toISOString(),
            }
          : s,
      ),
    );

    broadcastLocalChange("SUBMISSION_MUTATION", {
      eventType: "UPDATE",
      id: subId,
      new: { id: subId, status: "rejected", rejectionReason: reason },
    });

    if (USE_SUPABASE) {
      try {
        await upsertRows(
          "tutor_submissions",
          [{ id: subId, status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() }],
          "id",
        );
      } catch (err) {}
    }
  }, []);

  const handleDeleteSubmission = useCallback((subId) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== subId));
    broadcastLocalChange("SUBMISSION_MUTATION", {
      eventType: "DELETE",
      id: subId,
    });
  }, []);

  const handleDeleteLecturer = useCallback(
    async (id) => {
      if (!id) return;
      // 1. Simpan permanen ID dosen yang dihapus di localStorage
      storeDeletedLecturerId(id);

      // 2. Hapus dari direktori dosen & perbarui localStorage
      setLecturers((prev) => {
        const next = prev.filter((l) => l.id !== id);
        try {
          localStorage.setItem(
            STORED_CUSTOM_LECTURERS_KEY,
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });

      // 3. Hapus dari seluruh plotting semester & perbarui localStorage
      setTermPlottings((prev) => {
        const next = prev.filter((tp) => tp.lecturer_id !== id);
        try {
          localStorage.setItem(
            STORED_CUSTOM_PLOTTINGS_KEY,
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });

      // 4. Hapus dari riwayat pengajuan tutor agar tidak tersinkronisasi kembali
      setSubmissions((prev) => {
        const next = prev.filter((s) => (s.id || s.tutorId) !== id);
        try {
          localStorage.setItem("ut_tutor_submissions", JSON.stringify(next));
        } catch {}
        return next;
      });

      // 5. Bersihkan rating & catatan tersimpan
      discardStoredLecturerLabelChange(userEmail, id);

      // Siarkan ke tab/jendela lain secara real-time
      broadcastLocalChange("LECTURER_MUTATION", {
        eventType: "DELETE",
        id,
        old: { id },
      });

      // 6. Sinkronisasi hapus ke Supabase jika aktif
      if (USE_SUPABASE && !isDemoSession) {
        try {
          await syncTableChanges(
            "lecturers",
            { creates: [], updates: [], deletes: [id] },
            "id",
          );
          const plottingsToDelete = termPlottings
            .filter((tp) => tp.lecturer_id === id)
            .map((tp) => tp.id);
          if (plottingsToDelete.length) {
            await syncTableChanges(
              "term_plottings",
              { creates: [], updates: [], deletes: plottingsToDelete },
              "id",
            );
          }
        } catch (err) {
          console.warn("Supabase delete lecturer sync:", err);
        }
      }
    },
    [userEmail, isDemoSession, termPlottings],
  );

  const handleBulkDeleteLecturers = useCallback(
    async (ids) => {
      if (!Array.isArray(ids) || !ids.length) return;
      const idSet = new Set(ids);

      // 1. Simpan permanen ID dosen yang dihapus di localStorage & bersihkan rating/catatan
      ids.forEach((id) => {
        storeDeletedLecturerId(id);
        discardStoredLecturerLabelChange(userEmail, id);
      });

      // 2. Hapus dari direktori dosen & perbarui localStorage
      setLecturers((prev) => {
        const next = prev.filter((l) => !idSet.has(l.id));
        try {
          localStorage.setItem(
            STORED_CUSTOM_LECTURERS_KEY,
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });

      // 3. Hapus dari seluruh plotting semester & perbarui localStorage
      let plottingsToDelete = [];
      setTermPlottings((prev) => {
        plottingsToDelete = prev
          .filter((tp) => idSet.has(tp.lecturer_id))
          .map((tp) => tp.id);
        const next = prev.filter((tp) => !idSet.has(tp.lecturer_id));
        try {
          localStorage.setItem(
            STORED_CUSTOM_PLOTTINGS_KEY,
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });

      // 4. Hapus dari pengajuan tutor
      setSubmissions((prev) => {
        const next = prev.filter((s) => !idSet.has(s.id || s.tutorId));
        try {
          localStorage.setItem("ut_tutor_submissions", JSON.stringify(next));
        } catch {}
        return next;
      });

      // 5. Siarkan mutasi lokal
      ids.forEach((id) => {
        broadcastLocalChange("LECTURER_MUTATION", {
          eventType: "DELETE",
          id,
          old: { id },
        });
      });

      // 6. Sinkronisasi batch ke Supabase jika aktif
      if (USE_SUPABASE && !isDemoSession) {
        try {
          await syncTableChanges(
            "lecturers",
            { creates: [], updates: [], deletes: ids },
            "id",
          );
          if (plottingsToDelete.length) {
            await syncTableChanges(
              "term_plottings",
              { creates: [], updates: [], deletes: plottingsToDelete },
              "id",
            );
          }
        } catch (err) {
          console.warn("Supabase bulk delete sync:", err);
        }
      }
    },
    [userEmail, isDemoSession, termPlottings],
  );

  const handleBulkEditLecturers = useCallback(
    async (ids, updates) => {
      if (!Array.isArray(ids) || !ids.length || !updates) return;
      const idSet = new Set(ids);

      let updatedLecturersList = [];
      setLecturers((prev) => {
        const next = prev.map((lecturer) => {
          if (!idSet.has(lecturer.id)) return lecturer;
          const merged = { ...lecturer };
          if (updates.available !== undefined) {
            merged.available = updates.available;
          }
          if (updates.rating !== undefined) {
            merged.rating = updates.rating;
          }
          if (updates.degree !== undefined && updates.degree !== "") {
            merged.degree = updates.degree;
          }
          if (updates.addExpertise && Array.isArray(updates.addExpertise)) {
            const currentExp = new Set(merged.expertise || []);
            updates.addExpertise.forEach((exp) => currentExp.add(exp));
            merged.expertise = Array.from(currentExp);
          }
          if (updates.warning_note !== undefined) {
            merged.warning_note = updates.warning_note;
          }
          return merged;
        });
        updatedLecturersList = next.filter((l) => idSet.has(l.id));
        try {
          localStorage.setItem(
            STORED_CUSTOM_LECTURERS_KEY,
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });

      // Perbarui kuota slot tersedia di plotting semester jika diubah
      if (updates.available !== undefined) {
        setTermPlottings((prev) => {
          const next = prev.map((tp) => {
            if (idSet.has(tp.lecturer_id)) {
              return { ...tp, available: updates.available };
            }
            return tp;
          });
          try {
            localStorage.setItem(
              STORED_CUSTOM_PLOTTINGS_KEY,
              JSON.stringify(next),
            );
          } catch {}
          return next;
        });
      }

      // Sinkronisasi rating & warning_note
      ids.forEach((id) => {
        const labelPatch = {};
        if (updates.rating !== undefined) labelPatch.rating = updates.rating;
        if (updates.warning_note !== undefined)
          labelPatch.warning_note = updates.warning_note;
        if (Object.keys(labelPatch).length) {
          queueLecturerLabels(id, labelPatch);
        }
        broadcastLocalChange("LECTURER_MUTATION", {
          eventType: "UPDATE",
          id,
        });
      });

      if (USE_SUPABASE && !isDemoSession && updatedLecturersList.length) {
        try {
          await upsertRows(
            "lecturers",
            serializeLecturersForDatabase(updatedLecturersList, false),
            "id",
          );
        } catch (err) {
          console.warn("Supabase bulk edit sync:", err);
        }
      }
    },
    [isDemoSession, queueLecturerLabels],
  );

  const handleRegisterTutor = useCallback(
    async (formData) => {
      const submission = {
        id: formData.id || `FKIP${Date.now().toString().slice(-4)}`,
        degree: formData.degree || "",
        name: formData.name || "",
        email: formData.email || "",
        phone: formData.phone || "",
        expertise: formData.expertise || [],
        plotted: formData.plotted || [],
        available: Number(formData.available) || 0,
        warning_note: formData.warning_note || "",
        status: "pending",
        submittedAt: new Date().toISOString(),
      };

      unstoreDeletedLecturerId(submission.id);

      // Masukkan ke antrean submissions / approvals
      setSubmissions((prev) => {
        const filtered = prev.filter((s) => s.id !== submission.id);
        return [submission, ...filtered];
      });

      broadcastLocalChange("SUBMISSION_MUTATION", {
        eventType: "INSERT",
        id: submission.id,
        new: submission,
      });

      if (USE_SUPABASE) {
        try {
          await upsertRows("tutor_submissions", [submission], "id");
        } catch (err) {
          console.warn("Direct Supabase submission:", err);
        }
      }
    },
    [],
  );

  const props = {
    lecturers: pageLecturers,
    directoryLecturers: lecturers,
    setLecturers: pageSetLecturers,
    setTermLecturers: setTermScopedLecturers,
    courses,
    setCourses,
    terms,
    setTerms,
    setTermPlottings,
    selectedTermCode: effectiveSelectedTermCode,
    courseClassPlans,
    setCourseClassPlans,
    onActiveTermChange: setSelectedTermCode,
    canSyncData: !isDemoSession,
    canSyncLecturerLabels,
    onLecturerLabelChange: queueLecturerLabels,
    onDiscardLecturerLabelChange: discardLecturerLabels,
    onDeleteLecturer: handleDeleteLecturer,
    onBulkDeleteLecturers: handleBulkDeleteLecturers,
    onBulkEditLecturers: handleBulkEditLecturers,
    onSaveLecturer: (item) => {
      if (item?.id) {
        unstoreDeletedLecturerId(item.id);
        broadcastLocalChange("LECTURER_MUTATION", {
          eventType: "UPDATE",
          id: item.id,
          new: item,
        });
      }
    },
    // Approval props
    submissions,
    onApproveSubmission: handleApproveSubmission,
    onRejectSubmission: handleRejectSubmission,
    onDeleteSubmission: handleDeleteSubmission,
    onSyncApprovedToDirectory: handleSyncApprovedToDirectory,
  };
  const pendingLecturerLabelCount = Object.keys(
    pendingLecturerLabelChanges,
  ).length;
  const saveNowDisabled =
    syncState === "loading" ||
    syncState === "saving" ||
    (syncState === "saved" && pendingLecturerLabelCount === 0);

  const effectiveLecturers = lecturers.length ? lecturers : DEMO_LECTURERS;
  const effectiveCourses = courses.length ? courses : DEMO_COURSES;
  const effectiveTerms = terms.length ? terms : DEMO_TERMS;
  const effectiveTermPlottings = termPlottings.length ? termPlottings : DEMO_TERM_PLOTTINGS;

  const dashboardTotalDosen = lecturers.length || 12;
  const dashboardTotalCourses = courses.length || 10;
  const dashboardActiveTerm = terms.find((t) => t.active) || terms[0] || DEMO_TERMS[0];
  const dashboardTotalSlots = useMemo(() => {
    const activeCode = dashboardActiveTerm?.code;
    const plottingsForTerm = termPlottings.filter((tp) => tp.term_code === activeCode);
    if (plottingsForTerm.length) {
      return plottingsForTerm.reduce((sum, p) => sum + Math.max(0, Number(p.available || 0)), 0);
    }
    if (lecturers.length) {
      return lecturers.reduce((sum, l) => sum + Math.max(0, Number(l.available || 0)), 0);
    }
    return 20;
  }, [lecturers, termPlottings, dashboardActiveTerm]);

  if (entryMode === "landing")
    return (
      <>
        <LandingScreen
          sampleLecturers={DEMO_LECTURERS}
          courses={effectiveCourses}
          terms={effectiveTerms}
          termPlottings={DEMO_TERM_PLOTTINGS}
          selectedTermCode="DEMO-2026-1"
          realtimeStats={{
            totalDosen: dashboardTotalDosen,
            totalCourses: dashboardTotalCourses,
            activeTerm: dashboardActiveTerm,
            totalSlots: dashboardTotalSlots,
          }}
          onPublicMode={(lookupId) => {
            if (typeof lookupId === "string" && lookupId) {
              setInitialPublicLookupId(lookupId);
            } else {
              setInitialPublicLookupId("");
            }
            setEntryMode("public");
          }}
          onLoginMode={() => setEntryMode("login")}
          onOpenTutorForm={() => setEntryMode("tutor-form")}
          promptInstall={promptInstall}
          isInstalled={isInstalled}
          isOnline={isOnline}
        />
        <InstallGuideModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          onDirectInstall={promptInstall}
          hasPrompt={isInstallable}
        />
      </>
    );
  if (entryMode === "tutor-form")
    return (
      <TutorFormScreen
        courses={courses.length ? courses : DEMO_COURSES}
        terms={terms.length ? terms : DEMO_TERMS}
        onRegisterTutor={handleRegisterTutor}
        onBack={() => setEntryMode("landing")}
        onGoToDashboard={() => setEntryMode("login")}
      />
    );
  if (entryMode === "public")
    return (
      <PublicLookupScreen
        lecturers={effectiveLecturers}
        courses={effectiveCourses}
        terms={effectiveTerms}
        termPlottings={effectiveTermPlottings}
        selectedTermCode={effectiveSelectedTermCode}
        setSelectedTermCode={setSelectedTermCode}
        dbStatus={dbStatus}
        isHydrated={isHydrated}
        initialId={initialPublicLookupId}
        onBack={() => {
          setInitialPublicLookupId("");
          setEntryMode("landing");
        }}
        onLogin={() => setEntryMode("login")}
        onRefresh={loadPublicDirectory}
      />
    );
  if (!userEmail)
    return (
      <>
        <LoginScreen
          onLogin={handleLogin}
          onDemoLogin={handleDemoLogin}
          onBack={() => setEntryMode("landing")}
          promptInstall={promptInstall}
          isInstalled={isInstalled}
          isOnline={isOnline}
        />
        <InstallGuideModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          onDirectInstall={promptInstall}
          hasPrompt={isInstallable}
        />
        <AccessibilityWidget />
      </>
    );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-mesh-pattern pb-16 text-[#0f1e36]">
      {/* Skip to Content for Screen Readers and Keyboard Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-[#005baa] focus:text-white focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-2xl focus:font-bold focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        Loncat ke Konten Utama (Skip to Content)
      </a>

      <TopNavigation
        active={active}
        setActive={setActive}
        onLogout={handleLogout}
        pendingCount={submissions.filter((s) => s.status === "pending").length}
        terms={terms}
        selectedTermCode={effectiveSelectedTermCode}
        setSelectedTermCode={setSelectedTermCode}
        dbStatus={dbStatus}
        syncState={syncState}
        userEmail={userEmail}
        isDemoSession={isDemoSession}
        handleSaveNow={handleSaveNow}
        saveNowDisabled={saveNowDisabled}
        pendingLecturerLabelCount={pendingLecturerLabelCount}
        isOnline={isOnline}
        realtimeStatus={realtimeStatus}
      />
      <main id="main-content" tabIndex={-1} className="min-w-0 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 outline-none">
        <div className="w-full">
          <Header
            active={active}
            terms={terms}
            selectedTermCode={effectiveSelectedTermCode}
            setSelectedTermCode={setSelectedTermCode}
          />
          <motion.div
            key={`${active}-${effectiveSelectedTermCode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ErrorBoundary>
              <Page {...props} />
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      {/* Floating Realtime Update Toast */}
      {realtimeToast && (
        <div
          role="status"
          className="fixed bottom-20 right-5 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold shadow-xl border backdrop-blur-md transition-all bg-[#102F52]/95 text-white border-cyan-400/40"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span>{realtimeToast.message}</span>
          <button
            type="button"
            onClick={() => setRealtimeToast(null)}
            className="ml-2 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Offline / Online Connection Toast */}
      {networkToast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold shadow-xl border backdrop-blur-md transition-all ${
            networkToast.type === "online"
              ? "bg-emerald-950/95 text-white border-emerald-500/40"
              : "bg-amber-950/95 text-white border-amber-500/40"
          }`}
        >
          {networkToast.type === "online" ? (
            <Icons.cloud className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <Icons.cloudOff className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span>{networkToast.message}</span>
          <button
            type="button"
            onClick={() => setNetworkToast(null)}
            className="ml-2 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Install Guide Modal */}
      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onDirectInstall={promptInstall}
        hasPrompt={isInstallable}
      />

      {/* Floating Accessibility Widget & Global Keyboard Shortcuts */}
      <AccessibilityWidget onNavigate={setActive} activeTab={active} />
    </div>
  );
}
