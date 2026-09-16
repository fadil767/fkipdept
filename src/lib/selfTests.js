export function runSelfTests(deps) {
  const {
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
    mergeServerLecturerLabels,
    mergeImportedLecturer,
    normalizeCourseClassPlans,
    plottedCourseCountLabel,
    plottedCourseTitles,
    resizeCourseAssignments,
    serializeCourseClassPlans,
    serializeLecturersForDatabase,
    swapAssignmentSlots,
  } = deps;

  function runTests() {
    const testCourses = [
      { code: "COURSE101", title: "Basic Reading", credits: 3 },
      { code: "COURSE102", title: "Academic Writing", credits: 3 },
    ];
    const testLecturers = [
      {
        id: "LECT001",
        degree: "M.A.",
        name: "Test Lecturer",
        email: "lecturer@example.com",
        phone: "0800000000",
        expertise: ["Reading"],
        plotted: ["COURSE101"],
        available: 1,
        rating: 4,
        warning_note: "",
      },
      {
        id: "LECT002",
        degree: "Ph.D.",
        name: "Second Lecturer",
        email: "second@example.com",
        phone: "0800000001",
        expertise: ["Writing"],
        plotted: ["COURSE101", "COURSE102"],
        available: 4,
        rating: 3,
        warning_note: "Needs follow-up",
      },
    ];
    const testTerms = [
      {
        code: "TERM001",
        name: "Active Term",
        ay: "2025/2026",
        semester: "Semester 2",
        active: true,
      },
      {
        code: "TERM002",
        name: "Previous Term",
        ay: "2025/2026",
        semester: "Semester 1",
        active: false,
      },
    ];
    console.assert(testCourses.length > 0, "Courses should not be empty");
    console.assert(testLecturers.length > 0, "Lecturers should not be empty");
    console.assert(
      testTerms.filter((term) => term.active).length === 1,
      "Exactly one term should be active",
    );
    console.assert(
      findLecturerById(testLecturers, " lect001 ")?.name === "Test Lecturer",
      "Public lookup should find a lecturer by ID",
    );
    const courseCodes = new Set(testCourses.map((course) => course.code));
    const missingCodes = testLecturers.flatMap((lecturer) =>
      lecturer.plotted.filter((code) => !courseCodes.has(code)),
    );
    console.assert(
      missingCodes.length === 0,
      `Missing course codes: ${missingCodes.join(", ")}`,
    );
    const exportRows = buildLecturerExportRows(testLecturers, testCourses);
    console.assert(
      exportRows.length === testLecturers.length,
      "Export row count should match lecturer count",
    );
    console.assert(
      exportRows[0].Plotted_Course_Names.includes("Basic Reading"),
      "Export should include plotted course names",
    );
    console.assert(
      exportRows[1].Rating === 3 &&
        exportRows[1].Warning_Note === "Needs follow-up",
      "Export should include lecturer labels",
    );
    console.assert(
      Object.keys(buildLecturerTemplateRows()[0]).join(",") ===
        LECTURER_EXPORT_COLUMNS.join(","),
      "Lecturer template should include the import/export columns",
    );
    console.assert(
      plottedCourseTitles(testLecturers[0], testCourses).includes(
        "Basic Reading",
      ),
      "Lecturer display should resolve plotted course names",
    );
    console.assert(
      plottedCourseCountLabel(1) === "1 plotted course",
      "Singular label should work",
    );
    console.assert(
      plottedCourseCountLabel(2) === "2 plotted courses",
      "Plural label should work",
    );
    console.assert(
      getPlottedCountData(testLecturers).some(
        (item) => item.name === "1 plotted course",
      ),
      "Dashboard data should include 1 plotted course",
    );
    console.assert(
      getCourseClassCounts(testLecturers, testCourses, { COURSE101: 3 })
        .COURSE101 === 3,
      "Planned class count should override assigned count when larger",
    );
    console.assert(
      getCourseAssignmentMap(testLecturers, testCourses).COURSE101.length === 2,
      "Course assignment map should include each assigned class",
    );
    const largeAssignmentPlan = Array.from(
      { length: 117 },
      (_, index) => `LECT${index + 1}`,
    );
    const reducedAssignmentPlan = resizeCourseAssignments(
      largeAssignmentPlan,
      110,
    );
    console.assert(
      reducedAssignmentPlan.length === 110 &&
        reducedAssignmentPlan[109] === "LECT110",
      "Reducing planned classes should remove surplus assignment slots",
    );
    const swappedAssignments = swapAssignmentSlots(
      { COURSE101: ["LECT001"], COURSE102: ["LECT002"] },
      { courseCode: "COURSE101", classIndex: 0 },
      { courseCode: "COURSE102", classIndex: 0 },
    );
    console.assert(
      swappedAssignments.COURSE101[0] === "LECT002" &&
        swappedAssignments.COURSE102[0] === "LECT001",
      "Class swaps should exchange both assignment slots atomically",
    );
    console.assert(
      expertiseMatchesCourse(testLecturers[0], testCourses[0]),
      "Expertise should match course title",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["English Language Teaching"] },
        testCourses[0],
      ),
      "Course expertise rules should match teaching expertise to reading/writing courses",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["ELT"] },
        testCourses[0],
      ) &&
        expertiseMatchesCourse(
          { ...testLecturers[0], expertise: ["Language Teaching"] },
          testCourses[0],
        ),
      "Common expertise aliases should resolve to their canonical category",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Indonesian Linguistics"] },
        { code: "COURSE103", title: "Tata Bahasa Indonesia", credits: 3 },
      ),
      "Course expertise rules should match Indonesian Linguistics courses",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Literary Studies"] },
        { code: "COURSE104", title: "Pengantar Ilmu Sastra", credits: 3 },
      ),
      "Course expertise rules should match literary studies courses",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["English Linguistics"] },
        { code: "COURSE105", title: "Pengantar Linguistik Umum", credits: 3 },
      ),
      "Course expertise rules should match general linguistics to English Linguistics",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Indonesian Linguistics"] },
        { code: "COURSE105", title: "Pengantar Linguistik Umum", credits: 3 },
      ),
      "Course expertise rules should match general linguistics to Indonesian Linguistics",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Translation Studies"] },
        {
          code: "COURSE106",
          title: "Grammar Translation Exercises",
          credits: 3,
        },
      ),
      "Course expertise rules should match grammar translation to Translation Studies",
    );
    console.assert(
      expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Philosophy"] },
        { code: "COURSE107", title: "Sejarah Pemikiran Modern", credits: 3 },
      ),
      "Course expertise rules should match philosophy courses",
    );
    console.assert(
      !expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["English Linguistics"] },
        { code: "COURSE108", title: "Basic Grammar", credits: 3 },
      ),
      "Grammar alone should not match English Linguistics after keyword removal",
    );
    console.assert(
      !expertiseMatchesCourse(
        { ...testLecturers[0], expertise: ["Indonesian Linguistics"] },
        { code: "COURSE109", title: "Analisis Teks", credits: 3 },
      ),
      "Analisis teks alone should not match Indonesian Linguistics after keyword removal",
    );
    const autoPilotLecturers = [
      {
        ...testLecturers[0],
        id: "AUTO001",
        name: "Reading Expert",
        expertise: ["Reading"],
        plotted: [],
        available: 4,
        rating: 5,
        warning_note: "",
      },
      {
        ...testLecturers[1],
        id: "AUTO002",
        name: "Writing Expert",
        expertise: ["Writing"],
        plotted: [],
        available: 4,
        rating: 4,
        warning_note: "",
      },
      {
        ...testLecturers[0],
        id: "AUTO003",
        name: "Low Rated Expert",
        expertise: ["Reading"],
        plotted: [],
        available: 4,
        rating: 1,
        warning_note: "",
      },
      {
        ...testLecturers[1],
        id: "AUTO004",
        name: "Warning Expert",
        expertise: ["Writing"],
        plotted: [],
        available: 4,
        rating: 5,
        warning_note: "Review first",
      },
    ];
    const autoPilotResult = buildAutoPilotPlotting(
      autoPilotLecturers,
      testCourses,
      { COURSE101: 3, COURSE102: 3 },
    );
    console.assert(
      autoPilotResult.assignedCount === 6,
      "Auto-pilot should assign all classes when capacity exists",
    );
    console.assert(
      countLecturerAssignments(autoPilotResult.assignmentMap, "AUTO001") +
        countLecturerAssignments(autoPilotResult.assignmentMap, "AUTO004") ===
        6,
      "Auto-pilot should prioritize 5-star lecturers toward 4 classes before general distribution",
    );
    console.assert(
      autoPilotResult.reviewNotes.some((note) =>
        note.includes("Five-star lecturers were prioritized"),
      ),
      "Auto-pilot should explain 5-star prioritization",
    );
    console.assert(
      countLecturerAssignments(autoPilotResult.assignmentMap, "AUTO003") <= 1,
      "Auto-pilot should limit 1-2 star lecturers to one class",
    );
    console.assert(
      autoPilotLecturers.every(
        (lecturer) =>
          countLecturerAssignments(autoPilotResult.assignmentMap, lecturer.id) <
            2 || lecturer.rating >= 3,
      ),
      "Only lecturers with at least 3 stars should receive two or more classes",
    );
    console.assert(
      autoPilotResult.reviewNotes.every(
        (note) => !note.includes("warning notes or 1-2 star ratings"),
      ),
      "Warning notes should not restrict auto-pilot assignment",
    );
    console.assert(
      autoPilotLecturers.every(
        (lecturer) =>
          countLecturerAssignments(
            autoPilotResult.assignmentMap,
            lecturer.id,
          ) <= LECTURER_CLASS_LIMIT,
      ),
      "Auto-pilot should respect the 4-class lecturer cap",
    );
    console.assert(
      autoPilotResult.reviewNotes.some((note) =>
        note.includes("Auto-pilot preserved"),
      ),
      "Auto-pilot should provide admin review notes",
    );
    console.assert(
      autoPilotResult.assignmentExplanations.length ===
        autoPilotResult.assignedCount,
      "Auto-pilot should explain each assigned class",
    );
    console.assert(
      autoPilotResult.metrics.newExpertiseMismatchCount === 0,
      "Auto-pilot should avoid expertise fallbacks while matching capacity exists",
    );
    console.assert(
      autoPilotResult.metrics.newExpertiseMatchRate === 100,
      "Auto-pilot should report generated expertise matches separately",
    );
    console.assert(
      autoPilotResult.metrics.loadDistribution.reduce(
        (sum, item) => sum + item.count,
        0,
      ) === autoPilotLecturers.length,
      "Auto-pilot should report workload distribution",
    );
    const ratingPriorityAutoPilot = buildAutoPilotPlotting(
      [
        {
          ...testLecturers[0],
          id: "RATE004",
          name: "Four Star Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 4,
          warning_note: "",
        },
        {
          ...testLecturers[1],
          id: "RATE003",
          name: "Three Star Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 3,
          warning_note: "",
        },
      ],
      [testCourses[0]],
      { COURSE101: 1 },
    );
    console.assert(
      ratingPriorityAutoPilot.assignmentMap.COURSE101[0] === "RATE004",
      "Auto-pilot should prioritize 4-star lecturers over 3-star lecturers",
    );
    const ratingTierAutoPilot = buildAutoPilotPlotting(
      [
        {
          ...testLecturers[0],
          id: "TIER004",
          name: "Four Star Tier Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 4,
          warning_note: "",
        },
        {
          ...testLecturers[1],
          id: "TIER003",
          name: "Three Star Tier Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 3,
          warning_note: "",
        },
      ],
      [testCourses[0]],
      { COURSE101: 6 },
    );
    console.assert(
      countLecturerAssignments(
        ratingTierAutoPilot.assignmentMap,
        "TIER004",
      ) === 4 &&
        countLecturerAssignments(
          ratingTierAutoPilot.assignmentMap,
          "TIER003",
        ) === 2,
      "Four-star lecturers should reach their priority tier before three-star overflow",
    );
    const rebalancedRatingTier = buildRebalancedPlotting(
      [
        {
          ...testLecturers[0],
          id: "REBALANCE004",
          name: "Four Star Rebalance Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 4,
          warning_note: "",
        },
        {
          ...testLecturers[1],
          id: "REBALANCE003",
          name: "Three Star Rebalance Lecturer",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 3,
          warning_note: "",
        },
      ],
      [testCourses[0]],
      { COURSE101: 5 },
      {
        COURSE101: [
          "REBALANCE004",
          "REBALANCE004",
          "REBALANCE003",
          "REBALANCE003",
          "REBALANCE003",
        ],
      },
    );
    console.assert(
      countLecturerAssignments(
        rebalancedRatingTier.assignmentMap,
        "REBALANCE004",
      ) === 3 &&
        countLecturerAssignments(
          rebalancedRatingTier.assignmentMap,
          "REBALANCE003",
        ) === 2 &&
        rebalancedRatingTier.reassignments.length === 1 &&
        rebalancedRatingTier.reassignments[0].courseCode === "COURSE101",
      "Rebalancing should move one compatible class from a three-star lecturer above target to a four-star lecturer below target",
    );
    const matchFirstAutoPilot = buildAutoPilotPlotting(
      [
        {
          ...testLecturers[0],
          id: "MATCH005",
          name: "Non-matching Five Star",
          expertise: ["Translation Studies"],
          plotted: [],
          available: 4,
          rating: 5,
        },
        {
          ...testLecturers[1],
          id: "MATCH003",
          name: "Matching Three Star",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 3,
        },
      ],
      [testCourses[0]],
      { COURSE101: 4 },
    );
    console.assert(
      matchFirstAutoPilot.assignmentMap.COURSE101.every(
        (id) => id === "MATCH003",
      ) && matchFirstAutoPilot.metrics.newExpertiseMatchRate === 100,
      "Matching expertise should outrank a higher rating for every available class",
    );
    const expertiseFallbackAutoPilot = buildAutoPilotPlotting(
      [
        {
          ...testLecturers[0],
          id: "FALLBACK005",
          name: "Fallback Five Star",
          expertise: ["Translation Studies"],
          plotted: [],
          available: 4,
          rating: 5,
        },
        {
          ...testLecturers[1],
          id: "FALLBACK003",
          name: "Limited Reading Expert",
          expertise: ["Reading"],
          plotted: [],
          available: 2,
          rating: 3,
        },
      ],
      [testCourses[0]],
      { COURSE101: 3 },
    );
    console.assert(
      expertiseFallbackAutoPilot.assignmentMap.COURSE101.filter(
        (id) => id === "FALLBACK003",
      ).length === 2 &&
        expertiseFallbackAutoPilot.metrics.newExpertiseMismatchCount === 1,
      "Non-matching fallback should begin only after matching capacity is exhausted",
    );
    const preservedMismatchAutoPilot = buildAutoPilotPlotting(
      [
        {
          ...testLecturers[0],
          id: "PRESERVE_MATCH",
          name: "Preserved Match Expert",
          expertise: ["Reading"],
          plotted: [],
          available: 4,
          rating: 4,
        },
        {
          ...testLecturers[1],
          id: "PRESERVE_OTHER",
          name: "Preserved Other Expert",
          expertise: ["Translation Studies"],
          plotted: [],
          available: 4,
          rating: 4,
        },
      ],
      [testCourses[0]],
      { COURSE101: 5 },
      {
        COURSE101: ["PRESERVE_OTHER", "PRESERVE_OTHER", "", "", ""],
      },
    );
    console.assert(
      preservedMismatchAutoPilot.metrics.newExpertiseMatchRate === 100 &&
        preservedMismatchAutoPilot.metrics.preservedExpertiseMatchRate === 0 &&
        preservedMismatchAutoPilot.metrics.preservedExpertiseMismatchCount ===
          2,
      "Generated and preserved expertise results should be reported separately",
    );
    const plottingHealth = calculatePlottingHealth(
      [
        {
          ...testLecturers[0],
          id: "HEALTH001",
          plotted: [],
          available: 1,
          rating: 0,
        },
      ],
      testCourses,
      { COURSE101: 2, COURSE102: 1 },
      { COURSE101: ["HEALTH001", "HEALTH001"], COURSE102: [""] },
    );
    console.assert(
      plottingHealth.unassignedClasses.length === 1,
      "Plotting health should report unassigned classes",
    );
    console.assert(
      plottingHealth.overloadedLecturers.length === 1 &&
        plottingHealth.unratedLecturers.length === 1 &&
        plottingHealth.ruleExceptions.length > 0,
      "Plotting health should report overloaded and unrated lecturer exceptions",
    );
    const preservedAutoPilot = buildAutoPilotPlotting(
      autoPilotLecturers,
      testCourses,
      { COURSE101: 3, COURSE102: 1 },
      { COURSE101: ["AUTO004", "", ""], COURSE102: ["AUTO001"] },
    );
    console.assert(
      preservedAutoPilot.assignmentMap.COURSE101[0] === "AUTO004" &&
        preservedAutoPilot.assignmentMap.COURSE102[0] === "AUTO001",
      "Auto-pilot should preserve existing plotting assignments",
    );
    console.assert(
      preservedAutoPilot.metrics.preservedCount === 2,
      "Auto-pilot should report preserved plotting assignments",
    );
    const zeroAvailabilityAutoPilot = buildAutoPilotPlotting(
      autoPilotLecturers.map((lecturer) => ({ ...lecturer, available: 0 })),
      testCourses,
      { COURSE101: 2, COURSE102: 2 },
    );
    console.assert(
      zeroAvailabilityAutoPilot.assignedCount === 4,
      "Auto-pilot should use the class cap fallback when all availability values are zero",
    );
    console.assert(
      zeroAvailabilityAutoPilot.reviewNotes.some((note) =>
        note.includes("No positive availability slots"),
      ),
      "Auto-pilot should explain the zero-availability fallback",
    );
    const plottingRows = buildPlottingExportRows(testLecturers, testCourses, {
      COURSE101: 3,
    });
    console.assert(
      plottingRows.length === 4,
      "Plotting export should include planned classes and existing assignments",
    );
    console.assert(
      plottingRows[0].Idtutor === "LECT001" &&
        plottingRows[0].Kelas === "COURSE101.1" &&
        plottingRows[0]["Nama MK"] === "Basic Reading",
      "Plotting export should match the Excel plotting schema",
    );
    console.assert(
      plottingRows[2].Idtutor === "",
      "Unassigned planned classes should export as blank lecturer cells",
    );
    const importedPlotting = mapImportedPlottingRows(
      [
        {
          Idtutor: "LECT002",
          Nama: "Second Lecturer",
          Kelas: "COURSE102.1",
          "Nama MK": "Academic Writing",
        },
      ],
      testLecturers,
      testCourses,
    );
    console.assert(
      importedPlotting.counts.COURSE102 === 1,
      "Plotting import should set class count from Kelas",
    );
    console.assert(
      importedPlotting.assignments.COURSE102[0] === "LECT002",
      "Plotting import should map lecturer ID to class",
    );
    const simpleImportedPlotting = mapImportedPlottingRows(
      [{ ID: "LECT001", Course_Code: "COURSE101" }],
      testLecturers,
      testCourses,
    );
    console.assert(
      simpleImportedPlotting.assignments.COURSE101[0] === "LECT001",
      "Plotting import should support ID and Course_Code only",
    );
    const limitedAssignments = limitAssignmentMapByLecturer({
      COURSE101: ["LECT001", "LECT001", "LECT001"],
      COURSE102: ["LECT001", "LECT001"],
    });
    console.assert(
      countLecturerAssignments(limitedAssignments, "LECT001") ===
        LECTURER_CLASS_LIMIT,
      "Lecturer assignments should be capped at four classes",
    );
    const scopedLecturers = getTermScopedLecturers(
      testLecturers,
      [
        buildTermPlottingRow("TERM002", {
          ...testLecturers[0],
          plotted: ["COURSE102"],
          available: 3,
        }),
      ],
      "TERM002",
    );
    console.assert(
      scopedLecturers[0].plotted.includes("COURSE102"),
      "Term plotting should override lecturer plotting",
    );
    console.assert(
      scopedLecturers[1].plotted.length === 0,
      "Missing term plotting should stay empty for a new term",
    );
    console.assert(availabilityTone(0) === "red", "0 available should be red");
    console.assert(
      availabilityTone(1) === "orange",
      "1 available should be orange",
    );
    console.assert(
      availabilityTone(2) === "amber",
      "2 available should be yellow/amber",
    );
    console.assert(
      availabilityTone(3) === "blue",
      "3 available should be blue",
    );
    console.assert(
      availabilityTone(4) === "green",
      "4 available should be green",
    );
    const mergedLecturerImport = mergeImportedLecturer(testLecturers[0], {
      id: "LECT001",
      email: "new@example.com",
      phone: "08123456789",
      plotted: [],
      available: 0,
    });
    console.assert(
      mergedLecturerImport.email === "new@example.com" &&
        mergedLecturerImport.phone === "08123456789",
      "Lecturer import should update completed profile fields",
    );
    console.assert(
      mergedLecturerImport.plotted.includes("COURSE101") &&
        mergedLecturerImport.available === 1,
      "Lecturer import should preserve existing plotting data",
    );
    const availabilityImport = mergeImportedLecturer(testLecturers[0], {
      id: "LECT001",
      available: 3,
      _hasImportedAvailable: true,
    });
    console.assert(
      availabilityImport.available === 3 &&
        availabilityImport.plotted.includes("COURSE101"),
      "Lecturer import should update availability without changing plotted courses",
    );
    const labelImport = mergeImportedLecturer(testLecturers[0], {
      id: "LECT001",
      rating: 5,
      warning_note: "Review before plotting",
      _hasImportedRating: true,
      _hasImportedWarningNote: true,
    });
    console.assert(
      labelImport.rating === 5 &&
        labelImport.warning_note === "Review before plotting",
      "Lecturer import should update labels when provided",
    );
    console.assert(
      !("rating" in serializeLecturersForDatabase(testLecturers, false)[0]) &&
        !("warning_note" in
          serializeLecturersForDatabase(testLecturers, false)[0]) &&
        serializeLecturersForDatabase(testLecturers, true)[0].rating === 4,
      "Core lecturer sync should not include labels",
    );
    const queuedLabelRows = applyLecturerLabelChanges(testLecturers, {
      LECT001: { rating: 5, changeId: "test-change" },
    });
    console.assert(
      queuedLabelRows[0].rating === 5 && queuedLabelRows[1].rating === 3,
      "Pending labels should apply only to the selected lecturer",
    );
    const serverLabelRows = mergeServerLecturerLabels(
      [{ ...testLecturers[0], rating: 1 }],
      [{ ...testLecturers[0], rating: 5 }],
    );
    console.assert(
      serverLabelRows[0].rating === 5,
      "Server labels should replace stale labels in restored core snapshots",
    );
    const dedupedImport = dedupeImportedLecturers([
      { id: "LECT001", email: "a@example.com", expertise: ["Reading"] },
      {
        id: "LECT001",
        phone: "0800",
        expertise: ["Writing"],
        available: 2,
        _hasImportedAvailable: true,
      },
    ]);
    console.assert(
      dedupedImport.length === 1 &&
        dedupedImport[0].phone === "0800" &&
        dedupedImport[0].expertise.length === 2 &&
        dedupedImport[0].available === 2,
      "Lecturer import should merge duplicate IDs before upsert",
    );
    console.assert(
      typeof USE_SUPABASE === "boolean",
      "Supabase config flag should be boolean",
    );
    const serializedPlans = serializeCourseClassPlans(
      {
        TERM001: {
          counts: { COURSE101: 2 },
          assignments: { COURSE101: ["LECT001", ""] },
        },
      },
      testTerms,
    );
    console.assert(
      serializedPlans.length === 1 &&
        serializedPlans[0].term_code === "TERM001" &&
        serializedPlans[0].counts.COURSE101 === 2,
      "Course class plans should serialize by academic term",
    );
    console.assert(
      normalizeCourseClassPlans(serializedPlans).TERM001.assignments
        .COURSE101[0] === "LECT001",
      "Course class plans should round-trip through Supabase rows",
    );
    const rowChanges = buildTableChanges(
      [{ id: "A", name: "Original", phone: "100" }],
      [{ id: "A", name: "Original", phone: "200" }],
      "id",
    );
    console.assert(
      rowChanges.creates.length === 0 &&
        rowChanges.deletes.length === 0 &&
        rowChanges.updates.length === 1 &&
        Object.keys(rowChanges.updates[0].patch).join(",") === "phone",
      "Row synchronization should patch only fields changed locally",
    );
    const replayedRows = applyTableChanges(
      [
        { id: "A", name: "Original", phone: "100" },
        { id: "B", name: "Added elsewhere", phone: "300" },
      ],
      rowChanges,
      "id",
    );
    console.assert(
      replayedRows.length === 2 &&
        replayedRows.find((row) => row.id === "A")?.phone === "200" &&
        replayedRows.some((row) => row.id === "B"),
      "Pending row changes should preserve records added by another client",
    );
    const demoSnapshot = cloneDemoSnapshot();
    console.assert(
      demoSnapshot.lecturers.length >= 5 && demoSnapshot.courses.length >= 5,
      "Demo snapshot should include enough data for presentation",
    );
    console.assert(
      demoSnapshot.terms.some((term) => term.active),
      "Demo snapshot should include an active term",
    );
  }
  runTests();
}
