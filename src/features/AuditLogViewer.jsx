import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuditLogs } from "../lib/auditLog.js";

const ACTION_LABELS = {
  create: { label: "Buat", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "+" },
  update: { label: "Ubah", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "✏" },
  delete: { label: "Hapus", color: "bg-rose-100 text-rose-800 border-rose-200", icon: "🗑" },
  approve: { label: "Setujui", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "✓" },
  reject: { label: "Tolak", color: "bg-rose-100 text-rose-800 border-rose-200", icon: "✗" },
  import: { label: "Impor", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "📥" },
  login: { label: "Login", color: "bg-sky-100 text-sky-800 border-sky-200", icon: "🔑" },
  logout: { label: "Logout", color: "bg-slate-200 text-slate-700 border-slate-300", icon: "🚪" },
};

const ENTITY_LABELS = {
  lecturer: "Dosen",
  course: "Mata Kuliah",
  term: "Semester",
  plotting: "Plotting",
  submission: "Pengajuan",
  auth: "Autentikasi",
  class_plan: "Rencana Kelas",
};

function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return "";
  } catch {
    return "";
  }
}

export function createAuditLogViewer({ Button, Card, Icons, TextInput }) {
  return function AuditLogViewer() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
      search: "",
      action: "",
      entityType: "",
    });
    const [expandedId, setExpandedId] = useState(null);
    const pageSize = 50;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const loadLogs = useCallback(async () => {
      setLoading(true);
      try {
        const result = await fetchAuditLogs({
          search: filters.search || undefined,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          page,
          pageSize,
        });
        setLogs(result.logs);
        setTotal(result.total);
      } catch (error) {
        console.error("[AuditLog] Failed to load logs:", error);
        setLogs([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, [filters.search, filters.action, filters.entityType, page]);

    useEffect(() => {
      loadLogs();
    }, [loadLogs]);

    // Reset page when filters change
    useEffect(() => {
      setPage(1);
    }, [filters.search, filters.action, filters.entityType]);

    const actionOptions = Object.entries(ACTION_LABELS).map(([key, val]) => ({
      value: key,
      label: val.label,
    }));

    const entityOptions = Object.entries(ENTITY_LABELS).map(([key, val]) => ({
      value: key,
      label: val,
    }));

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#102f52] tracking-tight">
              Log Aktivitas
            </h2>
            <p className="text-sm text-[#6f90af] font-medium mt-0.5">
              Riwayat semua perubahan data oleh administrator
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#6f90af]">
              {total.toLocaleString("id-ID")} catatan
            </span>
            <Button variant="ghost" onClick={loadLogs} className="!px-2.5">
              <Icons.refresh className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextInput
              icon={Icons.search}
              value={filters.search}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, search: value }))
              }
              placeholder="Cari nama, ID..."
            />
            <div className="relative">
              <select
                value={filters.action}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, action: e.target.value }))
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-xs font-semibold text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
              >
                <option value="">Semua Aksi</option>
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icons.chevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-[#6f90af]" />
            </div>
            <div className="relative">
              <select
                value={filters.entityType}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    entityType: e.target.value,
                  }))
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-xs font-semibold text-[#102f52] shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-[#005baa] focus:ring-2 focus:ring-[#005baa]/15"
              >
                <option value="">Semua Entitas</option>
                {entityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icons.chevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-[#6f90af]" />
            </div>
          </div>
        </Card>

        {/* Log Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-[#005baa]" />
                <span className="text-xs font-semibold text-[#6f90af]">
                  Memuat log...
                </span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Icons.file className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-[#102f52]">
                Belum ada log aktivitas
              </p>
              <p className="text-xs text-[#6f90af] mt-1 max-w-xs">
                {filters.search || filters.action || filters.entityType
                  ? "Tidak ada log yang cocok dengan filter. Coba ubah kriteria pencarian."
                  : "Log akan muncul otomatis saat Anda membuat perubahan data dosen, plotting, atau mata kuliah."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-[#4f6478] uppercase tracking-wider text-[10px] w-[160px]">
                        Waktu
                      </th>
                      <th className="px-4 py-3 font-bold text-[#4f6478] uppercase tracking-wider text-[10px] w-[140px]">
                        User
                      </th>
                      <th className="px-4 py-3 font-bold text-[#4f6478] uppercase tracking-wider text-[10px] w-[80px]">
                        Aksi
                      </th>
                      <th className="px-4 py-3 font-bold text-[#4f6478] uppercase tracking-wider text-[10px] w-[100px]">
                        Entitas
                      </th>
                      <th className="px-4 py-3 font-bold text-[#4f6478] uppercase tracking-wider text-[10px]">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log, index) => {
                      const actionInfo =
                        ACTION_LABELS[log.action] || ACTION_LABELS.update;
                      const entityLabel =
                        ENTITY_LABELS[log.entity_type] || log.entity_type;
                      const isExpanded =
                        expandedId === (log.id ?? `local-${index}`);
                      const logKey = log.id ?? `local-${index}`;
                      const relative = formatRelativeTime(log.created_at);

                      return (
                        <tr
                          key={logKey}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : logKey)
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#102f52]">
                              {formatDateTime(log.created_at)}
                            </div>
                            {relative && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {relative}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#102f52] truncate max-w-[130px] block">
                              {log.user_email
                                ? log.user_email.split("@")[0]
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold shadow-2xs ${actionInfo.color}`}
                            >
                              <span>{actionInfo.icon}</span>
                              <span>{actionInfo.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[#315577] font-medium">
                              {entityLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#102f52] truncate max-w-[200px]">
                                {log.entity_label || log.entity_id || "—"}
                              </span>
                              {log.entity_id && log.entity_label && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{log.entity_id}
                                </span>
                              )}
                            </div>
                            {isExpanded &&
                              log.details &&
                              Object.keys(log.details).length > 0 && (
                                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[9px] mb-1.5">
                                    Detail Perubahan
                                  </p>
                                  <pre className="whitespace-pre-wrap text-slate-700 font-mono leading-relaxed">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3">
                  <span className="text-xs text-[#6f90af] font-medium">
                    Halaman {page} dari {totalPages} ({total} catatan)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#102f52] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
                    >
                      <Icons.chevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#102f52] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
                    >
                      <Icons.chevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    );
  };
}
