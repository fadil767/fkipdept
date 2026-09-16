import {
  buildAutoPilotPlotting,
  buildRebalancedPlotting,
} from "../lib/autoPilot.js";

self.onmessage = (event) => {
  const { lecturers, courses, classCounts, assignmentMap, strategy } =
    event.data;
  try {
    const buildPlotting =
      strategy === "rebalance"
        ? buildRebalancedPlotting
        : buildAutoPilotPlotting;
    const result = buildPlotting(
      lecturers,
      courses,
      classCounts,
      assignmentMap,
    );
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Auto-pilot failed.",
    });
  }
};
