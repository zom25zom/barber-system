// Real-time notification and queue listener service

class RealtimeService {
  constructor() {
    this.listeners = new Set();
    this.channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('barber_system_realtime')
      : null;

    if (this.channel) {
      this.channel.onmessage = (event) => {
        this.notifyListeners(event.data);
      };
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('Realtime listener error:', err);
      }
    });
  }

  emit(type, payload) {
    const data = { type, payload, timestamp: Date.now() };
    if (this.channel) {
      this.channel.postMessage(data);
    }
    this.notifyListeners(data);
  }
}

export const realtime = new RealtimeService();
