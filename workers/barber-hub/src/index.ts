/**
 * BarberHubDO — Durable Object for real-time WebSocket broadcasting.
 *
 * Lifecycle:
 *   1. Pages Function receives request → routes /api/ws to this DO via binding.
 *   2. DO accepts the WebSocket, stores it, sends CONNECTED welcome.
 *   3. Pages Function POSTs to /broadcast after every D1 mutation.
 *   4. DO pushes the event to every open WebSocket instantly.
 *
 * D1 remains the source of truth — this DO only relays notifications.
 */

export class BarberHubDO {
  private state: DurableObjectState;
  private connections: WebSocket[] = [];

  constructor(state: DurableObjectState) {
    this.state = state;
    // Restore any WebSocket connections that survived a hibernation event
    this.connections = this.state.getWebSockets();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── WebSocket upgrade ──────────────────────────────────────────────────
    if (url.pathname === '/connect') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept with hibernation API so the DO can sleep between events
      this.state.acceptWebSocket(server);

      // Welcome message
      try {
        server.send(JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() }));
      } catch (_) {}

      return new Response(null, { status: 101, webSocket: client });
    }

    // ── Broadcast (called from Pages Function after D1 mutation) ───────────
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const { type, payload } = await request.json();
        this.broadcast(type, payload);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // ── Stats (diagnostic) ────────────────────────────────────────────────
    if (url.pathname === '/stats') {
      return new Response(JSON.stringify({ connections: this.connections.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  // ── WebSocket event handlers (hibernation-compatible) ────────────────────

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const data = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (_) {}
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.connections = this.connections.filter((s) => s !== ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    this.connections = this.connections.filter((s) => s !== ws);
  }

  // ── Broadcast helper ────────────────────────────────────────────────────

  broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    this.connections = this.connections.filter((ws) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    });
  }
}

// Default export required for ES module worker format.
// This worker only serves Durable Objects — no standalone routes.
export default {
  fetch() {
    return new Response('Not found', { status: 404 });
  },
};
