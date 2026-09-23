/**
 * Role-Based Access Control (RBAC) Module — FKIP Dashboard
 *
 * Provides roles, permissions checking, and user role management.
 * Supports Supabase REST API synchronization with fallback to localStorage.
 */

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  VIEWER: "viewer",
};

export const ROLE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    description: "Akses penuh sistem, kelola hak akses pengguna, dan audit log",
    badgeColor:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
  },
  admin: {
    label: "Admin Akademik",
    description:
      "Kelola data dosen, mata kuliah, semester, plotting, dan persetujuan tutor",
    badgeColor:
      "bg-blue-100 text-[#005baa] border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  },
  viewer: {
    label: "Hanya Lihat",
    description:
      "Akses melihat dashboard, direktori, dan hasil alokasi tanpa izin ubah data",
    badgeColor:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  },
};

export const PERMISSIONS = {
  manage_users: ["super_admin"],
  manage_audit: ["super_admin"],
  edit_lecturers: ["super_admin", "admin"],
  edit_plotting: ["super_admin", "admin"],
  edit_courses: ["super_admin", "admin"],
  edit_terms: ["super_admin", "admin"],
  approve_submissions: ["super_admin", "admin"],
  import_data: ["super_admin", "admin"],
  view_dashboard: ["super_admin", "admin", "viewer"],
  view_lecturers: ["super_admin", "admin", "viewer"],
  view_plotting: ["super_admin", "admin", "viewer"],
  view_courses: ["super_admin", "admin", "viewer"],
  view_terms: ["super_admin", "admin", "viewer"],
  view_audit: ["super_admin", "admin"],
};

const LOCAL_ROLES_KEY = "ut_fkip_user_roles_v1";

// Default seed roles
const DEFAULT_ROLES = {
  "demo@fkip.ut.ac.id": {
    role: "super_admin",
    displayName: "Admin Demo FKIP",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  "fkip@ecampus.ut.ac.id": {
    role: "super_admin",
    displayName: "Program Studi FKIP UT",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

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

function getStoredLocalRoles() {
  if (typeof localStorage === "undefined") return { ...DEFAULT_ROLES };
  try {
    const raw = localStorage.getItem(LOCAL_ROLES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
      return { ...DEFAULT_ROLES };
    }
    return { ...DEFAULT_ROLES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ROLES };
  }
}

function saveStoredLocalRoles(rolesMap) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_ROLES_KEY, JSON.stringify(rolesMap));
  } catch (err) {
    console.warn("[RBAC] Failed to save roles locally:", err);
  }
}

/**
 * Check if a role has permission to perform an action.
 * Super Admin always has all permissions.
 */
export function can(role = "viewer", permission = "") {
  if (!role) return false;
  if (role === ROLES.SUPER_ADMIN) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Fetch role for a specific user email.
 */
export async function fetchUserRole(email = "") {
  if (!email) return ROLES.VIEWER;
  const normalizedEmail = email.trim().toLowerCase();

  // Demo user is always super_admin
  if (normalizedEmail === "demo@fkip.ut.ac.id") {
    return ROLES.SUPER_ADMIN;
  }

  const { url, key, configured } = getSupabaseConfig();
  if (configured) {
    try {
      const response = await fetch(
        `${url}/rest/v1/user_roles?user_email=eq.${encodeURIComponent(normalizedEmail)}&select=*`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          },
        },
      );
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].role) {
          const role = rows[0].role;
          // Cache locally
          const local = getStoredLocalRoles();
          local[normalizedEmail] = {
            role,
            displayName: rows[0].display_name || "",
            createdAt: rows[0].created_at,
          };
          saveStoredLocalRoles(local);
          return role;
        }
      }
    } catch (err) {
      console.warn("[RBAC] Supabase fetch error, fallback to local:", err);
    }
  }

  // Fallback to local storage
  const local = getStoredLocalRoles();
  if (local[normalizedEmail]?.role) {
    return local[normalizedEmail].role;
  }

  // If this is the first custom cloud user or admin domain, default to admin
  if (
    normalizedEmail.endsWith("@ecampus.ut.ac.id") ||
    normalizedEmail.endsWith("@ut.ac.id")
  ) {
    return ROLES.ADMIN;
  }

  return ROLES.VIEWER;
}

/**
 * Fetch all registered user roles.
 */
export async function fetchAllUserRoles() {
  const { url, key, configured } = getSupabaseConfig();
  let serverRoles = [];

  if (configured) {
    try {
      const response = await fetch(
        `${url}/rest/v1/user_roles?select=*&order=created_at.asc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          },
        },
      );
      if (response.ok) {
        serverRoles = await response.json();
      }
    } catch (err) {
      console.warn("[RBAC] Failed to fetch user roles from Supabase:", err);
    }
  }

  const local = getStoredLocalRoles();
  const mergedMap = new Map();

  // Local first
  Object.entries(local).forEach(([email, data]) => {
    mergedMap.set(email.toLowerCase(), {
      user_email: email.toLowerCase(),
      role: data.role || ROLES.VIEWER,
      display_name: data.displayName || "",
      created_at: data.createdAt || new Date().toISOString(),
    });
  });

  // Server overrides / adds
  serverRoles.forEach((item) => {
    mergedMap.set(item.user_email.toLowerCase(), item);
  });

  return Array.from(mergedMap.values());
}

/**
 * Assign or update a user's role.
 */
export async function saveUserRole(email, role, displayName = "") {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const validRole = Object.values(ROLES).includes(role) ? role : ROLES.VIEWER;

  // 1. Update localStorage
  const local = getStoredLocalRoles();
  local[normalizedEmail] = {
    role: validRole,
    displayName,
    createdAt: local[normalizedEmail]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveStoredLocalRoles(local);

  // 2. Update Supabase if configured
  const { url, key, configured } = getSupabaseConfig();
  if (configured) {
    try {
      await fetch(`${url}/rest/v1/user_roles`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_email: normalizedEmail,
          role: validRole,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn("[RBAC] Failed to persist role to Supabase:", err);
    }
  }

  return true;
}

/**
 * Remove a user role assignment (reverts back to default viewer).
 */
export async function deleteUserRole(email) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();

  // Prevent deleting default demo or primary admin
  if (
    normalizedEmail === "demo@fkip.ut.ac.id" ||
    normalizedEmail === "fkip@ecampus.ut.ac.id"
  ) {
    throw new Error("Akun administrator utama tidak dapat dihapus.");
  }

  // 1. Update localStorage
  const local = getStoredLocalRoles();
  delete local[normalizedEmail];
  saveStoredLocalRoles(local);

  // 2. Delete from Supabase
  const { url, key, configured } = getSupabaseConfig();
  if (configured) {
    try {
      await fetch(
        `${url}/rest/v1/user_roles?user_email=eq.${encodeURIComponent(normalizedEmail)}`,
        {
          method: "DELETE",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        },
      );
    } catch (err) {
      console.warn("[RBAC] Failed to delete role from Supabase:", err);
    }
  }

  return true;
}
