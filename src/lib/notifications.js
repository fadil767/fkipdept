/**
 * In-App Notification System — FKIP Dashboard
 *
 * Provides reactive local storage-backed notifications with cross-tab synchronization.
 */

import { broadcastLocalChange } from "./realtime.js";

const NOTIFICATIONS_STORAGE_KEY = "ut_fkip_notifications_v1";
const MAX_NOTIFICATIONS = 100;

const listeners = new Set();

function emitChange() {
  const notifications = getNotifications();
  listeners.forEach((listener) => {
    try {
      listener(notifications);
    } catch (err) {
      console.error("[Notifications] Listener error:", err);
    }
  });
}

// Initial welcome / system notifications for first load
const SEED_NOTIFICATIONS = [
  {
    id: "notif_seed_1",
    type: "info",
    title: "Selamat Datang di FKIP Dashboard",
    message: "Sistem Manajemen Dosen, Mata Kuliah, dan Plotting Terpadu siap digunakan.",
    timestamp: new Date().toISOString(),
    read: true,
    targetTab: "dashboard",
  },
];

/**
 * Get all notifications from localStorage
 */
export function getNotifications() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(SEED_NOTIFICATIONS),
      );
      return SEED_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get unread notification count
 */
export function getUnreadCount() {
  const list = getNotifications();
  return list.filter((n) => !n.read).length;
}

/**
 * Add a new notification
 *
 * @param {object} param0
 * @param {'submission'|'approval'|'rejection'|'import'|'warning'|'system'|'info'} param0.type
 * @param {string} param0.title
 * @param {string} param0.message
 * @param {string} [param0.targetTab]
 * @param {object} [param0.metadata]
 */
export function addNotification({
  type = "info",
  title = "",
  message = "",
  targetTab = "",
  metadata = {},
}) {
  if (!title) return null;

  const current = getNotifications();
  const newNotif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    message,
    targetTab,
    metadata,
    read: false,
    timestamp: new Date().toISOString(),
  };

  const updated = [newNotif, ...current].slice(0, MAX_NOTIFICATIONS);

  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Notifications] Failed to save:", err);
  }

  emitChange();

  // Broadcast to other browser tabs
  try {
    broadcastLocalChange("NOTIFICATION_EVENT", {
      action: "ADD",
      notification: newNotif,
    });
  } catch {}

  return newNotif;
}

/**
 * Mark a specific notification as read
 */
export function markAsRead(id) {
  if (!id) return;
  const current = getNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  emitChange();
}

/**
 * Mark all notifications as read
 */
export function markAllAsRead() {
  const current = getNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  emitChange();
}

/**
 * Delete a single notification
 */
export function deleteNotification(id) {
  if (!id) return;
  const current = getNotifications();
  const updated = current.filter((n) => n.id !== id);
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  emitChange();
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
  } catch {}
  emitChange();
}

/**
 * Subscribe to notification changes
 * Returns an unsubscribe function.
 */
export function subscribeNotifications(callback) {
  listeners.add(callback);
  // Initial fire
  callback(getNotifications());

  return () => {
    listeners.delete(callback);
  };
}

// Listen to storage events from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === NOTIFICATIONS_STORAGE_KEY) {
      emitChange();
    }
  });
}
