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
