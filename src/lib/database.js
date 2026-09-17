import { getSupabaseClient } from "./realtime";

const getStoredConfig = (key) => {
  try {
    return (typeof window !== "undefined" && window.localStorage?.getItem(key)) || "";
  } catch {
    return "";
  }
};

const SUPABASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  getStoredConfig("ut_supabase_url") ||
  "";
const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
  getStoredConfig("ut_supabase_anon_key") ||
  "";

export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const PENDING_SYNC_STORAGE_KEY = "ut_pending_sync_v1";
export const PENDING_LECTURER_LABELS_STORAGE_KEY =
  "ut_pending_lecturer_labels_v1";

const ACCESS_TOKEN_STORAGE_KEY = "ut_supabase_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "ut_supabase_refresh_token";
const ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY =
  "ut_supabase_access_token_expires_at";
const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

async function fetchTextWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, {
    once: true,
  });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return { response, text: await response.text() };
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        "Supabase did not respond in time. Check the connection and try again.",
      );
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

function parseResponseText(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

function saveAuthSession(data, fallbackEmail = "") {
  if (data.access_token)
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
  if (data.refresh_token)
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refresh_token);
  if (data.expires_in) {
    localStorage.setItem(
      ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY,
      String(Date.now() + Number(data.expires_in) * 1000),
    );
  }
  const email =
    data.user?.email ||
    fallbackEmail ||
    localStorage.getItem("ut_user_email") ||
    "";
  if (email) localStorage.setItem("ut_user_email", email);
  return email;
}

export function supabaseHeaders({ preferReturn = false } = {}) {
  const token = getAccessToken() || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(preferReturn ? { Prefer: "return=representation" } : {}),
  };
}

let refreshSessionPromise = null;

async function refreshAuthSession() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "";
  if (!refreshToken) throw new Error("Session expired. Please sign in again.");
  if (!refreshSessionPromise) {
    refreshSessionPromise = fetchTextWithTimeout(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    )
      .then(({ response, text }) => {
        const data = parseResponseText(text);
        if (!response.ok) {
          const error = new Error(
            data?.error_description || data?.msg || "Session refresh failed.",
          );
          error.status = 401;
          throw error;
        }
        saveAuthSession(data);
        return data.access_token;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }
  return refreshSessionPromise;
}

export async function supabaseRequest(path, options = {}, allowRefresh = true) {
  if (!USE_SUPABASE) throw new Error("Supabase is not configured.");
  const { response, text } = await fetchTextWithTimeout(
    `${SUPABASE_URL}${path}`,
    options,
  );
  const data = parseResponseText(text);
  if (
    response.status === 401 &&
    allowRefresh &&
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  ) {
    const accessToken = await refreshAuthSession();
    return supabaseRequest(
      path,
      {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${accessToken}`,
        },
      },
      false,
    );
  }
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.msg ||
        data?.error_description ||
        (typeof data === "string" ? data : "") ||
        "Supabase request failed.",
    );
    error.status = response.status;
    error.code = data?.code || "";
    throw error;
  }
  return data;
}

export function fetchTable(table, orderBy) {
  return supabaseRequest(`/rest/v1/${table}?select=*&order=${orderBy}.asc`, {
    method: "GET",
    headers: supabaseHeaders(),
  });
}

export async function upsertRows(table, rows, conflictKey) {
  if (!rows.length) return [];
  return supabaseRequest(`/rest/v1/${table}?on_conflict=${conflictKey}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders({ preferReturn: true }),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
}

function comparableValue(value) {
  if (Array.isArray(value)) return value.map(comparableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, comparableValue(value[key])]),
    );
  }
  return value;
}

function valuesEqual(left, right) {
  return (
    JSON.stringify(comparableValue(left)) ===
    JSON.stringify(comparableValue(right))
  );
}

export function buildTableChanges(baselineRows = [], rows = [], key) {
  const baselineByKey = new Map(
    baselineRows.map((row) => [row[key], row]),
  );
  const rowsByKey = new Map(rows.map((row) => [row[key], row]));
  const creates = [];
  const updates = [];

  rows.forEach((row) => {
    const keyValue = row[key];
    const baseline = baselineByKey.get(keyValue);
    if (!baseline) {
      creates.push(row);
      return;
    }
    const patch = Object.fromEntries(
      Object.entries(row).filter(
        ([field, value]) =>
          field !== key && !valuesEqual(value, baseline[field]),
      ),
    );
    if (Object.keys(patch).length) {
      updates.push({
        keyValue,
        patch,
        baseline: Object.fromEntries(
          Object.keys(patch).map((field) => [field, baseline[field]]),
        ),
      });
    }
  });

  return {
    creates,
    updates,
    deletes: baselineRows
      .map((row) => row[key])
      .filter((keyValue) => !rowsByKey.has(keyValue)),
  };
}

export function hasTableChanges(changes) {
  return Boolean(
    changes?.creates?.length ||
      changes?.updates?.length ||
      changes?.deletes?.length,
  );
}

export function applyTableChanges(rows = [], changes = {}, key) {
  const byKey = new Map(rows.map((row) => [row[key], row]));
  (changes.deletes || []).forEach((keyValue) => byKey.delete(keyValue));
  (changes.updates || []).forEach(({ keyValue, patch }) => {
    const current = byKey.get(keyValue);
    if (current) byKey.set(keyValue, { ...current, ...patch });
  });
  (changes.creates || []).forEach((row) => byKey.set(row[key], row));
  return Array.from(byKey.values());
}

async function fetchRow(table, key, keyValue) {
  const rows = await supabaseRequest(
    `/rest/v1/${table}?${key}=eq.${encodeURIComponent(keyValue)}&select=*`,
    { method: "GET", headers: supabaseHeaders() },
  );
  return Array.isArray(rows) ? rows[0] : null;
}

function syncConflict(table, keyValue, detail) {
  const error = new Error(
    `${table} record ${keyValue} ${detail} Refresh before trying again.`,
  );
  error.code = "SYNC_CONFLICT";
  return error;
}

async function createRow(table, key, row) {
  const keyValue = row[key];
  const existing = await fetchRow(table, key, keyValue);
  if (existing) {
    const alreadySaved = Object.entries(row).every(([field, value]) =>
      valuesEqual(existing[field], value),
    );
    if (alreadySaved) return;
    throw syncConflict(table, keyValue, "was also created elsewhere.");
  }
  await supabaseRequest(`/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(row),
  });
}

async function patchRow(table, key, keyValue, patch, baseline = {}) {
  const existing = await fetchRow(table, key, keyValue);
  if (!existing)
    throw syncConflict(table, keyValue, "was removed by another administrator.");
  const conflictingFields = Object.keys(patch).filter(
    (field) =>
      !valuesEqual(existing[field], baseline[field]) &&
      !valuesEqual(existing[field], patch[field]),
  );
  if (conflictingFields.length) {
    throw syncConflict(
      table,
      keyValue,
      `has newer values for ${conflictingFields.join(", ")}.`,
    );
  }
  if (
    Object.entries(patch).every(([field, value]) =>
      valuesEqual(existing[field], value),
    )
  )
    return;
  const rows = await supabaseRequest(
    `/rest/v1/${table}?${key}=eq.${encodeURIComponent(keyValue)}&select=${key}`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders({ preferReturn: true }),
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    },
  );
  if (!Array.isArray(rows) || !rows.length) {
    throw syncConflict(table, keyValue, "changed while it was being saved.");
  }
}

export async function deleteRow(table, key, keyValue) {
  return supabaseRequest(
    `/rest/v1/${table}?${key}=eq.${encodeURIComponent(keyValue)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

export async function syncTableChanges(table, changes, key) {
  if (!hasTableChanges(changes)) return;
  await Promise.all(changes.creates.map((row) => createRow(table, key, row)));
  await Promise.all(
    changes.updates.map(({ keyValue, patch, baseline }) =>
      patchRow(table, key, keyValue, patch, baseline),
    ),
  );
  await Promise.all(
    changes.deletes.map((keyValue) => deleteRow(table, key, keyValue)),
  );
}

function normalizeLecturerLabelPatch(patch = {}) {
  const labels = {};
  if (Object.hasOwn(patch, "rating")) {
    const rating = Number(patch.rating);
    labels.rating = Number.isFinite(rating)
      ? Math.min(5, Math.max(0, Math.round(rating)))
      : 0;
  }
  if (Object.hasOwn(patch, "warning_note"))
    labels.warning_note = String(patch.warning_note || "").trim();
  return labels;
}

export async function updateLecturerLabels(lecturerId, patch) {
  const id = String(lecturerId || "").trim();
  const labels = normalizeLecturerLabelPatch(patch);
  if (!id || !Object.keys(labels).length)
    throw new Error("A lecturer and label change are required.");

  const rows = await supabaseRequest(
    `/rest/v1/lecturers?id=eq.${encodeURIComponent(id)}&select=id,rating,warning_note`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders({ preferReturn: true }),
        Prefer: "return=representation",
      },
      body: JSON.stringify(labels),
    },
  );
  const saved = Array.isArray(rows) ? rows[0] : null;
  if (!saved)
    throw new Error(`Supabase did not confirm the label update for ${id}.`);
  const verified = Object.entries(labels).every(
    ([key, value]) => saved[key] === value,
  );
  if (!verified)
    throw new Error(`Supabase returned different label values for ${id}.`);
  return saved;
}

export async function signIn(email, password) {
  if (!USE_SUPABASE) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable access.",
    );
  }
  const cleanEmail = String(email || "").trim();
  const cleanPassword = String(password || "");
  const { response, text } = await fetchTextWithTimeout(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
    },
  );
  const data = parseResponseText(text);
  if (!response.ok) {
    console.error("Supabase Auth Failed:", {
      status: response.status,
      data,
      text,
    });
    const errorMsg =
      data?.error_description ||
      data?.msg ||
      data?.message ||
      (typeof data === "string" ? data : "") ||
      `Login failed (Error ${response.status}).`;
    throw new Error(errorMsg);
  }
  return saveAuthSession(data, cleanEmail);
}

export const ALLOWED_SSO_DOMAINS = ["ecampus.ut.ac.id", "ut.ac.id"];

/**
 * Memeriksa apakah email merupakan akun institusi resmi Universitas Terbuka
 */
export function isAuthorizedSSOEmail(email) {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  const domain = clean.split("@")[1] || "";
  return (
    ALLOWED_SSO_DOMAINS.includes(domain) ||
    domain.endsWith(".ut.ac.id") ||
    domain === "fkip.ut.ac.id"
  );
}

/**
 * Memulai proses otentikasi Microsoft 365 / Azure SSO (Office 365 UT) via Supabase
 */
export async function signInWithMicrosoftSSO() {
  if (!USE_SUPABASE) {
    throw new Error(
      "Supabase belum dikonfigurasi. Hubungkan URL dan Anon Key Supabase terlebih dahulu.",
    );
  }
  const client = getSupabaseClient();
  if (!client?.auth) {
    throw new Error("Supabase Auth client tidak siap.");
  }

  // Arahkan kembali ke origin saat ini tanpa hash / search lama
  const redirectTo = window.location.origin + window.location.pathname;

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: "email openid profile User.Read",
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;
  return data;
}

export const signInWithUTSSO = signInWithMicrosoftSSO;

/**
 * Memulai proses otentikasi Google Workspace SSO via Supabase
 */
export async function signInWithGoogleSSO() {
  if (!USE_SUPABASE) {
    throw new Error(
      "Supabase belum dikonfigurasi. Hubungkan URL dan Anon Key Supabase terlebih dahulu.",
    );
  }
  const client = getSupabaseClient();
  if (!client?.auth) {
    throw new Error("Supabase Auth client tidak siap.");
  }

  // Arahkan kembali ke origin saat ini tanpa hash / search lama
  const redirectTo = window.location.origin + window.location.pathname;

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
        hd: "ecampus.ut.ac.id",
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Mengirim Magic Link / Kode OTP ke email institusi UT
 */
export async function sendEmailOtp(email) {
  if (!USE_SUPABASE) {
    throw new Error(
      "Supabase belum dikonfigurasi. Hubungkan URL dan Anon Key Supabase terlebih dahulu.",
    );
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error("Silakan masukkan alamat email.");
  }

  // Validasi domain resmi UT
  if (!isAuthorizedSSOEmail(cleanEmail)) {
    throw new Error(
      `Hanya alamat email resmi Universitas Terbuka (@ecampus.ut.ac.id atau @ut.ac.id) yang diperbolehkan.`,
    );
  }

  const client = getSupabaseClient();
  if (!client?.auth) {
    throw new Error("Supabase Auth client tidak siap.");
  }

  const redirectTo = window.location.origin + window.location.pathname;

  const { data, error } = await client.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw new Error(error.message || "Gagal mengirim link/kode verifikasi ke email.");
  }

  return data;
}

/**
 * Memverifikasi kode OTP 6-digit yang dikirimkan ke email
 */
export async function verifyEmailOtp(email, token) {
  if (!USE_SUPABASE) {
    throw new Error("Supabase belum dikonfigurasi.");
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanToken = String(token || "").trim();

  if (!cleanEmail || !cleanToken) {
    throw new Error("Email dan kode OTP wajib diisi.");
  }

  const client = getSupabaseClient();
  if (!client?.auth) {
    throw new Error("Supabase Auth client tidak siap.");
  }

  const { data, error } = await client.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "email",
  });

  if (error) {
    throw new Error(error.message || "Kode verifikasi salah atau telah kedaluwarsa.");
  }

  if (data?.session && data?.user) {
    saveAuthSession(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        user: data.user,
      },
      cleanEmail,
    );
    return {
      email: cleanEmail,
      user: data.user,
      session: data.session,
    };
  }

  return { email: cleanEmail };
}

/**
 * Menangkap dan memvalidasi callback sesi OAuth setelah redirect dari Google atau Magic Link
 */
export async function processOAuthCallback() {
  if (!USE_SUPABASE || typeof window === "undefined") return null;

  const hasAuthHash =
    window.location.hash.includes("access_token=") ||
    window.location.hash.includes("error=");
  const hasAuthSearch =
    window.location.search.includes("code=") ||
    window.location.search.includes("error=");

  if (!hasAuthHash && !hasAuthSearch) {
    return null;
  }

  const client = getSupabaseClient();
  if (!client?.auth) return null;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash,
  );
  const rawError =
    searchParams.get("error_description") ||
    hashParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error");

  if (rawError) {
    window.history.replaceState({}, document.title, window.location.pathname);
    throw new Error(decodeURIComponent(rawError));
  }

  let session = null;
  if (hasAuthSearch && searchParams.get("code")) {
    const { data, error } = await client.auth.exchangeCodeForSession(
      searchParams.get("code"),
    );
    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      throw error;
    }
    session = data.session;
  }

  if (!session) {
    const { data, error } = await client.auth.getSession();
    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      throw error;
    }
    session = data?.session;
  }

  if (session && session.user) {
    const email = (session.user.email || "").trim().toLowerCase();

    // Validasi domain resmi UT
    if (!isAuthorizedSSOEmail(email)) {
      await client.auth.signOut();
      signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
      const domainError = new Error(
        `Akses Ditolak: Akun "${email}" bukan email resmi Universitas Terbuka (@ecampus.ut.ac.id atau @ut.ac.id). Silakan login dengan akun email UT Anda.`,
      );
      domainError.code = "UNAUTHORIZED_DOMAIN";
      throw domainError;
    }

    // Simpan sesi ke local storage
    saveAuthSession(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        user: session.user,
      },
      email,
    );

    // Bersihkan URL dari token/code
    window.history.replaceState({}, document.title, window.location.pathname);
    return {
      email,
      user: session.user,
      session,
    };
  }

  return null;
}

export function signOut() {
  localStorage.removeItem("ut_user_email");
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY);
  try {
    const client = getSupabaseClient();
    client?.auth?.signOut()?.catch(() => {});
  } catch (err) {
    void err;
  }
}

export function getStoredUserEmail() {
  if (!USE_SUPABASE || !getAccessToken()) {
    signOut();
    return "";
  }
  return localStorage.getItem("ut_user_email") || "";
}

export function getStoredPendingSync(userEmail) {
  if (typeof localStorage === "undefined" || !userEmail) return null;
  try {
    const stored = JSON.parse(
      localStorage.getItem(PENDING_SYNC_STORAGE_KEY) || "null",
    );
    return stored?.userEmail === userEmail && stored.payload ? stored : null;
  } catch {
    return null;
  }
}

export function storePendingSync(userEmail, payload) {
  if (typeof localStorage === "undefined" || !userEmail) return;
  try {
    localStorage.setItem(
      PENDING_SYNC_STORAGE_KEY,
      JSON.stringify({
        userEmail,
        payload,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (cause) {
    const error = new Error(
      "This device could not store a local backup of pending changes.",
    );
    error.code = "LOCAL_STORAGE_WRITE_FAILED";
    error.cause = cause;
    throw error;
  }
}

export function clearPendingSync(userEmail) {
  if (typeof localStorage === "undefined") return;
  if (getStoredPendingSync(userEmail))
    localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
}

function lecturerLabelStorageKey(userEmail) {
  return `${PENDING_LECTURER_LABELS_STORAGE_KEY}:${encodeURIComponent(
    String(userEmail || "").toLowerCase(),
  )}`;
}

export function getStoredLecturerLabelChanges(userEmail) {
  if (typeof localStorage === "undefined" || !userEmail) return {};
  try {
    const stored = JSON.parse(
      localStorage.getItem(lecturerLabelStorageKey(userEmail)) || "{}",
    );
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

export function queueLecturerLabelChange(userEmail, lecturerId, patch) {
  if (typeof localStorage === "undefined" || !userEmail) return {};
  const id = String(lecturerId || "").trim();
  const labels = normalizeLecturerLabelPatch(patch);
  if (!id || !Object.keys(labels).length)
    return getStoredLecturerLabelChanges(userEmail);
  const changes = getStoredLecturerLabelChanges(userEmail);
  changes[id] = {
    ...(changes[id] || {}),
    ...labels,
    changeId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(
      lecturerLabelStorageKey(userEmail),
      JSON.stringify(changes),
    );
  } catch (cause) {
    const error = new Error(
      "This device could not queue the lecturer rating or note locally.",
    );
    error.code = "LOCAL_STORAGE_WRITE_FAILED";
    error.cause = cause;
    throw error;
  }
  return changes;
}

export function clearStoredLecturerLabelChanges(userEmail, savedChanges = {}) {
  if (typeof localStorage === "undefined" || !userEmail) return {};
  const changes = getStoredLecturerLabelChanges(userEmail);
  Object.entries(savedChanges).forEach(([id, saved]) => {
    if (changes[id]?.changeId === saved?.changeId) delete changes[id];
  });
  const key = lecturerLabelStorageKey(userEmail);
  try {
    if (Object.keys(changes).length)
      localStorage.setItem(key, JSON.stringify(changes));
    else localStorage.removeItem(key);
  } catch (cause) {
    const error = new Error(
      "Supabase saved the lecturer labels, but the local queue could not be updated.",
    );
    error.code = "LOCAL_STORAGE_WRITE_FAILED";
    error.cause = cause;
    throw error;
  }
  return changes;
}

export function discardStoredLecturerLabelChange(userEmail, lecturerId) {
  const changes = getStoredLecturerLabelChanges(userEmail);
  delete changes[String(lecturerId || "").trim()];
  const key = lecturerLabelStorageKey(userEmail);
  try {
    if (Object.keys(changes).length)
      localStorage.setItem(key, JSON.stringify(changes));
    else localStorage.removeItem(key);
  } catch (cause) {
    const error = new Error(
      "The pending lecturer label could not be removed from local storage.",
    );
    error.code = "LOCAL_STORAGE_WRITE_FAILED";
    error.cause = cause;
    throw error;
  }
  return changes;
}

export function createDatabaseSnapshotTools(deps) {
  const {
    normalizeCourseClassPlans,
    normalizeLecturer,
    normalizeTermPlotting,
  } = deps;

  async function fetchCourseClassPlans() {
    try {
      const rows = await fetchTable("course_class_plans", "term_code");
      return {
        supported: true,
        plans: normalizeCourseClassPlans(Array.isArray(rows) ? rows : []),
      };
    } catch (error) {
      if (error.status === 404 || ["42P01", "PGRST205"].includes(error.code))
        return { supported: false, plans: {} };
      throw error;
    }
  }

  async function fetchDatabaseSnapshot() {
    const [
      lecturerRows,
      courseRows,
      termRows,
      plottingRows,
      courseClassPlanResult,
    ] = await Promise.all([
      fetchTable("lecturers", "name"),
      fetchTable("courses", "code"),
      fetchTable("academic_terms", "code"),
      fetchTable("term_plottings", "id"),
      fetchCourseClassPlans(),
    ]);
    return {
      lecturers: Array.isArray(lecturerRows)
        ? lecturerRows.map(normalizeLecturer)
        : [],
      courses: Array.isArray(courseRows) ? courseRows : [],
      terms: Array.isArray(termRows) ? termRows : [],
      termPlottings: Array.isArray(plottingRows)
        ? plottingRows.map(normalizeTermPlotting)
        : [],
      courseClassPlans: courseClassPlanResult.plans,
      courseClassPlansSupported: courseClassPlanResult.supported,
    };
  }

  async function fetchPublicDatabaseSnapshot() {
    const [lecturerRows, courseRows, termRows, plottingRows] =
      await Promise.all([
        fetchTable("public_lecturer_profiles", "name"),
        fetchTable("public_courses", "code"),
        fetchTable("public_academic_terms", "code"),
        fetchTable("public_term_plottings", "id"),
      ]);
    return {
      lecturers: Array.isArray(lecturerRows)
        ? lecturerRows.map(normalizeLecturer)
        : [],
      courses: Array.isArray(courseRows) ? courseRows : [],
      terms: Array.isArray(termRows) ? termRows : [],
      termPlottings: Array.isArray(plottingRows)
        ? plottingRows.map(normalizeTermPlotting)
        : [],
    };
  }

  async function fetchLecturerLabelColumnSupport() {
    if (!USE_SUPABASE) return false;
    try {
      await supabaseRequest(
        "/rest/v1/lecturers?select=rating,warning_note&limit=1",
        {
          method: "GET",
          headers: supabaseHeaders(),
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  return {
    fetchDatabaseSnapshot,
    fetchPublicDatabaseSnapshot,
    fetchLecturerLabelColumnSupport,
  };
}
