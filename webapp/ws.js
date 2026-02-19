// ws-server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const LOG_FILE = path.join(__dirname, 'ws.log');
const STATE_FILE = path.join(__dirname, 'roomStates.json');
const MESSAGE_HISTORY_LIMIT = 100;
const API_DIR = path.join(__dirname, 'api');
const ROOM_STATE_TTL = 3 * 60 * 60 * 1000; // 3 hours

// { roomId: [ { message, timestamp } ] }
const roomMessages = {};

const rooms = {}; // { roomId: Set of sockets }
const roomStates = {}; // { roomId: lastStateObject }
const activePanels = {}; // { roomId: panelId }

function sendToRoom(roomId, data, exceptSocket = null) {
    if (!rooms[roomId]) return;
    for (const sock of rooms[roomId]) {
        if (sock !== exceptSocket && sock.readyState === WebSocket.OPEN) {
            try {
                sock.send(JSON.stringify(data));
            } catch (e) {
                console.error('Send error:', e);
            }
        }
    }
}

const MESSAGE_LIMIT = 30; // сообщений в 5 секунд
const MESSAGE_INTERVAL = 5000;
const socketMessageCounts = new WeakMap();

const ROOM_TTL = 10 * 60 * 1000; // 10 минут в миллисекундах
const roomTimeouts = {}; // { roomId: timeoutObject }
const roomLastActive = {}; // { roomId: timestamp }

const AVATARS_JSON_DIR = __dirname; // где лежат avatars_*.json
const AVATARS_JSON_TTL = 24 * 60 * 60 * 1000; // 1 сутки в мс

// --- Удаление avatars_*.json, если не обращались более суток ---
function cleanupAvatarsJsonFiles() {
    const now = Date.now();
    fs.readdir(AVATARS_JSON_DIR, (err, files) => {
        if (err) return;
        files.filter(f => /^avatars_\d{4}\.json$/.test(f)).forEach(f => {
            const filePath = path.join(AVATARS_JSON_DIR, f);
            fs.stat(filePath, (err, stat) => {
                if (err) return;
                // Проверяем время последнего доступа (atime)
                const lastAccess = stat.atimeMs || stat.mtimeMs || stat.ctimeMs;
                if (now - lastAccess > AVATARS_JSON_TTL) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}
// Запускать очистку раз в час
setInterval(cleanupAvatarsJsonFiles, 60 * 60 * 1000);

// --- Логирование ---
function logEvent(...args) {
    const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    fs.appendFile(LOG_FILE, msg, () => {});
    console.log(...args);
}

// --- История сообщений ---
function addRoomMessage(roomId, message) {
    roomMessages[roomId] = roomMessages[roomId] || [];
    roomMessages[roomId].push({ message, timestamp: Date.now() });
    if (roomMessages[roomId].length > MESSAGE_HISTORY_LIMIT) {
        roomMessages[roomId].shift();
    }
}

// --- Сохранение/загрузка состояния ---
function saveRoomStates() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(roomStates, null, 2));
    } catch (e) {
        logEvent('Ошибка сохранения состояния:', e);
    }
}
function loadRoomStates() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            Object.assign(roomStates, JSON.parse(data));
        } else {
            loadAvatarsFromDB();
        }
    } catch (e) {
        logEvent('Ошибка загрузки состояния:', e);
    }
}
loadRoomStates();

// --- Загрузка avatars из базы при старте сервера ---
async function loadAvatarsFromDB() {
    const fetch = require('node-fetch');
    try {
        // Получить всех игроков с аватарами
        const res = await fetch('http://localhost:31006/api/players-get.php?za&playerLogin[]=%25');
        const players = await res.json();
        for (const p of players) {
            let login = null;
            try {
                login = JSON.parse(p.data).login;
            } catch {}
            if (login && p.avatar) {
                if (!roomStates.global) roomStates.global = {};
                if (!roomStates.global.avatars) roomStates.global.avatars = {};
                roomStates.global.avatars[login] = p.avatar;
            }
        }
    } catch (e) {
        logEvent('Ошибка загрузки avatars из БД:', e);
    }
}

async function saveAvatarToDB(login, avatar) {
    const fetch = require('node-fetch');
    try {
        const player = { login, avatar };
        await fetch('http://localhost:31006/api/players-add.php?za', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `player[]=${encodeURIComponent(JSON.stringify(player))}`
        });
    } catch (e) {
        logEvent('Ошибка сохранения avatar в БД:', e);
    }
}

// --- Мониторинг ---
function getStats() {
    return {
        rooms: Object.keys(rooms).length,
        roomIds: Object.keys(rooms),
        users: Object.values(rooms).reduce((a, s) => a + s.size, 0),
        roomStates: Object.keys(roomStates).length
    };
}

// --- Админ-команды ---
function handleAdminCommand(ws, data, currentRoom) {
    if (!data.admin) return false;
    if (data.cmd === 'kick' && currentRoom && data.target) {
        // Кикнуть пользователя по id (не реализовано, нужен id сокета)
        // Можно реализовать через ws._id, если назначить id при подключении
        return true;
    }
    if (data.cmd === 'resetRoom' && currentRoom) {
        roomStates[currentRoom] = {};
        roomMessages[currentRoom] = [];
        sendToRoom(currentRoom, { type: 'state', reset: true });
        logEvent(`Room ${currentRoom} reset by admin`);
        saveRoomStates();
        return true;
    }
    if (data.cmd === 'getStats') {
        ws.send(JSON.stringify({ type: 'stats', stats: getStats() }));
        return true;
    }
    if (data.cmd === 'getHistory' && currentRoom) {
        ws.send(JSON.stringify({ type: 'history', history: roomMessages[currentRoom] || [] }));
        return true;
    }
    return false;
}

function getRoomStateFile(roomId) {
    return path.join(API_DIR, `room_${roomId}.json`);
}

function saveRoomStateToFile(roomId) {
    const file = getRoomStateFile(roomId);
    try {
        fs.writeFileSync(file, JSON.stringify(roomStates[roomId] || {}, null, 2));
    } catch (e) {
        logEvent('Ошибка сохранения room state:', e);
    }
}

function loadRoomStateFromFile(roomId) {
    const file = getRoomStateFile(roomId);
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            logEvent('Ошибка чтения room state:', e);
        }
    }
    return null;
}

function deleteRoomStateFile(roomId) {
    const file = getRoomStateFile(roomId);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

function scheduleRoomCleanup(roomId) {
    clearRoomTimeout(roomId);
    roomTimeouts[roomId] = setTimeout(() => {
        delete rooms[roomId];
        delete roomStates[roomId];
        delete roomMessages[roomId];
        delete roomLastActive[roomId];
        deleteRoomStateFile(roomId);
        saveRoomStates();
        logEvent(`Room ${roomId} deleted after inactivity`);
    }, ROOM_STATE_TTL);
}

function clearRoomTimeout(roomId) {
    if (roomTimeouts[roomId]) {
        clearTimeout(roomTimeouts[roomId]);
        delete roomTimeouts[roomId];
    }
}

wss.on('connection', function connection(ws) {
    let currentRoom = null;
    let panelId = uuidv4();

    logEvent('New connection');

    ws.on('message', async function incoming(message) {
        // --- антифлуд ---
        let count = socketMessageCounts.get(ws) || { cnt: 0, ts: Date.now() };
        if (Date.now() - count.ts > MESSAGE_INTERVAL) {
            count = { cnt: 0, ts: Date.now() };
        }
        count.cnt++;
        socketMessageCounts.set(ws, count);
        if (count.cnt > MESSAGE_LIMIT) {
            ws.close();
            return;
        }
        // --- конец антифлуд ---

        let data;
        try { data = JSON.parse(message); } catch { return; }

        // --- обработка panelId при входе ---
        if (data.joinRoom) {
            currentRoom = data.joinRoom;
            if (!rooms[currentRoom]) {
                rooms[currentRoom] = new Set();
            }
            ws.panelId = panelId;
            rooms[currentRoom].add(ws);

            // --- Load state from file if exists ---
            let loadedState = loadRoomStateFromFile(currentRoom);
            if (loadedState) {
                roomStates[currentRoom] = loadedState;
            }

            // --- новая панель становится главной ---
            activePanels[currentRoom] = panelId;
            sendToRoom(currentRoom, { type: "activePanelChanged", activePanelId: panelId });

            // Сбросить таймер удаления комнаты
            clearRoomTimeout(currentRoom);
            roomLastActive[currentRoom] = Date.now();

            ws.send(JSON.stringify({ joinedRoom: currentRoom, panelId }));

            // --- Просто сообщаем всем, кто сейчас активная панель ---
            sendToRoom(currentRoom, { type: "activePanelChanged", activePanelId: panelId });

            // --- avatars: объединяем room и global ---
            const stateToSend = roomStates[currentRoom] || {};
            if (!stateToSend.avatars) stateToSend.avatars = {};
            // merge global avatars if not present
            if (roomStates.global && roomStates.global.avatars) {
                for (const [login, avatar] of Object.entries(roomStates.global.avatars)) {
                    if (!stateToSend.avatars[login]) {
                        stateToSend.avatars[login] = avatar;
                    }
                }
            }
            // --- всегда отправлять avatars клиенту ---
            ws.send(JSON.stringify({ type: "state", ...stateToSend, avatars: stateToSend.avatars, activePanelId: panelId }));

            // Отправить историю сообщений
            if (roomMessages[currentRoom] && roomMessages[currentRoom].length) {
                ws.send(JSON.stringify({ type: 'history', history: roomMessages[currentRoom] }));
            }
        } else {
            // --- обработка запроса на активацию панели ---
            if (data.type === "activatePanel" && data.panelId) {
                // Удалить весь блок обработки activatePanel
                return;
            }            // --- Различаем panel.html и roles.html ---
            const isPanelHtml = ws.panelId && activePanels[currentRoom] === ws.panelId;
            const isRolesHtml = !ws.panelId;

            // --- Блокируем изменения от roles.html ---
            if (isRolesHtml && (
                data.type === "actionChange" ||
                data.type === "roleChange" ||
                data.type === "avatarChange" ||
                data.type === "highlight" ||
                data.type === "panelStateChange" ||
                data.type === "bestMoveChange" ||
                data.type === "bestMoveConfirm" ||
                data.type === "state" ||
                data.type === "reset"
            )) {
                // roles.html не может отправлять никаких изменений состояния
                logEvent(`Blocked ${data.type} from roles.html in room ${currentRoom}`);
                return;
            }

            // --- только активная панель может отправлять изменения ---
            if (currentRoom && !isRolesHtml) {
                // Разрешаем только активной панели отправлять изменения (кроме ping)
                if (
                    data.type !== "ping" &&
                    data.type !== "activePanelChanged" &&
                    data.type !== "activatePanel" &&
                    !isPanelHtml
                ) {
                    // Неактивная панель не может отправлять изменения
                    ws.send(JSON.stringify({ type: "notActivePanel", activePanelId: activePanels[currentRoom] }));
                    return;
                }
            }

            if (!currentRoom) return;

            roomLastActive[currentRoom] = Date.now();

            // --- Save state to file on every change ---
            function saveAndSend(type, obj) {
                saveRoomStateToFile(currentRoom);
                sendToRoom(currentRoom, obj, ws);
                addRoomMessage(currentRoom, data);
            }

            if (data.type === "avatarChange") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].avatars = roomStates[currentRoom].avatars || {};
                // --- определяем login для roleKey ---
                let login = data.login || data.roleKey;
                // Если data содержит login, используем его, иначе используем roleKey (fallback)
                roomStates[currentRoom].avatars[login] = data.avatar;
                await saveAvatarToDB(login, data.avatar);
                if (!roomStates.global) roomStates.global = {};
                if (!roomStates.global.avatars) roomStates.global.avatars = {};
                roomStates.global.avatars[login] = data.avatar;
                saveAndSend("avatarChange", { type: "avatarChange", roleKey: data.roleKey, avatar: data.avatar });
                return;
            }
            if (data.type === "roleChange") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].roles = roomStates[currentRoom].roles || {};
                if (data.role) {
                    roomStates[currentRoom].roles[data.roleKey] = data.role;
                } else {
                    delete roomStates[currentRoom].roles[data.roleKey];
                }
                saveAndSend("roleChange", { type: "roleChange", roleKey: data.roleKey, role: data.role });
                return;
            }
            if (data.type === "actionChange") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].playersActions = roomStates[currentRoom].playersActions || {};
                if (data.action) {
                    roomStates[currentRoom].playersActions[data.roleKey] = data.action;
                } else {
                    delete roomStates[currentRoom].playersActions[data.roleKey];
                }
                saveAndSend("actionChange", { type: "actionChange", roleKey: data.roleKey, action: data.action });
                return;
            }
            if (data.type === "highlight") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].highlightedPlayer = data.roleKey;
                saveAndSend("highlight", { type: "highlight", roleKey: data.roleKey });
                return;
            }
            if (data.type === "panelStateChange") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].panelState = Object.assign({}, roomStates[currentRoom].panelState, data.panelState);
                saveAndSend("panelStateChange", { type: "panelStateChange", panelState: data.panelState });
                return;
            }
            if (data.type === "bestMoveChange") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].bestMoveData = {
                    bestMove: data.bestMove,
                    firstKilledPlayer: data.firstKilledPlayer
                };
                saveAndSend("bestMoveChange", { type: "bestMoveChange", bestMove: data.bestMove, firstKilledPlayer: data.firstKilledPlayer });
                return;
            }
            if (data.type === "bestMoveConfirm") {
                roomStates[currentRoom] = roomStates[currentRoom] || {};
                roomStates[currentRoom].bestMoveData = {
                    bestMove: data.bestMove,
                    firstKilledPlayer: data.firstKilledPlayer,
                    confirmed: true
                };
                saveAndSend("bestMoveConfirm", { type: "bestMoveConfirm", bestMove: data.bestMove, firstKilledPlayer: data.firstKilledPlayer });
                return;
            }
            if (data.type === "reset") {
                // --- не очищать avatars при reset ---
                const avatarsBackup = roomStates[currentRoom]?.avatars || {};
                roomStates[currentRoom] = {};
                roomStates[currentRoom].avatars = avatarsBackup;
                saveAndSend("reset", { type: "reset", avatars: avatarsBackup });
                return;
            }            // --- Полная синхронизация (legacy) ---
            if (data.type === "state") {
                // ИСПРАВЛЕНО: Сохраняем playersActions от перезаписи при полной синхронизации
                const prevPlayersActions = roomStates[currentRoom]?.playersActions || {};
                
                // --- сохраняем avatars отдельно и не затираем их ---
                roomStates[currentRoom] = { ...data };
                
                // Восстанавливаем playersActions
                roomStates[currentRoom].playersActions = prevPlayersActions;
                
                // если были avatars ранее — восстанавливаем их
                if (roomStates[currentRoom].avatars == null) {
                    // если были avatars в предыдущем состоянии — не теряем их
                    const prevAvatars = roomStates[currentRoom]?.avatars;
                    if (prevAvatars) {
                        roomStates[currentRoom].avatars = prevAvatars;
                    } else if (fs.existsSync(path.join(API_DIR, `avatars_${currentRoom}.json`))) {
                        // если есть avatars_<roomId>.json — подгружаем их
                        try {
                            const avatarsJson = fs.readFileSync(path.join(API_DIR, `avatars_${currentRoom}.json`), 'utf8');
                            roomStates[currentRoom].avatars = JSON.parse(avatarsJson);
                        } catch {}
                    } else {
                        roomStates[currentRoom].avatars = {};
                    }
                }
                saveRoomStateToFile(currentRoom);
                sendToRoom(currentRoom, roomStates[currentRoom], ws);
                addRoomMessage(currentRoom, data);
                return;
            }
            // Любое другое изменение: рассылаем всем кроме отправителя (но не сохраняем)
            sendToRoom(currentRoom, data, ws);
            addRoomMessage(currentRoom, data);
        }
    });

    ws.on('close', function() {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].delete(ws);
            // Если закрылась активная панель — сбросить активную панель
            if (activePanels[currentRoom] === ws.panelId) {
                activePanels[currentRoom] = null;
                sendToRoom(currentRoom, { type: "activePanelChanged", activePanelId: null });
            }
            if (rooms[currentRoom].size === 0) {
                roomLastActive[currentRoom] = Date.now();
                scheduleRoomCleanup(currentRoom);
            }
        }
        logEvent('Connection closed');
    });
});

console.log('WebSocket server running on ws://localhost:8081');