/**
 * BarberHubDO — Cloudflare Durable Object
 *
 * Acts as the real-time WebSocket hub for the barbershop system.
 * All connected browser clients (Admin + Customer) hold a WebSocket
 * connection here. When any data mutation happens (booking created,
 * status changed, barber updated, etc.) the Edge Function sends a
 * POST /broadcast request to this DO, which instantly fans the event
 * out to every connected client.
 *
 * Uses the WebSocket Hibernation API (ctx.acceptWebSocket) so the DO
 * can hibernate between messages — reducing costs significantly compared
 * to keeping raw WebSocket pairs in memory.
 *
 * Internal HTTP routes (called only by the Edge Function):
 *   POST /broadcast  — fan out { type, payload } to all WS clients
 *
 * Public WebSocket route (called by browser via Edge Function):
 *   GET /ws          — upgrade to WebSocket
 */
export class BarberHubDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // ─── Main entry point ────────────────────────────────────────────────────────
  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // WebSocket upgrade: browser clients connect here (any path with Upgrade header)
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return this._handleWebSocketUpgrade(request);
    }

    // Internal broadcast: Edge Function posts events here after D1 writes
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this._handleBroadcast(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  // ─── WebSocket Upgrade ────────────────────────────────────────────────────────
  _handleWebSocketUpgrade(request) {
    // Create a WebSocket pair and accept via Hibernation API
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);

    // Send a welcome CONNECTED message immediately
    try {
      server.send(JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() }));
    } catch (_) {
      // Client may have disconnected immediately — safe to ignore
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // ─── Broadcast handler ────────────────────────────────────────────────────────
  async _handleBroadcast(request) {
    let event;
    try {
      event = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const message = JSON.stringify(event);
    const sessions = this.state.getWebSockets();
    let sent = 0;

    for (const ws of sessions) {
      try {
        ws.send(message);
        sent++;
      } catch (_) {
        // Client disconnected or errored — the Hibernation API will
        // call webSocketClose/webSocketError automatically; safe to skip.
      }
    }

    return new Response(JSON.stringify({ ok: true, clients: sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Hibernation API Handlers ─────────────────────────────────────────────────
  // Called by the runtime when a client sends a message while the DO is hibernated

  webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      // Handle PING keep-alive from client
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
      // All other client → server messages are ignored (server is push-only)
    } catch (_) {
      // Ignore malformed messages
    }
  }

  webSocketClose(ws, code, reason) {
    // Hibernation API automatically removes the socket from getWebSockets()
    // No manual cleanup needed
  }

  webSocketError(ws, error) {
    // Same as above — Hibernation API handles removal
  }
}
