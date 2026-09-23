/**
 * Audit Log Module — FKIP Dashboard
 *
 * Provides functions to log user actions and fetch audit history.
 * Uses Supabase REST API when available, falls back to localStorage.
 */

import { getSupabaseClient } from "./realtime";

const LOCAL_AUDIT_KEY = "ut_fkip_audit_logs";
const LOCAL_AUDIT_LIMIT = 500;
const BATCH_FLUSH_INTERVAL_MS = 2_000;

let pendingLogs = [];
let flushTimer = null;

/**
 * Get Supabase config for direct REST calls
 */
function getSupabaseConfig() {
  const url =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
    "";
  const key =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.SUPABASE_ANON_KEY)) ||
    "";
  return { url, key, configured: Boolean(url && key) };
}

function getAccessToken() {
  try {
    return localStorage.getItem("ut_supabase_access_token") || "";
  } catch {
    return "";
  }
}

/**
 * Log a single action. Batched and flushed every 2 seconds.
 *
 * @param {string} userEmail - Email of the user performing the action
 * @param {string} action - Action type: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'import' | 'login' | 'logout'
 * @param {string} entityType - Entity type: 'lecturer' | 'course' | 'term' | 'plotting' | 'submission' | 'auth'
 * @param {string} entityId - ID of the affected entity
 * @param {string} entityLabel - Human-readable label (e.g., lecturer name)
 * @param {object} details - Additional details object
 */
export function logAction(
  userEmail = "",
  action = "",
  entityType = "",
  entityId = "",
  entityLabel = "",
  details = {},
) {
  let resolvedEmail = userEmail;
  if (!resolvedEmail && typeof localStorage !== "undefined") {
    try {
      resolvedEmail = localStorage.getItem("ut_user_email") || "";
      if (!resolvedEmail && localStorage.getItem("ut_is_demo_session")) {
        resolvedEmail = "demo@fkip.ut.ac.id";
      }
    } catch {
      resolvedEmail = "";
    }
  }
  if (!resolvedEmail) resolvedEmail = "admin@fkip.ut.ac.id";

  const entry = {
    user_email: resolvedEmail,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    entity_label: String(entityLabel),
    details: details && typeof details === "object" ? details : {},
    created_at: new Date().toISOString(),
  };

  pendingLogs.push(entry);

  // Schedule flush
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushLogs();
    }, BATCH_FLUSH_INTERVAL_MS);
  }
}

/**
 * Immediately flush all pending logs
 */
export async function flushLogs() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = [...pendingLogs];
  pendingLogs = [];

  if (!batch.length) return;

  const { url, key, configured } = getSupabaseConfig();

  if (configured) {
    try {
      const token = getAccessToken() || key;
      const response = await fetch(`${url}/rest/v1/audit_logs`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        // If Supabase fails (e.g., table doesn't exist yet), fall back to localStorage
        console.warn(
          "[AuditLog] Supabase insert failed, saving locally:",
          response.status,
        );
        saveToLocalStorage(batch);
      }
    } catch (error) {
      console.warn("[AuditLog] Network error, saving locally:", error.message);
      saveToLocalStorage(batch);
    }
  } else {
    saveToLocalStorage(batch);
  }
}

/**
 * Save logs to localStorage as fallback
 */
function saveToLocalStorage(entries) {
  try {
    const existing = JSON.parse(
      localStorage.getItem(LOCAL_AUDIT_KEY) || "[]",
    );
    const combined = [...entries, ...existing].slice(0, LOCAL_AUDIT_LIMIT);
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(combined));
  } catch (error) {
    console.warn("[AuditLog] localStorage save failed:", error.message);
  }
}

/**
 * Fetch audit logs with optional filters
 *
 * @param {object} filters
 * @param {string} filters.userEmail - Filter by user email
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.entityType - Filter by entity type
 * @param {string} filters.entityId - Filter by entity ID
 * @param {string} filters.search - Full-text search in entity_label
 * @param {string} filters.dateFrom - ISO date string (inclusive)
 * @param {string} filters.dateTo - ISO date string (inclusive)
 * @param {number} filters.page - Page number (1-indexed)
 * @param {number} filters.pageSize - Items per page (default 50)
 * @returns {Promise<{ logs: Array, total: number }>}
 */
export async function fetchAuditLogs(filters = {}) {
  const { url, key, configured } = getSupabaseConfig();
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(filters.pageSize) || 50));

  if (configured) {
    try {
      const token = getAccessToken() || key;
      const params = new URLSearchParams();
      params.set("select", "*");
      params.set("order", "created_at.desc");

      if (filters.userEmail) {
        params.append("user_email", `eq.${filters.userEmail}`);
      }
      if (filters.action) {
        params.append("action", `eq.${filters.action}`);
      }
      if (filters.entityType) {
        params.append("entity_type", `eq.${filters.entityType}`);
      }
      if (filters.entityId) {
        params.append("entity_id", `eq.${filters.entityId}`);
      }
      if (filters.search) {
        params.append(
          "entity_label",
          `ilike.*${filters.search}*`,
        );
      }
      if (filters.dateFrom) {
        params.append("created_at", `gte.${filters.dateFrom}`);
      }
      if (filters.dateTo) {
        params.append("created_at", `lte.${filters.dateTo}`);
      }

      const rangeStart = (page - 1) * pageSize;
      const rangeEnd = rangeStart + pageSize - 1;

      const response = await fetch(
        `${url}/rest/v1/audit_logs?${params.toString()}`,
        {
          method: "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Range: `${rangeStart}-${rangeEnd}`,
            Prefer: "count=exact",
          },
        },
      );

      if (!response.ok) {
        console.warn("[AuditLog] Supabase fetch failed:", response.status);
        return fetchFromLocalStorage(filters, page, pageSize);
      }

      const data = await response.json();
      const contentRange = response.headers.get("content-range") || "";
      const totalMatch = contentRange.match(/\/(\d+|\*)/);
      const total = totalMatch && totalMatch[1] !== "*"
        ? Number(totalMatch[1])
        : Array.isArray(data)
          ? data.length
          : 0;

      return { logs: Array.isArray(data) ? data : [], total };
    } catch (error) {
      console.warn("[AuditLog] fetch error:", error.message);
      return fetchFromLocalStorage(filters, page, pageSize);
    }
  }

  return fetchFromLocalStorage(filters, page, pageSize);
}

/**
 * Fetch logs from localStorage with filtering
 */
function fetchFromLocalStorage(filters, page, pageSize) {
  try {
    let logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");

    // Apply filters
    if (filters.userEmail) {
      logs = logs.filter((log) => log.user_email === filters.userEmail);
    }
    if (filters.action) {
      logs = logs.filter((log) => log.action === filters.action);
    }
    if (filters.entityType) {
      logs = logs.filter((log) => log.entity_type === filters.entityType);
    }
    if (filters.entityId) {
      logs = logs.filter((log) => log.entity_id === filters.entityId);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      logs = logs.filter(
        (log) =>
          (log.entity_label || "").toLowerCase().includes(q) ||
          (log.entity_id || "").toLowerCase().includes(q),
      );
    }
    if (filters.dateFrom) {
      logs = logs.filter((log) => log.created_at >= filters.dateFrom);
    }
    if (filters.dateTo) {
      logs = logs.filter((log) => log.created_at <= filters.dateTo);
    }

    // Sort by created_at desc
    logs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const total = logs.length;
    const start = (page - 1) * pageSize;
    const paged = logs.slice(start, start + pageSize);

    return { logs: paged, total };
  } catch {
    return { logs: [], total: 0 };
  }
}

/**
 * Get count of local-only logs (not yet synced to Supabase)
 */
export function getLocalLogCount() {
  try {
    const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
    return Array.isArray(logs) ? logs.length : 0;
  } catch {
    return 0;
  }
}

// Flush logs on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pendingLogs.length) {
      flushLogs();
    }
  });

  // Also flush on visibility change (tab going to background)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pendingLogs.length) {
      flushLogs();
    }
  });
}
