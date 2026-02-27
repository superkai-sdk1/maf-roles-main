const STORAGE_KEY = 'mafboard_sessions';
const TOMBSTONE_KEY = 'mafboard_deleted';
const SYNC_API = '/api/sessions-sync.php';
const MAX_SESSIONS = 50;
const SESSION_TTL = 365 * 24 * 60 * 60 * 1000;
const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000;
const SERVER_PUSH_DEBOUNCE = 2000;

class SessionManager {
  constructor() {
    this._deletedIds = this._loadTombstones();
    this._sessions = this._loadFromStorage();
    this._authToken = null;
    this._pushTimer = null;
  }

  setAuthToken(token) {
    this._authToken = token;
  }

  // Server is the source of truth. On sync:
  // 1. Fetch server data (sessions + tombstones)
  // 2. Merge server tombstones into local
  // 3. Replace local sessions with server sessions (filtered by local tombstones)
  // 4. Merge any local-only sessions into the set
  // 5. Push combined state back to server
  async syncWithServer() {
    const token = this._authToken;
    if (!token) return;
    try {
      const res = await fetch(`${SYNC_API}?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = await res.json();

      // Merge server tombstones into local set
      if (Array.isArray(data.deleted)) {
        const now = Date.now();
        for (const d of data.deleted) {
          if (d.id && d.ts && (now - d.ts) < TOMBSTONE_TTL) {
            this._deletedIds.add(d.id);
          }
        }
        this._saveTombstones();
      }

      if (Array.isArray(data.sessions)) {
        // Build map from server sessions (authoritative), excluding tombstoned
        const serverMap = new Map();
        for (const s of data.sessions) {
          if (s.sessionId && !this._deletedIds.has(s.sessionId)) {
            serverMap.set(s.sessionId, s);
          }
        }

        // Merge local-only sessions (ones not on server yet) into the map
        for (const s of this._sessions) {
          if (this._deletedIds.has(s.sessionId)) continue;
          const serverVersion = serverMap.get(s.sessionId);
          if (!serverVersion) {
            serverMap.set(s.sessionId, s);
          } else {
            const localTs = s.updatedAt || s.timestamp || 0;
            const remoteTs = serverVersion.updatedAt || serverVersion.timestamp || 0;
            if (localTs > remoteTs) {
              serverMap.set(s.sessionId, s);
            }
          }
        }

        this._sessions = Array.from(serverMap.values())
          .sort((a, b) => (b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0))
          .slice(0, MAX_SESSIONS);
        this._saveToStorage();
      }

      // Push local state (including tombstones) to server
      this._pushToServerNow();
    } catch { /* ignore */ }
  }

  _schedulePush() {
    if (!this._authToken) return;
    if (this._pushTimer) clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this._pushTimer = null;
      this._pushToServerNow();
    }, SERVER_PUSH_DEBOUNCE);
  }

  async _pushToServerNow() {
    const token = this._authToken;
    if (!token) return;
    try {
      const sessions = this._sessions.map(s => ({
        ...s,
        timestamp: s.updatedAt || s.timestamp || Date.now(),
      }));
      await fetch(SYNC_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sessions, deleted: this._getTombstoneEntries() }),
      });
    } catch { /* ignore */ }
  }

  _getTombstoneEntries() {
    try {
      const raw = localStorage.getItem(TOMBSTONE_KEY);
      if (!raw) return [];
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return [];
      const now = Date.now();
      return entries.filter(e => e.id && e.ts && (now - e.ts) < TOMBSTONE_TTL);
    } catch {
      return [];
    }
  }

  // Build sendBeacon payload (used by GameContext beforeunload)
  buildBeaconPayload() {
    const token = this._authToken;
    if (!token) return null;
    const sessions = this._sessions.map(s => ({
      ...s,
      timestamp: s.updatedAt || s.timestamp || Date.now(),
    }));
    return JSON.stringify({ token, sessions, deleted: this._getTombstoneEntries() });
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions = JSON.parse(raw);
      const now = Date.now();
      return sessions.filter(s =>
        (!s.updatedAt || (now - s.updatedAt) < SESSION_TTL) &&
        !this._deletedIds.has(s.sessionId)
      );
    } catch (e) {
      return [];
    }
  }

  _loadTombstones() {
    try {
      const raw = localStorage.getItem(TOMBSTONE_KEY);
      if (!raw) return new Set();
      const entries = JSON.parse(raw);
      const now = Date.now();
      const alive = entries.filter(e => (now - e.ts) < TOMBSTONE_TTL);
      if (alive.length !== entries.length) {
        localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(alive));
      }
      return new Set(alive.map(e => e.id));
    } catch {
      return new Set();
    }
  }

  _saveTombstones() {
    try {
      const entries = this._getTombstoneEntries();
      // Merge any new IDs from _deletedIds that aren't in entries yet
      const existingSet = new Set(entries.map(e => e.id));
      const now = Date.now();
      for (const id of this._deletedIds) {
        if (!existingSet.has(id)) {
          entries.push({ id, ts: now });
        }
      }
      localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(entries));
    } catch { /* ignore */ }
  }

  _addTombstones(sessionIds) {
    const now = Date.now();
    for (const id of sessionIds) {
      this._deletedIds.add(id);
    }
    try {
      const raw = localStorage.getItem(TOMBSTONE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const existingSet = new Set(existing.map(e => e.id));
      for (const id of sessionIds) {
        if (!existingSet.has(id)) {
          existing.push({ id, ts: now });
        }
      }
      localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
  }

  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._sessions));
    } catch (e) {
      console.error('SessionManager: save error', e);
    }
  }

  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  getSessions() {
    return [...this._sessions];
  }

  getSession(sessionId) {
    return this._sessions.find(s => s.sessionId === sessionId) || null;
  }

  saveSession(sessionData) {
    if (!sessionData || !sessionData.sessionId) return;
    const idx = this._sessions.findIndex(s => s.sessionId === sessionData.sessionId);
    const now = Date.now();
    const prev = idx >= 0 ? this._sessions[idx] : null;
    const data = { ...sessionData, updatedAt: now, timestamp: now };
    if (prev?.seriesArchived) data.seriesArchived = true;
    if (idx >= 0) {
      this._sessions[idx] = data;
    } else {
      this._sessions.unshift(data);
    }
    if (this._sessions.length > MAX_SESSIONS) {
      this._sessions = this._sessions.slice(0, MAX_SESSIONS);
    }
    this._saveToStorage();
    this._schedulePush();
  }

  removeSession(sessionId) {
    this._addTombstones([sessionId]);
    this._sessions = this._sessions.filter(s => s.sessionId !== sessionId);
    this._saveToStorage();
    this._pushToServerNow();
  }

  hasSignificantData(session) {
    if (!session) return false;
    if (session.tournamentId) return true;
    if (session.roomId) return true;
    if (session.gamesHistory?.length > 0) return true;
    const rolesCount = session.roles ? Object.keys(session.roles).length : 0;
    if (rolesCount > 0) return true;
    if (session.rolesDistributed) return true;
    if (session.winnerTeam) return true;
    return false;
  }

  groupByTournament(sessions) {
    const groups = {};
    const standalone = [];

    for (const s of sessions) {
      if (s.tournamentId && !s.tournamentId.startsWith('funky_') && !s.tournamentId.startsWith('city_')) {
        if (!groups[s.tournamentId]) {
          groups[s.tournamentId] = {
            tournamentId: s.tournamentId,
            tournamentName: s.tournamentName || s.tournamentId,
            sessions: [],
            finishedGamesCount: 0,
            allGamesFinished: false,
            archived: false,
            tableSelected: null,
            lastStartedGameNumber: 0,
            isFunky: false,
            gameMode: null,
            totalGamesInTournament: 0,
            totalGamesForTable: 0,
          };
        }
        const g = groups[s.tournamentId];
        g.sessions.push(s);
        const gh = s.gamesHistory || [];
        g.finishedGamesCount += gh.length + (s.gameFinished ? 1 : 0);
        if (s.seriesArchived) g.archived = true;
        if (s.tableSelected && !g.tableSelected) g.tableSelected = s.tableSelected;
        if ((s.gameSelected || 0) > g.lastStartedGameNumber) {
          g.lastStartedGameNumber = s.gameSelected || 0;
        }
        if (s.funkyMode) g.isFunky = true;
        if (s.gameMode && !g.gameMode) g.gameMode = s.gameMode;
        if (s.totalGamesInTournament && s.totalGamesInTournament > g.totalGamesInTournament) {
          g.totalGamesInTournament = s.totalGamesInTournament;
        }
        if (s.totalGamesForTable && s.totalGamesForTable > g.totalGamesForTable) {
          g.totalGamesForTable = s.totalGamesForTable;
        }
      } else {
        standalone.push(s);
      }
    }

    for (const g of Object.values(groups)) {
      g.allGamesFinished = g.sessions.length > 0 && g.sessions.every(s => s.gameFinished && s.winnerTeam);
      g.sessions.sort((a, b) => (a.gameSelected || 0) - (b.gameSelected || 0));
    }

    return {
      groups: Object.values(groups).sort((a, b) => {
        const la = Math.max(...a.sessions.map(s => s.updatedAt || 0));
        const lb = Math.max(...b.sessions.map(s => s.updatedAt || 0));
        return lb - la;
      }),
      standalone: standalone.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    };
  }

  archiveSeries(tournamentId) {
    let changed = false;
    const now = Date.now();
    for (const s of this._sessions) {
      if (s.tournamentId === tournamentId) {
        s.gameFinished = true;
        s.seriesArchived = true;
        s.updatedAt = now;
        s.timestamp = now;
        changed = true;
      }
    }
    if (changed) {
      this._saveToStorage();
      this._schedulePush();
    }
    return changed;
  }

  removeSeries(tournamentId) {
    const toDelete = this._sessions.filter(s => s.tournamentId === tournamentId).map(s => s.sessionId);
    if (toDelete.length === 0) return;
    this._addTombstones(toDelete);
    this._sessions = this._sessions.filter(s => s.tournamentId !== tournamentId);
    this._saveToStorage();
    this._pushToServerNow();
  }

  getLastActiveSession() {
    return this._sessions.find(s => s.gamePhase && s.gamePhase !== 'results' && !s.gameFinished) || null;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
