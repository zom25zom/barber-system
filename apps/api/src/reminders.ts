import type { Bindings, ReminderMessage } from './types';

import { SALON_TZ_OFFSET_MS } from './utils';

const REMINDER_LEAD_MINUTES = 20;

/** Epoch ms of a naive salon-local date/time string (Jordan UTC+3). */
function salonLocalTimestamp(date: string, time: string): number {
  return new Date(`${date}T${time}:00Z`).getTime() - SALON_TZ_OFFSET_MS;
}

/**
 * Schedules a pre-appointment reminder for a confirmed booking by sending a
 * delayed message to the booking-reminders queue.
 *
 * Cloudflare Queues rejects delaySeconds above ~24h (empirically verified:
 * 24h succeeds, 72h fails with "Bad Request"), so we cap the initial delay at
 * QUEUE_MAX_DELAY and let the consumer re-chain the message until it fires
 * inside the reminder window.
 *
 * Urgent bookings (< 20 min away) are intentionally skipped instead of
 * scheduling with a negative delay.
 *
 * Never throws — a queue outage must not fail the booking itself.
 */
export async function scheduleBookingReminder(
  env: Pick<Bindings, 'DB' | 'REMINDER_QUEUE'>,
  salonId: number,
  bookingId: number,
  bookingDate: string,
  startTime: string,
): Promise<void> {
  try {
    if (!env.REMINDER_QUEUE) {
      console.warn('[Reminder] REMINDER_QUEUE not bound; skipping schedule');
      return;
    }

    const targetMs = salonLocalTimestamp(bookingDate, startTime) - REMINDER_LEAD_MINUTES * 60_000;
    const delaySeconds = Math.floor((targetMs - Date.now()) / 1000);

    // Urgent booking (or already past) — no point reminding
    if (delaySeconds <= 0) {
      console.log(`[Reminder] Booking #${bookingId} is < ${REMINDER_LEAD_MINUTES}min away; skipping`);
      return;
    }

    const cappedDelay = Math.min(delaySeconds, QUEUE_MAX_DELAY_SECONDS);
    const body: ReminderMessage = { salonId, bookingId, bookingDate, startTime };
    await env.REMINDER_QUEUE.send(body, { delaySeconds: cappedDelay });
    console.log(
      `[Reminder] Scheduled booking #${bookingId}: requested ${delaySeconds}s → queued ${cappedDelay}s (${bookingDate} ${startTime})`,
    );
  } catch (err) {
    console.error(`[Reminder] Failed to schedule reminder for booking #${bookingId}:`, err);
  }
}

export const QUEUE_MAX_DELAY_SECONDS = 86_400; // empirically-safe maximum (24h)
export { SALON_TZ_OFFSET_MS };
