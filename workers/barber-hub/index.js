/**
 * Barber Hub Worker — Standalone Cloudflare Worker
 *
 * This worker's sole purpose is to host the BarberHubDO Durable Object.
 * Cloudflare Pages cannot host Durable Objects directly — they must be
 * defined in a separate Worker and referenced via `script_name`.
 *
 * Deploy this worker FIRST, then deploy the Pages project.
 * Deploy command: npx wrangler deploy --config workers/barber-hub/wrangler.jsonc
 */
export { BarberHubDO } from '../../functions/api/durable-objects/BarberHubDO.js';

// Minimal default fetch handler — this worker is only accessed internally
// by the Pages Functions (via DO stub), never directly by the browser.
export default {
  async fetch(request, env, ctx) {
    return new Response('Barber Hub Worker — internal use only', { status: 200 });
  }
};
