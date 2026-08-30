"use client";

/**
 * /super-admin/dashboard — the PLATFORM OWNER's control console.
 *
 * Design system (ui-ux-pro-max pass, layered on the app's barbershop tokens):
 *   • Consistent card framework — every section lives in a .bs-panel with the
 *     same PanelHeader pattern, internal padding and spacing rhythm.
 *   • Hierarchy: 1) dominant stats hero, 2) salons registry (search + status
 *     filter + table/cards), 3) platform settings.
 *   • Status colors are the same badge tokens used app-wide (green/amber/red).
 *   • SVG icons only (lucide), visible focus states, ≥44px touch targets,
 *     loading feedback on every async action, fully responsive.
 *
 * Same data/APIs as before — visual/UX redesign only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearSuperAdminToken, getSuperAdminToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BadgeCheck,
  CalendarX2,
  Clock3,
  LogOut,
  RefreshCw,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Lock,
} from "lucide-react";

type SubscriptionStatus = "trial" | "active" | "expired";

type SalonRow = {
  id: number;
  name: string;
  slug: string | null;
  created_at: string;
  phone: string | null;
  subscription_status: SubscriptionStatus;
  subscription_start_date: string | null;
  billing_cycle_type: string;
  bookings_count: number;
};

type PlatformStats = {
  total_salons: number;
  trial: number;
  active: number;
  expired: number;
  total_bookings: number;
};

type PlatformSettings = {
  renewal_phone: string;
  renewal_banner_template: string;
  expired_lockout_template: string;
  trial_duration_days: number;
};

const STATUS_META: Record<SubscriptionStatus, { label: string; cls: string; dot: string }> = {
  active: {
    label: "نشط",
    cls: "border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] text-[var(--bs-success)]",
    dot: "bg-[var(--bs-success)]",
  },
  trial: {
    label: "تجريبي",
    cls: "border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] text-[var(--bs-warning)]",
    dot: "bg-[var(--bs-warning)]",
  },
  expired: {
    label: "منتهي",
    cls: "border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] text-[var(--bs-error)]",
    dot: "bg-[var(--bs-error)]",
  },
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.trial;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.cls}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** Shared card header — one consistent pattern across every section panel. */
function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--bs-border)] px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)]"
        >
          <Icon className="h-4 w-4 text-[var(--bs-primary)]" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black text-[var(--bs-text)]">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--bs-text-faint)]">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const toast = useToast();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [salons, setSalons] = useState<SalonRow[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // registry search + status filter (client-side, purely presentational)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");

  // pending status change (confirm step before applying)
  const [pendingChange, setPendingChange] = useState<{ salon: SalonRow; next: SubscriptionStatus } | null>(
    null,
  );

  // settings form state
  const [formPhone, setFormPhone] = useState("");
  const [formBanner, setFormBanner] = useState("");
  const [formLockout, setFormLockout] = useState("");
  const [formTrialDays, setFormTrialDays] = useState("30");

  const authFetch = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
      const t = getSuperAdminToken();
      if (!t) throw Object.assign(new Error("انتهت صلاحية جلستك"), { code: "SESSION_EXPIRED" });
      return apiFetch<T>(path, { ...opts, token: t });
    },
    [],
  );

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [s, sal, cfg] = await Promise.all([
          authFetch<{ stats: PlatformStats }>("/api/super-admin/stats"),
          authFetch<{ salons: SalonRow[] }>("/api/super-admin/salons"),
          authFetch<{ settings: PlatformSettings }>("/api/super-admin/settings"),
        ]);
        setStats(s.stats);
        setSalons(sal.salons);
        setSettings(cfg.settings);
        setFormPhone(cfg.settings.renewal_phone);
        setFormBanner(cfg.settings.renewal_banner_template);
        setFormLockout(cfg.settings.expired_lockout_template);
        setFormTrialDays(String(cfg.settings.trial_duration_days));
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  // Session guard + initial load
  useEffect(() => {
    const t = getSuperAdminToken();
    if (!t) {
      router.replace("/super-admin/login");
      return;
    }
    setToken(t);
    setReady(true);
    loadAll();
  }, [router, loadAll]);

  const applyStatusChange = useCallback(async () => {
    if (!pendingChange) return;
    const { salon, next } = pendingChange;
    setSavingStatus(salon.id);
    try {
      await authFetch(`/api/super-admin/salons/${salon.id}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(
        next === "expired"
          ? `تم إيقاف صالون «${salon.name}» — لم يعد متاحاً لأصحابه أو زبائنه`
          : `تم تحديث حالة «${salon.name}» إلى ${STATUS_META[next].label} ✓`,
      );
      setPendingChange(null);
      await loadAll(true);
    } catch (err) {
      toast.error((err as Error).message || "تعذر تحديث الحالة");
    } finally {
      setSavingStatus(null);
    }
  }, [pendingChange, authFetch, loadAll, toast]);

  const saveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const d = await authFetch<{ settings: PlatformSettings }>("/api/super-admin/settings", {
        method: "PUT",
        body: {
          renewal_phone: formPhone,
          renewal_banner_template: formBanner,
          expired_lockout_template: formLockout,
          trial_duration_days: Number(formTrialDays),
        },
      });
      setSettings(d.settings);
      toast.success("تم حفظ إعدادات المنصة ✓ — الرسائل والرقم محدّثان في كل مكان فوراً");
    } catch (err) {
      toast.error((err as Error).message || "تعذر حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  }, [formPhone, formBanner, formLockout, formTrialDays, authFetch, toast]);

  function logout() {
    if (token) {
      apiFetch("/api/super-admin/logout", { method: "POST", token }).catch(() => {});
    }
    clearSuperAdminToken();
    router.push("/super-admin/login");
  }

  const deactivating = pendingChange?.next === "expired";
  const statusCounts = useMemo(
    () => ({ active: stats?.active ?? 0, trial: stats?.trial ?? 0, expired: stats?.expired ?? 0 }),
    [stats],
  );

  // client-side registry filtering — search by name/slug/phone + status chip
  const filteredSalons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return salons.filter((s) => {
      if (statusFilter !== "all" && s.subscription_status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.slug ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q)
      );
    });
  }, [salons, search, statusFilter]);

  if (!ready) return null;

  return (
    <div className="bs-skin mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      {/* ══════════ Header ══════════ */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)]">
            <ShieldCheck className="h-5 w-5 text-[var(--bs-primary)]" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
              PLATFORM OWNER
            </p>
            <h1 className="text-2xl font-black tracking-tight text-[var(--bs-text)] [text-wrap:balance] sm:text-3xl">
              لوحة مالك المنصة
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAll()}
            disabled={loading}
            aria-label="تحديث البيانات"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </header>

      {/* Skeleton loaders — match the real layout shape instead of a generic
          spinner, so the page feels resolved while data arrives */}
      {loading && !stats ? (
        <div className="space-y-6 sm:space-y-8" aria-busy="true" aria-label="جاري تحميل البيانات">
          {/* hero skeleton */}
          <div className="bs-panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="space-y-4">
              <div className="h-3 w-40 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
              <div className="h-16 w-32 animate-pulse rounded-2xl bg-[var(--bs-surface-raised)]" />
              <div className="h-3 w-28 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
            </div>
            <div className="divide-y divide-[var(--bs-border)] rounded-2xl border border-[var(--bs-border)]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--bs-surface-raised)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
                  <div className="mr-auto h-5 w-10 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
                </div>
              ))}
            </div>
          </div>

          {/* registry skeleton */}
          <div className="bs-panel overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[var(--bs-border)] px-5 py-4 sm:px-7 sm:py-5">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-[var(--bs-surface-raised)]" />
              <div className="space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
                <div className="h-2.5 w-48 animate-pulse rounded bg-[var(--bs-surface-raised)]" />
              </div>
            </div>
            <div className="space-y-3 p-5 sm:p-7">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--bs-surface-raised)]" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ══════════ 1) Stats hero — dominant figure + nested counters ══════════ */}
          <section className="bs-panel relative overflow-hidden" aria-label="إحصائيات المنصة">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 100% at 90% -20%, rgba(201,162,39,0.14), transparent 60%)",
              }}
            />
            <div className="bs-grain" />
            <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12">
              {/* dominant figure */}
              <div className="text-center lg:text-right">
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bs-text-muted)]">
                  إجمالي الصالونات المسجلة
                </p>
                <p className="mt-1 text-6xl font-black leading-none tabular-nums text-[var(--bs-text)] sm:text-7xl">
                  {stats?.total_salons ?? 0}
                </p>
                <p className="mt-3 text-sm text-[var(--bs-text-muted)]">
                  <span className="font-black text-[var(--bs-primary)]">
                    {(stats?.total_bookings ?? 0).toLocaleString("ar-EG")}
                  </span>{" "}
                  حجز عبر المنصة
                </p>
              </div>

              {/* nested status counters — visual hierarchy, not equal boxes */}
              <div className="divide-y divide-[var(--bs-border)] overflow-hidden rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60">
                {(
                  [
                    { key: "active", icon: BadgeCheck, meta: STATUS_META.active },
                    { key: "trial", icon: Clock3, meta: STATUS_META.trial },
                    { key: "expired", icon: CalendarX2, meta: STATUS_META.expired },
                  ] as const
                ).map(({ key, icon: Icon, meta }) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.cls}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-bold text-[var(--bs-text)]">{meta.label}</span>
                    <span className="mr-auto text-2xl font-black tabular-nums text-[var(--bs-text)]">
                      {statusCounts[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════ 2) Salons registry ══════════ */}
          <section className="bs-panel overflow-hidden" aria-label="الصالونات المسجلة">
            <PanelHeader
              icon={Store}
              title="الصالونات المسجلة"
              subtitle="تغيير الحالة يبدأ دورة/عدّاداً جديداً من اليوم"
              trailing={
                <span className="shrink-0 rounded-full border border-[var(--bs-border)] px-3 py-1 text-xs font-black tabular-nums text-[var(--bs-text-muted)]">
                  {filteredSalons.length} / {salons.length}
                </span>
              }
            />

            {/* toolbar — search + status filter chips */}
            <div className="flex flex-col gap-3 border-b border-[var(--bs-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="relative w-full sm:max-w-xs">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bs-text-faint)]"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الرابط أو الهاتف…"
                  aria-label="بحث في الصالونات"
                  className="h-11 w-full rounded-xl border border-[var(--bs-border)] bg-[var(--bs-bg)] pr-10 pl-3.5 text-sm text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none transition focus:border-[var(--bs-primary)] focus:ring-1 focus:ring-[var(--bs-primary)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="تصفية حسب الحالة">
                {(
                  [
                    { key: "all", label: "الكل", count: salons.length },
                    { key: "active", label: STATUS_META.active.label, count: statusCounts.active },
                    { key: "trial", label: STATUS_META.trial.label, count: statusCounts.trial },
                    { key: "expired", label: STATUS_META.expired.label, count: statusCounts.expired },
                  ] as const
                ).map(({ key, label, count }) => {
                  const isActive = statusFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      aria-pressed={isActive}
                      className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-primary)] ${
                        isActive
                          ? "border-[var(--bs-primary)]/50 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"
                          : "border-[var(--bs-border)] text-[var(--bs-text-muted)] hover:border-[var(--bs-border-strong)] hover:text-[var(--bs-text)]"
                      }`}
                    >
                      {key !== "all" && (
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_META[key].dot}`} />
                      )}
                      {label}
                      <span className="tabular-nums opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead>
                  <tr className="border-b border-[var(--bs-border)] text-[11px] uppercase tracking-wider text-[var(--bs-text-muted)]">
                    <th className="px-5 py-3.5 font-bold">الصالون</th>
                    <th className="px-4 py-3.5 font-bold">الرابط</th>
                    <th className="px-4 py-3.5 font-bold">تاريخ التسجيل</th>
                    <th className="px-4 py-3.5 font-bold">بداية الدورة</th>
                    <th className="px-4 py-3.5 font-bold">الحجوزات</th>
                    <th className="px-4 py-3.5 font-bold">الاشتراك</th>
                    <th className="px-4 py-3.5 font-bold">تغيير الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--bs-border)]">
                  {filteredSalons.map((s) => (
                    <tr key={s.id} className="transition-colors duration-200 hover:bg-[var(--bs-surface-raised)]/50">
                      <td className="px-5 py-3.5">
                        <p className="font-black text-[var(--bs-text)]">{s.name}</p>
                        <p className="text-xs text-[var(--bs-text-faint)]" dir="ltr">
                          {s.phone || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-bold text-[var(--bs-primary)]" dir="ltr">
                        {s.slug ? `/${s.slug}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums text-[var(--bs-text-muted)]" dir="ltr">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular-nums text-[var(--bs-text-muted)]" dir="ltr">
                        {formatDate(s.subscription_start_date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-black tabular-nums text-[var(--bs-text)]">{s.bookings_count}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={s.subscription_status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusControl
                          salon={s}
                          disabled={savingStatus === s.id}
                          onPick={(next) => setPendingChange({ salon: s, next })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-[var(--bs-border)] md:hidden">
              {filteredSalons.map((s) => (
                <div key={s.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-[var(--bs-text)]">{s.name}</p>
                      <p className="mt-0.5 truncate text-xs font-bold text-[var(--bs-primary)]" dir="ltr">
                        {s.slug ? `/${s.slug}` : "—"}
                      </p>
                    </div>
                    <StatusBadge status={s.subscription_status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">حجوزات</dt>
                      <dd className="text-sm font-black tabular-nums text-[var(--bs-text)]">{s.bookings_count}</dd>
                    </div>
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">التسجيل</dt>
                      <dd className="text-xs font-bold tabular-nums text-[var(--bs-text)]" dir="ltr">
                        {formatDate(s.created_at)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">الدورة</dt>
                      <dd className="text-xs font-bold tabular-nums text-[var(--bs-text)]" dir="ltr">
                        {formatDate(s.subscription_start_date)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <StatusControl
                      salon={s}
                      disabled={savingStatus === s.id}
                      onPick={(next) => setPendingChange({ salon: s, next })}
                    />
                  </div>
                </div>
              ))}
            </div>

            {filteredSalons.length === 0 && (
              <div className="p-10 text-center">
                <Search aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-[var(--bs-text-faint)]" />
                <p className="text-sm text-[var(--bs-text-muted)]">
                  {salons.length === 0
                    ? "لا توجد صالونات مسجلة بعد"
                    : "لا توجد نتائج مطابقة للبحث أو التصفية"}
                </p>
              </div>
            )}
          </section>

          {/* ══════════ 3) Platform settings ══════════ */}
          <section className="bs-panel overflow-hidden" aria-label="إعدادات المنصة">
            <PanelHeader
              icon={Settings2}
              title="إعدادات المنصة"
              subtitle="رقم التجديد ورسالتَي التذكير والإقفال — تُحدّث فوراً في كل مكان بعد الحفظ"
            />

            <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-phone">رقم هاتف التجديد</Label>
                <Input
                  id="cfg-phone"
                  type="tel"
                  dir="ltr"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0795105850"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-trial">مدة التجربة (أيام)</Label>
                <Input
                  id="cfg-trial"
                  type="number"
                  min={1}
                  max={365}
                  dir="ltr"
                  value={formTrialDays}
                  onChange={(e) => setFormTrialDays(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="cfg-banner">قالب رسالة تذكير التجديد</Label>
                <textarea
                  id="cfg-banner"
                  rows={2}
                  value={formBanner}
                  onChange={(e) => setFormBanner(e.target.value)}
                  className="w-full cursor-text rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-3.5 py-2.5 text-sm text-[var(--bs-text)] transition-colors placeholder:text-[var(--bs-text-faint)] focus:border-[var(--bs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--bs-primary)]"
                />
                <p className="text-[11px] text-[var(--bs-text-faint)]">
                  يجب أن يحتوي على <span dir="ltr" className="font-bold">{"{phone}"}</span> — يُستبدل تلقائياً برقم التجديد.
                </p>
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="cfg-lockout">قالب رسالة الإقفال</Label>
                <textarea
                  id="cfg-lockout"
                  rows={2}
                  value={formLockout}
                  onChange={(e) => setFormLockout(e.target.value)}
                  className="w-full cursor-text rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-3.5 py-2.5 text-sm text-[var(--bs-text)] transition-colors placeholder:text-[var(--bs-text-faint)] focus:border-[var(--bs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--bs-primary)]"
                />
                <p className="text-[11px] text-[var(--bs-text-faint)]">
                  يجب أن يحتوي على <span dir="ltr" className="font-bold">{"{phone}"}</span> — تُرسل للزبائن عند إيقاف الصالون.
                </p>
              </div>

              <div className="lg:col-span-2">
                <Button onClick={saveSettings} disabled={savingSettings} className="w-full sm:w-auto">
                  {savingSettings ? (
                    <>
                      <Spinner size="sm" color="zinc" />
                      <span>جاري الحفظ…</span>
                    </>
                  ) : (
                    "حفظ الإعدادات"
                  )}
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ══════════ Confirm step before applying a status change ══════════ */}
      <ConfirmModal
        isOpen={!!pendingChange}
        title={deactivating ? "تأكيد إيقاف الصالون" : "تأكيد تغيير حالة الاشتراك"}
        message={
          deactivating
            ? `سيتم إيقاف صالون «${pendingChange?.salon.name}» فوراً: لن يستطيع صاحبه الدخول إلى لوحته ولن يستطيع زبائنه الحجز. هل أنت متأكد؟`
            : `سيتم تغيير حالة صالون «${pendingChange?.salon.name}» من «${
                pendingChange ? STATUS_META[pendingChange.salon.subscription_status].label : ""
              }» إلى «${pendingChange ? STATUS_META[pendingChange.next].label : ""}»${
                pendingChange?.next !== "expired"
                  ? " وسيبدأ عدّاد/دورة جديدة من اليوم"
                  : ""
              }. هل أنت متأكد؟`
        }
        confirmText={deactivating ? "نعم، أوقف الصالون" : "نعم، غيّر الحالة"}
        cancelText="إلغاء"
        variant={deactivating ? "danger" : "warning"}
        icon={deactivating ? <Lock className="h-5 w-5 text-[var(--bs-error)]" aria-hidden="true" /> : undefined}
        isLoading={savingStatus !== null}
        onConfirm={applyStatusChange}
        onClose={() => setPendingChange(null)}
      />
    </div>
  );
}

/** Inline status control: select + apply. Every pick routes through the confirm modal. */
function StatusControl({
  salon,
  disabled,
  onPick,
}: {
  salon: SalonRow;
  disabled: boolean;
  onPick: (next: SubscriptionStatus) => void;
}) {
  const [draft, setDraft] = useState<SubscriptionStatus>(salon.subscription_status);
  // Keep the draft in sync when the status changes after a confirmed update
  useEffect(() => setDraft(salon.subscription_status), [salon.subscription_status]);

  const dirty = draft !== salon.subscription_status;
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`تغيير حالة اشتراك ${salon.name}`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value as SubscriptionStatus)}
        className="min-h-[38px] cursor-pointer rounded-lg border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-2.5 py-1.5 text-xs font-bold text-[var(--bs-text)] transition-colors focus:border-[var(--bs-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--bs-primary)] disabled:opacity-50"
      >
        <option value="trial">تجريبي</option>
        <option value="active">نشط</option>
        <option value="expired">منتهي</option>
      </select>
      <Button
        size="sm"
        variant={dirty ? "default" : "outline"}
        disabled={!dirty || disabled}
        onClick={() => onPick(draft)}
      >
        {disabled ? <Spinner size="sm" color="zinc" /> : "تطبيق"}
      </Button>
    </div>
  );
}
