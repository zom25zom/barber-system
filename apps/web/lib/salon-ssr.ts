import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { API_BASE } from "./api";

/**
 * SSR-side tenant validation for /[salonSlug]/* pages.
 *
 * Verifies the slug exists server-side BEFORE rendering. Without this, an
 * unknown/nonexistent slug silently fell back to DEFAULT_SALON_ID (salon 1)
 * on every downstream read endpoint — rendering one salon's data under
 * another's URL. Calls notFound() (Next.js 404 page) when the salon doesn't
 * exist. Network failures propagate as errors (500) instead — a transient
 * outage must not masquerade as "salon not found".
 *
 * Returns the salon's subscription state so pages can render the "salon
 * unavailable" screen when the platform owner has expired the salon
 * (instead of normal content).
 *
 * Transport notes (split deployment: web worker ≠ API worker):
 *  1. PRODUCTION: a Worker cannot fetch another same-account Worker via
 *     *.workers.dev (edge returns 404/1042) — so we use the "API" SERVICE
 *     BINDING declared in wrangler.jsonc, which invokes barber-api directly.
 *  2. FALLBACK (local dev without the binding / non-worker contexts):
 *     direct fetch to API_BASE.
 */
async function fetchSalonSettings(salonSlug: string): Promise<Response | null> {
  // 1) Service binding (production path)
  try {
    const env = (getCloudflareContext() as unknown as {
      env?: { API?: { fetch?: (url: string) => Promise<Response> } };
    })?.env;
    if (env?.API?.fetch) {
      const viaBinding = await env.API.fetch(
        `https://barber-api.internal/api/salon-settings?salonSlug=${encodeURIComponent(salonSlug)}`,
      );
      if (viaBinding.ok) return viaBinding;
      // binding responded non-OK — fall through to the direct fetch
    }
  } catch {
    // getCloudflareContext unavailable (e.g. non-worker context) — use fallback
  }

  // 2) Direct fetch (local dev / fallback)
  return fetch(`${API_BASE}/api/salon-settings?salonSlug=${encodeURIComponent(salonSlug)}`, {
    cache: "no-store",
  });
}

export type SalonPageState = {
  /** true when the platform owner set this salon's subscription to 'expired' */
  expired: boolean;
};

/**
 * Validates the slug AND reports the salon's subscription state.
 * Kept name-compatible with the previous void-returning helper: existing
 * callers that `await requireSalonPage(slug)` keep working, and tenant
 * pages can now branch on `expired` to show the unavailable screen.
 */
export async function requireSalonPage(salonSlug: string): Promise<SalonPageState> {
  if (!salonSlug || !/^[a-zA-Z0-9-_]{1,60}$/.test(salonSlug)) notFound();

  const res = await fetchSalonSettings(salonSlug);
  if (!res || !res.ok) notFound();

  const data = (await res.json().catch(() => ({}))) as {
    salon?: { id?: number; subscription_status?: string };
  };
  if (!data?.salon?.id) notFound();

  return { expired: data.salon.subscription_status === "expired" };
}
