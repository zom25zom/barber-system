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
  const [socialFacebook, setSocialFacebook] = useState(initialSettings.social_facebook || "");
  const [socialInstagram, setSocialInstagram] = useState(initialSettings.social_instagram || "");
  const [socialTiktok, setSocialTiktok] = useState(initialSettings.social_tiktok || "");
  const [socialWhatsapp, setSocialWhatsapp] = useState(initialSettings.social_whatsapp || "");
  const [mapsUrl, setMapsUrl] = useState(initialSettings.maps_url || "");

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
    setSocialFacebook(initialSettings.social_facebook || "");
    setSocialInstagram(initialSettings.social_instagram || "");
    setSocialTiktok(initialSettings.social_tiktok || "");
    setSocialWhatsapp(initialSettings.social_whatsapp || "");
    setMapsUrl(initialSettings.maps_url || "");
  }, [initialSettings]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!name.trim() || name.trim().length < 2) {
      const msg = "اسم الصالون مطلوب ويجب أن يتكون من حرفين على الأقل";
      setError(msg);
      showToast.error(msg);
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
          social_facebook: socialFacebook.trim() || null,
          social_instagram: socialInstagram.trim() || null,
          social_tiktok: socialTiktok.trim() || null,
          social_whatsapp: socialWhatsapp.trim() || null,
          maps_url: mapsUrl.trim() || null,
        },
      });

      if (res.salon) {
        // Update client cache and broadcast live to all components + manifest
        updateSalonSettingsClient(res.salon);
        setSuccess(true);
        showToast.success("تم حفظ وتحديث إعدادات الصالون والهوية بنجاح ✓");
      }
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة ثانية";
      setError(msg);
      showToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!currentPassword) {
      const msg = "يرجى إدخال كلمة المرور الحالية";
      setPasswordError(msg);
      showToast.error(msg);
      return;
    }

    if (newPassword.length < 6) {
      const msg = "كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل";
      setPasswordError(msg);
      showToast.error(msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = "كلمة المرور الجديدة وتأكيدها غير متطابقين";
      setPasswordError(msg);
      showToast.error(msg);
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
      showToast.success("تم تغيير كلمة المرور بنجاح ✓");
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ، يرجى التأكد من كلمة المرور الحالية والمحاولة مجدداً";
      setPasswordError(msg);
      showToast.error(msg);
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

            {/* 5. Social Media & Maps Links */}
            <div className="border-t border-zinc-800/80 pt-6 space-y-4">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <span>🌐</span> روابط التواصل الاجتماعي وموقع الخريطة
              </h3>
              <p className="text-xs text-zinc-400">
                جميع الحقول اختيارية — تظهر الروابط المُدخلة فقط في تذييل الصفحة الرئيسية (Footer) للزبائن.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Facebook */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <span>📘</span> رابط صفحة فيسبوك (Facebook)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={socialFacebook}
                    onChange={(e) => setSocialFacebook(e.target.value)}
                    placeholder="https://facebook.com/your-salon"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-left text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <span>📸</span> رابط حساب إنستغرام (Instagram)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="https://instagram.com/your-salon"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-left text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                  />
                </div>

                {/* TikTok */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <span>🎵</span> رابط حساب تيك توك (TikTok)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={socialTiktok}
                    onChange={(e) => setSocialTiktok(e.target.value)}
                    placeholder="https://tiktok.com/@your-salon"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-left text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                    <span>💬</span> رقم أو رابط واتساب (WhatsApp)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={socialWhatsapp}
                    onChange={(e) => setSocialWhatsapp(e.target.value)}
                    placeholder="+962790000000 أو https://wa.me/..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-left text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Google Maps Link */}
              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                  <span>📍</span> رابط موقع الصالون على خرائط Google Maps
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-left text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  الرابط الذي سيفتح للزبائن عند الضغط على &quot;موقعنا على الخريطة&quot;.
                </p>
              </div>
            </div>

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

              {/* Social & Maps Preview Icons */}
              {(socialFacebook || socialInstagram || socialTiktok || socialWhatsapp || mapsUrl) && (
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-xs">
                  {socialWhatsapp && <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg" title="WhatsApp">💬</span>}
                  {socialInstagram && <span className="p-1.5 bg-pink-500/20 text-pink-400 rounded-lg" title="Instagram">📸</span>}
                  {socialFacebook && <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg" title="Facebook">📘</span>}
                  {socialTiktok && <span className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg" title="TikTok">🎵</span>}
                  {mapsUrl && <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg" title="Maps">📍</span>}
                </div>
              )}
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
