import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:8081`
  : undefined; // same origin in production (nginx proxies /socket.io/)

function createSocket() {
  const opts = {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  };
  return SOCKET_URL ? io(SOCKET_URL, opts) : io(opts);
}

// ─── Panel connection ────────────────────────────────────────────────────────

export function createPanelConnection(roomCode, { onJoined, onStateUpdate, onError, onDisconnect }) {
  const socket = createSocket();
  let debounceTimer = null;

  socket.on('connect', () => {
    socket.emit('panel:join', { code: roomCode });
  });

  socket.on('panel:joined', (data) => {
    onJoined?.(data);
  });

  socket.on('panel:error', (data) => {
    onError?.(data?.message || 'Connection error');
  });

  socket.on('state:update', (data) => {
    onStateUpdate?.(data);
  });

  socket.on('state:full', (data) => {
    onStateUpdate?.(data);
  });

  socket.on('overlay:closed', () => {
    onDisconnect?.('overlay_closed');
  });

  socket.on('disconnect', () => {
    onDisconnect?.('disconnected');
  });

  return {
    emit(event, data) {
      if (socket.connected) socket.emit(event, data);
    },

    sendUpdate(partialState) {
      if (socket.connected) socket.emit('state:update', partialState);
    },

    sendUpdateDebounced(partialState) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (socket.connected) socket.emit('state:update', partialState);
      }, 80);
    },

    sendFull(fullState) {
      if (socket.connected) socket.emit('state:full', fullState);
    },

    sendAvatarChange(login, avatar) {
      if (socket.connected) socket.emit('avatar:change', { login, avatar });
    },

    close() {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.removeAllListeners();
      socket.disconnect();
    },

    get connected() {
      return socket.connected;
    },
  };
}

// ─── Overlay connection ──────────────────────────────────────────────────────

export function createOverlayConnection({ onRoomCode, onHostConnected, onHostDisconnected, onStateUpdate, onOverlayClosed }) {
  const socket = createSocket();

  socket.on('connect', () => {
    socket.emit('overlay:init');
  });

  socket.on('overlay:roomCode', (data) => {
    onRoomCode?.(data.code);
  });

  socket.on('overlay:hostConnected', () => {
    onHostConnected?.();
  });

  socket.on('overlay:hostDisconnected', () => {
    onHostDisconnected?.();
  });

  socket.on('overlay:closed', () => {
    onOverlayClosed?.();
  });

  socket.on('state:update', (data) => {
    onStateUpdate?.(data);
  });

  socket.on('state:full', (data) => {
    onStateUpdate?.(data);
  });

  socket.on('disconnect', () => {
    onHostDisconnected?.();
  });

  return {
    close() {
      socket.removeAllListeners();
      socket.disconnect();
    },

    get connected() {
      return socket.connected;
    },
  };
}
