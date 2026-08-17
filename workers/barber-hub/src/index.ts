/**
 * BarberHubDO — Durable Object for real-time WebSocket broadcasting.
 *
 * Uses Cloudflare's Hibernation API so the DO can sleep between events
 * without dropping connections. All state lives in the storage-backed
 * WebSocket set managed by this.state — no in-memory array needed.
 */

export class BarberHubDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
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

      this.state.acceptWebSocket(server);

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
      const sockets = this.state.getWebSockets();
      return new Response(JSON.stringify({ connections: sockets.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  // ── WebSocket hibernation handlers ───────────────────────────────────────

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      const data = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (_) {}
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Connection removed automatically by runtime — nothing to do.
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    // Connection removed automatically by runtime — nothing to do.
  }

  // ── Broadcast helper ────────────────────────────────────────────────────

  broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      } catch (_) {
        // Stale socket — runtime will clean it up.
      }
    }
  }
}

export default {
  fetch() {
    return new Response('Not found', { status: 404 });
  },
};
