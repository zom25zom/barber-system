"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { useSalonSettings } from "@/lib/salon";
import Spinner from "@/components/Spinner";

export default function AdminProfilePage() {
  const router = useRouter();
  const token = getOwnerToken();
  const salon = useSalonSettings();
  const [loading, setLoading] = useState(true);
  // Owner identity comes ONLY from the owner session (server-validated via /api/owner/me).
  // Never reads customer storage — the two session types are fully separate.
  const [username, setUsername] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<{ owner: { id: number; username: string } }>("/api/owner/me", { token })
      .then((d) => setUsername(d.owner.username))
      .catch(() => {
        // Invalid/expired OWNER token → not an authenticated admin
        clearOwnerToken();
        router.replace("/admin/login");
      })
      .finally(() => setLoading(false));
  }, [token, router]);

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/owner/change-password", {
        method: "POST",
        token,
        body: { newPassword },
      });
      // All sessions invalidated server-side → this device is logged out; go re-login
      clearOwnerTokenAndGo(router);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function clearOwnerTokenAndGo(r: ReturnType<typeof useRouter>) {
    import("@/lib/auth").then(({ clearOwnerToken }) => {
      clearOwnerToken();
      r.push("/admin/login");
    });
  }

  if (loading || !token) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none transition focus:border-[var(--bs-primary)] focus:ring-1 focus:ring-[var(--bs-primary)]";

  return (
    <div className="bs-skin mx-auto max-w-lg space-y-8 pb-4">
      {/* ── Account header: the avatar letter is the focal point ── */}
      <header className="flex items-center gap-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-3xl font-black text-[var(--bs-primary)] shadow-lg">
          {(username || "A").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">حساب الإدارة</p>
          <h1 className="mt-1 truncate text-2xl font-black text-[var(--bs-text)] sm:text-3xl">{username || "المدير"}</h1>
          <p className="mt-1 text-xs text-[var(--bs-text-faint)]">حساب إدارة {salon.name}</p>
        </div>
      </header>

      <div className="bs-hairline" />

      {/* ── Reset password (no current password required) ── */}
      <section>
        <h2 className="text-lg font-black text-[var(--bs-text)]">كلمة المرور</h2>
        <p className="mt-1 text-xs text-[var(--bs-text-faint)]">
          إعادة تعيين مباشرة — سيتم تسجيل خروجك من جميع الأجهزة بعد التغيير
        </p>

        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError(null);
            }}
            className="mt-4 w-full rounded-xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] px-4 py-2.5 text-xs font-bold text-[var(--bs-primary)] transition hover:brightness-110 active:scale-95 sm:text-sm"
          >
            🔑 إعادة تعيين كلمة المرور
          </button>
        ) : (
          <form onSubmit={onResetPassword} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={6}
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputCls} pl-11 text-left`}
                  placeholder="6 خانات على الأقل"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showNewPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--bs-text-muted)] hover:text-[var(--bs-text)] hover:bg-[var(--bs-surface-raised)] transition"
                >
                  {showNewPassword ? (
                    /* Eye-off */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">تأكيد كلمة المرور الجديدة</label>
              <input
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                dir="ltr"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={`${inputCls} text-left`}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] sm:text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-[var(--bs-border)] pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bs-primary)] py-3 font-bold text-[var(--bs-on-primary)] transition hover:bg-[var(--bs-primary-strong)] disabled:opacity-50 active:scale-95"
              >
                {saving ? (
                  <>
                    <Spinner size="sm" color="zinc" />
                    <span>جاري الحفظ…</span>
                  </>
                ) : (
                  "حفظ كلمة المرور الجديدة"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-5 py-3 text-sm font-medium text-[var(--bs-text-muted)] transition hover:bg-[var(--bs-surface-raised)] active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
