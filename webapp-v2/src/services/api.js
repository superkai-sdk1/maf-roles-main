// Full API service — ported from webapp/app-connector.js
// All 14+ PHP endpoints from old webapp

const API_BASE = '/api/';

export const goMafiaApi = {
  // Load tournament from GoMafia
  async getTournament(tournamentId) {
    const fd = new FormData();
    fd.set('url', `https://gomafia.pro/tournament/${tournamentId}`);
    try {
      const response = await fetch(`${API_BASE}get.php?za`, { method: 'POST', body: fd });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const text = await response.text();

      if (text.startsWith('<?') || text.includes('Fatal error')) {
        throw new Error('Server returned PHP error');
      }

      const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/);

      // Title extraction — 5 strategies from old webapp
      let pageTitle = '';
      const s1 = text.match(/class="[^"]*tournament[^"]*title[^"]*"[^>]*>([^<]+)/i);
      const s2 = text.match(/class="[^"]*top-left-title[^"]*"[^>]*>([^<]+)/i);
      const s3 = text.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
               || text.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
      const s4 = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      const s5 = text.match(/class="[^"]*_tid[^"]*"[^>]*>([^<]{2,100})/);

      if (s1) pageTitle = s1[1].trim();
      else if (s2) pageTitle = s2[1].trim();
      else if (s3) pageTitle = s3[1].trim();
      else if (s4) {
        pageTitle = s4[1].replace(/\s*[\|–—-]\s*gomafia.*$/i, '').trim();
        if (/^gomafia/i.test(pageTitle)) pageTitle = '';
      }
      else if (s5) pageTitle = s5[1].trim();

      if (!match || !match[1]) throw new Error('Tournament data not found in page');
      const data = JSON.parse(match[1]);

      // Fallback title from serverData
      if (!pageTitle) {
        const sd = data?.props?.pageProps?.serverData;
        if (sd) pageTitle = sd.name || sd.title || sd.tournamentName || sd.tournament_name || '';
      }

      // Recursive title search
      if (!pageTitle) {
        const pp = data?.props?.pageProps;
        if (pp) {
          const findName = (obj, depth) => {
            if (!obj || depth > 2 || typeof obj !== 'object') return '';
            if (typeof obj.name === 'string' && obj.name.length > 1 && obj.name.length < 200 && !obj.name.startsWith('http')) return obj.name;
            if (typeof obj.title === 'string' && obj.title.length > 1 && obj.title.length < 200 && !obj.title.startsWith('http')) return obj.title;
            for (const k of Object.keys(obj)) {
              if (k === 'games' || k === 'landingData' || Array.isArray(obj[k])) continue;
              if (typeof obj[k] === 'object' && obj[k] !== null) {
                const found = findName(obj[k], depth + 1);
                if (found) return found;
              }
            }
            return '';
          };
          pageTitle = findName(pp, 0);
        }
      }

      return { ...data, _pageTitle: pageTitle || data?.props?.pageProps?.serverData?.name || 'Турнир' };
    } catch (error) {
      console.error('Error fetching tournament:', error);
      throw error;
    }
  },

  // List tournaments with filters (for tournament browser)
  async getTournamentsList(filters = {}) {
    const params = new URLSearchParams({ za: '1' });
    if (filters.period) params.set('period', filters.period);
    if (filters.type) params.set('type', filters.type);
    if (filters.fsm) params.set('fsm', filters.fsm);
    if (filters.search) params.set('search', filters.search);
    if (filters.page && filters.page > 1) params.set('page', filters.page);

    try {
      const response = await fetch(`${API_BASE}tournaments-list.php?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API error');

      const serverData = data.data?.serverData || data.data;
      let tournaments = [];
      let totalCount = 0;

      if (serverData?.tournaments) {
        tournaments = serverData.tournaments;
        totalCount = serverData.totalCount || tournaments.length;
      } else if (serverData?.items) {
        tournaments = serverData.items;
        totalCount = serverData.totalCount || tournaments.length;
      } else if (Array.isArray(serverData)) {
        tournaments = serverData;
        totalCount = tournaments.length;
      } else if (serverData) {
        for (const key of Object.keys(serverData)) {
          if (Array.isArray(serverData[key]) && serverData[key].length > 0) {
            const first = serverData[key][0];
            if (first && (first.id || first.tournamentId || first.name || first.title)) {
              tournaments = serverData[key];
              totalCount = tournaments.length;
              break;
            }
          }
        }
      }

      return { tournaments, totalCount, hasMore: tournaments.length > 0 && tournaments.length < totalCount };
    } catch (err) {
      console.warn('tournaments-list.php failed, trying fallback:', err.message);

      // Fallback: parse gomafia.pro/tournaments HTML via get.php proxy
      try {
        const fd = new FormData();
        let url = 'https://gomafia.pro/tournaments';
        const qp = [];
        if (filters.period) qp.push(`period=${encodeURIComponent(filters.period)}`);
        if (filters.type) qp.push(`type=${encodeURIComponent(filters.type)}`);
        if (filters.fsm) qp.push(`fsm=${encodeURIComponent(filters.fsm)}`);
        if (filters.search) qp.push(`search=${encodeURIComponent(filters.search)}`);
        if (filters.page && filters.page > 1) qp.push(`page=${filters.page}`);
        if (qp.length) url += '?' + qp.join('&');

        fd.set('url', url);
        const resp = await fetch(`${API_BASE}get.php?za`, { method: 'POST', body: fd });
        const text = await resp.text();

        const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/);
        if (match && match[1]) {
          const nextData = JSON.parse(match[1]);
          const sd = nextData?.props?.pageProps?.serverData || nextData?.props?.pageProps;
          let tournaments = [];

          if (sd) {
            for (const key of Object.keys(sd)) {
              if (Array.isArray(sd[key]) && sd[key].length > 0) {
                const first = sd[key][0];
                if (first && (first.id || first.tournamentId || first.name || first.title)) {
                  tournaments = sd[key];
                  break;
                }
              }
            }
          }

          return { tournaments, totalCount: tournaments.length, hasMore: false };
        }
      } catch (e2) {
        console.error('Fallback also failed:', e2);
      }

      return { tournaments: [], totalCount: 0, hasMore: false };
    }
  },

  // Get player data by logins
  async getPlayersData(logins) {
    const fd = new FormData();
    logins.forEach(login => fd.append('playerLogin[]', login));
    try {
      const response = await fetch(`${API_BASE}players-get.php?za`, { method: 'POST', body: fd });
      return await response.json();
    } catch (error) {
      console.error('Error fetching players:', error);
      return null;
    }
  },

  // Search players (for funky/city modes)
  async searchPlayers(query) {
    try {
      const response = await fetch(`${API_BASE}players-search.php?za&q=${encodeURIComponent(query)}`);
      if (!response.ok) return [];
      const results = await response.json();
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  },

  // Get cached avatars from server
  async getAvatarsCache(logins) {
    try {
      const response = await fetch(`${API_BASE}avatars-cache.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `za=1&action=get&logins=${encodeURIComponent(JSON.stringify(logins))}`
      });
      if (!response.ok) return {};
      const ct = response.headers.get('content-type');
      if (ct && ct.includes('application/json')) return await response.json();
      return {};
    } catch (e) { return {}; }
  },

  // Save avatars to global cache
  async saveAvatarsCache(avatars) {
    try {
      await fetch(`${API_BASE}avatars-cache.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `za=1&avatars=${encodeURIComponent(JSON.stringify(avatars))}`
      });
    } catch (e) { /* ignore */ }
  },

  // Save avatars to room
  async saveAvatars(roomId, avatars) {
    const fd = new FormData();
    fd.set('room', roomId);
    fd.set('avatars', JSON.stringify(avatars));
    try {
      await fetch(`${API_BASE}avatars-save.php?za`, { method: 'POST', body: fd });
    } catch (e) { /* ignore */ }
  },

  // Save room state to server
  async saveRoomState(roomId, state) {
    const fd = new FormData();
    fd.set('room', roomId);
    fd.set('state', JSON.stringify(state));
    try {
      await fetch(`${API_BASE}room-state.php?za`, { method: 'POST', body: fd });
    } catch (e) { /* ignore */ }
  },

  // Get room state from server
  async getRoomState(roomId) {
    try {
      const response = await fetch(`${API_BASE}room-state.php?za&room=${encodeURIComponent(roomId)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) { return null; }
  },

  // Save summary
  async saveSummary(data) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.set(k, typeof v === 'object' ? JSON.stringify(v) : v));
    try {
      const response = await fetch(`${API_BASE}summary-save.php?za`, { method: 'POST', body: fd });
      return await response.json();
    } catch (e) { return null; }
  },

  // Get summary
  async getSummary(id) {
    try {
      const response = await fetch(`${API_BASE}summary-get.php?za&id=${encodeURIComponent(id)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) { return null; }
  },

  async loginGoMafia(nickname, password) {
    const fd = new FormData();
    fd.set('nickname', nickname);
    fd.set('password', password);
    try {
      const response = await fetch(`${API_BASE}gomafia-auth.php?za&action=login`, {
        method: 'POST',
        body: fd,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('GoMafia login error:', error);
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  },

  async lookupGoMafiaPlayer(nickname) {
    try {
      const response = await fetch(
        `${API_BASE}gomafia-auth.php?za&action=lookup&nickname=${encodeURIComponent(nickname)}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('GoMafia lookup error:', error);
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  },

  getStoredGoMafiaProfile() {
    try {
      const raw = localStorage.getItem('maf_gomafia_profile');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  saveGoMafiaProfile(profile) {
    try {
      localStorage.setItem('maf_gomafia_profile', JSON.stringify(profile));
    } catch {}
  },

  removeGoMafiaProfile() {
    try {
      localStorage.removeItem('maf_gomafia_profile');
    } catch {}
  },
};

const AUTH_BASE = '/login/';

export const sessionsApi = {
  async getActiveSessions(token) {
    try {
      const response = await fetch(`${AUTH_BASE}sessions-list.php?token=${encodeURIComponent(token)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.sessions || [];
    } catch {
      return null;
    }
  },

  async terminateSession(token, sessionId) {
    try {
      const response = await fetch(
        `${AUTH_BASE}sessions-list.php?token=${encodeURIComponent(token)}&session_id=${sessionId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },
};

export const profileApi = {
  async loadProfile(token) {
    try {
      const response = await fetch(`${API_BASE}profile-sync.php?token=${encodeURIComponent(token)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async saveProfile(token, profileData) {
    try {
      const response = await fetch(`${API_BASE}profile-sync.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profile: profileData }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async clearGoMafia(token) {
    try {
      const response = await fetch(
        `${API_BASE}profile-sync.php?token=${encodeURIComponent(token)}&field=gomafia`,
        { method: 'DELETE' }
      );
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },
};

export default goMafiaApi;
