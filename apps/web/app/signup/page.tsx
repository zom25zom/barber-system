"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";

interface SignupResponse {
  ok: boolean;
  token: string;
  owner: { id: number; username: string };
  salon: { id: number; name: string; slug: string };
  publicUrl: string;
}

export default function SignupPage() {
  const router = useRouter();

  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState<SignupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-redirect to the dashboard shortly after successful signup
  useEffect(() => {
    if (!success) return;
    setOwnerToken(success.token);
    const t = setTimeout(() => router.push("/admin"), 6000);
    return () => clearTimeout(t);
  }, [success, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }

    setLoading(true);
    try {
      const d = await apiFetch<SignupResponse>("/api/salons/register", {
        method: "POST",
        body: {
          name: salonName.trim(),
          phone: phone.trim() || null,
          adminUsername: adminUsername.trim(),
          password,
        },
      });
      // Public link built from OUR origin (web worker), not the API origin
      setSuccess({ ...d, publicUrl: `${window.location.origin}/${d.salon.slug}` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl sm:p-8">
        <h1 className="text-center text-2xl font-bold text-emerald-400">أنشئ صالونك — مجاناً</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          سجّل صالونك واحصل على رابط حجز عام + لوحة تحكم كاملة خلال دقيقة
        </p>

        {!success ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">اسم الصالون</label>
              <input
                type="text"
                required
                minLength={2}
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="مثال: صالون الأمل"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">رقم التواصل (اختياري)</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+962 7 9000 0000"
                className={`${inputCls} text-left`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">اسم مستخدم الأدمن</label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="ستستخدمه لدخول لوحة التحكم"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pl-11 text-left`}
                  placeholder="6 خانات على الأقل"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "إخفاء" : "إظهار"}
                  className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">تأكيد كلمة المرور</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${inputCls} text-left`}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-bold text-zinc-950 shadow-md transition hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري إنشاء صالونك…</span>
                </>
              ) : (
                "🚀 إنشاء الصالون الآن"
              )}
            </button>
          </form>
        ) : (
          /* ── Success screen ── */
          <div className="mt-8 space-y-5 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-3xl text-emerald-400">✓</span>

            <div>
              <h2 className="text-lg font-black text-zinc-100">تم إنشاء صالونك بنجاح! 🎉</h2>
              <p className="mt-1 text-sm text-zinc-400">رابط صالونك العام الجاهز للمشاركة مع زبائنك:</p>
            </div>

            {/* Public URL box */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <a
                href={success.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-left font-mono text-xs font-bold text-emerald-300 hover:underline sm:text-sm"
                dir="ltr"
              >
                {success.publicUrl}
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
              >
                {copied ? "✓ تم النسخ" : "نسخ"}
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              سيتم نقلك تلقائياً إلى لوحة التحكم خلال لحظات…
            </p>

            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
            >
              الدخول إلى لوحة التحكم الآن ←
            </button>
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-sm text-zinc-400">
        لديك حساب مدير بالفعل؟{" "}
        <a href="/admin/login" className="font-bold text-amber-400 hover:underline">
          دخول لوحة التحكم
        </a>
      </p>
    </div>
  );
}
