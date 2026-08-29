import type { D1Database, DurableObjectNamespace, Fetcher, MessageBatch, Queue, R2Bucket } from '@cloudflare/workers-types';

/** Payload sent to the booking-reminders queue */
export type ReminderMessage = {
  salonId: number;
  bookingId: number;
  bookingDate: string;
  startTime: string;
};

export type Bindings = {
  DB: D1Database;
  NOTIFICATION_HUB: DurableObjectNamespace;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  REMINDER_QUEUE?: Queue<ReminderMessage>;
  /** VAPID private key — MUST come from a Worker secret (wrangler secret put).
   *  Never hardcode it in source: the previous key was leaked in git history
   *  and has been rotated. Local dev reads it from .dev.vars (gitignored). */
  VAPID_PRIVATE_KEY?: string;
  /** VAPID public key — not secret; optional override for the built-in constant. */
  VAPID_PUBLIC_KEY?: string;
  /** Extra CORS origins (comma-separated) — for custom salon domains added
   *  after launch. Base whitelist lives in index.ts BASE_ALLOWED_ORIGINS. */
  ALLOWED_ORIGINS?: string;
};

export type { MessageBatch };

export type Owner = { id: number; username: string };
export type SuperAdmin = { id: number; username: string };
export type Customer = { id: number; username: string; phone: string };

export type Variables = {
  owner: Owner;
  superAdmin: SuperAdmin;
  customer: Customer;
  /** Derived from the authenticated session — set by requireOwner/requireCustomer */
  salonId: number;
};

export type SalonSettings = {
  id: number;
  name: string;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_tiktok?: string | null;
  social_whatsapp?: string | null;
  maps_url?: string | null;
  /** trial | active | expired — included in public salon-settings responses
   *  so SSR pages can render the "salon unavailable" state when expired. */
  subscription_status?: string;
};

export type BarberTimeOff = {
  id: number;
  salon_id: number;
  barber_id: number;
  date: string;
  reason: string | null;
  created_at?: string;
};

export type BarberBreak = {
  id: number;
  salon_id: number;
  barber_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at?: string;
};
