"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { useOwnerSalonSettings, updateSalonSettingsClient, type SalonSettings } from "@/lib/salon";
import { useToast } from "@/components/Toaster";
import ImageUploader from "@/components/ImageUploader";
import { ThemeModeSelector } from "@/components/ThemeToggle";

const PRESET_COLORS = [
  { name: "ذهبي كهرماني", hex: "#f59e0b" },
  { name: "أخضر زمردي", hex: "#10b981" },
  { name: "أزرق ملكي", hex: "#3b82f6" },
  { name: "بنفسجي فاخر", hex: "#8b5cf6" },
  { name: "قرمزي أنيق", hex: "#ef4444" },
  { name: "برونزي دافئ", hex: "#d97706" },
  { name: "سماوي عصري", hex: "#06b6d4" },
];

type SectionKey = "basic" | "branding" | "social";

export default function AdminSettingsPage() {
  const token = getOwnerToken();
  const showToast = useToast();
  // Session-scoped settings — always the logged-in owner's own salon
  const salon = useOwnerSalonSettings(!!token);

  // ── Section collapse state (first section open by default) ──
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    basic: true,
    branding: false,
    social: false,
  });

  // ── Shared form state (all sections read from the same source) ──
  const [name, setName] = useState(salon.name);
  const [phone, setPhone] = useState(salon.phone || "");
  const [primaryColor, setPrimaryColor] = useState(salon.primary_color || "#f59e0b");
  const [logoUrl, setLogoUrl] = useState(salon.logo_url || "");
  const [socialFacebook, setSocialFacebook] = useState(salon.social_facebook || "");
  const [socialInstagram, setSocialInstagram] = useState(salon.social_instagram || "");
  const [socialTiktok, setSocialTiktok] = useState(salon.social_tiktok || "");
  const [socialWhatsapp, setSocialWhatsapp] = useState(salon.social_whatsapp || "");
  const [mapsUrl, setMapsUrl] = useState(salon.maps_url || "");

  // Per-section saving state
  const [saving, setSaving] = useState<Record<SectionKey, boolean>>({
    basic: false,
    branding: false,
    social: false,
  });

  useEffect(() => {
    setName(salon.name);
    setPhone(salon.phone || "");
    setPrimaryColor(salon.primary_color || "#f59e0b");
    setLogoUrl(salon.logo_url || "");
    setSocialFacebook(salon.social_facebook || "");
    setSocialInstagram(salon.social_instagram || "");
    setSocialTiktok(salon.social_tiktok || "");
    setSocialWhatsapp(salon.social_whatsapp || "");
    setMapsUrl(salon.maps_url || "");
  }, [salon]);

  /**
   * Saves one section via the existing PUT /api/salon-settings endpoint.
   * The endpoint overwrites every column, so we always merge the edited
   * section's fields with the current values of the untouched sections.
   */
  async function saveSection(
    section: SectionKey,
    successMsg: string,
    validate?: () => string | null
  ): Promise<void> {
    if (!token) return;
    if (validate) {
      const err = validate();
      if (err) {
        showToast.error(err);
        return;
      }
    }

    setSaving((s) => ({ ...s, [section]: true }));
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
      if (res.salon) updateSalonSettingsClient(res.salon);
      showToast.success(successMsg);
    } catch (err) {
      showToast.error((err as Error).message || "حدث خطأ أثناء الحفظ، يرجى المحاولة ثانية");
    } finally {
      setSaving((s) => ({ ...s, [section]: false }));
    }
  }

  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const inputCls =
    "w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none transition focus:border-[var(--bs-primary)] focus:ring-1 focus:ring-[var(--bs-primary)]";

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-extrabold text-[var(--bs-text)] sm:text-3xl">إعدادات الصالون</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--bs-text-muted)]">
          عدّل كل قسم على حدة واضغط زر الحفظ الخاص به فقط — باقي الأقسام لن تتأثر.
        </p>
      </div>

      {/* ══════════ Section 1: Basic Salon Info ══════════ */}
      <section className="overflow-hidden rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/90 shadow-lg">
        <button
          type="button"
          onClick={() => toggleSection("basic")}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition hover:bg-[var(--bs-surface-raised)]/40"
          aria-expanded={openSections.basic}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${openSections.basic ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)]" : "border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"}`}>
              🏪
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--bs-text)]">معلومات الصالون الأساسية</h2>
              <p className="mt-0.5 hidden text-xs text-[var(--bs-text-faint)] sm:block">اسم الصالون ورقم التواصل</p>
            </div>
          </div>
          <span className={`shrink-0 text-[var(--bs-text-faint)] transition-transform duration-200 ${openSections.basic ? "rotate-180" : ""}`}>▼</span>
        </button>

        {openSections.basic && (
          <div className="space-y-4 border-t border-[var(--bs-border)] p-5 pt-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">
                اسم الصالون <span className="text-[var(--bs-primary)]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: صالون الأناقة الملكي"
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-[var(--bs-text-muted)]">
                يظهر في رأس الصفحة، عنوان الموقع، وتطبيق الهاتف المحمول (PWA).
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">رقم التواصل / الهاتف</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+962 7 9000 0000"
                className={`${inputCls} text-left`}
              />
              <p className="mt-1.5 text-xs text-[var(--bs-text-muted)]">رقم الهاتف المخصص لتواصل الزبائن والاستفسارات.</p>
            </div>

            <div className="flex items-center justify-end border-t border-[var(--bs-border)] pt-4">
              <SaveButton
                onClick={() =>
                  saveSection("basic", "تم حفظ معلومات الصالون الأساسية ✓", () =>
                    !name.trim() || name.trim().length < 2 ? "اسم الصالون مطلوب ويجب أن يتكون من حرفين على الأقل" : null
                  )
                }
                saving={saving.basic}
                label="حفظ المعلومات الأساسية"
                color={primaryColor}
              />
            </div>
          </div>
        )}
      </section>

      {/* ══════════ Section 2: Visual Branding ══════════ */}
      <section className="overflow-hidden rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/90 shadow-lg">
        <button
          type="button"
          onClick={() => toggleSection("branding")}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition hover:bg-[var(--bs-surface-raised)]/40"
          aria-expanded={openSections.branding}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${openSections.branding ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)]" : "border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"}`}>
              🎨
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--bs-text)]">الهوية البصرية</h2>
              <p className="mt-0.5 hidden text-xs text-[var(--bs-text-faint)] sm:block">شعار الصالون واللون الأساسي</p>
            </div>
          </div>
          <span className={`shrink-0 text-[var(--bs-text-faint)] transition-transform duration-200 ${openSections.branding ? "rotate-180" : ""}`}>▼</span>
        </button>

        {openSections.branding && (
          <div className="space-y-4 border-t border-[var(--bs-border)] p-5 pt-5">
            {/* Logo */}
            <ImageUploader
              label="شعار الصالون (Logo)"
              value={logoUrl}
              onChange={setLogoUrl}
              shape="rounded"
              helperText="يظهر الشعار في الشريط العلوي وأيقونة تطبيق الهاتف (PWA)."
            />

            {/* Primary color */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">اللون الأساسي للهوية</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] p-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 bg-transparent text-sm font-mono uppercase text-[var(--bs-text)] outline-none"
                  />
                </div>

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
                          ? "scale-105 border-white ring-2 ring-[var(--bs-primary)] ring-offset-2 ring-offset-[var(--bs-bg)]"
                          : "border-[var(--bs-border)] opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-[var(--bs-text-muted)]">
                يحدد اللون الرئيسي للأزرار وشريط التطبيق وثيم شاشة الهاتف.
              </p>
            </div>

            <div className="flex items-center justify-end border-t border-[var(--bs-border)] pt-4">
              <SaveButton
                onClick={() => saveSection("branding", "تم حفظ الهوية البصرية وتحديث الثيم فوراً ✓")}
                saving={saving.branding}
                label="حفظ الهوية البصرية"
                color={primaryColor}
              />
            </div>
          </div>
        )}
      </section>

      {/* ══════════ Section 3: Social Media & Maps ══════════ */}
      <section className="overflow-hidden rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/90 shadow-lg">
        <button
          type="button"
          onClick={() => toggleSection("social")}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition hover:bg-[var(--bs-surface-raised)]/40"
          aria-expanded={openSections.social}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${openSections.social ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)]" : "border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"}`}>
              🌐
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--bs-text)]">التواصل الاجتماعي والخريطة</h2>
              <p className="mt-0.5 hidden text-xs text-[var(--bs-text-faint)] sm:block">فيسبوك، إنستغرام، تيك توك، واتساب، خرائط Google</p>
            </div>
          </div>
          <span className={`shrink-0 text-[var(--bs-text-faint)] transition-transform duration-200 ${openSections.social ? "rotate-180" : ""}`}>▼</span>
        </button>

        {openSections.social && (
          <div className="space-y-4 border-t border-[var(--bs-border)] p-5 pt-5">
            <p className="text-xs text-[var(--bs-text-muted)]">
              جميع الحقول اختيارية — تظهر الروابط المُدخلة فقط في تذييل الصفحة الرئيسية للزبائن.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--bs-text)]">
                  <span>📘</span> رابط صفحة فيسبوك (Facebook)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  placeholder="https://facebook.com/your-salon"
                  className={`${inputCls} py-2.5 text-left text-xs sm:text-sm`}
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--bs-text)]">
                  <span>📸</span> رابط حساب إنستغرام (Instagram)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="https://instagram.com/your-salon"
                  className={`${inputCls} py-2.5 text-left text-xs sm:text-sm`}
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--bs-text)]">
                  <span>🎵</span> رابط حساب تيك توك (TikTok)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="https://tiktok.com/@your-salon"
                  className={`${inputCls} py-2.5 text-left text-xs sm:text-sm`}
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--bs-text)]">
                  <span>💬</span> رقم أو رابط واتساب (WhatsApp)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={socialWhatsapp}
                  onChange={(e) => setSocialWhatsapp(e.target.value)}
                  placeholder="+962790000000 أو https://wa.me/..."
                  className={`${inputCls} py-2.5 text-left text-xs sm:text-sm`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--bs-text)]">
                <span>📍</span> رابط موقع الصالون على خرائط Google Maps
              </label>
              <input
                type="url"
                dir="ltr"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className={`${inputCls} py-2.5 text-left text-xs sm:text-sm`}
              />
              <p className="mt-1 text-[11px] text-[var(--bs-text-faint)]">
                الرابط الذي سيفتح للزبائن عند الضغط على &quot;موقعنا على الخريطة&quot;.
              </p>
            </div>

            <div className="flex items-center justify-end border-t border-[var(--bs-border)] pt-4">
              <SaveButton
                onClick={() => saveSection("social", "تم حفظ روابط التواصل الاجتماعي والخريطة ✓")}
                saving={saving.social}
                label="حفظ روابط التواصل"
                color={primaryColor}
              />
            </div>
          </div>
        )}
      </section>

      {/* ══════════ Section 4: Security → direct reset lives in /admin/profile ══════════ */}
      <section className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/90 p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] text-lg text-[var(--bs-success)]">🔒</span>
            <div>
              <h2 className="text-base font-bold text-[var(--bs-text)]">كلمة مرور المدير</h2>
              <p className="mt-0.5 text-xs text-[var(--bs-text-faint)]">إعادة تعيين مباشرة بدون كلمة المرور الحالية</p>
            </div>
          </div>
          <a
            href="/admin/profile"
            className="shrink-0 rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] px-4 py-2 text-xs font-bold text-[var(--bs-success)] transition hover:brightness-110 active:scale-95"
          >
            الانتقال لإعادة التعيين ←
          </a>
        </div>
      </section>

      {/* ══════════ Section 5: Appearance → light/dark mode (Phase 1 foundation) ══════════ */}
      <section className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/90 p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-lg text-[var(--bs-primary)]">🎨</span>
            <div>
              <h2 className="text-base font-bold text-[var(--bs-text)]">وضع العرض</h2>
              <p className="mt-0.5 text-xs text-[var(--bs-text-faint)]">فاتح، داكن، أو حسب إعداد نظامك — يتم حفظ اختيارك تلقائياً</p>
            </div>
          </div>
          <ThemeModeSelector />
        </div>
      </section>
    </div>
  );
}

/** Per-section save button */
function SaveButton({
  onClick,
  saving,
  label,
  color,
}: {
  onClick: () => void;
  saving: boolean;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      style={{ backgroundColor: color }}
      className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
    >
      {saving ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>جاري الحفظ…</span>
        </>
      ) : (
        <>💾 {label}</>
      )}
    </button>
  );
}
