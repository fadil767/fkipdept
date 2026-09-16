import { createClient } from "@supabase/supabase-js";

const getStoredConfig = (key) => {
  try {
    return (typeof window !== "undefined" && window.localStorage?.getItem(key)) || "";
  } catch {
    return "";
  }
};

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  getStoredConfig("ut_supabase_url") ||
  "";
const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  getStoredConfig("ut_supabase_anon_key") ||
  "";

export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function saveSupabaseConfig(url, key) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ut_supabase_url", (url || "").trim());
      window.localStorage.setItem("ut_supabase_anon_key", (key || "").trim());
    }
  } catch (err) {
    console.error("Failed to save supabase config:", err);
  }
}

export function clearSupabaseConfig() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("ut_supabase_url");
      window.localStorage.removeItem("ut_supabase_anon_key");
    }
  } catch (err) {
    console.error("Failed to clear supabase config:", err);
  }
}

// Unique ID per tab/window instance to filter out self-originated broadcast messages
export const INSTANCE_ID = "inst_" + Math.random().toString(36).substring(2, 9);

// Singleton Supabase client for realtime connection
let supabaseClient = null;
if (IS_SUPABASE_CONFIGURED) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.warn("Failed to initialize Supabase realtime client:", err);
  }
}

// Local BroadcastChannel for instant zero-latency sync across tabs & desktop windows
let localBroadcast = null;
if (typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined") {
  try {
    localBroadcast = new BroadcastChannel("ut_fkip_realtime_sync");
  } catch (err) {
    console.warn("BroadcastChannel not supported or failed:", err);
  }
}

/**
 * Broadcast local change to other tabs/windows on this machine
 * @param {string} type - e.g. "LECTURER_UPDATE", "LECTURER_DELETE", "PLOTTING_UPDATE", "SUBMISSION_UPDATE"
 * @param {any} payload - modified data
 */
export function broadcastLocalChange(type, payload) {
  if (!localBroadcast) return;
  try {
    localBroadcast.postMessage({
      type,
      payload,
      senderId: INSTANCE_ID,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("Error broadcasting local change:", err);
  }
}

/**
 * Initialize Realtime Manager combining Supabase Realtime (WebSocket across devices)
 * and BroadcastChannel (across tabs/windows on the same computer)
 */
export function initRealtimeManager({
  onLecturerChange,
  onPlottingChange,
  onSubmissionChange,
  onCourseClassPlansChange,
  onStatusChange,
}) {
  let supabaseChannel = null;

  // 1. Setup Local Broadcast Listener
  const handleLocalMessage = (event) => {
    const data = event?.data;
    if (!data || data.senderId === INSTANCE_ID) return; // Skip own messages

    switch (data.type) {
      case "LECTURER_MUTATION":
        onLecturerChange?.({
          source: "broadcast",
          eventType: data.payload.eventType,
          new: data.payload.new,
          old: data.payload.old,
          id: data.payload.id,
        });
        break;
      case "PLOTTING_MUTATION":
        onPlottingChange?.({
          source: "broadcast",
          eventType: data.payload.eventType,
          new: data.payload.new,
          old: data.payload.old,
          id: data.payload.id,
        });
        break;
      case "SUBMISSION_MUTATION":
        onSubmissionChange?.({
          source: "broadcast",
          eventType: data.payload.eventType,
          new: data.payload.new,
          old: data.payload.old,
          id: data.payload.id,
        });
        break;
      case "PLANS_MUTATION":
        onCourseClassPlansChange?.({
          source: "broadcast",
          eventType: data.payload.eventType,
          new: data.payload.new,
          term_code: data.payload.term_code,
        });
        break;
      default:
        break;
    }
  };

  if (localBroadcast) {
    localBroadcast.addEventListener("message", handleLocalMessage);
  }

  // 2. Setup Supabase Realtime (WebSocket) if configured
  if (supabaseClient && IS_SUPABASE_CONFIGURED) {
    try {
      onStatusChange?.({ status: "CONNECTING", mode: "cloud" });

      supabaseChannel = supabaseClient
        .channel("fkip_dashboard_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lecturers" },
          (payload) => {
            onLecturerChange?.({
              source: "supabase",
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              id: payload.new?.id || payload.old?.id,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "term_plottings" },
          (payload) => {
            onPlottingChange?.({
              source: "supabase",
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              id: payload.new?.id || payload.old?.id,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tutor_submissions" },
          (payload) => {
            onSubmissionChange?.({
              source: "supabase",
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              id: payload.new?.id || payload.old?.id,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "course_class_plans" },
          (payload) => {
            onCourseClassPlansChange?.({
              source: "supabase",
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              term_code: payload.new?.term_code || payload.old?.term_code,
            });
          },
        )
        .subscribe((status) => {
          onStatusChange?.({
            status: status === "SUBSCRIBED" ? "CONNECTED" : status,
            mode: "cloud",
          });
        });
    } catch (err) {
      console.warn("Supabase realtime channel subscription error:", err);
      onStatusChange?.({ status: "ERROR", mode: "cloud", error: err.message });
    }
  } else {
    // In local demo mode, indicate local multi-tab sync is active
    onStatusChange?.({
      status: "CONNECTED",
      mode: "local",
      message: "Sinkronisasi lokal multi-tab/window aktif",
    });
  }

  // Return cleanup function
  return () => {
    if (localBroadcast) {
      localBroadcast.removeEventListener("message", handleLocalMessage);
    }
    if (supabaseChannel && supabaseClient) {
      supabaseClient.removeChannel(supabaseChannel);
    }
  };
}
