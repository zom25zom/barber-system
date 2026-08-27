import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Minimal OpenNext Cloudflare config.
 * Incremental cache (KV/R2) intentionally omitted — the app relies on
 * client-side data fetching; no ISR/tag caching is used.
 */
export default defineCloudflareConfig({
  // Enable when ISR/cache revalidation is needed:
  // incrementalCache: r2IncrementalCache,
});
