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
    "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500";

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* ── Account header ── */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 text-center shadow-xl">
        <span className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/40 bg-zinc-800 text-3xl font-black text-amber-400">
          {(username || "A").charAt(0).toUpperCase()}
        </span>
        <h1 className="text-xl font-black text-zinc-100">{username || "المدير"}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">حساب إدارة {salon.name}</p>
      </div>

      {/* ── Reset password (no current password required) ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-lg">
        <h2 className="text-base font-bold text-zinc-100">كلمة المرور</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          إعادة تعيين مباشرة — سيتم تسجيل خروجك من جميع الأجهزة بعد التغيير
        </p>

        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError(null);
            }}
            className="mt-4 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20 active:scale-95 sm:text-sm"
          >
            🔑 إعادة تعيين كلمة المرور
          </button>
        ) : (
          <form onSubmit={onResetPassword} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور الجديدة</label>
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
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
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
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">تأكيد كلمة المرور الجديدة</label>
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
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50 active:scale-95"
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
                className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-95"
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
