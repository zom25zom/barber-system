import { DurableObject } from 'cloudflare:workers';

/**
 * NotificationHub — a Durable Object that holds WebSocket connections for
 * the owner and all customers of a single salon, pushes notifications live,
 * and provides distributed atomic Rate Limiting per IP/action.
 *
 * Each salon gets its own DO instance via idFromName(`salon-${salonId}`),
 * ensuring complete isolation between tenants even when sharing infrastructure.
 *
 * Client connects:  GET /ws?role=owner&token=...  or  ?role=customer&customerId=...
 * Server pushes:    POST /broadcast  { recipient_type, recipient_id, ... }
 * Rate limit check: POST /rate-limit { key, limit, windowSeconds }
 */
export class NotificationHub extends DurableObject {
  private sockets = new Map<WebSocket, { role: string; customerId: number | null }>();
  private rateLimits = new Map<string, number[]>(); // key -> array of attempt timestamps (ms)

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── WebSocket Endpoint ──
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const role = url.searchParams.get('role') ?? 'customer';
      const customerIdRaw = url.searchParams.get('customerId');
      const customerId = customerIdRaw ? Number(customerIdRaw) : null;

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.set(server, { role, customerId });
      server.addEventListener('close', () => this.sockets.delete(server));
      server.addEventListener('error', () => this.sockets.delete(server));
      return new Response(null, { status: 101, webSocket: client });
    }

    // ── Broadcast Endpoint ──
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.text();
      let parsed: { recipient_type?: string; recipient_id?: number | null } = {};
      try {
        parsed = JSON.parse(payload);
      } catch {
        return new Response('Bad JSON', { status: 400 });
      }
      for (const [ws, meta] of this.sockets) {
        const isOwnerTarget = parsed.recipient_type === 'owner' && meta.role === 'owner';
        const isCustomerTarget =
          parsed.recipient_type === 'customer' &&
          meta.role === 'customer' &&
          meta.customerId === parsed.recipient_id;
        if (isOwnerTarget || isCustomerTarget) {
          try {
            ws.send(payload);
          } catch {
            this.sockets.delete(ws);
          }
        }
      }
      return new Response('ok');
    }

    // ── Distributed Rate Limiter Endpoint (e.g. 5 attempts per 15 mins) ──
    if (url.pathname === '/rate-limit' && request.method === 'POST') {
      let body: { key?: string; limit?: number; windowSeconds?: number } = {};
      try {
        body = await request.json();
      } catch {
        return new Response('Bad JSON', { status: 400 });
      }

      const key = body.key || 'default';
      const limit = Number(body.limit) || 5;
      const windowSeconds = Number(body.windowSeconds) || 900; // 15 minutes default
      const now = Date.now();
      const windowMs = windowSeconds * 1000;

      let timestamps = this.rateLimits.get(key) || [];
      // Purge expired timestamps
      timestamps = timestamps.filter((t) => now - t < windowMs);

      if (timestamps.length >= limit) {
        const oldest = timestamps[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return new Response(
          JSON.stringify({
            allowed: false,
            remaining: 0,
            retryAfter: retryAfterSeconds,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 429,
          },
        );
      }

      timestamps.push(now);
      this.rateLimits.set(key, timestamps);

      // Periodic garbage collection on map size if it exceeds 10,000 keys
      if (this.rateLimits.size > 10000) {
        for (const [k, ts] of this.rateLimits.entries()) {
          const fresh = ts.filter((t) => now - t < windowMs);
          if (fresh.length === 0) {
            this.rateLimits.delete(k);
          } else {
            this.rateLimits.set(k, fresh);
          }
        }
      }

      return new Response(
        JSON.stringify({
          allowed: true,
          remaining: limit - timestamps.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response('Not found', { status: 404 });
  }
}
