const STORAGE_KEY = 'mafboard_sessions';
const MAX_SESSIONS = 50;
const SESSION_TTL = 365 * 24 * 60 * 60 * 1000;

class SessionManager {
  constructor() {
    this._sessions = this._loadFromStorage();
    this._tgCloud = null;
    this._initTelegramCloud();
  }

  _initTelegramCloud() {
    try {
      if (window.Telegram?.WebApp?.CloudStorage) {
        this._tgCloud = window.Telegram.WebApp.CloudStorage;
        this._syncFromTelegramCloud();
      }
    } catch (e) { /* ignore */ }
  }

  _syncFromTelegramCloud() {
    if (!this._tgCloud) return;
    try {
      this._tgCloud.getItem(STORAGE_KEY, (err, value) => {
        if (err || !value) return;
        try {
          const cloudSessions = JSON.parse(value);
          if (Array.isArray(cloudSessions)) {
            this._mergeSessions(cloudSessions);
          }
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  _mergeSessions(remoteSessions) {
    const map = new Map();
    for (const s of this._sessions) {
      map.set(s.sessionId, s);
    }
    for (const s of remoteSessions) {
      const existing = map.get(s.sessionId);
      if (!existing || (s.updatedAt || 0) > (existing.updatedAt || 0)) {
        map.set(s.sessionId, s);
      }
    }
    this._sessions = Array.from(map.values())
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, MAX_SESSIONS);
    this._saveToStorage();
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions = JSON.parse(raw);
      const now = Date.now();
      return sessions.filter(s => !s.updatedAt || (now - s.updatedAt) < SESSION_TTL);
    } catch (e) {
      return [];
    }
  }

  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._sessions));
      if (this._tgCloud) {
        this._tgCloud.setItem(STORAGE_KEY, JSON.stringify(this._sessions), () => {});
      }
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
    const data = { ...sessionData, updatedAt: Date.now() };
    if (idx >= 0) {
      this._sessions[idx] = data;
    } else {
      this._sessions.unshift(data);
    }
    if (this._sessions.length > MAX_SESSIONS) {
      this._sessions = this._sessions.slice(0, MAX_SESSIONS);
    }
    this._saveToStorage();
  }

  removeSession(sessionId) {
    this._sessions = this._sessions.filter(s => s.sessionId !== sessionId);
    this._saveToStorage();
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
        if (s.gameFinished) g.finishedGamesCount++;
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
      g.allGamesFinished = g.sessions.length > 0 && g.sessions.every(s => s.gameFinished);
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
    for (const s of this._sessions) {
      if (s.tournamentId === tournamentId) {
        s.gameFinished = true;
        s.seriesArchived = true;
        s.updatedAt = Date.now();
        changed = true;
      }
    }
    if (changed) this._saveToStorage();
    return changed;
  }

  getLastActiveSession() {
    return this._sessions.find(s => s.gamePhase && s.gamePhase !== 'results' && !s.gameFinished) || null;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
