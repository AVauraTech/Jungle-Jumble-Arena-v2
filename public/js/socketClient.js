/**
 * socketClient.js
 * Real-time WebSocket connection manager and latency monitor using Socket.io.
 */

/* global io */

export class SocketClient {
  constructor() {
    this.socket = null;
    this.ping = 0;
    this.pingInterval = null;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io({
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        // console.log('[Socket] Connected to server, ID:', this.socket.id);
        this.startPingMonitor();
        resolve(this.socket);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });

      this.socket.on('disconnect', () => {
        clearInterval(this.pingInterval);
      });
    });
  }

  startPingMonitor() {
    clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) return;
      const start = Date.now();
      this.socket.volatile.emit('ping:check', () => {
        this.ping = Date.now() - start;
        const pingEl = document.getElementById('ping-indicator');
        if (pingEl) {
          pingEl.textContent = `${this.ping}ms`;
          pingEl.className = this.ping < 60 ? 'ping-good' : (this.ping < 140 ? 'ping-med' : 'ping-poor');
        }
      });
    }, 4000);
  }

  on(event, handler) {
    if (!this.socket) return;
    this.socket.on(event, handler);
  }

  emit(event, data, callback) {
    if (!this.socket) return;
    this.socket.emit(event, data, callback);
  }

  getId() {
    return this.socket ? this.socket.id : null;
  }
}

export const network = new SocketClient();
