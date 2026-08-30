"use client";

/**
 * RenewalBanner — persistent, NON-DISMISSIBLE reminder shown across every
 * admin dashboard page when the salon's subscription is `active` and today
 * is within 2 days of ITS OWN monthly cycle end date.
 *
 * The message text (with the phone number interpolated) comes from
 * platform_settings via GET /api/owner/subscription-status — nothing is
 * hardcoded here. It disappears automatically the moment the super admin
 * renews the salon (status change resets subscription_start_date, the next
 * status fetch no longer reports a banner).
 */
import { Hourglass } from "lucide-react";

export default function RenewalBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-[57px] z-30 border-b border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-2.5 px-4 py-2.5 text-center">
        <Hourglass className="h-4 w-4 shrink-0 text-[var(--bs-warning)]" aria-hidden="true" />
        <p className="text-xs font-bold leading-relaxed text-[var(--bs-text)] sm:text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}
