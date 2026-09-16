import { useMemo, useRef, useState } from "react";
import {
  buildPlottingImportReview,
  readImportFile,
} from "../lib/importExport.js";

export function createPlottingComponent(deps) {
  const {
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
  } = deps;
  const AUTO_PILOT_WORKER_TIMEOUT_MS = 15_000;

  function PlannedClassCountInput({ planned, max, onCommit }) {
    const [draft, setDraft] = useState(null);
    const commit = () => {
      if (draft === null) return;
      const value = String(draft).trim();
      setDraft(null);
      if (value) onCommit(value);
    };

    return (
      <input
        type="number"
        min="0"
        max={max}
        value={draft ?? planned}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-28 rounded-lg border border-[#dce9e6] bg-[#fffffb] px-2 py-2 text-sm font-normal text-[#26353f] outline-none focus:border-[#9bbfe8]"
      />
    );
  }

  function runAutoPilotOnMainThread(payload) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          const buildPlotting =
            payload.strategy === "rebalance"
              ? buildRebalancedPlotting
              : buildAutoPilotPlotting;
          resolve(
            buildPlotting(
              payload.lecturers,
              payload.courses,
              payload.classCounts,
              payload.assignmentMap,
            ),
          );
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }

  function runAutoPilotCalculation(payload) {
    if (typeof Worker === "undefined")
      return runAutoPilotOnMainThread(payload);

    return new Promise((resolve, reject) => {
      let worker;
      let settled = false;
      let timeoutId;
      const finishWorker = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        worker?.terminate();
      };
      const fallBackToMainThread = () => {
        if (settled) return;
        settled = true;
        finishWorker();
        runAutoPilotOnMainThread(payload).then(resolve, reject);
      };
      try {
        worker = new Worker(
          new URL("../workers/autoPilot.worker.js", import.meta.url),
          { type: "module" },
        );
      } catch {
        fallBackToMainThread();
        return;
      }
      timeoutId = window.setTimeout(
        fallBackToMainThread,
        AUTO_PILOT_WORKER_TIMEOUT_MS,
      );
      worker.onmessage = (event) => {
        if (settled) return;
        settled = true;
        finishWorker();
        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }
        resolve(event.data.result);
      };
      worker.onerror = (event) => {
        event.preventDefault?.();
        fallBackToMainThread();
      };
      try {
        worker.postMessage(payload);
      } catch {
        fallBackToMainThread();
      }
    });
  }

  function Plotting({
    lecturers,
    setLecturers,
    courses,
    terms = [],
    selectedTermCode,
    courseClassPlans,
    setCourseClassPlans,
  }) {
    const importInputRef = useRef(null);
    const [plottingMode, setPlottingMode] = useState("course");
    const [query, setQuery] = useState("");
    const [lecturerSort, setLecturerSort] = useState("Default");
    const [lecturerHeaderSort, setLecturerHeaderSort] = useState("name");
    const [lecturerHeaderSortDirection, setLecturerHeaderSortDirection] =
      useState("asc");
    const [lecturerPlottedFilter, setLecturerPlottedFilter] = useState("Semua");
    const [selectedExpertiseFilter, setSelectedExpertiseFilter] = useState("Semua");
    const [importMessage, setImportMessage] = useState("");
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [healthDetailsOpen, setHealthDetailsOpen] = useState(false);

    const FKIP_EXPERTISE_FILTERS = [
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
    ];
    const [importReview, setImportReview] = useState(null);
    const [autoPilotReview, setAutoPilotReview] = useState(null);
    const [autoPilotPreview, setAutoPilotPreview] = useState(null);
    const [autoPilotUndo, setAutoPilotUndo] = useState(null);
    const [autoPilotRunning, setAutoPilotRunning] = useState(false);
    const [autoPilotRunMode, setAutoPilotRunMode] = useState("");
    const [exportBusy, setExportBusy] = useState(false);
    const [selectedCourseCode, setSelectedCourseCode] = useState("");
    const [selectedLecturerId, setSelectedLecturerId] = useState("");
    const [classCountReduction, setClassCountReduction] = useState(null);
    const [swapDraft, setSwapDraft] = useState(null);
    const [swapUndo, setSwapUndo] = useState(null);
    const plannedCounts = useMemo(
      () => getCourseClassPlan(courseClassPlans, selectedTermCode),
      [courseClassPlans, selectedTermCode],
    );
    const assignmentMap = useMemo(
      () =>
        getCourseClassAssignmentPlan(
          courseClassPlans,
          selectedTermCode,
          lecturers,
          courses,
        ),
      [courseClassPlans, selectedTermCode, lecturers, courses],
    );
    const classCounts = useMemo(
      () =>
        getCourseClassCounts(lecturers, courses, plannedCounts, assignmentMap),
      [lecturers, courses, plannedCounts, assignmentMap],
    );
    const plannedTotal = courses.reduce(
      (sum, course) => sum + (classCounts[course.code] || 0),
      0,
    );
    const assignedTotal = courses.reduce(
      (sum, course) =>
        sum + (assignmentMap[course.code] || []).filter(Boolean).length,
      0,
    );
    const plottingHealth = useMemo(
      () =>
        calculatePlottingHealth(lecturers, courses, classCounts, assignmentMap),
      [lecturers, courses, classCounts, assignmentMap],
    );
    const visibleCourses = courses
      .filter(
        (course) =>
          includes(course.code, query) || includes(course.title, query),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
    const sortLecturerHeader = (value) => {
      setLecturerHeaderSortDirection((current) =>
        lecturerHeaderSort === value
          ? current === "asc"
            ? "desc"
            : "asc"
          : "asc",
      );
      setLecturerHeaderSort(value);
      setLecturerSort("Default");
    };
    const lecturerSortHeader = (label, value) => (
      <button
        type="button"
        onClick={() => sortLecturerHeader(value)}
        className="inline-flex items-center gap-1 font-medium uppercase tracking-[0.15em] text-[#6d7d86] hover:text-[#005baa]"
      >
        {label}
        {lecturerHeaderSort === value && (
          <span>{lecturerHeaderSortDirection === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    );
    const visibleLecturers = lecturers
      .filter((lecturer) =>
        [
          lecturer.id,
          lecturer.name,
          lecturer.degree,
          lecturer.expertise.join(" "),
          plottedCourseTitles(lecturer, courses).join(" "),
        ].some((value) => includes(value, query)),
      )
      .filter(
        (lecturer) =>
          lecturerPlottedFilter === "All" ||
          lecturerPlottedFilter === "Semua" ||
          String(lecturer.plotted.length) === lecturerPlottedFilter,
      )
      .filter(
        (lecturer) =>
          selectedExpertiseFilter === "Semua" ||
          (lecturer.expertise || []).some((e) =>
            String(e).toLowerCase().includes(selectedExpertiseFilter.toLowerCase()),
          ),
      )
      .sort((a, b) => {
        if (
          (lecturerSort === "Default" || lecturerSort === "Standar") &&
          lecturerHeaderSort
        ) {
          const result = String(a[lecturerHeaderSort] ?? "").localeCompare(
            String(b[lecturerHeaderSort] ?? ""),
          );
          return lecturerHeaderSortDirection === "asc" ? result : -result;
        }
        if (
          lecturerSort === "Not plotted first" ||
          lecturerSort === "Belum terplot dahulu"
        ) {
          return (
            Number(a.plotted.length > 0) - Number(b.plotted.length > 0) ||
            a.name.localeCompare(b.name)
          );
        }
        if (
          lecturerSort === "Most plotted first" ||
          lecturerSort === "Terplot terbanyak dahulu"
        ) {
          return (
            b.plotted.length - a.plotted.length || a.name.localeCompare(b.name)
          );
        }
        return a.name.localeCompare(b.name);
      });
    const selectedLecturer = lecturers.find(
      (lecturer) => lecturer.id === selectedLecturerId,
    );
    const selectedLecturerCourseCounts = useMemo(
      () =>
        Object.fromEntries(
          getPlottedCourseCounts(selectedLecturer?.plotted || []).map(
            ({ code, count }) => [code, count],
          ),
        ),
      [selectedLecturer],
    );
    const getLecturerAssignmentEntries = (lecturerId) =>
      courses.flatMap((course) =>
        (assignmentMap[course.code] || []).flatMap((assignedId, classIndex) =>
          assignedId === lecturerId
            ? [
                {
                  key: `${course.code}:${classIndex}`,
                  course,
                  courseCode: course.code,
                  classIndex,
                  className: `${course.code}.${classIndex + 1}`,
                },
              ]
            : [],
        ),
      );
    const getCourseSwapTargetEntries = (courseCode, sourceLecturerId) => {
      const course = courses.find((item) => item.code === courseCode);
      if (!course) return [];
      return (assignmentMap[courseCode] || []).flatMap(
        (lecturerId, classIndex) => {
          const lecturer = lecturers.find((item) => item.id === lecturerId);
          return lecturerId &&
            lecturerId !== sourceLecturerId &&
            lecturer
            ? [
                {
                  key: `${courseCode}:${classIndex}`,
                  lecturer,
                  lecturerId,
                  course,
                  courseCode,
                  classIndex,
                  className: `${courseCode}.${classIndex + 1}`,
                },
              ]
            : [];
        },
      );
    };
    const swapSourceLecturer = lecturers.find(
      (lecturer) => lecturer.id === swapDraft?.sourceLecturerId,
    );
    const swapTargetLecturer = lecturers.find(
      (lecturer) => lecturer.id === swapDraft?.targetLecturerId,
    );
    const swapSourceEntries = swapDraft
      ? getLecturerAssignmentEntries(swapDraft.sourceLecturerId)
      : [];
    const swapSourceEntry = swapSourceEntries.find(
      (entry) =>
        entry.courseCode === swapDraft?.sourceCourseCode &&
        entry.classIndex === swapDraft?.sourceClassIndex,
    );
    const swapTargetCourseOptions = swapDraft
      ? courses.filter(
          (course) =>
            getCourseSwapTargetEntries(
              course.code,
              swapDraft.sourceLecturerId,
            ).length > 0,
        )
      : [];
    const swapTargetEntries = swapDraft
      ? (() => {
          const rankedEntries = getCourseSwapTargetEntries(
            swapDraft.targetCourseCode,
            swapDraft.sourceLecturerId,
          )
            .map((entry) => {
              const targetMatchesSource = Boolean(
                swapSourceEntry &&
                  expertiseMatchesCourse(entry.lecturer, swapSourceEntry.course),
              );
              const sourceMatchesTarget = Boolean(
                swapSourceLecturer &&
                  expertiseMatchesCourse(swapSourceLecturer, entry.course),
              );
              return {
                ...entry,
                targetMatchesSource,
                sourceMatchesTarget,
                recommendationScore:
                  Number(targetMatchesSource) * 100 +
                  Number(sourceMatchesTarget) * 40 +
                  Number(entry.lecturer.rating || 0) * 5,
              };
            })
            .sort(
              (a, b) =>
                b.recommendationScore - a.recommendationScore ||
                a.lecturer.name.localeCompare(b.lecturer.name) ||
                a.classIndex - b.classIndex,
            );
          const hasExpertiseRecommendation = rankedEntries.some(
            (entry) => entry.targetMatchesSource,
          );
          return rankedEntries.map((entry, index) => {
            const fallbackRecommendation =
              !hasExpertiseRecommendation && index === 0;
            const recommended =
              entry.targetMatchesSource || fallbackRecommendation;
            return {
              ...entry,
              recommended,
              fallbackRecommendation,
              recommendationLabel: entry.targetMatchesSource
                ? entry.sourceMatchesTarget
                  ? "Disarankan: kecocokan keahlian dua arah"
                  : "Disarankan: keahlian kelas penerima cocok"
                : fallbackRecommendation
                  ? "Rekomendasi alternatif: kandidat berperingkat tertinggi"
                  : "",
            };
          });
        })()
      : [];
    const recommendedSwapTargetEntries = swapTargetEntries.filter(
      (entry) => entry.recommended,
    );
    const otherSwapTargetEntries = swapTargetEntries.filter(
      (entry) => !entry.recommended,
    );
    const swapTargetEntry = swapTargetEntries.find(
      (entry) =>
        entry.courseCode === swapDraft?.targetCourseCode &&
        entry.classIndex === swapDraft?.targetClassIndex &&
        entry.lecturerId === swapDraft?.targetLecturerId,
    );
    const swapExpertiseWarnings = [
      swapSourceLecturer &&
      swapTargetEntry &&
      !expertiseMatchesCourse(swapSourceLecturer, swapTargetEntry.course)
        ? `${swapSourceLecturer.name} tidak memiliki keahlian yang terdaftar untuk ${swapTargetEntry.course.title}.`
        : "",
      swapTargetLecturer &&
      swapSourceEntry &&
      !expertiseMatchesCourse(swapTargetLecturer, swapSourceEntry.course)
        ? `${swapTargetLecturer.name} tidak memiliki keahlian yang terdaftar untuk ${swapSourceEntry.course.title}.`
        : "",
    ].filter(Boolean);
    const canConfirmSwap = Boolean(
      swapSourceLecturer &&
        swapTargetLecturer &&
        swapSourceEntry &&
        swapTargetEntry &&
        swapSourceLecturer.id !== swapTargetLecturer.id,
    );
    const selectedLecturerHasSwapTarget = Boolean(
      selectedLecturer &&
        courses.some(
          (course) =>
            getCourseSwapTargetEntries(course.code, selectedLecturer.id).length >
            0,
        ),
    );
    const openClassSwap = (lecturerId, preferredCourseCode) => {
      const sourceEntries = getLecturerAssignmentEntries(lecturerId);
      const sourceEntry =
        sourceEntries.find(
          (entry) => entry.courseCode === preferredCourseCode,
        ) || sourceEntries[0];
      if (!sourceEntry) return;
      setSwapDraft({
        termCode: selectedTermCode,
        sourceLecturerId: lecturerId,
        sourceCourseCode: sourceEntry.courseCode,
        sourceClassIndex: sourceEntry.classIndex,
        targetLecturerId: "",
        targetCourseCode: "",
        targetClassIndex: -1,
      });
    };
    const confirmClassSwap = () => {
      if (!canConfirmSwap || swapDraft.termCode !== selectedTermCode) return;
      const previousAssignmentMap = JSON.parse(JSON.stringify(assignmentMap));
      const nextAssignmentMap = swapAssignmentSlots(
        assignmentMap,
        {
          courseCode: swapSourceEntry.courseCode,
          classIndex: swapSourceEntry.classIndex,
        },
        {
          courseCode: swapTargetEntry.courseCode,
          classIndex: swapTargetEntry.classIndex,
        },
      );
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts,
            assignments: {
              ...assignments,
              [swapSourceEntry.courseCode]:
                nextAssignmentMap[swapSourceEntry.courseCode],
              [swapTargetEntry.courseCode]:
                nextAssignmentMap[swapTargetEntry.courseCode],
            },
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, nextAssignmentMap),
      );
      setSwapUndo({
        termCode: selectedTermCode,
        assignmentMap: previousAssignmentMap,
        description: `${swapSourceLecturer.name}: ${swapSourceEntry.className} dan ${swapTargetLecturer.name}: ${swapTargetEntry.className}`,
      });
      setAutoPilotUndo(null);
      setAutoPilotReview(null);
      setImportMessage(
        `Menukar ${swapSourceEntry.className} (${swapSourceLecturer.name}) dengan ${swapTargetEntry.className} (${swapTargetLecturer.name}).`,
      );
      setSwapDraft(null);
      setSelectedLecturerId("");
    };
    const undoClassSwap = () => {
      if (!swapUndo || swapUndo.termCode !== selectedTermCode) return;
      setCourseClassPlans((prev) => {
        const { counts } = getCoursePlanParts(prev, selectedTermCode);
        return {
          ...prev,
          [selectedTermCode]: {
            counts,
            assignments: swapUndo.assignmentMap,
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(
          prev,
          courses,
          swapUndo.assignmentMap,
        ),
      );
      setAutoPilotUndo(null);
      setAutoPilotReview(null);
      setImportMessage(`Mengembalikan alokasi sebelum ${swapUndo.description}.`);
      setSwapUndo(null);
    };
    const applyCoursePlanCount = (courseCode, value) => {
      const count = toClassCount(value);
      const nextCourseAssignments = resizeCourseAssignments(
        assignmentMap[courseCode],
        count,
      );
      const nextAssignmentMap = {
        ...assignmentMap,
        [courseCode]: nextCourseAssignments,
      };
      setSwapUndo(null);
      setAutoPilotReview(null);
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts: { ...counts, [courseCode]: count },
            assignments: {
              ...assignments,
              [courseCode]: nextCourseAssignments,
            },
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, nextAssignmentMap),
      );
    };
    const commitCoursePlanCount = (course, value) => {
      const count = toClassCount(value);
      const currentCount = classCounts[course.code] || 0;
      if (count === currentCount) return;
      if (count < currentCount) {
        const removedAssignments = (assignmentMap[course.code] || [])
          .slice(count, currentCount)
          .filter(Boolean).length;
        setClassCountReduction({
          courseCode: course.code,
          courseTitle: course.title,
          currentCount,
          nextCount: count,
          removedAssignments,
        });
        return;
      }
      applyCoursePlanCount(course.code, count);
    };
    const cancelClassCountReduction = () => {
      setClassCountReduction(null);
    };
    const confirmClassCountReduction = () => {
      if (!classCountReduction) return;
      applyCoursePlanCount(
        classCountReduction.courseCode,
        classCountReduction.nextCount,
      );
      setClassCountReduction(null);
    };
    const assignLecturer = (courseCode, classIndex, lecturerId) => {
      const count = classCounts[courseCode] || 0;
      const nextCourseAssignments = Array.from(
        { length: count },
        (_, index) => assignmentMap[courseCode]?.[index] || "",
      );
      const currentLecturerId = nextCourseAssignments[classIndex] || "";
      const lecturer = lecturers.find((item) => item.id === lecturerId);
      const lecturerLimit = lecturer
        ? getLecturerRatingClassLimit(lecturer)
        : LECTURER_CLASS_LIMIT;
      if (
        lecturerId &&
        lecturerId !== currentLecturerId &&
        countLecturerAssignments(assignmentMap, lecturerId) >= lecturerLimit
      )
        return;
      nextCourseAssignments[classIndex] = lecturerId;
      const nextAssignmentMap = {
        ...assignmentMap,
        [courseCode]: nextCourseAssignments,
      };
      setSwapUndo(null);
      setAutoPilotReview(null);
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts: {
              ...counts,
              [courseCode]: Math.max(toClassCount(counts[courseCode]), count),
            },
            assignments: {
              ...assignments,
              [courseCode]: nextCourseAssignments,
            },
          },
        };
      });
      setLecturers((prev) => {
        return applyCourseAssignmentsToLecturers(
          prev,
          courses,
          nextAssignmentMap,
        );
      });
    };
    const clearCourseAssignments = (courseCode) => {
      const count = classCounts[courseCode] || 0;
      const nextCourseAssignments = Array.from({ length: count }, () => "");
      const nextAssignmentMap = {
        ...assignmentMap,
        [courseCode]: nextCourseAssignments,
      };
      setSwapUndo(null);
      setAutoPilotReview(null);
      setImportMessage("");
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts: {
              ...counts,
              [courseCode]: Math.max(toClassCount(counts[courseCode]), count),
            },
            assignments: {
              ...assignments,
              [courseCode]: nextCourseAssignments,
            },
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, nextAssignmentMap),
      );
    };
    const setLecturerCourseCount = (
      courseCode,
      value,
      lecturerId = selectedLecturer?.id,
    ) => {
      if (!lecturerId) return;
      const currentAssignments = assignmentMap[courseCode] || [];
      const currentCount = currentAssignments.filter(
        (id) => id === lecturerId,
      ).length;
      const lecturerTotal = countLecturerAssignments(assignmentMap, lecturerId);
      const lecturer = lecturers.find((item) => item.id === lecturerId);
      const lecturerLimit = lecturer
        ? getLecturerRatingClassLimit(lecturer)
        : LECTURER_CLASS_LIMIT;
      const maxCountForCourse =
        currentCount + Math.max(0, lecturerLimit - lecturerTotal);
      const requestedCount = Math.min(toClassCount(value), maxCountForCourse);
      if (requestedCount === currentCount) return;

      let nextCourseAssignments = [...currentAssignments];
      if (requestedCount > currentCount) {
        const additions = requestedCount - currentCount;
        let remaining = additions;
        nextCourseAssignments = nextCourseAssignments.map((id) => {
          if (remaining > 0 && !id) {
            remaining -= 1;
            return lecturerId;
          }
          return id;
        });
        while (remaining > 0) {
          nextCourseAssignments.push(lecturerId);
          remaining -= 1;
        }
      } else {
        let remaining = currentCount - requestedCount;
        for (
          let index = nextCourseAssignments.length - 1;
          index >= 0 && remaining > 0;
          index -= 1
        ) {
          if (nextCourseAssignments[index] === lecturerId) {
            nextCourseAssignments[index] = "";
            remaining -= 1;
          }
        }
      }

      const nextAssignmentMap = {
        ...assignmentMap,
        [courseCode]: nextCourseAssignments,
      };
      setSwapUndo(null);
      setAutoPilotReview(null);
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts: {
              ...counts,
              [courseCode]: Math.max(
                toClassCount(counts[courseCode]),
                nextCourseAssignments.length,
              ),
            },
            assignments: {
              ...assignments,
              [courseCode]: nextCourseAssignments,
            },
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, nextAssignmentMap),
      );
    };
    const handleImport = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setImportMessage("");
      setAutoPilotReview(null);
      try {
        if (!selectedTermCode)
          throw new Error(
            "Buat atau pilih semester terlebih dahulu sebelum mengimpor data plotting.",
          );
        const rawRows = await readImportFile(file, {
          parseCSV,
          rowsToObjects,
          parseXLSX,
        });
        const imported = mapImportedPlottingRows(rawRows, lecturers, courses);
        const importedClassCount = Object.values(imported.counts).reduce(
          (sum, count) => sum + count,
          0,
        );
        if (!importedClassCount)
          throw new Error(
            "Tidak ditemukan baris plotting yang valid. Gunakan kolom ID + Course_Code, atau Idtutor, Nama, Kelas, dan Nama MK.",
          );
        setImportReview(
          buildPlottingImportReview(rawRows, imported, lecturers, courses),
        );
      } catch (error) {
        setImportMessage(error.message || "Gagal mengimpor.");
      } finally {
        event.target.value = "";
      }
    };
    const runPlottingExport = async () => {
      if (exportBusy) return;
      setExportBusy(true);
      setImportMessage("");
      try {
        const result = await exportPlottingToXLSX(
          lecturers,
          courses,
          plannedCounts,
          assignmentMap,
        );
        if (!result) throw new Error("Tidak ada data plotting untuk diekspor.");
        setImportMessage(
          result.cancelled
            ? "Ekspor dibatalkan."
            : `Ekspor dimulai: ${result.filename}`,
        );
      } catch (error) {
        setImportMessage(`Ekspor gagal: ${error.message || "Terjadi kesalahan"}`);
      } finally {
        setExportBusy(false);
      }
    };
    const runPlottingTemplateExport = async () => {
      if (exportBusy || typeof exportPlottingTemplateToXLSX !== "function") return;
      setExportBusy(true);
      setImportMessage("");
      try {
        const result = await exportPlottingTemplateToXLSX();
        if (result && !result.cancelled) {
          setImportMessage(`Template diunduh: ${result.filename}`);
        }
      } catch (error) {
        setImportMessage(
          `Gagal mengunduh template: ${error.message || "Terjadi kesalahan"}`
        );
      } finally {
        setExportBusy(false);
      }
    };
    const runPlottingPDFExport = () => {
      if (typeof exportPlottingToPDF !== "function") return;
      const currentTerm =
        (terms || []).find((t) => t.code === selectedTermCode) ||
        terms?.[0] || {
          code: selectedTermCode || "20261",
          name: "2026/2027 Ganjil",
          ay: "2026/2027",
          semester: "Ganjil",
        };
      exportPlottingToPDF(
        lecturers,
        courses,
        classCounts || plannedCounts,
        assignmentMap,
        currentTerm,
      );
    };
    const applyImportReview = () => {
      if (!importReview) return;
      setSwapUndo(null);
      const nextAssignmentMap = mergeAssignmentMapWithLecturerLimit(
        assignmentMap,
        importReview.imported.assignments,
        lecturers,
      );
      setCourseClassPlans((prev) => {
        const { counts, assignments } = getCoursePlanParts(
          prev,
          selectedTermCode,
        );
        return {
          ...prev,
          [selectedTermCode]: {
            counts: { ...counts, ...importReview.imported.counts },
            assignments: { ...assignments, ...nextAssignmentMap },
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, nextAssignmentMap),
      );
      const firstImportedCourseCode =
        Object.keys(importReview.imported.counts)[0] || "";
      if (firstImportedCourseCode)
        setSelectedCourseCode(firstImportedCourseCode);
      setImportMessage(
        `Berhasil mengimpor ${importReview.importedClassCount} baris data plotting.`,
      );
      setImportReview(null);
    };
    const runPlottingProposal = async (mode = "auto-pilot") => {
      if (!selectedTermCode) {
        setAutoPilotReview({
          notes: [
            `Buat atau pilih semester terlebih dahulu sebelum menjalankan ${mode === "rebalance" ? "penyeimbangan beban" : "auto-pilot plotting"}.`,
          ],
          warnings: [],
          explanations: [],
          metrics: null,
          mode,
        });
        return;
      }
      if (autoPilotRunning) return;
      setAutoPilotRunning(true);
      setAutoPilotRunMode(mode);
      setImportMessage("");
      try {
        const result = await runAutoPilotCalculation({
          lecturers,
          courses,
          classCounts,
          assignmentMap,
          strategy: mode,
        });
        const nextCounts = Object.fromEntries(
          courses.map((course) => [course.code, classCounts[course.code] || 0]),
        );
        setAutoPilotPreview({ result, nextCounts, mode });
      } catch (error) {
        setAutoPilotReview({
          notes: [
            `${mode === "rebalance" ? "Penyeimbangan beban" : "Auto-pilot"} tidak dapat diselesaikan: ${error.message || "Terjadi kesalahan"}`,
          ],
          warnings: [],
          explanations: [],
          metrics: null,
          mode,
        });
      } finally {
        setAutoPilotRunning(false);
        setAutoPilotRunMode("");
      }
    };
    const runAutoPilot = () => runPlottingProposal("auto-pilot");
    const runRebalance = () => runPlottingProposal("rebalance");
    const applyAutoPilot = () => {
      if (!autoPilotPreview) return;
      setSwapUndo(null);
      const { result, nextCounts, mode } = autoPilotPreview;
      setAutoPilotUndo({
        assignmentMap: JSON.parse(JSON.stringify(assignmentMap)),
        counts: { ...plannedCounts },
        mode,
      });
      setCourseClassPlans((prev) => {
        const { counts } = getCoursePlanParts(prev, selectedTermCode);
        return {
          ...prev,
          [selectedTermCode]: {
            counts: { ...counts, ...nextCounts },
            assignments: result.assignmentMap,
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(prev, courses, result.assignmentMap),
      );
      setAutoPilotReview({
        notes: result.reviewNotes,
        warnings: result.conflictWarnings,
        explanations: result.assignmentExplanations,
        metrics: result.metrics,
        mode,
      });
      const firstAssignedCourseCode =
        courses.find((course) =>
          result.assignmentMap[course.code]?.some(Boolean),
        )?.code || "";
      if (firstAssignedCourseCode)
        setSelectedCourseCode(firstAssignedCourseCode);
      setImportMessage(
        mode === "rebalance"
          ? `Berhasil menyeimbangkan ${result.reassignments?.length || 0} alokasi kelas.`
          : `Menerapkan proposal auto-pilot dengan ${result.metrics.newlyAssignedCount} alokasi baru.`,
      );
      setAutoPilotPreview(null);
    };
    const undoAutoPilot = () => {
      if (!autoPilotUndo) return;
      setSwapUndo(null);
      setCourseClassPlans((prev) => {
        const { counts } = getCoursePlanParts(prev, selectedTermCode);
        return {
          ...prev,
          [selectedTermCode]: {
            counts: { ...counts, ...autoPilotUndo.counts },
            assignments: autoPilotUndo.assignmentMap,
          },
        };
      });
      setLecturers((prev) =>
        applyCourseAssignmentsToLecturers(
          prev,
          courses,
          autoPilotUndo.assignmentMap,
        ),
      );
      setAutoPilotReview(null);
      setImportMessage(
        autoPilotUndo.mode === "rebalance"
          ? "Mengembalikan alokasi sebelum penyeimbangan beban."
          : "Mengembalikan alokasi sebelum auto-pilot.",
      );
      setAutoPilotUndo(null);
    };
    const lecturerOptionsForCourse = (course) =>
      [...lecturers].sort(
        (a, b) =>
          Number(expertiseMatchesCourse(b, course)) -
            Number(expertiseMatchesCourse(a, course)) ||
          a.name.localeCompare(b.name),
      );
    const autoPilotNotes = autoPilotReview?.notes || [];
    const autoPilotWarnings = autoPilotReview?.warnings || [];
    const autoPilotExplanations = autoPilotReview?.explanations || [];
    const autoPilotMetrics = autoPilotReview?.metrics;
    const isRebalanceReview = autoPilotReview?.mode === "rebalance";
    return (
      <div className="space-y-5">
        <Card className={`p-4 relative transition-all duration-150 ${exportMenuOpen ? "z-50" : "z-20"}`}>
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(280px,1fr)_auto] xl:items-end">
            <label className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                Mode Plotting
              </span>
              <div className="relative">
                <select
                  value={plottingMode}
                  onChange={(event) => {
                    setPlottingMode(event.target.value);
                    setQuery("");
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-9 text-xs font-bold text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15 cursor-pointer"
                >
                  <option value="course">Plotting Berdasarkan Mata Kuliah</option>
                  <option value="lecturer">Plotting Berdasarkan Dosen</option>
                </select>
                <Icons.chevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#6f90af]" />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f6478]">
                Pencarian
              </span>
              <TextInput
                icon={Icons.search}
                value={query}
                onChange={setQuery}
                placeholder={
                  plottingMode === "course"
                    ? "Cari mata kuliah berdasarkan kode atau nama..."
                    : "Cari dosen berdasarkan ID, nama, keahlian, atau mata kuliah..."
                }
              />
            </label>
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f6478]">
                Aksi Plotting
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleImport}
                />
                <Button
                  className="h-11 whitespace-nowrap px-4 font-bold shadow-xs"
                  onClick={runAutoPilot}
                  disabled={!plannedTotal || autoPilotRunning}
                  aria-busy={autoPilotRunMode === "auto-pilot"}
                >
                  {autoPilotRunMode === "auto-pilot" ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icons.check className="h-4 w-4" />
                  )}
                  {autoPilotRunMode === "auto-pilot"
                    ? "Menjalankan Auto-Pilot..."
                    : "Jalankan Auto-Pilot"}
                </Button>
                <Button
                  variant="secondary"
                  className="h-11 whitespace-nowrap px-3"
                  onClick={runRebalance}
                  disabled={!assignedTotal || autoPilotRunning}
                  aria-busy={autoPilotRunMode === "rebalance"}
                  title="Seimbangkan beban alokasi"
                >
                  {autoPilotRunMode === "rebalance" ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-[#9bbfe8] border-t-[#005baa]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icons.swap className="h-4 w-4" />
                  )}
                  {autoPilotRunMode === "rebalance"
                    ? "Menyeimbangkan..."
                    : "Seimbangkan Beban"}
                </Button>
                {autoPilotUndo && (
                  <Button
                    variant="secondary"
                    className="h-11 whitespace-nowrap px-3 text-amber-700 hover:bg-amber-50"
                    onClick={undoAutoPilot}
                  >
                    Batal {autoPilotUndo.mode === "rebalance" ? "Seimbangkan" : "Auto-Pilot"}
                  </Button>
                )}

                {/* Dropdown Menu: Berkas & Ekspor */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className={`flex h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                      exportMenuOpen
                        ? "border-[#005baa] bg-blue-50/70 text-[#005baa] ring-2 ring-[#005baa]/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-[#102f52]"
                    }`}
                    aria-expanded={exportMenuOpen}
                  >
                    <Icons.download className="h-4 w-4 text-[#005baa]" />
                    <span>Berkas & Ekspor</span>
                    <Icons.chevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${exportMenuOpen ? "rotate-180 text-[#005baa]" : "text-slate-400"}`} />
                  </button>

                  {exportMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setExportMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl shadow-slate-900/20 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-2 border-b border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Kelola Data Plotting
                          </p>
                        </div>
                        <div className="p-1 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setExportMenuOpen(false);
                              importInputRef.current?.click();
                            }}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#005baa] transition-colors cursor-pointer text-left group"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#005baa] group-hover:text-white transition-colors">
                              <Icons.upload className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 group-hover:text-[#005baa]">Impor Plotting</p>
                              <p className="text-[11px] font-normal text-slate-400 truncate">Unggah berkas Excel (.xlsx) atau CSV</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExportMenuOpen(false);
                              runPlottingExport();
                            }}
                            disabled={!plannedTotal || exportBusy}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 cursor-pointer text-left group"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              <Icons.file className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 group-hover:text-emerald-700">
                                {exportBusy ? "Menyiapkan ekspor..." : "Ekspor Plotting XLSX"}
                              </p>
                              <p className="text-[11px] font-normal text-slate-400 truncate">Unduh data alokasi kelas spreadsheet</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExportMenuOpen(false);
                              runPlottingTemplateExport();
                            }}
                            disabled={exportBusy}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#005baa] transition-colors disabled:opacity-50 cursor-pointer text-left group"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005baa] group-hover:bg-[#005baa] group-hover:text-white transition-colors">
                              <Icons.download className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 group-hover:text-[#005baa]">Unduh Template Excel</p>
                              <p className="text-[11px] font-normal text-slate-400 truncate">Format standar impor plotting kelas</p>
                            </div>
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          <button
                            type="button"
                            onClick={() => {
                              setExportMenuOpen(false);
                              runPlottingPDFExport();
                            }}
                            disabled={!plannedTotal}
                            className="w-full flex items-center gap-3 rounded-xl p-2.5 text-xs font-bold text-[#005baa] bg-blue-50/70 hover:bg-blue-100/90 transition-colors disabled:opacity-50 cursor-pointer text-left group"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#005baa] text-white shadow-2xs">
                              <Icons.download className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#005baa]">Cetak Rekap PDF Resmi</p>
                              <p className="text-[11px] font-normal text-blue-600/75 truncate">Dokumen resmi penugasan semester</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
        {importMessage && (
          <div
            className={`flex flex-col gap-3 rounded-xl px-3 py-2 text-sm font-normal sm:flex-row sm:items-center sm:justify-between ${/^(Applied|Imported|Rebalanced|Swapped|Restored|Export started|Berhasil|Menerapkan|Menukar|Mengembalikan|Ekspor)/.test(importMessage) ? "bg-[#dff3e6] text-[#315f45]" : "bg-[#fde2e2] text-[#8a3a3a]"}`}
          >
            <span>{importMessage}</span>
            {swapUndo?.termCode === selectedTermCode && (
              <Button
                variant="ghost"
                className="shrink-0 self-end py-1.5 sm:self-auto"
                onClick={undoClassSwap}
              >
                <Icons.swap className="h-4 w-4" />
                Batal Tukar
              </Button>
            )}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Rencana Kelas"
            value={plannedTotal}
            icon={Icons.file}
          />
          <Stat
            label="Kelas Terplot"
            value={assignedTotal}
            icon={Icons.check}
            tone={
              assignedTotal === plannedTotal && plannedTotal ? "amber" : "blue"
            }
          />
          <Stat
            label="Kelas Belum Terplot"
            value={Math.max(0, plannedTotal - assignedTotal)}
            icon={Icons.users}
          />
        </div>
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005baa]">
                  Kesehatan Plotting
                </p>
                <Badge tone={plottingHealth.isHealthy ? "green" : "amber"}>
                  {plottingHealth.isHealthy ? "Optimal (Sehat)" : "Perlu Ditinjau"}
                </Badge>
              </div>
              <h3 className="mt-1 text-base font-bold text-[#102f52]">
                Pemeriksaan Aturan & Kepatuhan Alokasi Langsung
              </h3>
            </div>
            {!plottingHealth.isHealthy && (
              <button
                type="button"
                onClick={() => setHealthDetailsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 px-3 py-1.5 text-xs font-bold text-[#102f52] shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <span>{healthDetailsOpen ? "Sembunyikan Rincian Masalah" : "Lihat Rincian Masalah"}</span>
                <Icons.chevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${healthDetailsOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Belum Terplot", plottingHealth.unassignedClasses.length],
              [
                "Keahlian Tidak Cocok",
                plottingHealth.expertiseMismatches.length,
              ],
              ["Beban Berlebih", plottingHealth.overloadedLecturers.length],
              ["Tanpa Penilaian", plottingHealth.unratedLecturers.length],
              ["Pengecualian Aturan", plottingHealth.ruleExceptions.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className={`rounded-xl border p-3 transition-colors ${value ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 truncate">
                  {label}
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-900 font-display">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {!plottingHealth.isHealthy && healthDetailsOpen && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2 pt-3 border-t border-slate-100">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                  Masalah Alokasi Kelas
                </p>
                <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-slate-700 font-medium">
                  {plottingHealth.unassignedClasses.slice(0, 8).map((item) => (
                    <li key={item.className} className="flex items-center gap-1.5 text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>{item.className}</strong> belum dialokasikan.</span>
                    </li>
                  ))}
                  {plottingHealth.expertiseMismatches
                    .slice(0, 8)
                    .map((item) => (
                      <li key={item.className} className="flex items-center gap-1.5 text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>{item.className}</strong>: {item.lecturerName} tidak memiliki keahlian yang cocok.</span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                  Masalah Dosen & Aturan
                </p>
                <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-slate-700 font-medium">
                  {plottingHealth.overloadedLecturers.map((item) => (
                    <li key={item.id} className="flex items-center gap-1.5 text-rose-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{item.name}: {item.assigned}/{item.limit} kelas (melebihi batas).</span>
                    </li>
                  ))}
                  {plottingHealth.unratedLecturers.map((item) => (
                    <li key={item.id} className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                      <span>{item.name} belum memiliki penilaian ({item.assigned} kelas teralokasi).</span>
                    </li>
                  ))}
                  {plottingHealth.ruleExceptions.map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
        {autoPilotNotes.length > 0 && (
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#005baa]">
                  {isRebalanceReview ? "Tinjauan Penyeimbangan" : "Tinjauan Auto-Pilot"}
                </p>
                <h3 className="mt-1 text-lg font-medium text-[#26353f]">
                  {isRebalanceReview
                    ? "Catatan admin untuk penyeimbangan ini"
                    : "Catatan admin untuk proses plotting ini"}
                </h3>
              </div>
              <Badge
                tone={
                  assignedTotal === plannedTotal && plannedTotal
                    ? "green"
                    : "amber"
                }
              >
                {assignedTotal} / {plannedTotal} teralokasi
              </Badge>
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[#4f6478]">
              {autoPilotNotes.map((note) => (
                <li
                  key={note}
                  className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] px-3 py-2"
                >
                  {note}
                </li>
              ))}
            </ul>
            {autoPilotMetrics && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      {isRebalanceReview ? "Kelas dialihkan" : "Slot terbuka terisi"}
                    </p>
                    <p className="mt-2 text-2xl font-medium text-[#102f52]">
                      {isRebalanceReview
                        ? autoPilotMetrics.rebalancedCount || 0
                        : autoPilotMetrics.newlyAssignedCount}
                    </p>
                    <p className="mt-1 text-xs text-[#61717b]">
                      {isRebalanceReview
                        ? `${autoPilotMetrics.newlyAssignedCount} slot terbuka terisi`
                        : `${autoPilotMetrics.preservedCount} dipertahankan`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      {isRebalanceReview
                        ? "Kecocokan keahlian akhir"
                        : "Kecocokan keahlian hasil generate"}
                    </p>
                    <p className="mt-2 text-2xl font-medium text-[#102f52]">
                      {isRebalanceReview
                        ? `${autoPilotMetrics.expertiseMatchRate}%`
                        : autoPilotMetrics.newlyAssignedCount
                          ? `${autoPilotMetrics.newExpertiseMatchRate}%`
                          : "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-[#61717b]">
                      {isRebalanceReview
                        ? `${autoPilotMetrics.expertiseMatchCount}/${autoPilotMetrics.assignedCount} teralokasi`
                        : `${autoPilotMetrics.newExpertiseMatchCount}/${autoPilotMetrics.newlyAssignedCount} dihasilkan`}
                    </p>
                    {!isRebalanceReview && (
                      <p className="mt-1 text-xs text-[#61717b]">
                        Dipertahankan: {autoPilotMetrics.preservedCount
                          ? `${autoPilotMetrics.preservedExpertiseMatchRate}%`
                          : "N/A"}{" ("}
                        {autoPilotMetrics.preservedExpertiseMatchCount}/
                        {autoPilotMetrics.preservedCount})
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      Alokasi penilaian rendah
                    </p>
                    <p className="mt-2 text-2xl font-medium text-[#102f52]">
                      {autoPilotMetrics.lowRatingAssignmentCount}
                    </p>
                    <p className="mt-1 text-xs text-[#61717b]">
                      {autoPilotMetrics.warningAssignmentCount} dengan catatan,{" "}
                      {autoPilotMetrics.unratedAssignmentCount} tanpa penilaian
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      Sebaran beban
                    </p>
                    <p className="mt-2 text-2xl font-medium text-[#102f52]">
                      {autoPilotMetrics.loadSpread}
                    </p>
                    <p className="mt-1 text-xs text-[#61717b]">
                      Rata-rata {autoPilotMetrics.averageLoad.toFixed(1)} kelas
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#315577]">
                      Distribusi Beban Kerja
                    </p>
                    <p className="text-xs text-[#61717b]">
                      Dosen dikelompokkan berdasarkan jumlah kelas teralokasi setelah {isRebalanceReview ? "penyeimbangan" : "auto-pilot"}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    {autoPilotMetrics.loadDistribution.map((item) => (
                      <div
                        key={item.load}
                        className="rounded-lg bg-[#f7fbf6] p-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#61717b]">
                          <span>
                            {item.load} kelas
                          </span>
                          <strong className="text-[#102f52]">
                            {item.count}
                          </strong>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dce9e6]">
                          <div
                            className="h-full rounded-full bg-[#005baa]"
                            style={{
                              width: `${Math.min(100, item.count * 18)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.35fr]">
              <div className="rounded-xl border border-[#f3dda2] bg-[#fff9df] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#71540f]">
                  Peringatan Konflik
                </p>
                {autoPilotWarnings.length ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#71540f]">
                    {autoPilotWarnings.map((warning) => (
                      <li
                        key={warning}
                        className="rounded-lg bg-white/70 px-3 py-2"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm leading-6 text-[#315f45]">
                    Tidak ada peringatan konflik yang terdeteksi untuk {isRebalanceReview ? "penyeimbangan ini" : "proses auto-pilot ini"}.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#315577]">
                  Penjelasan Alokasi
                </p>
                {autoPilotExplanations.length ? (
                  <div className="mt-3 grid max-h-96 gap-3 overflow-y-auto pr-1">
                    {autoPilotExplanations.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-[#26353f]">
                            {item.className} - {item.courseTitle}
                          </p>
                          <Badge
                            tone={item.warnings.length ? "amber" : "green"}
                          >
                            {item.lecturerName} ({item.lecturerId})
                          </Badge>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[#4f6478]">
                          {item.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                        {item.warnings.length > 0 && (
                          <p className="mt-2 rounded-lg bg-[#fff0c2] px-2 py-1 text-xs leading-5 text-[#71540f]">
                            {item.warnings.join("; ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-[#f7fbf6] px-3 py-2 text-sm leading-6 text-[#4f6478]">
                    Tidak ada alokasi baru yang perlu dijelaskan.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}
        {plottingMode === "course" ? (
          <Card className="overflow-hidden">
            <div className="border-b border-[#dce9e6] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6d7d86]">
                Mata Kuliah
              </p>
              <p className="mt-1 text-sm text-[#61717b]">
                Buka baris mata kuliah untuk merencanakan jumlah kelas dan mengalokasikan dosen pengajar.
              </p>
            </div>
            <div className="divide-y divide-[#edf3f1]">
              {visibleCourses.map((course) => {
                const planned = classCounts[course.code] || 0;
                const assigned = (assignmentMap[course.code] || []).filter(
                  Boolean,
                ).length;
                const selected = selectedCourseCode === course.code;
                const lecturerOptions = selected
                  ? lecturerOptionsForCourse(course)
                  : [];
                return (
                  <div
                    key={course.code}
                    className={selected ? "bg-[#fbfdf8]" : ""}
                  >
                    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCourseCode(selected ? "" : course.code)
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-normal text-[#315577]">
                          {course.code}
                        </p>
                        <p className="mt-1 font-medium text-[#26353f]">
                          {course.title}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          tone={
                            assigned >= planned && planned
                              ? "green"
                              : planned
                                ? "amber"
                                : "slate"
                          }
                        >
                          {assigned} / {planned}
                        </Badge>
                        <Button
                          variant="danger"
                          onClick={() => clearCourseAssignments(course.code)}
                          disabled={!assigned}
                        >
                          Hapus Alokasi
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setSelectedCourseCode(selected ? "" : course.code)
                          }
                        >
                          {selected ? "Tutup" : "Alokasikan"}
                        </Button>
                      </div>
                    </div>
                    {selected && (
                      <div className="px-4 pb-5">
                        <div className="rounded-xl border border-[#dce9e6] bg-[#fffffb] p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-sm font-normal text-[#315577]">
                                {course.code}
                              </p>
                              <h3 className="text-xl font-medium text-[#26353f]">
                                {course.title}
                              </h3>
                              <p className="mt-1 text-sm text-[#61717b]">
                                Tentukan rencana jumlah kelas, kemudian pilih dosen pengajar untuk setiap kelas pada mata kuliah ini.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="space-y-1.5">
                                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                                  Rencana Kelas
                                </span>
                                <PlannedClassCountInput
                                  planned={planned}
                                  max={MAX_CLASS_ASSIGNMENTS_PER_COURSE}
                                  onCommit={(value) =>
                                    commitCoursePlanCount(course, value)
                                  }
                                />
                              </label>
                              <Badge
                                tone={
                                  assigned >= planned && planned
                                    ? "green"
                                    : planned
                                      ? "amber"
                                      : "slate"
                                }
                              >
                                {assigned} teralokasi
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {Array.from({ length: planned }, (_, index) => {
                              const selectedId =
                                assignmentMap[course.code]?.[index] || "";
                              const selectedClassLecturer = lecturers.find(
                                (lecturer) => lecturer.id === selectedId,
                              );
                              return (
                                <label
                                  key={`${course.code}-${index}`}
                                  className="space-y-1.5 rounded-xl border border-[#dce9e6] bg-[#fffffb] p-3"
                                >
                                  <span className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.15em] text-[#6d7d86]">
                                    <span>
                                      {course.code}.{index + 1}
                                    </span>
                                    {selectedClassLecturer &&
                                      expertiseMatchesCourse(
                                        selectedClassLecturer,
                                        course,
                                      ) && (
                                        <Badge tone="green">
                                          Keahlian Cocok
                                        </Badge>
                                      )}
                                  </span>
                                  <div className="relative">
                                    <select
                                      value={selectedId}
                                      onChange={(event) =>
                                        assignLecturer(
                                          course.code,
                                          index,
                                          event.target.value,
                                        )
                                      }
                                      className="w-full appearance-none rounded-lg border border-[#dce9e6] bg-[#fffffb] px-3 py-2.5 pr-9 text-sm font-normal text-[#3f4f58] outline-none focus:border-[#9bbfe8]"
                                    >
                                      <option value="">Belum Dialokasikan</option>
                                      {lecturerOptions.map((lecturer) => {
                                        const lecturerTotal =
                                          countLecturerAssignments(
                                            assignmentMap,
                                            lecturer.id,
                                          );
                                        const lecturerLimit =
                                          getLecturerRatingClassLimit(lecturer);
                                        const isFull =
                                          lecturerTotal >= lecturerLimit &&
                                          selectedId !== lecturer.id;
                                        const labelPrefix = isFull
                                          ? "Penuh - "
                                          : expertiseMatchesCourse(
                                                lecturer,
                                                course,
                                              )
                                            ? "Disarankan - "
                                            : "";
                                        return (
                                          <option
                                            key={lecturer.id}
                                            value={lecturer.id}
                                            disabled={isFull}
                                          >
                                            {labelPrefix}
                                            {lecturer.name} ({lecturer.id})
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <Icons.chevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#8aa1ad]" />
                                  </div>
                                  {selectedClassLecturer && (
                                    <p className="text-xs text-[#61717b]">
                                      {selectedClassLecturer.expertise.join(
                                        ", ",
                                      ) || "Keahlian tidak terdaftar"}
                                    </p>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          {!planned && (
                            <div className="mt-5 rounded-xl border border-dashed border-[#dce9e6] bg-[#f7fbf6] p-6 text-center text-sm text-[#61717b]">
                              Tentukan rencana kelas untuk mata kuliah ini untuk mulai mengalokasikan dosen.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleCourses.length === 0 && (
                <p className="p-6 text-center text-sm text-[#61717b]">
                  Tidak ada mata kuliah yang cocok dengan pencarian Anda.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <>
            <Card className="mobile-card-table plotting-lecturer-table overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-[#dce9e6] p-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6d7d86]">
                    Dosen Pengajar
                  </p>
                  <p className="mt-1 text-sm text-[#61717b]">
                    Tinjau daftar dosen, lalu buka jendela alokasi untuk mengatur jumlah kelas yang diampu.
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto">
                  <label className="space-y-1.5 lg:w-48">
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      Kelas Terplot
                    </span>
                    <div className="relative">
                      <select
                        value={lecturerPlottedFilter}
                        onChange={(event) =>
                          setLecturerPlottedFilter(event.target.value)
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3 pr-9 text-sm font-normal text-[#3f4f58] outline-none"
                      >
                        <option value="Semua">Semua</option>
                        <option>0</option>
                        <option>1</option>
                        <option>2</option>
                        <option>3</option>
                        <option>4</option>
                      </select>
                      <Icons.chevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-[#8aa1ad]" />
                    </div>
                  </label>
                  <label className="space-y-1.5 lg:w-56">
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      Urutkan
                    </span>
                    <div className="relative">
                      <select
                        value={lecturerSort}
                        onChange={(event) =>
                          setLecturerSort(event.target.value)
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3 pr-9 text-sm font-normal text-[#3f4f58] outline-none"
                      >
                        <option value="Default">Standar</option>
                        <option value="Belum terplot dahulu">Belum terplot dahulu</option>
                        <option value="Terplot terbanyak dahulu">Terplot terbanyak dahulu</option>
                      </select>
                      <Icons.chevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-[#8aa1ad]" />
                    </div>
                  </label>
                </div>
              </div>

              {/* FKIP Expertise Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 border-b border-[#dce9e6] bg-[#fbfdfb] no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d7d86] shrink-0 flex items-center gap-1">
                  <Icons.graduation className="h-3.5 w-3.5 text-[#005baa]" />
                  Kepakaran FKIP:
                </span>
                {FKIP_EXPERTISE_FILTERS.map((exp) => {
                  const isActive = selectedExpertiseFilter === exp;
                  return (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => setSelectedExpertiseFilter(exp)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? "bg-[#005baa] text-white shadow-2xs"
                          : "border border-[#dce9e6] bg-white text-[#3f4f58] hover:bg-slate-50 hover:border-[#b8d2eb]"
                      }`}
                    >
                      {exp}
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-[#f7fbf6] text-[10px] uppercase tracking-[0.15em] text-[#6d7d86]">
                    <tr>
                      <th className="px-4 py-4">
                        {lecturerSortHeader("ID", "id")}
                      </th>
                      <th className="px-4 py-4">
                        {lecturerSortHeader("Gelar", "degree")}
                      </th>
                      <th className="px-4 py-4">
                        {lecturerSortHeader("Nama Lengkap", "name")}
                      </th>
                      <th className="px-4 py-4 font-medium text-center">Terplot</th>
                      <th className="px-4 py-4 font-medium min-w-[210px]">Beban & Kapasitas Slot</th>
                      <th className="px-4 py-4 font-medium">Bidang Keahlian</th>
                      <th className="px-4 py-4 font-medium">Mata Kuliah Terplot</th>
                      <th className="sticky right-0 z-20 bg-[#f7fbf6]/98 backdrop-blur-xs px-4 py-4 font-medium text-center border-l border-[#edf3f1] shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                        Alokasikan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLecturers.map((lecturer) => {
                      const selected = selectedLecturerId === lecturer.id;
                      return (
                        <tr
                          key={lecturer.id}
                          className={`border-t border-[#edf3f1] ${selected ? "bg-[#fbfdf8]" : ""}`}
                        >
                          <td className="px-4 py-4 font-normal text-[#315577]">
                            {lecturer.id}
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone="slate">{lecturer.degree}</Badge>
                          </td>
                          <td className="px-4 py-4 font-medium text-[#26353f]">
                            {lecturer.name}
                          </td>
                          <td className="px-4 py-4 text-center font-normal text-[#3f4f58]">
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-black text-[#005baa]">
                              {lecturer.plotted.length}
                            </span>
                          </td>
                          <td className="px-4 py-4 min-w-[210px]">
                            {(() => {
                              const plottedCount = lecturer.plotted.length;
                              const avail = Math.max(0, Number(lecturer.available ?? 0));
                              const limit = typeof getLecturerRatingClassLimit === "function" ? getLecturerRatingClassLimit(lecturer) : 3;
                              const totalCap = Math.max(plottedCount + avail, limit);
                              const pct = totalCap > 0 ? Math.min(100, Math.round((plottedCount / totalCap) * 100)) : 0;
                              const isOverloaded = plottedCount > limit;
                              const isOptimal = !isOverloaded && (avail === 0 || plottedCount >= limit);

                              return (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-extrabold text-[#102F52]">
                                      {plottedCount} <span className="font-normal text-slate-400">/ {totalCap} Kelas</span>
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                        isOverloaded
                                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                                          : isOptimal
                                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          isOverloaded
                                            ? "bg-rose-600"
                                            : isOptimal
                                            ? "bg-amber-500"
                                            : "bg-emerald-600"
                                        }`}
                                      />
                                      {isOverloaded
                                        ? "Overload"
                                        : isOptimal
                                        ? "Penuh / Optimal"
                                        : `${avail} Slot Bebas`}
                                    </span>
                                  </div>
                                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/70">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isOverloaded
                                          ? "bg-gradient-to-r from-rose-500 to-red-600"
                                          : isOptimal
                                          ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                          : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                      }`}
                                      style={{ width: `${Math.max(6, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex max-w-sm flex-wrap gap-1">
                              {lecturer.expertise.map((item) => (
                                <Badge key={item}>{item}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex max-w-md flex-wrap gap-1">
                              <PlottedCourseBadges
                                plotted={lecturer.plotted}
                                courses={courses}
                              />
                            </div>
                          </td>
                          <td className="sticky right-0 z-10 bg-white/98 backdrop-blur-xs px-4 py-4 text-center border-l border-[#edf3f1] shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedLecturerId(lecturer.id)}
                            >
                              Alokasikan
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visibleLecturers.length === 0 && (
                <p className="p-6 text-center text-sm text-[#61717b]">
                  Tidak ada dosen yang cocok dengan pencarian Anda.
                </p>
              )}
            </Card>
            {selectedLecturer && (
              <Modal
                title="Alokasi Mengajar Dosen"
                onClose={() => setSelectedLecturerId("")}
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-normal text-[#315577]">
                          {selectedLecturer.id}
                        </p>
                        <h3 className="text-xl font-medium text-[#26353f]">
                          {selectedLecturer.name}
                        </h3>
                        <p className="mt-1 text-sm font-normal text-[#61717b]">
                          {selectedLecturer.expertise.join(", ") ||
                            "Keahlian tidak terdaftar"}
                        </p>
                      </div>
                      <Badge
                        tone={
                          selectedLecturer.plotted.length >=
                          getLecturerRatingClassLimit(selectedLecturer)
                            ? "amber"
                            : selectedLecturer.plotted.length
                              ? "blue"
                              : "slate"
                        }
                      >
                        {selectedLecturer.plotted.length} /{" "}
                        {getLecturerRatingClassLimit(selectedLecturer)} kelas teralokasi
                      </Badge>
                    </div>
                  </div>
                  <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                    {courses.map((course) => {
                      const count =
                        selectedLecturerCourseCounts[course.code] || 0;
                      const lecturerTotal = countLecturerAssignments(
                        assignmentMap,
                        selectedLecturer.id,
                      );
                      const lecturerLimit =
                        getLecturerRatingClassLimit(selectedLecturer);
                      const maxCountForCourse =
                        count + Math.max(0, lecturerLimit - lecturerTotal);
                      const planned = classCounts[course.code] || 0;
                      const assigned = (
                        assignmentMap[course.code] || []
                      ).filter(Boolean).length;
                      return (
                        <div
                          key={`${selectedLecturer.id}-${course.code}`}
                          className={`grid items-center gap-3 rounded-xl border border-[#dce9e6] bg-[#fffffb] p-3 ${count ? "grid-cols-[1fr_auto_76px]" : "grid-cols-[1fr_76px]"}`}
                        >
                          <span>
                            <span className="block text-sm font-normal text-[#26353f]">
                              {course.title}
                            </span>
                            <span className="mt-1 block text-xs font-normal text-[#61717b]">
                              {course.code} · {assigned} / {planned} teralokasi
                            </span>
                          </span>
                          {count > 0 && (
                            <Button
                              variant="ghost"
                              className="px-2.5"
                              onClick={() =>
                                openClassSwap(
                                  selectedLecturer.id,
                                  course.code,
                                )
                              }
                              disabled={!selectedLecturerHasSwapTarget}
                              title={
                                selectedLecturerHasSwapTarget
                                  ? `Tukar ${course.title} dengan kelas dosen lain`
                                  : "Tidak ada dosen lain dengan kelas teralokasi untuk ditukar."
                              }
                            >
                              <Icons.swap className="h-4 w-4" />
                              Tukar
                            </Button>
                          )}
                          <input
                            type="number"
                            min="0"
                            max={maxCountForCourse}
                            value={count}
                            onChange={(event) =>
                              setLecturerCourseCount(
                                course.code,
                                event.target.value,
                                selectedLecturer.id,
                              )
                            }
                            className="w-full rounded-lg border border-[#dce9e6] bg-[#fffffb] px-2 py-2 text-sm font-normal text-[#26353f] outline-none focus:border-[#9bbfe8] disabled:opacity-50"
                            title={
                              maxCountForCourse === 0
                                ? `Dosen ini telah mencapai batas ${lecturerLimit} kelas sesuai penilaiannya.`
                                : undefined
                            }
                            disabled={maxCountForCourse === 0}
                            aria-label={`Kelas dialokasikan untuk ${selectedLecturer.name} pada ${course.title}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedLecturerId("")}
                    >
                      Selesai
                    </Button>
                  </div>
                </div>
              </Modal>
            )}
            {swapDraft && swapSourceLecturer && (
              <Modal title="Tukar Penugasan Kelas" onClose={() => setSwapDraft(null)}>
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                        Kelas milik {swapSourceLecturer.name}
                      </span>
                      <div className="relative">
                        <select
                          value={swapSourceEntry?.key || ""}
                          onChange={(event) => {
                            const entry = swapSourceEntries.find(
                              (item) => item.key === event.target.value,
                            );
                            if (!entry) return;
                            setSwapDraft((current) => ({
                              ...current,
                              sourceCourseCode: entry.courseCode,
                              sourceClassIndex: entry.classIndex,
                            }));
                          }}
                          className="h-12 w-full appearance-none rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3 pr-9 text-sm text-[#3f4f58] outline-none focus:border-[#9bbfe8]"
                        >
                          {swapSourceEntries.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.className} - {entry.course.title}
                            </option>
                          ))}
                        </select>
                        <Icons.chevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-[#8aa1ad]" />
                      </div>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                        Kelas Tujuan
                      </span>
                      <div className="relative">
                        <select
                          value={swapDraft.targetCourseCode}
                          onChange={(event) => {
                            const targetCourseCode = event.target.value;
                            setSwapDraft((current) => ({
                              ...current,
                              targetCourseCode,
                              targetLecturerId: "",
                              targetClassIndex: -1,
                            }));
                          }}
                          className="h-12 w-full appearance-none rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3 pr-9 text-sm text-[#3f4f58] outline-none focus:border-[#9bbfe8]"
                        >
                          <option value="">Pilih mata kuliah target...</option>
                          {swapTargetCourseOptions.map((course) => (
                            <option key={course.code} value={course.code}>
                              {course.code} - {course.title}
                            </option>
                          ))}
                        </select>
                        <Icons.chevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-[#8aa1ad]" />
                      </div>
                    </label>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#6d7d86]">
                      Dosen di Kelas Target
                    </span>
                    <div className="relative">
                      <select
                        value={swapTargetEntry?.key || ""}
                        onChange={(event) => {
                          const entry = swapTargetEntries.find(
                            (item) => item.key === event.target.value,
                          );
                          if (!entry) return;
                          setSwapDraft((current) => ({
                            ...current,
                            targetLecturerId: entry.lecturerId,
                            targetClassIndex: entry.classIndex,
                          }));
                        }}
                        disabled={!swapDraft.targetCourseCode}
                        className="h-12 w-full appearance-none rounded-xl border border-[#dce9e6] bg-[#fffffb] px-3 pr-9 text-sm text-[#3f4f58] outline-none focus:border-[#9bbfe8]"
                      >
                        <option value="">
                          {swapDraft.targetCourseCode
                            ? "Pilih dosen dan kelas..."
                            : "Pilih mata kuliah target terlebih dahulu"}
                        </option>
                        {recommendedSwapTargetEntries.length > 0 && (
                          <optgroup label="Dosen yang Disarankan">
                            {recommendedSwapTargetEntries.map((entry) => (
                              <option key={entry.key} value={entry.key}>
                                {entry.recommendationLabel} -{" "}
                                {entry.lecturer.name} ({entry.lecturerId}) -{" "}
                                {entry.className}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {otherSwapTargetEntries.length > 0 && (
                          <optgroup label="Dosen Lain di Kelas Target">
                            {otherSwapTargetEntries.map((entry) => (
                              <option key={entry.key} value={entry.key}>
                                {entry.lecturer.name} ({entry.lecturerId}) -{" "}
                                {entry.className}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <Icons.chevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-[#8aa1ad]" />
                    </div>
                    {recommendedSwapTargetEntries.length > 0 && (
                      <p
                        className={`rounded-lg px-3 py-2 text-xs leading-5 ${recommendedSwapTargetEntries[0].fallbackRecommendation ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                        aria-live="polite"
                      >
                        <span className="font-medium">
                          {recommendedSwapTargetEntries[0]
                            .fallbackRecommendation
                            ? "Rekomendasi alternatif"
                            : "Disarankan"}
                          :{" "}
                        </span>
                        {recommendedSwapTargetEntries
                          .map(
                            (entry) =>
                              `${entry.lecturer.name} (${entry.className})`,
                          )
                          .join(", ")}
                        {recommendedSwapTargetEntries[0]
                          .fallbackRecommendation
                          ? ". Tidak ada kecocokan keahlian persis di kelas target ini."
                          : ". Keahlian cocok dengan kelas yang akan diterima."}
                      </p>
                    )}
                  </label>
                  {canConfirmSwap && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] p-4">
                        <p className="font-medium text-[#26353f]">
                          {swapSourceLecturer.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#61717b]">
                          Melepas {swapSourceEntry.className} dan menerima{" "}
                          <span className="font-medium text-[#315577]">
                            {swapTargetEntry.className} -{" "}
                            {swapTargetEntry.course.title}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] p-4">
                        <p className="font-medium text-[#26353f]">
                          {swapTargetLecturer.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#61717b]">
                          Melepas {swapTargetEntry.className} dan menerima{" "}
                          <span className="font-medium text-[#315577]">
                            {swapSourceEntry.className} -{" "}
                            {swapSourceEntry.course.title}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                  <div
                    className={`rounded-xl border p-4 ${!canConfirmSwap ? "border-slate-200 bg-slate-50" : swapExpertiseWarnings.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                  >
                    <div className="flex items-start gap-3">
                      {!canConfirmSwap ? (
                        <Icons.swap className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                      ) : swapExpertiseWarnings.length ? (
                        <Icons.warning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                      ) : (
                        <Icons.check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      )}
                      <div className="text-sm leading-6">
                        {!canConfirmSwap ? (
                          <>
                            <p className="font-medium text-slate-900">
                              Lengkapi Pilihan Pertukaran
                            </p>
                            <p className="text-slate-600">
                              Pilih kelas target, lalu tentukan dosen dan kelas untuk meninjau kesesuaian keahlian.
                            </p>
                          </>
                        ) : swapExpertiseWarnings.length ? (
                          <>
                            <p className="font-medium text-amber-950">
                              Perlu Tinjauan Keahlian
                            </p>
                            {swapExpertiseWarnings.map((warning) => (
                              <p key={warning} className="text-amber-800">
                                {warning}
                              </p>
                            ))}
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-emerald-950">
                              Pemeriksaan Keahlian Lolos
                            </p>
                            <p className="text-emerald-800">
                              Kedua dosen memiliki keahlian yang sesuai dengan kelas yang akan mereka terima.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[#61717b]">
                    Setiap dosen mempertahankan jumlah total kelas yang sama. Kedua perubahan penugasan akan disinkronkan bersama.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setSwapDraft(null)}
                    >
                      Batal
                    </Button>
                    <Button onClick={confirmClassSwap} disabled={!canConfirmSwap}>
                      <Icons.swap className="h-4 w-4" />
                      Konfirmasi Pertukaran
                    </Button>
                  </div>
                </div>
              </Modal>
            )}
          </>
        )}
        {importReview && (
          <ImportReviewModal
            title="Tinjau Impor Data Plotting"
            summary={importReview.summary}
            issues={importReview.issues}
            previewRows={importReview.previewRows}
            onApply={applyImportReview}
            onClose={() => setImportReview(null)}
          />
        )}
        {autoPilotRunning && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#24333f]/35 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="w-full max-w-sm rounded-xl border border-[#dce9e6] bg-[#fffffb] p-6 text-center shadow-2xl shadow-[#9fb8b1]/30">
              <span
                className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#d7e6f7] border-t-[#005baa]"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-lg font-medium text-[#26353f]">
                Menjalankan Auto-Pilot
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#61717b]">
                Menyiapkan proposal plotting dan memeriksa aturan alokasi.
              </p>
            </div>
          </div>
        )}
        {classCountReduction && (
          <Modal
            title="Kurangi Rencana Jumlah Kelas?"
            onClose={cancelClassCountReduction}
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Icons.warning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="font-medium text-amber-950">
                      {classCountReduction.courseCode} -{" "}
                      {classCountReduction.courseTitle}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Rencana kelas akan berubah dari{" "}
                      {classCountReduction.currentCount} menjadi{" "}
                      {classCountReduction.nextCount}. Ini akan menghapus{" "}
                      {classCountReduction.currentCount -
                        classCountReduction.nextCount}{" "}
                      slot kelas.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6 text-[#61717b]">
                {classCountReduction.removedAssignments
                  ? `${classCountReduction.removedAssignments} alokasi dosen pada slot kelas yang dihapus akan dibatalkan.`
                  : "Slot kelas yang dihapus tidak berisi alokasi dosen."}
                {" "}Perubahan ini akan disinkronkan setelah Anda mengonfirmasinya.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={cancelClassCountReduction}
                >
                  Batal
                </Button>
                <Button variant="danger" onClick={confirmClassCountReduction}>
                  <Icons.check className="h-4 w-4" />
                  Kurangi Menjadi {classCountReduction.nextCount}
                </Button>
              </div>
            </div>
          </Modal>
        )}
        {autoPilotPreview && (
          <Modal
            title={
              autoPilotPreview.mode === "rebalance"
                ? "Tinjau Proposal Penyeimbangan"
                : "Tinjau Proposal Auto-Pilot"
            }
            onClose={() => setAutoPilotPreview(null)}
          >
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Rencana"
                  value={autoPilotPreview.result.plannedCount}
                  icon={Icons.file}
                />
                <Stat
                  label="Teralokasi"
                  value={autoPilotPreview.result.assignedCount}
                  icon={Icons.check}
                />
                <Stat
                  label={
                    autoPilotPreview.mode === "rebalance"
                      ? "Dialihkan"
                      : "Peringatan"
                  }
                  value={
                    autoPilotPreview.mode === "rebalance"
                      ? autoPilotPreview.result.reassignments?.length || 0
                      : autoPilotPreview.result.conflictWarnings.length
                  }
                  icon={
                    autoPilotPreview.mode === "rebalance"
                      ? Icons.swap
                      : Icons.warning
                  }
                />
              </div>
              <div className="rounded-xl border border-[#dce9e6] bg-[#f7fbf6] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#315577]">
                  Belum Ada Perubahan yang Diterapkan
                </p>
                <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-sm leading-6 text-[#4f6478]">
                  {autoPilotPreview.result.reviewNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                  {autoPilotPreview.result.conflictWarnings.map((warning) => (
                    <li key={warning} className="text-[#8a5a14]">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
              {autoPilotPreview.mode === "rebalance" &&
                autoPilotPreview.result.reassignments?.length > 0 && (
                  <div className="rounded-xl border border-[#dce9e6] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#315577]">
                      Usulan Pengalihan Kelas
                    </p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                      {autoPilotPreview.result.reassignments.map((item) => (
                        <div
                          key={`${item.className}:${item.toLecturerId}`}
                          className="rounded-lg border border-[#dce9e6] bg-[#f7fbf6] px-3 py-2 text-sm leading-6 text-[#4f6478]"
                        >
                          <p className="font-medium text-[#26353f]">
                            {item.className} - {item.courseTitle}
                          </p>
                          <p>
                            {item.fromLecturerName} (bintang {item.fromRating || "tanpa penilaian"}, beban {item.donorLoadBefore} menjadi {item.donorLoadAfter})
                          </p>
                          <p>
                            <span aria-hidden="true">→</span> {item.toLecturerName} (bintang {item.toRating}, beban {item.recipientLoadBefore} menjadi {item.recipientLoadAfter})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setAutoPilotPreview(null)}
                >
                  Batal
                </Button>
                <Button onClick={applyAutoPilot}>
                  {autoPilotPreview.mode === "rebalance"
                    ? "Terapkan Penyeimbangan"
                    : "Terapkan Proposal"}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return Plotting;
}
