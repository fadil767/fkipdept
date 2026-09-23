import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";

const BACKUP_APP_ID = "UT-FKIP-Dashboard";
const BACKUP_SCHEMA_VERSION = "1.0.0";
const SNAPSHOT_KEY_PREFIX = "ut_semester_snapshot_";

/**
 * Generate a complete JSON backup object with metadata
 */
export function buildBackupData({
  lecturers = [],
  courses = [],
  terms = [],
  termPlottings = [],
  courseClassPlans = {},
  auditLogs = [],
  userEmail = "",
}) {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    created_by: userEmail || "administrator@fkip.ut.ac.id",
    summary: {
      total_lecturers: lecturers.length,
      total_courses: courses.length,
      total_terms: terms.length,
      total_plottings: termPlottings.length,
      total_audit_logs: (auditLogs || []).length,
    },
    data: {
      lecturers,
      courses,
      terms,
      termPlottings,
      courseClassPlans,
      auditLogs,
    },
  };
}

/**
 * Download a backup file directly to the user's computer
 */
export function downloadBackupFile(backupPayload, compressGzip = false) {
  const jsonString = JSON.stringify(backupPayload, null, 2);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  let blob;
  let filename;

  if (compressGzip) {
    try {
      const u8Data = strToU8(jsonString);
      const compressed = gzipSync(u8Data, { level: 6 });
      blob = new Blob([compressed], { type: "application/gzip" });
      filename = `fkip_backup_${dateStr}.json.gz`;
    } catch {
      blob = new Blob([jsonString], { type: "application/json" });
      filename = `fkip_backup_${dateStr}.json`;
    }
  } else {
    blob = new Blob([jsonString], { type: "application/json" });
    filename = `fkip_backup_${dateStr}.json`;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

/**
 * Parse and validate an uploaded backup file (.json or .json.gz)
 */
export async function parseAndValidateBackupFile(file) {
  if (!file) {
    return { valid: false, error: "Berkas tidak ditemukan." };
  }

  try {
    let rawText = "";

    if (file.name.endsWith(".gz")) {
      const arrayBuffer = await file.arrayBuffer();
      const u8 = new Uint8Array(arrayBuffer);
      const decompressed = gunzipSync(u8);
      rawText = strFromU8(decompressed);
    } else {
      rawText = await file.text();
    }

    const parsed = JSON.parse(rawText);

    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "Format berkas JSON tidak valid." };
    }

    if (parsed.app !== BACKUP_APP_ID) {
      return {
        valid: false,
        error: `Berkas ini bukan cadangan resmi sistem FKIP Dashboard (Ditemukan: ${parsed.app || "Format tidak dikenal"}).`,
      };
    }

    if (!parsed.data || typeof parsed.data !== "object") {
      return { valid: false, error: "Konten data cadangan tidak lengkap." };
    }

    const data = parsed.data;
    const summary = parsed.summary || {
      total_lecturers: (data.lecturers || []).length,
      total_courses: (data.courses || []).length,
      total_terms: (data.terms || []).length,
      total_plottings: (data.termPlottings || []).length,
    };

    return {
      valid: true,
      filename: file.name,
      timestamp: parsed.timestamp,
      created_by: parsed.created_by,
      version: parsed.version,
      summary,
      data: {
        lecturers: Array.isArray(data.lecturers) ? data.lecturers : [],
        courses: Array.isArray(data.courses) ? data.courses : [],
        terms: Array.isArray(data.terms) ? data.terms : [],
        termPlottings: Array.isArray(data.termPlottings) ? data.termPlottings : [],
        courseClassPlans: data.courseClassPlans && typeof data.courseClassPlans === "object" ? data.courseClassPlans : {},
        auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: `Gagal membaca berkas: ${err.message || "Pastikan berkas berformat JSON atau GZIP yang valid."}`,
    };
  }
}

/**
 * Save a quick semester snapshot in localStorage
 */
export function saveSemesterSnapshot(termCode, termName, snapshotData) {
  if (!termCode) return false;
  const key = `${SNAPSHOT_KEY_PREFIX}${termCode}`;
  const record = {
    termCode,
    termName: termName || termCode,
    timestamp: new Date().toISOString(),
    data: snapshotData,
  };
  try {
    localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch (e) {
    console.warn("Failed to save snapshot to localStorage:", e);
    return false;
  }
}

/**
 * List all local semester snapshots saved in localStorage
 */
export function listSavedSnapshots() {
  const snapshots = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SNAPSHOT_KEY_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            snapshots.push({
              key,
              termCode: parsed.termCode,
              termName: parsed.termName,
              timestamp: parsed.timestamp,
              itemCount: (parsed.data?.lecturers || []).length,
              data: parsed.data,
            });
          }
        } catch {
          // ignore corrupted snapshot
        }
      }
    }
  } catch {
    // ignore
  }
  return snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Delete a local snapshot from localStorage
 */
export function deleteSavedSnapshot(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
