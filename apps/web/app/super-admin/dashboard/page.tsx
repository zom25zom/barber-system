"use client";

/**
 * /super-admin/dashboard — the PLATFORM OWNER's control console.
 *
 * Visual hierarchy (deliberately NOT a flat grid of equal boxes):
 *   1. Stats hero — one dominant "total salons" figure with status counters
 *      nested inside it (active / trial / expired) + platform bookings.
 *   2. Salons table — clear status badges + inline status controls, each
 *      change confirmed by a modal (deactivation locks out real users).
 *   3. Platform settings — phone number, message templates, trial duration.
 *
 * Fully responsive: stacked stat flow + salon cards on mobile, table on
 * desktop. Same --bs-* design tokens as the rest of the app.
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
import { BadgeCheck, CalendarX2, Clock3, LogOut, RefreshCw, Scissors, ShieldCheck } from "lucide-react";

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

  if (!ready) return null;

  return (
    <div className="bs-skin w-full space-y-8">
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
            <h1 className="text-xl font-black text-[var(--bs-text)] sm:text-2xl">
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

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {/* ══════════ 1) Stats hero — dominant figure + nested counters ══════════ */}
          <section className="bs-panel relative overflow-hidden">
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
                <p className="mt-1 text-6xl font-black leading-none text-[var(--bs-text)] sm:text-7xl">
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
                    <span className="mr-auto text-2xl font-black text-[var(--bs-text)]">
                      {statusCounts[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════ 2) Salons table ══════════ */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-[var(--bs-text)]">
                <Scissors className="h-5 w-5 text-[var(--bs-primary)]" />
                الصالونات المسجلة
              </h2>
              <span className="text-xs text-[var(--bs-text-faint)]">
                تحديث الحالة يبدأ دورة/عدّاداً جديداً من اليوم
              </span>
            </div>

            {/* Desktop table */}
            <div className="bs-panel hidden overflow-x-auto md:block">
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
                  {salons.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--bs-surface-raised)]/50">
                      <td className="px-5 py-3.5">
                        <p className="font-black text-[var(--bs-text)]">{s.name}</p>
                        <p className="text-xs text-[var(--bs-text-faint)]" dir="ltr">
                          {s.phone || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--bs-primary)]" dir="ltr">
                        {s.slug ? `/${s.slug}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--bs-text-muted)]" dir="ltr">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--bs-text-muted)]" dir="ltr">
                        {formatDate(s.subscription_start_date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-black text-[var(--bs-text)]">{s.bookings_count}</span>
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
            <div className="space-y-3 md:hidden">
              {salons.map((s) => (
                <div key={s.id} className="bs-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-[var(--bs-text)]">{s.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--bs-primary)]" dir="ltr">
                        {s.slug ? `/${s.slug}` : "—"}
                      </p>
                    </div>
                    <StatusBadge status={s.subscription_status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">حجوزات</dt>
                      <dd className="text-sm font-black text-[var(--bs-text)]">{s.bookings_count}</dd>
                    </div>
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">التسجيل</dt>
                      <dd className="text-xs font-bold text-[var(--bs-text)]" dir="ltr">
                        {formatDate(s.created_at)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/60 p-2">
                      <dt className="text-[10px] text-[var(--bs-text-muted)]">الدورة</dt>
                      <dd className="text-xs font-bold text-[var(--bs-text)]" dir="ltr">
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

            {salons.length === 0 && (
              <div className="bs-panel p-10 text-center text-sm text-[var(--bs-text-muted)]">
                لا توجد صالونات مسجلة بعد
              </div>
            )}
          </section>

          {/* ══════════ 3) Platform settings ══════════ */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-black text-[var(--bs-text)]">إعدادات المنصة</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--bs-text-muted)]">
                رقم التجديد ورسالتَي التذكير والإقفال — يتحدّث الرقم في كل مكان تلقائياً (اللافتة +
                رسالة الإقفال) بمجرد الحفظ
              </p>
            </div>

            <div className="bs-panel grid gap-5 p-6 sm:p-8 lg:grid-cols-2">
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
                <Label htmlFor="cfg-banner">قالب رسالة تذكير التجديد — يجب أن يحتوي {"{phone}"}</Label>
                <textarea
                  id="cfg-banner"
                  rows={2}
                  value={formBanner}
                  onChange={(e) => setFormBanner(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-3.5 py-2.5 text-sm text-[var(--bs-text)] transition-colors placeholder:text-[var(--bs-text-faint)]"
                />
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="cfg-lockout">قالب رسالة الإقفال — يجب أن يحتوي {"{phone}"}</Label>
                <textarea
                  id="cfg-lockout"
                  rows={2}
                  value={formLockout}
                  onChange={(e) => setFormLockout(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-3.5 py-2.5 text-sm text-[var(--bs-text)] transition-colors placeholder:text-[var(--bs-text-faint)]"
                />
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
        icon={deactivating ? "🔒" : undefined}
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
        className="rounded-lg border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-2.5 py-1.5 text-xs font-bold text-[var(--bs-text)]"
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
