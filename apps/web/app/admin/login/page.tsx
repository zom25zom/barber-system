"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";

interface LoginResponse {
  token: string;
  owner: { id: number; username: string };
  salon?: { id: number; name: string; slug: string | null };
}

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonSlug, setSalonSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await apiFetch<LoginResponse>("/api/auth/owner/login", {
        method: "POST",
        body: {
          username,
          password,
          // Multi-tenant: usernames are unique PER SALON only — the slug tells
          // the backend which tenant this account belongs to.
          ...(salonSlug.trim() ? { salonSlug: salonSlug.trim() } : {}),
        },
      });
      setOwnerToken(d.token);
      toast.success(
        d.salon?.name
          ? `مرحباً بك في إدارة «${d.salon.name}» — تم تسجيل الدخول بنجاح ✓`
          : "مرحباً بك! تم تسجيل الدخول بنجاح ✓",
      );
      router.push("/admin");
    } catch (err) {
      const msg = (err as Error).message || "اسم المستخدم أو كلمة المرور غير صحيحة";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-xl">
        <div className="text-center">
          <span className="text-4xl">✂</span>
          <h1 className="mt-3 text-2xl font-bold text-amber-400">لوحة تحكم الصالون</h1>
          <p className="mt-1 text-sm text-zinc-400">تسجيل دخول صاحب الصالون والمدير</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">
              معرّف الصالون <span className="text-xs font-normal text-zinc-500">(رابط حجز صالونك)</span>
            </label>
            <input
              type="text"
              dir="ltr"
              value={salonSlug}
              onChange={(e) => setSalonSlug(e.target.value)}
              className={`${inputCls} text-left`}
              placeholder="مثال: salon-nkhba"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              هو الجزء الذي يأتي بعد الرابط الرئيسي في رابط حجز صالونك:
              <span dir="ltr" className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-300/90">
                example.com/<b>salon-slug</b>
              </span>
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
              placeholder="admin"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs sm:text-sm text-red-400 flex items-center gap-2">
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
                <span>جاري التحقق والدخول…</span>
              </>
            ) : (
              "دخول لوحة التحكم"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
