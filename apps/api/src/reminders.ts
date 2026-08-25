import type { Bindings, ReminderMessage } from './types';
import { SALON_ID } from './utils';

const REMINDER_LEAD_MINUTES = 20;

/**
 * Salon local timezone (Jordan — UTC+3 fixed, no DST since 2022).
 * Booking dates/times are stored as naive local strings in D1,
 * so we anchor them to +03:00 to compute real timestamps.
 */
const SALON_TZ_OFFSET = '+03:00';

/** Epoch ms of a naive salon-local date/time string */
function salonLocalTimestamp(date: string, time: string): number {
  return new Date(`${date}T${time}:00${SALON_TZ_OFFSET}`).getTime();
}

/**
 * Schedules a pre-appointment reminder for a confirmed booking by sending a
 * delayed message to the booking-reminders queue.
 *
 * The message fires at (booking start − 20 min). Cancellations/modifications
 * are handled at consumption time by re-checking the live DB state —
 * Cloudflare Queues cannot cancel an already-delayed message.
 *
 * Urgent bookings (< 20 min away) are intentionally skipped instead of
 * scheduling with a negative delay.
 *
 * Never throws — a queue outage must not fail the booking itself.
 */
export async function scheduleBookingReminder(
  env: Pick<Bindings, 'DB' | 'REMINDER_QUEUE'>,
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

    const body: ReminderMessage = { bookingId, bookingDate, startTime };
    await env.REMINDER_QUEUE.send(body, { delaySeconds });
    console.log(`[Reminder] Scheduled booking #${bookingId} in ${delaySeconds}s (${bookingDate} ${startTime})`);
  } catch (err) {
    console.error(`[Reminder] Failed to schedule reminder for booking #${bookingId}:`, err);
  }
}

export { SALON_ID };
