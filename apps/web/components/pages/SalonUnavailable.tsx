import { Scissors } from "lucide-react";

/**
 * SalonUnavailable — full-page state rendered (server-side) in place of the
 * normal tenant content when the platform owner has expired a salon's
 * subscription. Shown on the public /{salonSlug} pages; the booking APIs
 * are blocked server-side independently of this UI.
 *
 * Existing bookings are NOT deleted — they're preserved in the database and
 * become accessible again the moment the salon is reactivated.
 */
export default function SalonUnavailable() {
  return (
    <div className="bs-skin mx-auto max-w-lg py-14">
      <div className="bs-panel p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]">
          <Scissors className="h-7 w-7 text-[var(--bs-text-faint)]" />
        </div>
        <h1 className="mt-6 text-2xl font-black leading-relaxed text-[var(--bs-text)] sm:text-3xl">
          هذا الصالون غير متاح حالياً، عد قريباً
        </h1>
        <div className="bs-hairline mx-auto mt-8 max-w-[10rem]" />
        <p className="mt-6 text-sm text-[var(--bs-text-muted)]">
          يرجى المحاولة لاحقاً — شكراً لتفهّمك
        </p>
      </div>
    </div>
  );
}
