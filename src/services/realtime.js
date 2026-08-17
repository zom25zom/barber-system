/**
 * RealtimeService — WebSocket-first real-time client
 *
 * Opens a persistent WebSocket connection to the BarberHubDO Durable Object
 * via /api/ws. When the server pushes an event, all subscribers are notified
 * instantly (< 200ms), eliminating polling overhead.
 *
 * Fallback strategy:
 *   - If the WebSocket cannot connect (local dev without DO, network error, etc.)
 *     `isConnected` stays false and SystemContext falls back to 30s polling.
 *   - Auto-reconnect with exponential backoff (1s → 2s → 4s … up to 30s max).
 *
 * Cross-tab sync (same device):
 *   - Still uses BroadcastChannel so that multiple tabs on the same device share
 *     state without each opening its own WebSocket.
 *
 * Public API (unchanged from the old version so no consumer code changes):
 *   realtime.subscribe(callback)   → returns unsubscribe fn
 *   realtime.emit(type, payload)   → local + cross-tab broadcast (no WS send)
 *   realtime.isConnected           → boolean
 */

class RealtimeService {
  constructor() {
    this._listeners = new Set();
    this._ws = null;
    this._reconnectDelay = 1000;   // starts at 1s, doubles up to MAX
    this._maxDelay = 30000;         // 30 second ceiling
    this._pingInterval = null;
    this._reconnectTimer = null;
    this._destroyed = false;
    this._connected = false;

    // BroadcastChannel for same-device cross-tab sync (still useful)
    this._bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('barber_system_realtime')
      : null;

    if (this._bc) {
      this._bc.onmessage = (event) => {
        // Only forward tab-originated events (not server-push events already
        // received on this tab's WebSocket connection)
        if (event.data && event.data._source !== 'ws') {
          this._notifyListeners(event.data);
        }
      };
    }

    // Auto-connect in browser environments
    if (typeof window !== 'undefined') {
      this._connect();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get isConnected() {
    return this._connected;
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Emit a local event (for within-tab and cross-tab sync).
   * This does NOT send anything over the WebSocket — the server is the
   * authoritative event source. Use this for optimistic local-only updates.
   */
  emit(type, payload) {
    const data = { type, payload, timestamp: Date.now() };
    // Broadcast to other tabs
    if (this._bc) {
      this._bc.postMessage(data);
    }
    this._notifyListeners(data);
  }

  destroy() {
    this._destroyed = true;
    this._stopPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close(1000, 'destroyed');
      this._ws = null;
    }
    if (this._bc) {
      this._bc.close();
      this._bc = null;
    }
  }

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────

  _connect() {
    if (this._destroyed) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      this._ws = new WebSocket(wsUrl);

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectDelay = 1000; // reset backoff on success
        this._startPing();
        console.debug('[Realtime] WebSocket connected');
      };

      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Ignore infrastructure messages
          if (data.type === 'WS_CONNECTED') return;
          if (data.type === 'PING') {
            // Respond to client ping
            if (this._ws && this._ws.readyState === WebSocket.OPEN) {
              try {
                this._ws.send(JSON.stringify({ type: 'PONG' }));
              } catch (_) {}
            }
            return;
          }

          // Tag the event so BroadcastChannel re-broadcasts don't loop
          const tagged = { ...data, _source: 'ws' };

          // Forward to other tabs via BroadcastChannel
          if (this._bc) {
            try { this._bc.postMessage(tagged); } catch (_) {}
          }

          this._notifyListeners(data);
        } catch (err) {
          console.warn('[Realtime] Message parse error:', err);
        }
      };

      this._ws.onerror = (err) => {
        // onerror is always followed by onclose — handle reconnect there
        console.debug('[Realtime] WebSocket error:', err.message || err);
      };

      this._ws.onclose = (event) => {
        this._connected = false;
        this._stopPing();
        this._ws = null;

        if (this._destroyed) return;

        // Only reconnect on abnormal closures
        if (event.code !== 1000) {
          console.debug(`[Realtime] WebSocket closed (${event.code}), reconnecting in ${this._reconnectDelay}ms`);
          this._scheduleReconnect();
        }
      };

    } catch (err) {
      // WebSocket constructor itself threw (e.g. in SSR / non-browser env)
      console.debug('[Realtime] WebSocket unavailable:', err.message);
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, this._reconnectDelay);

    // Exponential backoff with jitter
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxDelay);
  }

  _startPing() {
    this._stopPing();
    // Send a PING every 25s to keep the connection alive through proxies
    this._pingInterval = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        try {
          this._ws.send(JSON.stringify({ type: 'PING' }));
        } catch (_) {}
      }
    }, 25000);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _notifyListeners(data) {
    this._listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('[Realtime] Listener error:', err);
      }
    });
  }
}

export const realtime = new RealtimeService();
