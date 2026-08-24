import type { D1Database, DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  NOTIFICATION_HUB: DurableObjectNamespace;
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
