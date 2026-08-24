"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setCustomerAuth } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import type { Customer } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await apiFetch<{ token: string; customer: Customer }>("/api/auth/customer/register", {
        method: "POST",
        body: { username: username.trim(), phone: phone.trim() },
      });
      setCustomerAuth(d.token, d.customer);
      router.push("/book");
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
        <p className="mt-2 text-center text-sm text-zinc-400">سجل باسم مستخدم ورقم هاتف لحجز مواعيدك بسهولة</p>
        
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500"
              placeholder="مثال: ahmed_ali"
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
                <span>جاري إنشاء الحساب…</span>
              </>
            ) : (
              "إنشاء الحساب والمتابعة"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-400">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-bold text-amber-400 hover:underline">
            سجل دخولك الآن
          </Link>
        </p>
      </div>
    </div>
  );
}
