import React, { useState, useEffect, useRef } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  subscribeNotifications,
} from "../lib/notifications.js";

function getRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} m lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} j lalu`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} h lalu`;
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function getNotificationVisual(type) {
  switch (type) {
    case "submission":
      return {
        icon: (
          <svg className="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        ),
        bg: "bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800",
      };
    case "approval":
      return {
        icon: (
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        ),
        bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
      };
    case "rejection":
      return {
        icon: (
          <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
        bg: "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
      };
    case "import":
      return {
        icon: (
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
        bg: "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800",
      };
    case "warning":
      return {
        icon: (
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
      };
    default:
      return {
        icon: (
          <svg className="w-4 h-4 text-[#005baa] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
      };
  }
}

export default function NotificationCenter({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const containerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeNotifications((newList) => {
      setNotifications(newList);
    });
    return unsubscribe;
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredList =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    if (notif.targetTab && onNavigate) {
      onNavigate(notif.targetTab);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
        className={`relative flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? "bg-[#005baa] text-white border-[#005baa] shadow-xs"
            : "bg-slate-50/90 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
        }`}
      >
        <svg
          className="h-4 w-4 sm:h-4.5 sm:w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white dark:ring-[#1e293b] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#005baa]/10 text-[#005baa] dark:bg-blue-900/30 dark:text-blue-300">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-[#005baa] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-[#005baa] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filter === "unread"
                  ? "bg-[#005baa] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div
            className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
            style={{ scrollbarWidth: "thin" }}
          >
            {filteredList.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {filter === "unread" ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Aktivitas pengajuan dan perubahan sistem akan muncul di sini.
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const visual = getNotificationVisual(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`relative flex items-start gap-3 p-3 transition-colors cursor-pointer group ${
                      item.read
                        ? "bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40 opacity-75 hover:opacity-100"
                        : "bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 font-medium"
                    }`}
                  >
                    {/* Visual Icon */}
                    <div
                      className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visual.bg}`}
                    >
                      {visual.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {getRelativeTime(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                      {item.targetTab && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-[#005baa] dark:text-blue-400">
                          Buka tab {item.targetTab} →
                        </span>
                      )}
                    </div>

                    {/* Unread indicator dot */}
                    {!item.read && (
                      <span className="absolute top-4 right-3 h-2 w-2 rounded-full bg-[#005baa] dark:bg-blue-400 shrink-0" />
                    )}

                    {/* Delete button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(item.id);
                      }}
                      title="Hapus notifikasi"
                      className="absolute bottom-2 right-2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">
                {notifications.length} total notifikasi
              </span>
              <button
                type="button"
                onClick={clearAllNotifications}
                className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold cursor-pointer"
              >
                Hapus Semua
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
