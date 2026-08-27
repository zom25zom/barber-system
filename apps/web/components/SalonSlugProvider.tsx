"use client";

import { type ReactNode } from "react";
import { setCurrentSalonSlug, TenantSlugProviderCtx } from "@/lib/salonTenant";

/**
 * Wraps every page under /[salonSlug]/* — the SINGLE source of truth for the
 * current tenant across the frontend:
 *
 *   1. React Context → consumed by useTenantLink() in all components
 *   2. Module registry (kept for plain helpers like withSlug() used inside
 *      fetch closures where hooks aren't available)
 *
 * No component may infer the slug independently or build a tenant URL any
 * other way (see ARCHITECTURE.md).
 */
export default function SalonSlugProvider({
  salonSlug,
  children,
}: {
  salonSlug: string;
  children: ReactNode;
}) {
  // Set synchronously during render so the FIRST child render (including all
  // <Link href> evaluation) already sees the tenant — effects alone would lag.
  setCurrentSalonSlug(salonSlug);

  return (
    <TenantSlugProviderCtx.Provider value={salonSlug}>
      {children}
    </TenantSlugProviderCtx.Provider>
  );
}
