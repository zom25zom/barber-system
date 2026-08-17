// BarberHub Durable Object - manages WebSocket connections with hibernation
// DO sleeps between messages = near-zero cost when idle
// Uses WebSocket Hibernation API: state.acceptWebSocket(ws)

let clients = new Set();

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
    this.ws = null;
    clients = new Set(); // Shared across instances
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Broadcast endpoint for external API calls
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const payload = await request.json();
      const { type, message } = payload;

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
    }

    return new Response('BarberHubDO', { status: 200 });
  }

  async acceptWebSocket(webSocket) {
    this.ws = webSocket;
    clients.add(this.ws);

    // Hibernation API - DO will sleep between messages
    // Only these handlers will be called when messages arrive
    webSocket.addEventListener('message', (event) => {
      this.webSocketMessage(webSocket, event.data);
    });

    // Handle client PING
    webSocket.addEventListener('ping', (event) => {
      this.send({
        type: EVENTS.PONG,
        payload: {},
        timestamp: Date.now()
      });
    });

    webSocket.addEventListener('close', (event) => {
      this.webSocketClose(webSocket, event.code, event.reason);
    });

    webSocket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
      this.webSocketClose(webSocket, 1011, 'WebSocket error');
    });

    // DO enters hibernation - will wake up only when messages arrive
  }

  webSocketMessage(webSocket, message) {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      // Handle client PING
      if (data.type === 'PING') {
        this.send({
          type: EVENTS.PONG,
          payload: {},
          timestamp: Date.now()
        });
        return;
      }

      // Forward to all clients including sender
      this.broadcast(data, webSocket);
    } catch (err) {
      console.error('Error handling message:', err);
      this.send({
        type: EVENTS.ERROR,
        payload: { message: 'Invalid message format' },
        timestamp: Date.now()
      });
    }
  }

  webSocketClose(webSocket, code, reason) {
    clients.delete(webSocket);
    console.log(`WebSocket closed: ${code} - ${reason}`);
  }

  broadcast(message, excludeWebSocket = null) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client !== excludeWebSocket && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (err) {
          console.error('Error sending to client:', err);
          clients.delete(client);
        }
      }
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
