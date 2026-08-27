/**
 * Path-based multi-tenancy — SINGLE SOURCE OF TRUTH for the frontend tenant.
 *
 * Architecture rule (enforced repo-wide):
 *   Every internal navigation URL used inside a tenant ([salonSlug]) context
 *   MUST be produced by buildTenantUrl()/useTenantLink(). No component may
 *   hardcode an internal route string like "/book" or "/my-bookings".
 *
 * The tenant is registered exactly once per page render chain — by
 * <SalonSlugProvider> (used by every /[salonSlug]/* page) — via two channels:
 *
 *   1. TenantSlugContext (React): primary channel, always correct for
 *      components mounted under a tenant page.
 *   2. Module registry (currentSalonSlug): secondary channel kept in sync by
 *      the same provider, consumed by plain helpers (withSlug()) called inside
 *      fetch closures where hooks aren't available.
 */

"use client";

import { useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createContext } from "react";

let currentSalonSlug: string | null = null;

/** Internal: used ONLY by SalonSlugProvider */
export function setCurrentSalonSlug(slug: string | null | undefined) {
  currentSalonSlug = slug || null;
}

/** Raw module-level slug (secondary channel) */
export function getCurrentSalonSlug(): string | null {
  return currentSalonSlug;
}

/** Returns "salonSlug=xxx" or "" when no slug context is active. */
export function getSalonSlugParam(): string {
  if (!currentSalonSlug) return "";
  return `salonSlug=${encodeURIComponent(currentSalonSlug)}`;
}

/** Appends the slug param to a URL that has NO query string yet. */
export function withSlug(url: string): string {
  const q = getSalonSlugParam();
  if (!q) return url;
  return url + (url.includes("?") ? "&" : "?") + q;
}

// ─────────────────────────────────────────────────────────────────────────
// Centralized tenant-URL building (THE fix for lost-slug navigation)
// ─────────────────────────────────────────────────────────────────────────

const NON_ROUTE_PREFIXES = ["http://", "https://", "tel:", "mailto:", "#"];

function validateInternalPath(path: string): void {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(
      `[tenantLink] buildTenantUrl expects an app-internal absolute path starting with "/", got: "${path}"`,
    );
  }
}

/**
 * Builds the tenant-scoped version of any internal app path.
 *   buildTenantUrl("/book")          → "/{slug}/book"     (inside a tenant page)
 *                                      "/book"            (root/default pages)
 * External URLs, tel:, mailto:, #anchors pass through untouched.
 */
export function buildTenantUrl(path: string, slugOverride?: string | null): string {
  validateInternalPath(path);

  const slug = slugOverride ?? currentSalonSlug;
  if (!slug) return path;

  // Already tenant-scoped or externally-targeted → untouched
  if (path === `/${slug}` || path.startsWith(`/${slug}/`)) return path;
  if (NON_ROUTE_PREFIXES.some((p) => path.startsWith(p))) return path;

  // Never scope admin routes — the admin panel is session-global, not tenant-pathed
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/signup")) return path;

  return `/${slug}${path}`;
}

// ─────────────────────────────────────────────────────────────────────────
// React hook API — preferred in components
// ─────────────────────────────────────────────────────────────────────────

const TenantSlugContext = createContext<string | null>(null);
/** Set once by SalonSlugProvider */
export const TenantSlugProviderCtx = TenantSlugContext;

export interface TenantLinkApi {
  /** Resolved href for <Link>, wired to the active tenant */
  href: (path: string) => string;
  /** router.push to a tenant-scoped path */
  push: (path: string) => void;
  /** router.replace to a tenant-scoped path */
  replace: (path: string) => void;
  /** Current active slug (may be null on root pages) */
  slug: string | null;
}

export function useTenantLink(): TenantLinkApi {
  const ctxSlug = useContext(TenantSlugContext);
  const router = useRouter();

  return useMemo(() => {
    const slug = ctxSlug ?? currentSalonSlug;
    const b = (path: string) => buildTenantUrl(path, slug);
    return {
      href: b,
      slug,
      push: (path) => router.push(b(path)),
      replace: (path) => router.replace(b(path)),
    };
    // rebuild when route changes router identity; slug read at call time
  }, [router]);
}
