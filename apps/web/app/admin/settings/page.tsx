"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { useSalonSettings, updateSalonSettingsClient, type SalonSettings } from "@/lib/salon";
import { useToast } from "@/components/Toaster";
import ImageUploader from "@/components/ImageUploader";

const PRESET_COLORS = [
  { name: "ذهبي كهرماني", hex: "#f59e0b", label: "Amber" },
  { name: "أخضر زمردي", hex: "#10b981", label: "Emerald" },
  { name: "أزرق ملكي", hex: "#3b82f6", label: "Blue" },
  { name: "بنفسجي فاخر", hex: "#8b5cf6", label: "Purple" },
  { name: "قرمزي أنيق", hex: "#ef4444", label: "Red" },
  { name: "برونزي دافئ", hex: "#d97706", label: "Bronze" },
  { name: "سماوي عصري", hex: "#06b6d4", label: "Cyan" },
];

export default function AdminSettingsPage() {
  const token = getOwnerToken();
  const showToast = useToast();
  const initialSettings = useSalonSettings();

  // Branding Form State
  const [name, setName] = useState(initialSettings.name);
  const [phone, setPhone] = useState(initialSettings.phone || "");
  const [primaryColor, setPrimaryColor] = useState(initialSettings.primary_color || "#f59e0b");
  const [logoUrl, setLogoUrl] = useState(initialSettings.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    setName(initialSettings.name);
    setPhone(initialSettings.phone || "");
    setPrimaryColor(initialSettings.primary_color || "#f59e0b");
    setLogoUrl(initialSettings.logo_url || "");
  }, [initialSettings]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!name.trim() || name.trim().length < 2) {
      setError("اسم الصالون مطلوب ويجب أن يتكون من حرفين على الأقل");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch<{ ok: boolean; salon: SalonSettings }>("/api/salon-settings", {
        method: "PUT",
        token,
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          primary_color: primaryColor.trim() || "#f59e0b",
          logo_url: logoUrl.trim() || null,
        },
      });

      if (res.salon) {
        // Update client cache and broadcast live to all components + manifest
        updateSalonSettingsClient(res.salon);
        setSuccess(true);
        showToast("✅ تم حفظ وتحديث إعدادات الصالون والهوية بنجاح!");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!currentPassword) {
      setPasswordError("يرجى إدخال كلمة المرور الحالية");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      await apiFetch<{ ok: boolean; message: string }>("/api/owner/change-password", {
        method: "POST",
        token,
        body: {
          currentPassword,
          newPassword,
        },
      });

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("🔒 تم تغيير كلمة المرور بنجاح!");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">إعدادات الصالون والأمان</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          تخصيص هوية الصالون، اللون الأساسي، الشعار، وإدارة أمان حساب المدير.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>تم تطبيق التغييرات بنجاح وتحديث شريط التنقل والـ Manifest فوراً دون الحاجة لإعادة النشر!</span>
          </div>
          <button onClick={() => setSuccess(false)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ── Main Column: Branding & Security (2 cols) ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Card 1: Branding Form */}
          <form onSubmit={handleSaveBranding} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <span>🎨</span> الهوية البصرية ومعلومات الصالون
              </h2>
            </div>

            {/* 1. Salon Name */}
            <div>
              <label className="block text-sm font-semibold text-zinc-200 mb-2">
                اسم الصالون <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: صالون الأناقة الملكي"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                يظهر في رأس الصفحة (Navbar)، عنوان الموقع، وتطبيق الهاتف المحمول (PWA).
              </p>
            </div>

            {/* 2. Contact Phone */}
            <div>
              <label className="block text-sm font-semibold text-zinc-200 mb-2">رقم التواصل / الهاتف</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+962 7 9000 0000"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-left text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1.5 text-xs text-zinc-400">رقم الهاتف أو الواتساب المخصص لتواصل الزبائن والاستفسارات.</p>
            </div>

            {/* 3. Primary Brand Color */}
            <div>
              <label className="block text-sm font-semibold text-zinc-200 mb-2">اللون الأساسي للهوية</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 bg-transparent text-sm font-mono text-zinc-200 outline-none uppercase"
                  />
                </div>

                {/* Preset Palettes */}
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPrimaryColor(c.hex)}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        primaryColor.toLowerCase() === c.hex.toLowerCase()
                          ? "border-white ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-950 scale-105"
                          : "border-zinc-800 opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                يحدد اللون الرئيسي للأزرار وشريط التطبيق وثيم شاشة الهاتف (Theme Color).
              </p>
            </div>

            {/* 4. Salon Logo */}
            <ImageUploader
              label="شعار الصالون (Logo)"
              value={logoUrl}
              onChange={setLogoUrl}
              shape="rounded"
              helperText="يتم حفظ الشعار في التخزين السحابي ويظهر في الشريط العلوي وأيقونة التطبيق (PWA)."
            />

            {/* Submit button */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                style={{ backgroundColor: primaryColor }}
                className="rounded-xl px-8 py-3 font-bold text-zinc-950 shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "جاري حفظ الإعدادات…" : "💾 حفظ بيانات الهوية"}
              </button>
            </div>
          </form>

          {/* Card 2: Password Change Form */}
          <form onSubmit={handlePasswordChange} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>🔒</span> تغيير كلمة مرور المدير
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                لحماية حسابك، يرجى إدخال كلمة المرور الحالية أولاً قبل تعيين كلمة المرور الجديدة.
              </p>
            </div>

            {passwordError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-center gap-2">
                <span>⚠️</span>
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center gap-2">
                <span>✅</span>
                <span>تم تحديث كلمة المرور بنجاح! استخدم كلمة المرور الجديدة في تسجيلات الدخول القادمة.</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">كلمة المرور الحالية</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-zinc-200 mb-2">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 خانات على الأقل"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-200 mb-2">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور الجديدة"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-6 py-2.5 text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                {passwordSaving ? "جاري التحديث…" : "🔐 تحديث كلمة المرور"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Live Preview Card (1 col) ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">معاينة حية للهوية</h2>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl sticky top-20">
            {/* Fake Navbar Header Preview */}
            <div className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-full object-cover border border-amber-500/40" />
                ) : (
                  <span className="text-lg">💈</span>
                )}
                <span className="font-bold text-sm" style={{ color: primaryColor }}>
                  {name || "اسم الصالون"}
                </span>
              </div>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Navbar</span>
            </div>

            {/* Hero Card Preview */}
            <div className="p-5 text-center space-y-3">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-zinc-700 bg-zinc-950 overflow-hidden shadow-inner mx-auto">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">💈</span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-zinc-100">{name || "صالون الحلاقة"}</h3>
                {phone && <p className="text-xs text-zinc-400 mt-0.5" dir="ltr">{phone}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  style={{ backgroundColor: primaryColor }}
                  className="w-full rounded-xl py-2.5 text-xs font-bold text-zinc-950 shadow-md pointer-events-none"
                >
                  ✂ احجز موعدك الآن
                </button>
              </div>
            </div>

            {/* Security & Rate Limiting Status Card */}
            <div className="border-t border-zinc-800 bg-zinc-950/70 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-zinc-300 font-bold pb-1 border-b border-zinc-900">
                <span>🛡 حالة حماية النظام</span>
                <span className="text-emerald-400">مفعّلة</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>حماية محاولات الدخول:</span>
                <span className="text-zinc-200">5 محاولات / 15 دقيقة</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>التحقق من المدخلات:</span>
                <span className="text-zinc-200">فحص صارم من الخادم</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>تشفير كلمات المرور:</span>
                <span className="text-zinc-200">SHA-256</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
