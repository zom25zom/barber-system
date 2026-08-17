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
