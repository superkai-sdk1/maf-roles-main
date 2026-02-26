const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PORT = 8081;
const LOG_FILE = path.join(__dirname, 'server.log');
const API_DIR = path.join(__dirname, 'api');
const ROOM_STATE_TTL = 3 * 60 * 60 * 1000;
const MESSAGE_LIMIT = 30;
const MESSAGE_INTERVAL = 5000;
const AVATARS_JSON_DIR = __dirname;
const AVATARS_JSON_TTL = 24 * 60 * 60 * 1000;

if (!fs.existsSync(API_DIR)) fs.mkdirSync(API_DIR, { recursive: true });

// ─── State ───────────────────────────────────────────────────────────────────

const roomStates = {};      // { code: { ...gameState } }
const roomTimeouts = {};    // { code: timeoutId }
const roomLastActive = {};  // { code: timestamp }
const activeCodes = {};     // { code: overlaySocketId }
const rateLimits = new WeakMap();

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  fs.appendFile(LOG_FILE, msg, () => {});
  console.log(...args);
}

// ─── Room code generation ────────────────────────────────────────────────────

function generateRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (activeCodes[code]);
  return code;
}

// ─── Room state persistence ──────────────────────────────────────────────────

function getRoomFile(code) {
  return path.join(API_DIR, `room_${code}.json`);
}

function saveRoomState(code) {
  try {
    fs.writeFileSync(getRoomFile(code), JSON.stringify(roomStates[code] || {}, null, 2));
  } catch (e) {
    log('Error saving room state:', e.message);
  }
}

function loadRoomState(code) {
  const file = getRoomFile(code);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return null;
}

function deleteRoomFile(code) {
  const file = getRoomFile(code);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// ─── Room cleanup ────────────────────────────────────────────────────────────

function scheduleCleanup(code) {
  clearCleanup(code);
  roomTimeouts[code] = setTimeout(() => {
    delete roomStates[code];
    delete roomLastActive[code];
    delete activeCodes[code];
    deleteRoomFile(code);
    log(`Room ${code} cleaned up after inactivity`);
  }, ROOM_STATE_TTL);
}

function clearCleanup(code) {
  if (roomTimeouts[code]) {
    clearTimeout(roomTimeouts[code]);
    delete roomTimeouts[code];
  }
}

// ─── Avatar persistence ──────────────────────────────────────────────────────

async function saveAvatarToDB(login, avatar) {
  const fetch = require('node-fetch');
  try {
    const player = { login, avatar };
    await fetch('http://localhost/api/players-add.php?za', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `player[]=${encodeURIComponent(JSON.stringify(player))}`
    });
  } catch (e) {
    log('Error saving avatar to DB:', e.message);
  }
}

async function loadGlobalAvatars() {
  const fetch = require('node-fetch');
  try {
    const res = await fetch('http://localhost/api/players-get.php?za&playerLogin[]=%25');
    const players = await res.json();
    const avatars = {};
    for (const p of players) {
      let login = null;
      try { login = JSON.parse(p.data).login; } catch {}
      if (login && p.avatar) avatars[login] = p.avatar;
    }
    return avatars;
  } catch (e) {
    log('Error loading global avatars:', e.message);
    return {};
  }
}

function cleanupAvatarsJsonFiles() {
  const now = Date.now();
  fs.readdir(AVATARS_JSON_DIR, (err, files) => {
    if (err) return;
    files.filter(f => /^avatars_\d{4}\.json$/.test(f)).forEach(f => {
      const fp = path.join(AVATARS_JSON_DIR, f);
      fs.stat(fp, (err, stat) => {
        if (err) return;
        if (now - (stat.atimeMs || stat.mtimeMs) > AVATARS_JSON_TTL) {
          fs.unlink(fp, () => {});
        }
      });
    });
  });
}
setInterval(cleanupAvatarsJsonFiles, 60 * 60 * 1000);

// ─── Rate limiting ───────────────────────────────────────────────────────────

function checkRateLimit(socket) {
  let info = rateLimits.get(socket) || { count: 0, ts: Date.now() };
  if (Date.now() - info.ts > MESSAGE_INTERVAL) {
    info = { count: 0, ts: Date.now() };
  }
  info.count++;
  rateLimits.set(socket, info);
  return info.count <= MESSAGE_LIMIT;
}

// ─── Socket.IO Server ────────────────────────────────────────────────────────

const io = new Server(PORT, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

let globalAvatars = {};
loadGlobalAvatars().then(a => { globalAvatars = a; });

io.on('connection', (socket) => {
  let role = null;    // 'overlay' | 'panel'
  let roomCode = null;

  log(`Connection: ${socket.id}`);

  // ── Overlay connects, gets a room code ──
  socket.on('overlay:init', () => {
    role = 'overlay';
    roomCode = generateRoomCode();
    activeCodes[roomCode] = socket.id;
    roomStates[roomCode] = roomStates[roomCode] || {};
    clearCleanup(roomCode);
    roomLastActive[roomCode] = Date.now();

    socket.join(roomCode);
    socket.emit('overlay:roomCode', { code: roomCode });
    log(`Overlay ${socket.id} created room ${roomCode}`);
  });

  // ── Panel joins by code ──
  socket.on('panel:join', (data) => {
    const code = String(data?.code || '').trim();
    if (!code || !activeCodes[code]) {
      socket.emit('panel:error', { message: 'Invalid room code' });
      return;
    }

    role = 'panel';
    roomCode = code;
    clearCleanup(roomCode);
    roomLastActive[roomCode] = Date.now();

    socket.join(roomCode);

    const state = roomStates[roomCode] || {};
    const mergedAvatars = { ...globalAvatars, ...(state.avatars || {}) };

    socket.emit('panel:joined', {
      code: roomCode,
      state: { ...state, avatars: mergedAvatars },
    });

    socket.to(roomCode).emit('overlay:hostConnected', { panelId: socket.id });
    log(`Panel ${socket.id} joined room ${roomCode}`);
  });

  // ── State updates from panel ──
  socket.on('state:update', (data) => {
    if (role !== 'panel' || !roomCode) return;
    if (!checkRateLimit(socket)) { socket.disconnect(true); return; }

    roomLastActive[roomCode] = Date.now();
    roomStates[roomCode] = roomStates[roomCode] || {};

    if (data.avatars) {
      roomStates[roomCode].avatars = { ...(roomStates[roomCode].avatars || {}), ...data.avatars };
    }

    for (const [key, value] of Object.entries(data)) {
      if (key === 'avatars') continue;
      roomStates[roomCode][key] = value;
    }

    saveRoomState(roomCode);
    socket.to(roomCode).emit('state:update', data);
  });

  // ── Full state sync from panel ──
  socket.on('state:full', (data) => {
    if (role !== 'panel' || !roomCode) return;
    if (!checkRateLimit(socket)) { socket.disconnect(true); return; }

    roomLastActive[roomCode] = Date.now();

    const prevAvatars = roomStates[roomCode]?.avatars || {};
    roomStates[roomCode] = { ...data, avatars: { ...prevAvatars, ...(data.avatars || {}) } };

    saveRoomState(roomCode);
    socket.to(roomCode).emit('state:full', roomStates[roomCode]);
  });

  // ── Avatar change ──
  socket.on('avatar:change', async (data) => {
    if (role !== 'panel' || !roomCode) return;
    if (!data?.login || !data?.avatar) return;

    roomStates[roomCode] = roomStates[roomCode] || {};
    roomStates[roomCode].avatars = roomStates[roomCode].avatars || {};
    roomStates[roomCode].avatars[data.login] = data.avatar;
    globalAvatars[data.login] = data.avatar;

    await saveAvatarToDB(data.login, data.avatar);
    saveRoomState(roomCode);
    socket.to(roomCode).emit('state:update', { avatars: roomStates[roomCode].avatars });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    log(`Disconnected: ${socket.id} (role=${role}, room=${roomCode})`);

    if (!roomCode) return;

    if (role === 'overlay') {
      delete activeCodes[roomCode];
      io.to(roomCode).emit('overlay:closed');
      scheduleCleanup(roomCode);
    }

    if (role === 'panel') {
      socket.to(roomCode).emit('overlay:hostDisconnected');
      const room = io.sockets.adapter.rooms.get(roomCode);
      const hasClients = room && room.size > 0;
      if (!hasClients) {
        scheduleCleanup(roomCode);
      }
    }
  });
});

console.log(`Socket.IO server running on port ${PORT}`);
