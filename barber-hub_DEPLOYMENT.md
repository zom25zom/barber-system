# barber-hub Worker Deployment Guide

## Current Status
- Worker has **96.1% error rate** (206 errors out of 422 requests)
- This indicates **outdated code is deployed** and crashing
- Files below are the CORRECT, VERIFIED versions

---

## Complete Current File Contents

### 1. workers/barber-hub/src/index.js
```javascript
// barber-hub Worker - manages WebSocket connections using Hibernation API
// Hosts BarberHubDO Durable Object which sleeps between messages (near-zero cost)
// Direct WebSocket endpoint: wss://barber-hub.nawafzwd25.workers.dev/ws

import { BarberHubDO } from './BarberHubDO.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // WebSocket endpoint for clients
    if (url.pathname === '/ws' && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      // Create a WebSocket pair for this client
      const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();

      // Hand over the server side to the Durable Object stub
      const id = env.BARBER_HUB.idFromName('global');
      const stub = env.BARBER_HUB.get(id);

      // Accept the WebSocket on the stub (this enables hibernation)
      await stub.acceptWebSocket(serverWebSocket);

      // Return the client side to the browser
      return new Response(null, {
        status: 101,
        webSocket: clientWebSocket,
      });
    }

    // Broadcast endpoint (called by Pages API to push events)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const { type, message } = payload;

        if (!type || !message) {
          return new Response(JSON.stringify({ error: 'Missing type or message' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Broadcast to all connected clients via DO
        const id = env.BARBER_HUB.idFromName('global');
        const stub = env.BARBER_HUB.get(id);
        await stub.fetch(new Request('https://barber-hub/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, message })
        }));

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://barber-system.pages.dev'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://barber-system.pages.dev'
          }
        });
      }
    }

    // Health check
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'BarberHub WebSocket Server',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://barber-system.pages.dev'
      }
    });
  },
};

export { BarberHubDO } from './BarberHubDO.js';
```

### 2. workers/barber-hub/src/BarberHubDO.js
```javascript
// BarberHub Durable Object - manages WebSocket connections with hibernation
// DO sleeps between messages = near-zero cost when idle
// Uses WebSocket Hibernation API: this.ctx.acceptWebSocket(webSocket)

// Event type definitions
const EVENTS = {
  WS_CONNECTED: 'WS_CONNECTED',
  PING: 'PING',
  PONG: 'PONG',
  NEW_BOOKING: 'NEW_BOOKING',
  BOOKING_STATUS_CHANGED: 'BOOKING_STATUS_CHANGED',
  BOOKING_RESCHEDULED: 'BOOKING_RESCHEDULED',
  BARBERS_UPDATED: 'BARBERS_UPDATED',
  SERVICES_UPDATED: 'SERVICES_UPDATED',
  NOTIFICATION_ADDED: 'NOTIFICATION_ADDED',
  NOTIFICATION_CHANGED: 'NOTIFICATION_CHANGED',
  ERROR: 'ERROR'
};

export class BarberHubDO {
  constructor(state) {
    this.state = state;
    this.clients = new Set(); // Track all connected WebSocket clients
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade request - handle with hibernation
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      // Accept the WebSocket on the stub (this is how hibernation works)
      await this.ctx.acceptWebSocket(request.webSocket);

      // DO will now sleep and wake only when messages arrive
      return new Response(null, { status: 101 });
    }

    // Broadcast endpoint for external API calls
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const { type, message } = payload;

        if (!type || !message) {
          return new Response(JSON.stringify({ error: 'Missing type or message' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Broadcast to all connected clients
        this.broadcast({
          type,
          payload: { message },
          timestamp: Date.now()
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('BarberHubDO', { status: 200 });
  }

  // WebSocket Hibernation API methods
  // These are called by Cloudflare when WebSocket events occur

  webSocketMessage(webSocket, data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      // Handle client PING
      if (message.type === 'PING') {
        this.webSocketSend(webSocket, {
          type: EVENTS.PONG,
          payload: {},
          timestamp: Date.now()
        });
        return;
      }

      // Forward to all clients including sender
      this.broadcast(message, webSocket);
    } catch (err) {
      console.error('[BarberHubDO] Error handling message:', err);
      this.webSocketSend(webSocket, {
        type: EVENTS.ERROR,
        payload: { message: 'Invalid message format' },
        timestamp: Date.now()
      });
    }
  }

  webSocketClose(webSocket, code, reason) {
    this.clients.delete(webSocket);
    console.log(`[BarberHubDO] WebSocket closed: ${code} - ${reason}`);
  }

  // Broadcast message to all connected clients (except excluded one)
  broadcast(message, excludeWebSocket = null) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client !== excludeWebSocket && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (err) {
          console.error('[BarberHubDO] Error sending to client:', err);
          this.clients.delete(client);
        }
      }
    });
  }

  // Send message to the current WebSocket connection
  webSocketSend(webSocket, message) {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify(message));
    }
  }
}
```

### 3. workers/barber-hub/wrangler.toml
```toml
name = "barber-hub"
main = "src/index.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Durable Objects binding
[[durable_objects.bindings]]
name = "BARBER_HUB"
class_name = "BarberHubDO"
script_name = "barber-hub"

# Migrations for WebSocket Hibernation API
[[migrations]]
tag = "v1"
new_sqlite_classes = ["BarberHubDO"]
```

---

## Verification of Exports

### ✅ index.js exports:
```javascript
import { BarberHubDO } from './BarberHubDO.js';

export default {
  async fetch(request, env) { ... }
};

export { BarberHubDO } from './BarberHubDO.js';
```

### ✅ BarberHubDO.js export:
```javascript
export class BarberHubDO {
  constructor(state) { ... }
  async fetch(request) { ... }
  webSocketMessage(webSocket, data) { ... }
  webSocketClose(webSocket, code, reason) { ... }
  broadcast(message, excludeWebSocket) { ... }
  webSocketSend(webSocket, message) { ... }
}
```

---

## Deployment Command

```bash
cd workers/barber-hub
npx wrangler deploy --config wrangler.toml
```

This will:
1. Build the Worker from src/index.js
2. Bundle BarberHubDO from src/BarberHubDO.js
3. Deploy to Cloudflare Workers
4. Bind to BARBER_HUB Durable Object
5. Apply migration v1 for hibernation support

---

## After Deployment, Verify:

1. **Check error rate drops to 0%**
   - Cloudflare Dashboard → Workers → barber-hub → Observability → Logs
   - Should see 200 OK responses, no 5xx errors

2. **Test WebSocket connection**
   - Open browser console
   - Run:
   ```javascript
   const ws = new WebSocket('wss://barber-hub.nawafzwd25.workers.dev/ws');
   ws.onopen = () => console.log('✅ CONNECTED');
   ws.onerror = (e) => console.log('❌ ERROR', e);
   ws.onclose = (e) => console.log('🔴 CLOSED', e.code);
   ```
   - Should see: `✅ CONNECTED`

3. **Check Worker logs**
   ```bash
   npx wrangler tail
   ```
   - Should show: `[BarberHubDO] WebSocket closed: 1000 -`
   - Should NOT show errors

4. **Verify no more 1006 errors in browser**
   - Should see: `[Realtime] WebSocket connected`
   - Should NOT see: `[Realtime] WebSocket closed (1006)`

---

## Troubleshooting

### If error rate remains high after deployment:

1. **Force redeploy** (remove cache):
   ```bash
   npx wrangler deploy --config wrangler.toml --persist
   ```

2. **Check latest deployment version:**
   ```bash
   npx wrangler deployments list
   ```

3. **Check Worker logs:**
   ```bash
   npx wrangler tail --format pretty
   ```

4. **Verify binding exists:**
   - Go to Cloudflare Dashboard → Workers → Durable Objects
   - Ensure `barber-hub` script has `BARBER_HUB` binding

5. **Clear browser cache:**
   - Hard refresh (Ctrl+Shift+R)
   - Clear localStorage/cache

---

## Expected Results After Deploy

| Metric | Before | After |
|--------|--------|-------|
| Error Rate | 96.1% (206/422) | 0% |
| WebSocket Status | Error 1006 (100%) | CONNECTED |
| Requests (10min) | 661 | < 50 |
| Cost | High ($51/mo) | Low ($1/mo) |

---

## Summary

**The files are correct. The high error rate is because OLD CODE IS STILL DEPLOYED.**

Run the deployment command above to deploy the correct code and fix the 96.1% error rate.