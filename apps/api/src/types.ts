import type { D1Database, DurableObjectNamespace, Fetcher, R2Bucket } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  NOTIFICATION_HUB: DurableObjectNamespace;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
};

export type Owner = { id: number; username: string };
export type Customer = { id: number; username: string; phone: string };

export type Variables = {
  owner: Owner;
  customer: Customer;
};

export type SalonSettings = {
  id: number;
  name: string;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
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
