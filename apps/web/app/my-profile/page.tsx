"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken, getCustomerProfile, setCustomerAuth, clearCustomerAuth } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import type { Customer } from "@/lib/types";

export default function MyProfilePage() {
  const router = useRouter();
  const token = getCustomerToken();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    // Prefer fresh data from the server; fall back to cached profile
    apiFetch<{ customer: Customer }>("/api/customer/profile", { token })
      .then((d) => {
        setUsername(d.customer.username);
        setPhone(d.customer.phone);
      })
      .catch(() => {
        const p = getCustomerProfile();
        if (p) {
          setUsername(p.username);
          setPhone(p.phone);
        }
      })
      .finally(() => setLoading(false));
  }, [token, router]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setSaving(true);
    try {
      const d = await apiFetch<{ ok: boolean; customer: Customer }>("/api/customer/profile", {
        method: "PATCH",
        token,
        body: { username: username.trim(), phone: phone.trim() },
      });
      if (token) setCustomerAuth(token, d.customer); // refresh cached profile
      setProfileSuccess(true);
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmNewPassword) {
      setPasswordError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/api/customer/change-password", {
        method: "POST",
        token,
        body: { currentPassword, newPassword },
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!token || loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500";

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* ── Profile header ── */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 text-center shadow-xl">
        <span className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/40 bg-zinc-800 text-3xl font-black text-amber-400">
          {username.trim().charAt(0) || "👤"}
        </span>
        <h1 className="text-xl font-black text-zinc-100">{username}</h1>
        <p className="mt-0.5 text-sm text-zinc-500" dir="ltr">
          {phone}
        </p>
      </div>

      {/* ── Edit profile ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-lg">
        <h2 className="text-base font-bold text-zinc-100">بياناتي</h2>
        <p className="mt-0.5 text-xs text-zinc-500">عدّل اسمك ورقم هاتفك</p>

        <form onSubmit={onSaveProfile} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">الاسم</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-200">رقم الهاتف</label>
            <input
              type="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputCls} text-left`}
            />
          </div>

          {profileError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
              <span>⚠️</span>
              <span>{profileError}</span>
            </div>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400 sm:text-sm">
              <span>✓</span>
              <span>تم حفظ بياناتك بنجاح</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50 active:scale-95"
          >
            {saving ? (
              <>
                <Spinner size="sm" color="zinc" />
                <span>جاري الحفظ…</span>
              </>
            ) : (
              "حفظ التعديلات"
            )}
          </button>
        </form>
      </section>

      {/* ── Change password ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-100">كلمة المرور</h2>
            <p className="mt-0.5 text-xs text-zinc-500">تغيير كلمة مرور حسابك</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPasswordForm((v) => !v);
              setPasswordError(null);
              setPasswordSuccess(false);
            }}
            className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20 active:scale-95"
          >
            {showPasswordForm ? "إلغاء" : "تغيير"}
          </button>
        </div>

        {passwordSuccess && !showPasswordForm && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400 sm:text-sm">
            <span>✓</span>
            <span>{passwordSuccess && "تم تغيير كلمة المرور بنجاح"}</span>
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={onChangePassword} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور الحالية</label>
              <input
                type="password"
                required
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputCls} text-left`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputCls} text-left`}
                placeholder="6 خانات على الأقل"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">تأكيد كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={`${inputCls} text-left`}
              />
            </div>

            {passwordError && showPasswordForm && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
                <span>⚠️</span>
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50 active:scale-95"
            >
              {savingPassword ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري التغيير…</span>
                </>
              ) : (
                "تأكيد تغيير كلمة المرور"
              )}
            </button>
          </form>
        )}
      </section>

      {/* ── Logout ── */}
      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className="w-full rounded-2xl border border-red-500/30 bg-red-500/5 py-3.5 text-sm font-bold text-red-400 transition hover:bg-red-500/15 active:scale-95"
      >
        🚪 تسجيل الخروج من الحساب
      </button>

      <ConfirmModal
        isOpen={logoutOpen}
        title="تأكيد تسجيل الخروج"
        message="هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟"
        confirmText="نعم، تسجيل الخروج"
        cancelText="إلغاء"
        variant="warning"
        icon="🚪"
        onConfirm={() => {
          clearCustomerAuth();
          router.push("/");
        }}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  );
}
