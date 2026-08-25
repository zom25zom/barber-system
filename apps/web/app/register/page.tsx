"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 خانات على الأقل");
      return;
    }
    setLoading(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/customer/register", {
        method: "POST",
        body: { username: username.trim(), phone: phone.trim(), password },
      });
      // No auto-login — the customer signs in explicitly with phone + password
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-amber-400">إنشاء حساب جديد</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">سجّل باسمك ورقم هاتفك وكلمة مرور لحجز مواعيدك بسهولة</p>

        {success ? (
          <div className="mt-8 space-y-5 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-3xl">✓</span>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">تم إنشاء حسابك بنجاح!</h2>
              <p className="mt-1.5 text-sm text-zinc-400">سجّل دخولك الآن برقم هاتفك وكلمة المرور للحجز</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition hover:bg-amber-400 active:scale-95"
            >
              تسجيل الدخول الآن
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">الاسم</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500"
                placeholder="مثال: أحمد علي"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">رقم الهاتف</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-left text-zinc-100 outline-none focus:border-amber-500"
                placeholder="0790000000 أو +962..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور</label>
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-left text-zinc-100 outline-none focus:border-amber-500"
                placeholder="6 خانات على الأقل"
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 shadow-md active:scale-98"
            >
              {loading ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري إنشاء الحساب…</span>
                </>
              ) : (
                "إنشاء الحساب"
              )}
            </button>
          </form>
        )}

        {!success && (
          <p className="mt-5 text-center text-sm text-zinc-400">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="font-bold text-amber-400 hover:underline">
              سجل دخولك الآن
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
