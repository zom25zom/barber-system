"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";

interface LoginResponse {
  token: string;
  owner: { id: number; username: string };
  salon?: { id: number; name: string; slug: string | null };
}

/**
 * Per-salon admin login page — /{salonSlug}/admin/login
 *
 * The tenant is taken directly from the URL path (no input needed), so this
 * page is ideal for salons with their own branded entry link. After a
 * successful login the owner session is bound to THAT salon server-side and
 * the user lands on the shared dashboard /admin.
 */
export default function SalonAdminLoginPage() {
  const params = useParams<{ salonSlug: string }>();
  const salonSlug = String(params?.salonSlug ?? "");
  const router = useRouter();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validSlug = /^[a-zA-Z0-9-_]{1,60}$/.test(salonSlug);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await apiFetch<LoginResponse>("/api/auth/owner/login", {
        method: "POST",
        body: { username, password, salonSlug },
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
          {validSlug ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300" dir="ltr">
              🏪 /{salonSlug}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-400">
              معرّف الصالون في الرابط غير صالح
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
            disabled={loading || !validSlug}
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
