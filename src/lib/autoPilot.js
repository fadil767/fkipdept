export const LECTURER_CLASS_LIMIT = 4;

const LOW_RATING_THRESHOLD = 2;
const AUTO_PILOT_AVAILABILITY_FALLBACK_NOTE =
  "Tidak ditemukan slot ketersediaan positif, sehingga auto-pilot menggunakan batas kelas berbasis penilaian sebagai alternatif untuk proses ini.";
const FIVE_STAR_TARGET = LECTURER_CLASS_LIMIT;
const FOUR_STAR_TARGET = 3;
const THREE_STAR_TARGET = 2;

const COURSE_EXPERTISE_RULES = [
  {
    expertise: "English Language Teaching",
    aliases: [
      "language teaching",
      "elt",
      "tesol",
      "teaching english",
      "english teaching",
    ],
    keywords: [
      "reading",
      "writing",
      "listening",
      "speaking",
      "teaching",
      "elt",
      "tesol",
      "vocabulary",
      "composition",
      "language assessment",
      "artikel ilmiah",
    ],
  },
  {
    expertise: "English Linguistics",
    aliases: ["english language linguistics"],
    keywords: [
      "english linguistics",
      "linguistics",
      "syntax",
      "phonology",
      "morphology",
      "semantics",
      "pragmatics",
      "pragmatik",
      "discourse",
      "pengantar linguistik umum",
      "grammar translation exercises",
      "metode penelitian",
      "artikel ilmiah",
    ],
  },
  {
    expertise: "Translation Studies",
    aliases: ["translation", "translation study", "penerjemahan"],
    keywords: [
      "translation",
      "translating",
      "translator",
      "interpreting",
      "teori dan masalah penerjemahan",
      "grammar translation exercises",
      "penerjemahan karya fiksi",
      "analisis teks dalam penerjemahan",
      "metode penelitian",
      "praktik penerjemahan",
      "ukt",
      "artikel ilmiah",
    ],
  },
  {
    expertise: "Indonesian Linguistics",
    aliases: ["indonesian language", "linguistik indonesia"],
    keywords: [
      "indonesian",
      "bahasa indonesia",
      "tata bahasa",
      "pemahaman",
      "pengantar linguistik umum",
      "pragmatik",
      "keterampilan merangkum bacaan",
      "penyuntingan teks",
    ],
  },
  {
    expertise: "Literary Studies",
    aliases: ["literature", "english literature", "literary", "sastra"],
    keywords: [
      "literary",
      "literature",
      "poetry",
      "prose",
      "drama",
      "novel",
      "pengantar ilmu sastra",
    ],
  },
  {
    expertise: "Philosophy",
    aliases: [],
    keywords: ["sejarah pemikiran modern"],
  },
  {
    expertise: "English for Specific Purposes",
    aliases: ["esp"],
    keywords: [
      "specific purposes",
      "esp",
      "academic english",
      "business english",
      "professional english",
    ],
  },
];

const toLookupKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const normalizeText = (value) =>
  toLookupKey(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function clampRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

function toClassCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function getCourseText(course) {
  return normalizeText(`${course?.code || ""} ${course?.title || ""}`);
}

function getLecturerExpertiseKeys(lecturer) {
  return (Array.isArray(lecturer?.expertise) ? lecturer.expertise : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function canonicalizeExpertise(value) {
  const normalized = normalizeText(value);
  const matchingRule = COURSE_EXPERTISE_RULES.find(
    (rule) =>
      normalizeText(rule.expertise) === normalized ||
      (rule.aliases || []).some((alias) => normalizeText(alias) === normalized),
  );
  return matchingRule ? normalizeText(matchingRule.expertise) : normalized;
}

export function getCourseExpertiseMatches(course) {
  const courseText = getCourseText(course);
  if (!courseText) return [];
  return COURSE_EXPERTISE_RULES.filter((rule) =>
    rule.keywords.some((keyword) =>
      courseText.includes(normalizeText(keyword)),
    ),
  ).map((rule) => rule.expertise);
}

export function expertiseMatchesCourse(lecturer, course) {
  const expertiseKeys = getLecturerExpertiseKeys(lecturer);
  if (!expertiseKeys.length) return false;
  const canonicalExpertiseKeys = expertiseKeys.map(canonicalizeExpertise);

  const courseText = getCourseText(course);
  const mappedExpertise = getCourseExpertiseMatches(course).map((item) =>
    normalizeText(item),
  );
  if (
    canonicalExpertiseKeys.some((expertise) =>
      mappedExpertise.includes(expertise),
    )
  )
    return true;

  const titleText = normalizeText(course?.title || "");
  return expertiseKeys.some((expertise) => {
    if (!expertise) return false;
    return courseText.includes(expertise) || expertise.includes(titleText);
  });
}

export function getLecturerAutoPilotCapacity(
  lecturer,
  useAvailabilityFallback = false,
) {
  const ratingLimit = getLecturerRatingClassLimit(lecturer);
  const currentLoad = Array.isArray(lecturer?.plotted)
    ? lecturer.plotted.length
    : 0;
  if (useAvailabilityFallback) return ratingLimit;
  const availableSlots = Number(lecturer?.available ?? 0);
  return Math.min(
    ratingLimit,
    Math.max(
      0,
      currentLoad + (Number.isFinite(availableSlots) ? availableSlots : 0),
    ),
  );
}

export function getLecturerRatingClassLimit(lecturer) {
  const rating = clampRating(lecturer?.rating);
  return rating >= 3 ? LECTURER_CLASS_LIMIT : 1;
}

export function getLecturerRatingPriorityTarget(lecturer) {
  const rating = clampRating(lecturer?.rating);
  if (rating >= 5) return FIVE_STAR_TARGET;
  if (rating === 4) return FOUR_STAR_TARGET;
  if (rating === 3) return THREE_STAR_TARGET;
  return 1;
}

export function lecturerHasAutoPilotRisk(lecturer) {
  const rating = clampRating(lecturer?.rating);
  return rating > 0 && rating <= LOW_RATING_THRESHOLD;
}

export function calculatePlottingHealth(
  lecturers,
  courses,
  classCounts = {},
  assignmentMap = {},
) {
  const lecturerById = new Map(
    lecturers.map((lecturer) => [lecturer.id, lecturer]),
  );
  const assignedByLecturer = {};
  const unassignedClasses = [];
  const expertiseMismatches = [];
  const unknownAssignments = [];

  courses.forEach((course) => {
    const planned = toClassCount(classCounts[course.code]);
    Array.from({ length: planned }, (_, index) => {
      const className = `${course.code}.${index + 1}`;
      const lecturerId = assignmentMap[course.code]?.[index] || "";
      if (!lecturerId) {
        unassignedClasses.push({
          className,
          courseCode: course.code,
          courseTitle: course.title,
        });
        return;
      }
      const lecturer = lecturerById.get(lecturerId);
      if (!lecturer) {
        unknownAssignments.push({ className, lecturerId });
        return;
      }
      assignedByLecturer[lecturerId] =
        (assignedByLecturer[lecturerId] || 0) + 1;
      if (!expertiseMatchesCourse(lecturer, course)) {
        expertiseMismatches.push({
          className,
          courseCode: course.code,
          courseTitle: course.title,
          lecturerId,
          lecturerName: lecturer.name,
        });
      }
    });
  });

  const overloadedLecturers = lecturers
    .map((lecturer) => {
      const assigned = assignedByLecturer[lecturer.id] || 0;
      const ratingLimit = getLecturerRatingClassLimit(lecturer);
      const available = toClassCount(lecturer.available);
      const availabilityLimit =
        available > 0 ? Math.min(ratingLimit, available) : ratingLimit;
      return {
        id: lecturer.id,
        name: lecturer.name,
        assigned,
        limit: availabilityLimit,
        ratingLimit,
        available,
      };
    })
    .filter((lecturer) => lecturer.assigned > lecturer.limit);

  const unratedLecturers = lecturers
    .filter(
      (lecturer) =>
        !clampRating(lecturer.rating) &&
        (assignedByLecturer[lecturer.id] || 0) > 0,
    )
    .map((lecturer) => ({
      id: lecturer.id,
      name: lecturer.name,
      assigned: assignedByLecturer[lecturer.id],
    }));

  const ruleExceptions = [
    ...unknownAssignments.map(
      (item) =>
        `${item.className} merujuk ke dosen tidak dikenal ${item.lecturerId}.`,
    ),
    ...overloadedLecturers.map(
      (item) =>
        `${item.name} memiliki ${item.assigned} kelas, melebihi batas ketersediaan/penilaian (${item.limit} kelas).`,
    ),
    ...unratedLecturers
      .filter((item) => item.assigned > 1)
      .map(
        (item) =>
          `${item.name} belum memiliki penilaian tetapi memiliki ${item.assigned} kelas; dosen tanpa penilaian dibatasi 1 kelas.`,
      ),
  ];

  return {
    unassignedClasses,
    expertiseMismatches,
    overloadedLecturers,
    unratedLecturers,
    ruleExceptions,
    assignedByLecturer,
    isHealthy:
      !unassignedClasses.length &&
      !expertiseMismatches.length &&
      !overloadedLecturers.length &&
      !unratedLecturers.length &&
      !ruleExceptions.length,
  };
}

function getRatingPriorityScore(rating) {
  if (rating >= 5) return 260;
  if (rating === 4) return 150;
  if (rating === 3) return 70;
  if (rating > 0) return rating * 12;
  return 18;
}

function getRiskLabel(lecturer) {
  const rating = clampRating(lecturer?.rating);
  if (rating > 0 && rating <= LOW_RATING_THRESHOLD)
    return `${rating}-star rating`;
  return "";
}

function summarizeTargetShortfalls(states, targetForState, maxItems = 12) {
  const items = states
    .slice(0, maxItems)
    .map(
      (state) =>
        `${state.lecturer.name} (${state.assigned}/${targetForState(state)})`,
    );
  const remaining = Math.max(0, states.length - items.length);
  return `${items.join(", ")}${remaining ? `, and ${remaining} more` : ""}`;
}

function buildAutoPilotCourseSlots(courses, classCounts, lecturers) {
  return courses
    .flatMap((course) =>
      Array.from(
        { length: toClassCount(classCounts[course.code]) },
        (_, index) => ({ course, index }),
      ),
    )
    .sort((a, b) => {
      const aMatches = lecturers.filter((lecturer) =>
        expertiseMatchesCourse(lecturer, a.course),
      ).length;
      const bMatches = lecturers.filter((lecturer) =>
        expertiseMatchesCourse(lecturer, b.course),
      ).length;
      return (
        aMatches - bMatches ||
        a.course.code.localeCompare(b.course.code) ||
        a.index - b.index
      );
    });
}

function buildInitialAssignmentMap(
  lecturers,
  courses,
  classCounts,
  existingAssignmentMap = {},
) {
  const lecturerIds = new Set(lecturers.map((lecturer) => lecturer.id));
  return Object.fromEntries(
    courses.map((course) => {
      const count = toClassCount(classCounts[course.code]);
      const existing = Array.isArray(existingAssignmentMap[course.code])
        ? existingAssignmentMap[course.code]
        : [];
      return [
        course.code,
        Array.from({ length: count }, (_, index) => {
          const lecturerId = String(existing[index] || "");
          return !lecturerId || lecturerIds.has(lecturerId) ? lecturerId : "";
        }),
      ];
    }),
  );
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

function calculateAutoPilotMetrics(
  lecturers,
  courses,
  assignmentMap,
  preservedAssignmentMap,
  assignmentExplanations,
) {
  const plannedCount = courses.reduce(
    (sum, course) => sum + (assignmentMap[course.code] || []).length,
    0,
  );
  const assignedCount = courses.reduce(
    (sum, course) =>
      sum + (assignmentMap[course.code] || []).filter(Boolean).length,
    0,
  );
  const lecturerLoads = lecturers.map((lecturer) => ({
    id: lecturer.id,
    name: lecturer.name,
    load: countLecturerAssignments(assignmentMap, lecturer.id),
    rating: clampRating(lecturer.rating),
    classLimit: getLecturerRatingClassLimit(lecturer),
    warningNote: String(lecturer.warning_note || "").trim(),
  }));
  const averageLoad = lecturerLoads.length
    ? lecturerLoads.reduce((sum, item) => sum + item.load, 0) /
      lecturerLoads.length
    : 0;
  const loadSpread = lecturerLoads.length
    ? Math.max(...lecturerLoads.map((item) => item.load)) -
      Math.min(...lecturerLoads.map((item) => item.load))
    : 0;
  const loadStdDev = lecturerLoads.length
    ? Math.sqrt(
        lecturerLoads.reduce(
          (sum, item) => sum + (item.load - averageLoad) ** 2,
          0,
        ) / lecturerLoads.length,
      )
    : 0;
  const loadDistribution = Array.from(
    { length: LECTURER_CLASS_LIMIT + 1 },
    (_, load) => ({
      load,
      count: lecturerLoads.filter((item) => item.load === load).length,
    }),
  );
  const overLimitLecturers = lecturerLoads.filter(
    (item) => item.load > item.classLimit,
  );

  const lecturerById = new Map(
    lecturers.map((lecturer) => [lecturer.id, lecturer]),
  );
  const expertiseMatchCount = courses.reduce(
    (sum, course) =>
      sum +
      (assignmentMap[course.code] || []).filter((id) => {
        const lecturer = lecturerById.get(id);
        return lecturer && expertiseMatchesCourse(lecturer, course);
      }).length,
    0,
  );
  const warningAssignmentCount = courses.reduce(
    (sum, course) =>
      sum +
      (assignmentMap[course.code] || []).filter((id) =>
        String(lecturerById.get(id)?.warning_note || "").trim(),
      ).length,
    0,
  );
  const lowRatingAssignmentCount = courses.reduce(
    (sum, course) =>
      sum +
      (assignmentMap[course.code] || []).filter((id) => {
        const rating = clampRating(lecturerById.get(id)?.rating);
        return rating > 0 && rating <= LOW_RATING_THRESHOLD;
      }).length,
    0,
  );
  const unratedAssignmentCount = courses.reduce(
    (sum, course) =>
      sum +
      (assignmentMap[course.code] || []).filter(
        (id) => id && !clampRating(lecturerById.get(id)?.rating),
      ).length,
    0,
  );
  const preservedCount = courses.reduce(
    (sum, course) =>
      sum + (preservedAssignmentMap[course.code] || []).filter(Boolean).length,
    0,
  );
  const preservedExpertiseMismatches = courses.flatMap((course) =>
    (preservedAssignmentMap[course.code] || []).flatMap(
      (lecturerId, index) => {
        if (!lecturerId) return [];
        const lecturer = lecturerById.get(lecturerId);
        if (lecturer && expertiseMatchesCourse(lecturer, course)) return [];
        return [
          {
            className: `${course.code}.${index + 1}`,
            courseCode: course.code,
            courseTitle: course.title,
            lecturerId,
            lecturerName: lecturer?.name || lecturerId,
          },
        ];
      },
    ),
  );
  const preservedExpertiseMatchCount = Math.max(
    0,
    preservedCount - preservedExpertiseMismatches.length,
  );
  const newlyAssignedCount = assignmentExplanations.length;
  const newExpertiseMatchCount = assignmentExplanations.filter(
    (item) => item.expertiseMatched,
  ).length;

  return {
    assignedCount,
    plannedCount,
    unassignedCount: Math.max(0, plannedCount - assignedCount),
    newlyAssignedCount,
    preservedCount,
    newExpertiseMatchCount,
    newExpertiseMismatchCount: Math.max(
      0,
      newlyAssignedCount - newExpertiseMatchCount,
    ),
    newExpertiseMatchRate: newlyAssignedCount
      ? Math.round((newExpertiseMatchCount / newlyAssignedCount) * 100)
      : 0,
    preservedExpertiseMatchCount,
    preservedExpertiseMismatchCount: preservedExpertiseMismatches.length,
    preservedExpertiseMatchRate: preservedCount
      ? Math.round((preservedExpertiseMatchCount / preservedCount) * 100)
      : 0,
    preservedExpertiseMismatches,
    expertiseMatchCount,
    expertiseMatchRate: assignedCount
      ? Math.round((expertiseMatchCount / assignedCount) * 100)
      : 0,
    warningAssignmentCount,
    lowRatingAssignmentCount,
    unratedAssignmentCount,
    averageLoad,
    loadSpread,
    loadStdDev,
    loadDistribution,
    overLimitLecturers,
    lecturerLoads,
  };
}

export function buildAutoPilotPlotting(
  lecturers,
  courses,
  classCounts,
  existingAssignmentMap = {},
) {
  const plannedCourses = courses.filter(
    (course) => toClassCount(classCounts[course.code]) > 0,
  );
  const assignmentMap = buildInitialAssignmentMap(
    lecturers,
    courses,
    classCounts,
    existingAssignmentMap,
  );
  const preservedAssignmentMap = Object.fromEntries(
    Object.entries(assignmentMap).map(([code, ids]) => [code, [...ids]]),
  );
  const slots = buildAutoPilotCourseSlots(
    plannedCourses,
    classCounts,
    lecturers,
  ).filter((slot) => !assignmentMap[slot.course.code]?.[slot.index]);
  const hasPositiveAvailabilityData = lecturers.some(
    (lecturer) => Number(lecturer?.available || 0) > 0,
  );
  const useAvailabilityFallback = Boolean(
    slots.length && lecturers.length && !hasPositiveAvailabilityData,
  );
  const assignmentExplanations = [];
  const conflictWarningSet = new Set();
  const states = lecturers.map((lecturer) => {
    const assigned = countLecturerAssignments(assignmentMap, lecturer.id);
    return {
      lecturer,
      assigned,
      capacity: getLecturerAutoPilotCapacity(lecturer, useAvailabilityFallback),
      rating: clampRating(lecturer.rating),
      restricted: lecturerHasAutoPilotRisk(lecturer),
    };
  });

  states
    .filter((state) => state.assigned > state.capacity)
    .forEach((state) =>
      conflictWarningSet.add(
        `${state.lecturer.name} sudah memiliki ${state.assigned} alokasi tersimpan, melebihi batas ketersediaan/penilaian (${state.capacity} kelas).`,
      ),
    );

  const scoreCandidate = (state, course) => {
    const expertiseScore = expertiseMatchesCourse(state.lecturer, course)
      ? 120
      : 0;
    const ratingScore = getRatingPriorityScore(state.rating);
    const fiveStarTargetScore =
      state.rating >= 5
        ? Math.max(0, FIVE_STAR_TARGET - state.assigned) * 90
        : 0;
    const remainingCapacity = Math.max(0, state.capacity - state.assigned);
    const currentCourseCount = (assignmentMap[course.code] || []).filter(
      (id) => id === state.lecturer.id,
    ).length;
    const lowRatingPenalty =
      state.rating > 0 && state.rating <= LOW_RATING_THRESHOLD ? 40 : 0;
    return (
      expertiseScore +
      ratingScore +
      fiveStarTargetScore +
      remainingCapacity * 8 +
      state.capacity * 2 -
      state.assigned * 30 -
      currentCourseCount * 14 -
      lowRatingPenalty
    );
  };

  const chooseCandidate = (
    course,
    targetLimit,
    includeRestricted,
    predicate = () => true,
  ) => {
    const expertiseMatchHasCapacity = states.some(
      (state) =>
        state.capacity > 0 &&
        state.assigned < state.capacity &&
        expertiseMatchesCourse(state.lecturer, course),
    );
    const eligibleCandidates = states.filter(
      (state) =>
        predicate(state) &&
        state.capacity > 0 &&
        state.assigned < state.capacity &&
        state.assigned < targetLimit &&
        (includeRestricted || !state.restricted),
    );
    const candidates = expertiseMatchHasCapacity
      ? eligibleCandidates.filter((state) =>
          expertiseMatchesCourse(state.lecturer, course),
        )
      : eligibleCandidates;
    return (
      candidates
        .map((state) => ({ state, score: scoreCandidate(state, course) }))
        .sort(
          (a, b) =>
            b.state.rating - a.state.rating ||
            b.score - a.score ||
            a.state.assigned - b.state.assigned ||
            a.state.lecturer.name.localeCompare(b.state.lecturer.name),
        )[0]?.state || null
    );
  };

  const assignSlot = (slot, state, phaseLabel) => {
    if (!state) return false;
    const expertiseMatched = expertiseMatchesCourse(
      state.lecturer,
      slot.course,
    );
    const priorCourseCount = (assignmentMap[slot.course.code] || []).filter(
      (id) => id === state.lecturer.id,
    ).length;
    const warningNote = String(state.lecturer.warning_note || "").trim();
    const riskLabel = getRiskLabel(state.lecturer);
    const warnings = [];
    if (!expertiseMatched) {
      warnings.push("Keahlian tidak cocok");
      conflictWarningSet.add(
        `${slot.course.code}.${slot.index + 1} menggunakan ${state.lecturer.name} sebagai alternatif keahlian karena tidak ada dosen dengan keahlian cocok yang memiliki kapasitas tersisa.`,
      );
    }
    if (!state.rating) {
      warnings.push("Belum ada penilaian kinerja");
      conflictWarningSet.add(
        `${state.lecturer.name} belum memiliki penilaian kinerja; konfirmasi kesesuaian untuk ${slot.course.code}.${slot.index + 1}.`,
      );
    }
    if (state.rating > 0 && state.rating <= LOW_RATING_THRESHOLD) {
      warnings.push(`Penilaian bintang ${state.rating}: dibatasi 1 kelas`);
      conflictWarningSet.add(
        `${state.lecturer.name} memiliki penilaian bintang ${state.rating} dan dibatasi maksimal 1 kelas.`,
      );
    }
    if (state.assigned + 1 >= state.capacity && state.capacity > 0)
      warnings.push("Dosen mencapai batas slot/kapasitas");
    assignmentMap[slot.course.code][slot.index] = state.lecturer.id;
    assignmentExplanations.push({
      id: `${slot.course.code}.${slot.index + 1}`,
      courseCode: slot.course.code,
      courseTitle: slot.course.title,
      className: `${slot.course.code}.${slot.index + 1}`,
      lecturerId: state.lecturer.id,
      lecturerName: state.lecturer.name,
      expertiseMatched,
      reasons: [
        expertiseMatched
          ? "Bidang keahlian cocok dengan mata kuliah."
          : "Tidak ada dosen dengan keahlian yang cocok memiliki kapasitas tersisa; dipilih berdasarkan penilaian, ketersediaan, dan beban kerja sebagai alternatif.",
        state.rating
          ? `Penilaian kinerja bintang ${state.rating}.`
          : "Belum ada penilaian kinerja tercatat.",
        `Kapasitas setelah alokasi: ${state.assigned + 1}/${state.capacity}.`,
        priorCourseCount
          ? `Sudah mengajar ${priorCourseCount} kelas untuk mata kuliah ini sebelumnya.`
          : "Belum ada kelas duplikat untuk mata kuliah ini sebelum alokasi.",
        riskLabel ? `Label risiko: ${riskLabel}.` : "Tidak ada risiko penilaian rendah.",
        warningNote ? `Catatan admin: ${warningNote}.` : "Tidak ada catatan admin tercatat.",
        phaseLabel,
      ],
      warnings,
    });
    state.assigned += 1;
    return true;
  };

  const runTierPasses = (
    targetLimits,
    predicate,
    phaseLabel,
    includeRestricted = false,
  ) => {
    targetLimits.forEach((targetLimit) => {
      slots.forEach((slot) => {
        if (assignmentMap[slot.course.code][slot.index]) return;
        assignSlot(
          slot,
          chooseCandidate(
            slot.course,
            targetLimit,
            includeRestricted,
            predicate,
          ),
          phaseLabel,
        );
      });
    });
  };

  runTierPasses(
    Array.from({ length: FIVE_STAR_TARGET }, (_, index) => index + 1),
    (state) => state.rating >= 5,
    `Tahap pemenuhan bintang 5 menuju ${FIVE_STAR_TARGET} kelas.`,
  );
  runTierPasses(
    [1, 2, FOUR_STAR_TARGET],
    (state) => state.rating === 4,
    `Tahap prioritas bintang 4 menuju ${FOUR_STAR_TARGET} kelas.`,
  );
  runTierPasses(
    [1, THREE_STAR_TARGET],
    (state) => state.rating === 3,
    `Tahap distribusi bintang 3 menuju ${THREE_STAR_TARGET} kelas.`,
  );
  runTierPasses(
    [LECTURER_CLASS_LIMIT],
    (state) => state.rating === 4,
    `Tahap limpahan bintang 4 hingga ${LECTURER_CLASS_LIMIT} kelas.`,
  );
  runTierPasses(
    [3, LECTURER_CLASS_LIMIT],
    (state) => state.rating === 3,
    `Tahap limpahan bintang 3 hingga ${LECTURER_CLASS_LIMIT} kelas.`,
  );
  runTierPasses(
    [1],
    (state) => state.rating < 3,
    "Tahap alokasi 1 kelas untuk dosen tanpa penilaian dan bintang 1-2.",
    true,
  );
  runTierPasses(
    [1, 2, 3, LECTURER_CLASS_LIMIT],
    () => true,
    "Tahap alternatif kapasitas akhir setelah semua target penilaian dipertimbangkan.",
    true,
  );

  const metrics = calculateAutoPilotMetrics(
    lecturers,
    courses,
    assignmentMap,
    preservedAssignmentMap,
    assignmentExplanations,
  );
  const fiveStarLecturers = states.filter((state) => state.rating >= 5);
  const underTargetFiveStarLecturers = fiveStarLecturers.filter(
    (state) => state.assigned < Math.min(FIVE_STAR_TARGET, state.capacity),
  );
  const fourStarLecturers = states.filter((state) => state.rating === 4);
  const underTargetFourStarLecturers = fourStarLecturers.filter(
    (state) => state.assigned < Math.min(FOUR_STAR_TARGET, state.capacity),
  );
  const restrictedLecturers = states.filter((state) => state.restricted);
  const unratedLecturers = states.filter((state) => !state.rating);
  const fullLecturers = states.filter(
    (state) => state.assigned >= state.capacity && state.capacity > 0,
  );
  const unassignedByCourse = plannedCourses
    .map((course) => ({
      course,
      count: (assignmentMap[course.code] || []).filter((id) => !id).length,
    }))
    .filter((item) => item.count > 0);

  const reviewNotes = [
    `Auto-pilot mempertahankan ${metrics.preservedCount} alokasi yang sudah ada dan mengisi ${metrics.newlyAssignedCount} slot kelas terbuka.`,
    useAvailabilityFallback ? AUTO_PILOT_AVAILABILITY_FALLBACK_NOTE : "",
    `Hasil total: ${metrics.assignedCount} dari ${metrics.plannedCount} rencana kelas telah teralokasi dengan batas maksimal ${LECTURER_CLASS_LIMIT} kelas per dosen dan batas 1 kelas untuk dosen di bawah bintang 3.`,
    fiveStarLecturers.length
      ? `Dosen bintang 5 diprioritaskan hingga ${FIVE_STAR_TARGET} kelas sebelum tahap distribusi umum.`
      : "",
    `Tingkat penilaian diterapkan berurutan: dosen bintang 5 hingga ${FIVE_STAR_TARGET} kelas, lalu bintang 4 hingga ${FOUR_STAR_TARGET}, kemudian bintang 3 hingga ${THREE_STAR_TARGET}; hanya dosen minimal bintang 3 yang dapat menerima 2 kelas atau lebih.`,
    metrics.newlyAssignedCount
      ? `Alokasi yang dihasilkan cocok dengan bidang keahlian untuk ${metrics.newExpertiseMatchCount} dari ${metrics.newlyAssignedCount} kelas (${metrics.newExpertiseMatchRate}%).`
      : "Tidak ada slot kelas terbuka yang memerlukan alokasi auto-pilot baru.",
    metrics.preservedCount
      ? `Alokasi yang dipertahankan cocok keahlian untuk ${metrics.preservedExpertiseMatchCount} dari ${metrics.preservedCount} kelas (${metrics.preservedExpertiseMatchRate}%); ${metrics.preservedExpertiseMismatchCount} ketidakcocokan sebelumnya dipertahankan untuk tinjauan administrator.`
      : "Tidak ada alokasi sebelumnya yang dipertahankan dalam proses ini.",
  ].filter(Boolean);
  if (underTargetFiveStarLecturers.length)
    reviewNotes.push(
      `${underTargetFiveStarLecturers.length} dosen bintang 5 belum mencapai ${FIVE_STAR_TARGET} kelas karena batas kapasitas tersedia atau batas slot yang direncanakan: ${summarizeTargetShortfalls(underTargetFiveStarLecturers, (state) => Math.min(FIVE_STAR_TARGET, state.capacity))}.`,
    );
  if (underTargetFourStarLecturers.length)
    reviewNotes.push(
      `${underTargetFourStarLecturers.length} dosen bintang 4 belum mencapai ${FOUR_STAR_TARGET} kelas karena batas kapasitas tersedia atau batas slot yang direncanakan: ${summarizeTargetShortfalls(underTargetFourStarLecturers, (state) => Math.min(FOUR_STAR_TARGET, state.capacity))}.`,
    );
  if (restrictedLecturers.length)
    reviewNotes.push(
      `${restrictedLecturers.length} dosen dengan penilaian bintang 1-2 dibatasi maksimal 1 kelas: ${restrictedLecturers.map((state) => state.lecturer.name).join(", ")}.`,
    );
  if (unratedLecturers.length)
    reviewNotes.push(
      `${unratedLecturers.length} dosen tanpa penilaian dibatasi maksimal 1 kelas hingga penilaian bintang 3+ tercatat: ${unratedLecturers.map((state) => state.lecturer.name).join(", ")}.`,
    );
  if (fullLecturers.length)
    reviewNotes.push(
      `${fullLecturers.length} dosen telah mencapai batas ketersediaan/kapasitas: ${fullLecturers.map((state) => `${state.lecturer.name} (${state.assigned}/${state.capacity})`).join(", ")}.`,
    );
  if (unassignedByCourse.length)
    reviewNotes.push(
      `Perlu tinjauan manual untuk kelas yang belum teralokasi: ${unassignedByCourse.map(({ course, count }) => `${course.code} ${course.title} (${count})`).join("; ")}.`,
    );
  if (!metrics.plannedCount)
    reviewNotes.push(
      "Tidak ada rencana kelas yang ditemukan. Tentukan jumlah rencana kelas sebelum menjalankan auto-pilot.",
    );
  metrics.preservedExpertiseMismatches.forEach((item) =>
    conflictWarningSet.add(
      `${item.className} mempertahankan alokasi yang sudah ada untuk ${item.lecturerName} tanpa kecocokan keahlian terdaftar.`,
    ),
  );
  unassignedByCourse.forEach(({ course, count }) =>
    conflictWarningSet.add(
      `${course.code} ${course.title} masih memiliki ${count} rencana kelas yang belum teralokasi.`,
    ),
  );
  metrics.overLimitLecturers.forEach((item) =>
    conflictWarningSet.add(
      `${item.name} memiliki ${item.load} alokasi kelas, melebihi batas penilaian (${item.classLimit} kelas).`,
    ),
  );

  return {
    assignmentMap,
    reviewNotes,
    conflictWarnings: Array.from(conflictWarningSet),
    assignmentExplanations,
    assignedCount: metrics.assignedCount,
    plannedCount: metrics.plannedCount,
    metrics,
  };
}

export function buildRebalancedPlotting(
  lecturers,
  courses,
  classCounts,
  existingAssignmentMap = {},
) {
  const filledResult = buildAutoPilotPlotting(
    lecturers,
    courses,
    classCounts,
    existingAssignmentMap,
  );
  const assignmentMap = Object.fromEntries(
    Object.entries(filledResult.assignmentMap).map(([code, ids]) => [
      code,
      [...ids],
    ]),
  );
  const originalAssignmentMap = buildInitialAssignmentMap(
    lecturers,
    courses,
    classCounts,
    existingAssignmentMap,
  );
  const hasPositiveAvailabilityData = lecturers.some(
    (lecturer) => Number(lecturer?.available || 0) > 0,
  );
  const useAvailabilityFallback = Boolean(
    lecturers.length && !hasPositiveAvailabilityData,
  );
  const states = lecturers.map((lecturer) => ({
    lecturer,
    rating: clampRating(lecturer.rating),
    assigned: countLecturerAssignments(assignmentMap, lecturer.id),
    capacity: getLecturerAutoPilotCapacity(lecturer, useAvailabilityFallback),
    target: getLecturerRatingPriorityTarget(lecturer),
  }));
  const stateById = new Map(
    states.map((state) => [state.lecturer.id, state]),
  );
  const reassignments = [];
  const rebalanceExplanations = [];

  const findTransfer = (recipient) => {
    const recipientCourseCounts = Object.fromEntries(
      courses.map((course) => [
        course.code,
        (assignmentMap[course.code] || []).filter(
          (id) => id === recipient.lecturer.id,
        ).length,
      ]),
    );
    return courses
      .flatMap((course) =>
        (assignmentMap[course.code] || []).flatMap((lecturerId, index) => {
          const donor = stateById.get(lecturerId);
          if (
            !donor ||
            donor.rating >= recipient.rating ||
            donor.assigned <= Math.min(donor.target, donor.capacity) ||
            !expertiseMatchesCourse(recipient.lecturer, course)
          )
            return [];
          return [
            {
              course,
              index,
              donor,
              donorExpertiseMatched: expertiseMatchesCourse(
                donor.lecturer,
                course,
              ),
              recipientCourseCount: recipientCourseCounts[course.code] || 0,
            },
          ];
        }),
      )
      .sort(
        (a, b) =>
          Number(a.donorExpertiseMatched) -
            Number(b.donorExpertiseMatched) ||
          a.recipientCourseCount - b.recipientCourseCount ||
          a.donor.rating - b.donor.rating ||
          b.donor.assigned - b.donor.target -
            (a.donor.assigned - a.donor.target) ||
          a.course.code.localeCompare(b.course.code) ||
          a.index - b.index,
      )[0];
  };

  states
    .filter((state) => state.rating >= 4)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        a.assigned - b.assigned ||
        a.lecturer.name.localeCompare(b.lecturer.name),
    )
    .forEach((recipient) => {
      const protectedTarget = Math.min(recipient.target, recipient.capacity);
      while (
        recipient.assigned < protectedTarget &&
        recipient.assigned < recipient.capacity
      ) {
        const transfer = findTransfer(recipient);
        if (!transfer) break;
        const { course, index, donor } = transfer;
        assignmentMap[course.code][index] = recipient.lecturer.id;
        const className = `${course.code}.${index + 1}`;
        reassignments.push({
          className,
          courseCode: course.code,
          courseTitle: course.title,
          fromLecturerId: donor.lecturer.id,
          fromLecturerName: donor.lecturer.name,
          fromRating: donor.rating,
          toLecturerId: recipient.lecturer.id,
          toLecturerName: recipient.lecturer.name,
          toRating: recipient.rating,
          donorLoadBefore: donor.assigned,
          donorLoadAfter: donor.assigned - 1,
          recipientLoadBefore: recipient.assigned,
          recipientLoadAfter: recipient.assigned + 1,
        });
        rebalanceExplanations.push({
          id: `rebalance:${className}:${recipient.lecturer.id}`,
          courseCode: course.code,
          courseTitle: course.title,
          className,
          lecturerId: recipient.lecturer.id,
          lecturerName: recipient.lecturer.name,
          expertiseMatched: true,
          reasons: [
            `Dialihkan dari ${donor.lecturer.name} (bintang ${donor.rating || "tanpa penilaian"}).`,
            `Dosen penerima memiliki penilaian bintang ${recipient.rating} dan keahlian yang cocok.`,
            `Beban kerja berubah dari ${recipient.assigned} menjadi ${recipient.assigned + 1}; dosen sebelumnya tetap di ${donor.assigned - 1}.`,
            "Pengalihan meningkatkan prioritas penilaian tanpa mengurangi kompatibilitas keahlian.",
          ],
          warnings: [],
        });
        donor.assigned -= 1;
        recipient.assigned += 1;
      }
    });

  const metrics = calculateAutoPilotMetrics(
    lecturers,
    courses,
    assignmentMap,
    originalAssignmentMap,
    filledResult.assignmentExplanations,
  );
  metrics.rebalancedCount = reassignments.length;
  const health = calculatePlottingHealth(
    lecturers,
    courses,
    classCounts,
    assignmentMap,
  );
  const conflictWarnings = [
    ...health.unassignedClasses.map(
      (item) => `${item.className} masih belum dialokasikan.`,
    ),
    ...health.expertiseMismatches.map(
      (item) =>
        `${item.className} tetap dialokasikan untuk ${item.lecturerName} tanpa kecocokan keahlian terdaftar.`,
    ),
    ...health.ruleExceptions,
  ];
  const underTarget = states.filter(
    (state) =>
      state.rating >= 4 &&
      state.assigned < Math.min(state.target, state.capacity),
  );
  const reviewNotes = [
    `Penyeimbangan beban mengisi ${filledResult.metrics.newlyAssignedCount} slot kelas terbuka dan mengusulkan ${reassignments.length} pengalihan kelas yang kompatibel.`,
    `Dosen bintang 5 diproteksi menuju ${FIVE_STAR_TARGET} kelas dan dosen bintang 4 menuju ${FOUR_STAR_TARGET} sebelum dosen dengan penilaian lebih rendah mempertahankan alokasi di atas target proteksi mereka.`,
    reassignments.length
      ? "Setiap pengalihan yang diusulkan mempertahankan kecocokan keahlian dan memastikan dosen sebelumnya tetap berada pada atau di atas target penilaian mereka."
      : "Tidak ada pengalihan prioritas penilaian yang aman; alokasi yang ada tetap tidak berubah.",
    underTarget.length
      ? `${underTarget.length} dosen berpenilaian tinggi tetap di bawah target karena tidak ada alokasi dosen berpenilaian lebih rendah yang kompatibel untuk dipindahkan secara aman: ${summarizeTargetShortfalls(underTarget, (state) => Math.min(state.target, state.capacity))}.`
      : "Semua dosen bintang 5 dan bintang 4 dengan kapasitas cukup telah mencapai target proteksi mereka.",
  ];

  return {
    assignmentMap,
    reviewNotes,
    conflictWarnings,
    assignmentExplanations: [
      ...filledResult.assignmentExplanations,
      ...rebalanceExplanations,
    ],
    reassignments,
    assignedCount: metrics.assignedCount,
    plannedCount: metrics.plannedCount,
    metrics,
  };
}
