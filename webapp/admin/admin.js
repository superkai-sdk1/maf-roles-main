// =====================================================
// MafBoard Admin Panel — Main Application
// =====================================================

(function () {
    'use strict';

    const AUTH_TOKEN_KEY = 'maf_auth_token';
    const AUTH_USER_KEY = 'maf_auth_user';
    const API_BASE = './api/';
    const LOGIN_BASE = '../login/';

    // =============================================
    // State
    // =============================================

    const state = {
        token: null,
        user: null,
        currentPage: 'dashboard',
        dashboardData: null,
        // users
        usersData: null,
        usersPage: 1,
        usersSearch: '',
        usersSort: 'last_active',
        usersOrder: 'DESC',
        // games
        gamesData: null,
        gamesPage: 1,
        // summaries
        summariesData: null,
        // players
        playersSearch: '',
        playersData: null,
        // detail views
        selectedUserId: null,
        selectedUserDetail: null,
        selectedGameUserId: null,
        selectedGameDetail: null,
        editingGame: null,
    };

    // =============================================
    // Utility
    // =============================================

    function getToken() {
        try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch (e) { return null; }
    }
    function setToken(t) {
        try { localStorage.setItem(AUTH_TOKEN_KEY, t); } catch (e) { }
    }
    function getUser() {
        try { const d = localStorage.getItem(AUTH_USER_KEY); return d ? JSON.parse(d) : null; } catch (e) { return null; }
    }

    function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            const dt = new Date(d);
            if (isNaN(dt)) return d;
            return dt.toLocaleDateString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return d; }
    }

    function formatDateShort(d) {
        if (!d) return '—';
        try {
            const dt = new Date(d);
            if (isNaN(dt)) return d;
            return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        } catch (e) { return d; }
    }

    function timeAgo(d) {
        if (!d) return '—';
        try {
            const dt = new Date(d);
            const now = new Date();
            const diff = Math.floor((now - dt) / 1000);
            if (diff < 60) return 'только что';
            if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
            if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
            if (diff < 604800) return Math.floor(diff / 86400) + ' дн назад';
            return formatDate(d);
        } catch (e) { return d; }
    }

    async function apiCall(endpoint, options = {}) {
        const url = new URL(API_BASE + endpoint, window.location.href);
        url.searchParams.set('token', state.token);
        if (options.params) {
            Object.entries(options.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
            });
        }

        const fetchOpts = {};
        if (options.method) fetchOpts.method = options.method;
        if (options.body) {
            fetchOpts.method = fetchOpts.method || 'POST';
            fetchOpts.headers = { 'Content-Type': 'application/json' };
            fetchOpts.body = JSON.stringify({ token: state.token, ...options.body });
        }

        try {
            const resp = await fetch(url.toString(), fetchOpts);
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                console.error('API: non-JSON response:', text.substring(0, 300));
                throw new Error('Сервер вернул некорректный ответ (HTTP ' + resp.status + ')');
            }
            if (!resp.ok && data.error) throw new Error(data.error);
            return data;
        } catch (e) {
            console.error('API Error:', e);
            throw e;
        }
    }

    // =============================================
    // Toast
    // =============================================

    function toast(message, type = 'info') {
        const container = document.getElementById('admin-toast-container');
        const el = document.createElement('div');
        el.className = 'admin-toast ' + type;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    // =============================================
    // Modal
    // =============================================

    function showModal(html) {
        const modal = document.getElementById('admin-modal');
        document.getElementById('admin-modal-content').innerHTML = html;
        modal.style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('admin-modal').style.display = 'none';
    }

    // =============================================
    // Auth
    // =============================================

    async function checkAuth() {
        const authStatus = document.getElementById('auth-status-text');
        const authSpinner = document.getElementById('auth-spinner');
        const authError = document.getElementById('auth-error');
        const authErrorMsg = document.getElementById('auth-error-msg');

        const token = getToken();
        if (!token) {
            authSpinner.style.display = 'none';
            authErrorMsg.textContent = 'Вы не авторизованы. Сначала войдите через основное приложение.';
            authError.style.display = 'block';
            authStatus.textContent = 'Требуется авторизация';
            return;
        }

        state.token = token;
        authStatus.textContent = 'Проверка прав администратора...';

        try {
            const resp = await fetch(API_BASE + 'admin-auth.php?token=' + encodeURIComponent(token));
            const data = await resp.json();

            if (data.admin) {
                state.user = data.user;
                onAuthSuccess();
            } else {
                authSpinner.style.display = 'none';
                authErrorMsg.textContent = data.message || 'Доступ запрещён';
                authError.style.display = 'block';
                authStatus.textContent = 'Нет доступа';
            }
        } catch (e) {
            authSpinner.style.display = 'none';
            authErrorMsg.textContent = 'Ошибка подключения к серверу: ' + e.message;
            authError.style.display = 'block';
            authStatus.textContent = 'Ошибка';
        }
    }

    function onAuthSuccess() {
        // Update user info in sidebar
        const nameEl = document.getElementById('admin-user-name');
        const avatarEl = document.getElementById('admin-user-avatar');
        if (state.user) {
            const name = state.user.first_name || state.user.username || 'Admin';
            nameEl.textContent = name;
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }

        // Hide auth overlay, show app
        const overlay = document.getElementById('admin-auth-overlay');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('admin-main').style.display = 'flex';
            navigate('dashboard');
        }, 350);
    }

    function logout() {
        try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
        } catch (e) { }
        window.location.href = '../panel.html';
    }

    // =============================================
    // Navigation
    // =============================================

    function navigate(page, params) {
        state.currentPage = page;

        // Update sidebar active state
        document.querySelectorAll('.admin-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Update title
        const titles = {
            dashboard: 'Дашборд',
            users: 'Пользователи',
            games: 'Игровые сессии',
            summaries: 'Итоги вечеров',
            rooms: 'Комнаты',
            roomDetail: 'Комната',
            players: 'Игроки (БД)',
            userDetail: 'Пользователь',
            gameDetail: 'Игры пользователя',
        };
        document.getElementById('admin-page-title').textContent = titles[page] || page;

        // Close sidebar on mobile
        document.getElementById('admin-sidebar').classList.remove('open');

        // Render page
        const content = document.getElementById('admin-page-content');
        content.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';

        switch (page) {
            case 'dashboard': loadDashboard(); break;
            case 'users': loadUsers(); break;
            case 'games': loadGames(); break;
            case 'summaries': loadSummaries(); break;
            case 'rooms': loadRooms(); break;
            case 'roomDetail': loadRoomDetail(params); break;
            case 'players': loadPlayers(); break;
            case 'userDetail': loadUserDetail(params); break;
            case 'gameDetail': loadGameDetail(params); break;
            default: content.innerHTML = '<div class="admin-empty"><h3>Страница не найдена</h3></div>';
        }
    }

    // =============================================
    // Dashboard
    // =============================================

    async function loadDashboard() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-stats.php');
            state.dashboardData = data;

            // --- Stat cards (clickable) ---
            const statCards = `
                <div class="admin-stats-grid">
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('users')">
                        <div class="admin-stat-icon">👥</div>
                        <div class="admin-stat-label">Пользователей</div>
                        <div class="admin-stat-value">${data.totalUsers}</div>
                        <div class="admin-stat-hint">Все зарегистрированные →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('users')">
                        <div class="admin-stat-icon">🟢</div>
                        <div class="admin-stat-label">Активны сегодня</div>
                        <div class="admin-stat-value">${data.activeToday}</div>
                        <div class="admin-stat-hint">За последние 24ч →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('users')">
                        <div class="admin-stat-icon">📅</div>
                        <div class="admin-stat-label">За неделю</div>
                        <div class="admin-stat-value">${data.activeWeek}</div>
                        <div class="admin-stat-hint">Активных за 7 дней →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('users')">
                        <div class="admin-stat-icon">📆</div>
                        <div class="admin-stat-label">За месяц</div>
                        <div class="admin-stat-value">${data.activeMonth}</div>
                        <div class="admin-stat-hint">Активных за 30 дней →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('games')">
                        <div class="admin-stat-icon">🎮</div>
                        <div class="admin-stat-label">Всего игр</div>
                        <div class="admin-stat-value">${data.totalGames}</div>
                        <div class="admin-stat-hint">Все сыгранные →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('games')">
                        <div class="admin-stat-icon">🎲</div>
                        <div class="admin-stat-label">Играют</div>
                        <div class="admin-stat-value">${data.totalGameUsers}</div>
                        <div class="admin-stat-hint">Пользователей с играми →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('summaries')">
                        <div class="admin-stat-icon">📋</div>
                        <div class="admin-stat-label">Итогов</div>
                        <div class="admin-stat-value">${data.totalSummaries}</div>
                        <div class="admin-stat-hint">Сохранённые итоги →</div>
                    </div>
                    <div class="admin-stat-card clickable" onclick="AdminApp.navigate('players')">
                        <div class="admin-stat-icon">🃏</div>
                        <div class="admin-stat-label">Игроков в БД</div>
                        <div class="admin-stat-value">${data.totalPlayers}</div>
                        <div class="admin-stat-hint">Из GoMafia →</div>
                    </div>
                </div>
            `;

            // --- Secondary metrics ---
            const secondaryCards = `
                <div class="admin-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
                    <div class="admin-stat-card mini">
                        <div class="admin-stat-label">Среднее игр / юзер</div>
                        <div class="admin-stat-value">${data.avgGamesPerUser}</div>
                    </div>
                    <div class="admin-stat-card mini">
                        <div class="admin-stat-label">Retention</div>
                        <div class="admin-stat-value">${data.retentionRate}%</div>
                        <div class="admin-stat-hint">${data.retentionCount} вернулись</div>
                    </div>
                    <div class="admin-stat-card mini">
                        <div class="admin-stat-label">Комнат</div>
                        <div class="admin-stat-value">${data.activeRooms ? data.activeRooms.length : 0}</div>
                    </div>
                </div>
            `;

            // --- Charts ---
            let chartHtml = '';
            if (data.activityByDay && data.activityByDay.length > 0) {
                const maxVal = Math.max(...data.activityByDay.map(d => d.count), 1);
                const bars = data.activityByDay.map(d => {
                    const h = Math.max(4, (d.count / maxVal) * 100);
                    return `<div class="admin-chart-bar" style="height:${h}%"><div class="tooltip">${formatDateShort(d.date)}: ${d.count} польз.</div></div>`;
                }).join('');
                const labels = data.activityByDay.length > 1
                    ? `<div class="admin-chart-labels"><span>${formatDateShort(data.activityByDay[0].date)}</span><span>${formatDateShort(data.activityByDay[data.activityByDay.length - 1].date)}</span></div>`
                    : '';
                chartHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header"><div class="admin-card-title">📊 Активность (30 дней)</div></div>
                        <div class="admin-chart">${bars}</div>
                        ${labels}
                    </div>`;
            }

            let regChartHtml = '';
            if (data.registrationsByDay && data.registrationsByDay.length > 0) {
                const maxVal = Math.max(...data.registrationsByDay.map(d => d.count), 1);
                const bars = data.registrationsByDay.map(d => {
                    const h = Math.max(4, (d.count / maxVal) * 100);
                    return `<div class="admin-chart-bar" style="height:${h}%"><div class="tooltip">${formatDateShort(d.date)}: ${d.count} новых</div></div>`;
                }).join('');
                const labels = data.registrationsByDay.length > 1
                    ? `<div class="admin-chart-labels"><span>${formatDateShort(data.registrationsByDay[0].date)}</span><span>${formatDateShort(data.registrationsByDay[data.registrationsByDay.length - 1].date)}</span></div>`
                    : '';
                regChartHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header"><div class="admin-card-title">📈 Регистрации (30 дней)</div></div>
                        <div class="admin-chart">${bars}</div>
                        ${labels}
                    </div>`;
            }

            // --- Game mode breakdown (donut-like) ---
            const modes = data.modeBreakdown || {};
            const modeTotal = (modes.gomafia || 0) + (modes.funky || 0) + (modes.manual || 0) + (modes.tournament || 0) + (modes.city || 0);
            const modePct = (v) => modeTotal > 0 ? Math.round((v / modeTotal) * 100) : 0;
            const modeHtml = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">🎯 Режимы игр</div></div>
                    <div class="dash-breakdown">
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#a855f7"></span>
                            <span class="dash-breakdown-label">GoMafia</span>
                            <span class="dash-breakdown-bar"><span style="width:${modePct(modes.gomafia)}%;background:#a855f7"></span></span>
                            <span class="dash-breakdown-val">${modes.gomafia || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#ff6b9d"></span>
                            <span class="dash-breakdown-label">Фанки</span>
                            <span class="dash-breakdown-bar"><span style="width:${modePct(modes.funky)}%;background:#ff6b9d"></span></span>
                            <span class="dash-breakdown-val">${modes.funky || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#4fc3f7"></span>
                            <span class="dash-breakdown-label">Городская мафия</span>
                            <span class="dash-breakdown-bar"><span style="width:${modePct(modes.city)}%;background:#4fc3f7"></span></span>
                            <span class="dash-breakdown-val">${modes.city || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#ffd60a"></span>
                            <span class="dash-breakdown-label">Ручной</span>
                            <span class="dash-breakdown-bar"><span style="width:${modePct(modes.manual)}%;background:#ffd60a"></span></span>
                            <span class="dash-breakdown-val">${modes.manual || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#30d158"></span>
                            <span class="dash-breakdown-label">Турнир</span>
                            <span class="dash-breakdown-bar"><span style="width:${modePct(modes.tournament)}%;background:#30d158"></span></span>
                            <span class="dash-breakdown-val">${modes.tournament || 0}</span>
                        </div>
                    </div>
                </div>`;

            // --- Win breakdown ---
            const wins = data.winBreakdown || {};
            const winTotal = (wins.city || 0) + (wins.mafia || 0) + (wins.draw || 0) + (wins.in_progress || 0);
            const winPct = (v) => winTotal > 0 ? Math.round((v / winTotal) * 100) : 0;
            const winHtml = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">⚔️ Победители</div></div>
                    <div class="dash-breakdown">
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#30d158"></span>
                            <span class="dash-breakdown-label">Мирные</span>
                            <span class="dash-breakdown-bar"><span style="width:${winPct(wins.city)}%;background:#30d158"></span></span>
                            <span class="dash-breakdown-val">${wins.city || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#ff453a"></span>
                            <span class="dash-breakdown-label">Мафия</span>
                            <span class="dash-breakdown-bar"><span style="width:${winPct(wins.mafia)}%;background:#ff453a"></span></span>
                            <span class="dash-breakdown-val">${wins.mafia || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:#ffd60a"></span>
                            <span class="dash-breakdown-label">Ничья</span>
                            <span class="dash-breakdown-bar"><span style="width:${winPct(wins.draw)}%;background:#ffd60a"></span></span>
                            <span class="dash-breakdown-val">${wins.draw || 0}</span>
                        </div>
                        <div class="dash-breakdown-row">
                            <span class="dash-dot" style="background:var(--text-muted)"></span>
                            <span class="dash-breakdown-label">В процессе</span>
                            <span class="dash-breakdown-bar"><span style="width:${winPct(wins.in_progress)}%;background:var(--glass-3)"></span></span>
                            <span class="dash-breakdown-val">${wins.in_progress || 0}</span>
                        </div>
                    </div>
                </div>`;

            // --- Recent users ---
            let recentUsersHtml = '';
            if (data.recentUsers && data.recentUsers.length) {
                const rows = data.recentUsers.map(u => {
                    const name = ((u.telegram_first_name || '') + ' ' + (u.telegram_last_name || '')).trim() || 'Без имени';
                    const uname = u.telegram_username ? '@' + escapeHtml(u.telegram_username) : '';
                    return `<div class="dash-user-row clickable" onclick="AdminApp.navigate('userDetail','${u.telegram_id}')">
                        <div class="dash-user-avatar">${name.charAt(0).toUpperCase()}</div>
                        <div class="dash-user-info">
                            <div class="dash-user-name">${escapeHtml(name)}</div>
                            <div class="dash-user-sub">${uname} · ID: ${u.telegram_id}</div>
                        </div>
                        <div class="dash-user-time">${timeAgo(u.first_seen)}</div>
                    </div>`;
                }).join('');
                recentUsersHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">🆕 Новые пользователи</div>
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('users')">Все →</button>
                        </div>
                        ${rows}
                    </div>`;
            }

            // --- Last active users ---
            let lastActiveHtml = '';
            if (data.lastActiveUsers && data.lastActiveUsers.length) {
                const rows = data.lastActiveUsers.map(u => {
                    const name = ((u.telegram_first_name || '') + ' ' + (u.telegram_last_name || '')).trim() || 'Без имени';
                    const uname = u.telegram_username ? '@' + escapeHtml(u.telegram_username) : '';
                    return `<div class="dash-user-row clickable" onclick="AdminApp.navigate('userDetail','${u.telegram_id}')">
                        <div class="dash-user-avatar">${name.charAt(0).toUpperCase()}</div>
                        <div class="dash-user-info">
                            <div class="dash-user-name">${escapeHtml(name)}</div>
                            <div class="dash-user-sub">${uname}</div>
                        </div>
                        <div class="dash-user-time">${timeAgo(u.last_active)}</div>
                    </div>`;
                }).join('');
                lastActiveHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">⚡ Последняя активность</div>
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('users')">Все →</button>
                        </div>
                        ${rows}
                    </div>`;
            }

            // --- Top game users ---
            let topGamesHtml = '';
            if (data.topGameUsers && data.topGameUsers.length) {
                const rows = data.topGameUsers.map((u, i) => {
                    const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || 'Без имени';
                    const uname = u.username ? '@' + escapeHtml(u.username) : '';
                    const medals = ['🥇', '🥈', '🥉'];
                    const medal = i < 3 ? medals[i] : `${i + 1}.`;
                    return `<div class="dash-user-row clickable" onclick="AdminApp.navigate('userDetail','${u.telegram_id}')">
                        <div class="dash-rank">${medal}</div>
                        <div class="dash-user-info">
                            <div class="dash-user-name">${escapeHtml(name)}</div>
                            <div class="dash-user-sub">${uname}</div>
                        </div>
                        <div class="admin-badge admin-badge-accent">${u.games_count} игр</div>
                    </div>`;
                }).join('');
                topGamesHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">🏆 Топ по играм</div>
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('games')">Все →</button>
                        </div>
                        ${rows}
                    </div>`;
            }

            // --- Recent games feed ---
            let recentGamesHtml = '';
            if (data.recentGames && data.recentGames.length) {
                const rows = data.recentGames.map(g => {
                    const name = g.first_name || g.username || 'user';
                    const mode = g.cityMode ? '🏙️ Городская' : g.funkyMode ? '🎉 Фанки' : g.tournamentId ? '🏆 Турнир' : g.manualMode ? '✋ Ручной' : '🌐 GoMafia';
                    const winner = g.winnerTeam
                        ? `<span class="admin-badge ${g.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success'}">${escapeHtml(g.winnerTeam)}</span>`
                        : '<span class="admin-badge admin-badge-warning">⏳</span>';
                    return `<div class="dash-game-row clickable" onclick="AdminApp.navigate('gameDetail','${g.telegram_id}')">
                        <div class="dash-game-info">
                            <span class="dash-game-mode">${mode}</span>
                            <span class="dash-game-user">${escapeHtml(name)}</span>
                            ${g.playersCount ? `<span class="dash-game-players">${g.playersCount} игр.</span>` : ''}
                        </div>
                        <div class="dash-game-right">
                            ${winner}
                            <span class="dash-game-time">${timeAgo(g.updated_at)}</span>
                        </div>
                    </div>`;
                }).join('');
                recentGamesHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">🕹️ Последние игры</div>
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('games')">Все →</button>
                        </div>
                        ${rows}
                    </div>`;
            }

            // --- Active rooms ---
            let roomsHtml = '';
            if (data.activeRooms && data.activeRooms.length) {
                const rows = data.activeRooms.map(r => {
                    return `<div class="dash-room-chip clickable" onclick="AdminApp.navigate('roomDetail','${escapeHtml(r.roomId)}')">
                        <span class="dash-room-id">#${escapeHtml(r.roomId)}</span>
                        <span class="dash-room-count">${r.playersCount} игр.</span>
                    </div>`;
                }).join('');
                roomsHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">🏠 Активные комнаты</div>
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('rooms')">Управление →</button>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px">${rows}</div>
                    </div>`;
            }

            // --- Quick actions ---
            const quickActionsHtml = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">⚡ Быстрые действия</div></div>
                    <div class="dash-actions-grid">
                        <button class="dash-action-btn" onclick="AdminApp.navigate('users')">
                            <span class="dash-action-icon">👥</span>
                            <span>Пользователи</span>
                        </button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('games')">
                            <span class="dash-action-icon">🎮</span>
                            <span>Все игры</span>
                        </button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('summaries')">
                            <span class="dash-action-icon">📋</span>
                            <span>Итоги</span>
                        </button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('rooms')">
                            <span class="dash-action-icon">🏠</span>
                            <span>Комнаты</span>
                        </button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('players')">
                            <span class="dash-action-icon">🔄</span>
                            <span>Синхронизация</span>
                        </button>
                        <button class="dash-action-btn" onclick="window.open('../panel.html','_blank')">
                            <span class="dash-action-icon">🎯</span>
                            <span>Панель игры</span>
                        </button>
                        <button class="dash-action-btn" onclick="AdminApp.loadDashboard()">
                            <span class="dash-action-icon">🔃</span>
                            <span>Обновить</span>
                        </button>
                    </div>
                </div>
            `;

            // --- Assemble ---
            content.innerHTML = `
                ${statCards}
                ${secondaryCards}
                ${quickActionsHtml}
                <div class="admin-grid-2">
                    ${chartHtml}
                    ${regChartHtml}
                </div>
                <div class="admin-grid-2">
                    ${modeHtml}
                    ${winHtml}
                </div>
                <div class="admin-section-title">Пользователи и активность</div>
                <div class="admin-grid-2">
                    ${recentUsersHtml}
                    ${lastActiveHtml}
                </div>
                <div class="admin-grid-2">
                    ${topGamesHtml}
                    ${recentGamesHtml}
                </div>
                ${roomsHtml}
            `;
        } catch (e) {
            content.innerHTML = `<div class="admin-empty"><h3>Ошибка загрузки</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    // =============================================
    // Users
    // =============================================

    async function loadUsers() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-users.php', {
                params: {
                    page: state.usersPage,
                    search: state.usersSearch,
                    sort: state.usersSort,
                    order: state.usersOrder,
                }
            });
            state.usersData = data;

            let searchVal = escapeHtml(state.usersSearch);

            let rows = '';
            if (data.users && data.users.length > 0) {
                rows = data.users.map(u => {
                    const name = escapeHtml(u.telegram_first_name || '') + ' ' + escapeHtml(u.telegram_last_name || '');
                    const username = u.telegram_username ? '@' + escapeHtml(u.telegram_username) : '—';
                    return `<tr class="clickable" onclick="AdminApp.navigate('userDetail', '${u.telegram_id}')">
                        <td>${escapeHtml(u.telegram_id)}</td>
                        <td>${name.trim() || '—'}</td>
                        <td>${username}</td>
                        <td><span class="admin-badge admin-badge-accent">${u.games_count}</span></td>
                        <td>${u.sessions_count}</td>
                        <td title="${formatDate(u.first_seen)}">${timeAgo(u.first_seen)}</td>
                        <td title="${formatDate(u.last_active)}">${timeAgo(u.last_active)}</td>
                    </tr>`;
                }).join('');
            } else {
                rows = `<tr><td colspan="7" class="admin-empty" style="padding:40px"><h3>Нет пользователей</h3></td></tr>`;
            }

            const sortIcon = (col) => state.usersSort === col
                ? (state.usersOrder === 'ASC' ? ' ↑' : ' ↓') : '';

            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <div class="admin-search-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input class="admin-input" id="users-search" placeholder="Поиск по имени, username, ID..." value="${searchVal}" onkeydown="if(event.key==='Enter')AdminApp.searchUsers()">
                        </div>
                        <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.searchUsers()">Найти</button>
                        ${state.usersSearch ? `<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearUserSearch()">✕ Сбросить</button>` : ''}
                    </div>
                    <div class="admin-toolbar-right">
                        <span style="font-size:0.82em;color:var(--text-muted)">Всего: ${data.total}</span>
                    </div>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th onclick="AdminApp.sortUsers('telegram_id')" class="${state.usersSort === 'telegram_id' ? 'sorted' : ''}">ID${sortIcon('telegram_id')}</th>
                                <th>Имя</th>
                                <th onclick="AdminApp.sortUsers('telegram_username')" class="${state.usersSort === 'telegram_username' ? 'sorted' : ''}">Username${sortIcon('telegram_username')}</th>
                                <th onclick="AdminApp.sortUsers('games_count')" class="${state.usersSort === 'games_count' ? 'sorted' : ''}">Игр${sortIcon('games_count')}</th>
                                <th>Сессий</th>
                                <th onclick="AdminApp.sortUsers('created_at')" class="${state.usersSort === 'created_at' ? 'sorted' : ''}">Регистрация${sortIcon('created_at')}</th>
                                <th onclick="AdminApp.sortUsers('last_active')" class="${state.usersSort === 'last_active' ? 'sorted' : ''}">Активность${sortIcon('last_active')}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${renderPagination(data.page, data.totalPages, 'AdminApp.usersGoToPage')}
            `;
        } catch (e) {
            content.innerHTML = `<div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    function searchUsers() {
        state.usersSearch = document.getElementById('users-search').value.trim();
        state.usersPage = 1;
        loadUsers();
    }

    function clearUserSearch() {
        state.usersSearch = '';
        state.usersPage = 1;
        loadUsers();
    }

    function sortUsers(col) {
        if (state.usersSort === col) {
            state.usersOrder = state.usersOrder === 'ASC' ? 'DESC' : 'ASC';
        } else {
            state.usersSort = col;
            state.usersOrder = 'DESC';
        }
        state.usersPage = 1;
        loadUsers();
    }

    function usersGoToPage(p) {
        state.usersPage = p;
        loadUsers();
    }

    // =============================================
    // User Detail
    // =============================================

    async function loadUserDetail(telegramId) {
        if (!telegramId && state.selectedUserId) telegramId = state.selectedUserId;
        state.selectedUserId = telegramId;
        const content = document.getElementById('admin-page-content');
        document.getElementById('admin-page-title').textContent = 'Пользователь #' + telegramId;

        try {
            const data = await apiCall('admin-users.php', { params: { id: telegramId } });
            state.selectedUserDetail = data;

            if (!data.user) {
                content.innerHTML = `<button class="admin-back-btn" onclick="AdminApp.navigate('users')">← Назад</button><div class="admin-empty"><h3>Пользователь не найден</h3></div>`;
                return;
            }

            const u = data.user;
            const name = (u.first_name || '') + ' ' + (u.last_name || '');
            const username = u.username ? '@' + u.username : '—';

            let gamesHtml = '';
            if (data.games && data.games.length > 0) {
                gamesHtml = data.games.map((g, i) => {
                    const winner = g.winnerTeam ? `<span class="admin-badge ${g.winnerTeam === 'mafia' ? 'admin-badge-error' : (g.winnerTeam === 'city' || g.winnerTeam === 'civilians') ? 'admin-badge-success' : 'admin-badge-muted'}">${escapeHtml(g.winnerTeam)}</span>` : '<span class="admin-badge admin-badge-warning">В процессе</span>';
                    const mode = g.cityMode ? 'Городская' : g.funkyMode ? 'Фанки' : (g.tournamentId ? 'Турнир' : (g.manualMode ? 'Ручной' : 'gomafia'));
                    const gameNum = g.gameNumber || g.manualGameSelected || (i + 1);
                    const date = g.timestamp ? formatDate(new Date(g.timestamp)) : '—';
                    const modified = g.adminModified ? '<span class="admin-badge admin-badge-warning" title="Изменено админом">✎</span>' : '';
                    const players = [];
                    if (g.peoples && Array.isArray(g.peoples)) {
                        g.peoples.forEach(p => { if (p && p.login) players.push(p.login); });
                    }
                    const playersStr = players.length > 0
                        ? `<div class="admin-players-mini">${players.slice(0, 6).map(p => '<span>' + escapeHtml(p) + '</span>').join('')}${players.length > 6 ? '<span>+' + (players.length - 6) + '</span>' : ''}</div>`
                        : '';

                    return `<div class="admin-game-card" onclick="AdminApp.showGameModal('${telegramId}', '${escapeHtml(g.sessionId || '')}', ${i})">
                        <div class="admin-game-card-header">
                            <span class="admin-game-card-title">Игра #${gameNum} ${modified}</span>
                            ${winner}
                        </div>
                        <div class="admin-game-card-meta">
                            <span>${escapeHtml(mode)}</span>
                            <span>•</span>
                            <span>${date}</span>
                        </div>
                        ${playersStr}
                    </div>`;
                }).join('');
            } else {
                gamesHtml = '<div class="admin-empty" style="padding:20px"><p>Нет игр</p></div>';
            }

            content.innerHTML = `
                <button class="admin-back-btn" onclick="AdminApp.navigate('users')">← К списку пользователей</button>
                <div class="admin-card" style="margin-bottom:16px">
                    <div class="admin-card-header">
                        <div>
                            <div class="admin-card-title">${escapeHtml(name.trim()) || 'Пользователь'}</div>
                            <div class="admin-card-subtitle">${username} · ID: ${u.telegram_id}</div>
                        </div>
                        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteUserSessions('${u.telegram_id}')">Удалить сессии</button>
                    </div>
                    <div class="admin-detail-grid">
                        <div class="admin-detail-label">Telegram ID</div>
                        <div class="admin-detail-value">${u.telegram_id}</div>
                        <div class="admin-detail-label">Username</div>
                        <div class="admin-detail-value">${username}</div>
                        <div class="admin-detail-label">Имя</div>
                        <div class="admin-detail-value">${escapeHtml(name.trim()) || '—'}</div>
                        <div class="admin-detail-label">Первый визит</div>
                        <div class="admin-detail-value">${formatDate(u.first_seen)}</div>
                        <div class="admin-detail-label">Последняя активность</div>
                        <div class="admin-detail-value">${formatDate(u.last_active)}</div>
                        <div class="admin-detail-label">Auth сессий</div>
                        <div class="admin-detail-value">${u.sessions_count}</div>
                        <div class="admin-detail-label">Всего игр</div>
                        <div class="admin-detail-value">${u.games_count}</div>
                    </div>
                </div>

                <div class="admin-section-title">Игры (${data.games ? data.games.length : 0})</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${gamesHtml}
                </div>
            `;
        } catch (e) {
            content.innerHTML = `<button class="admin-back-btn" onclick="AdminApp.navigate('users')">← Назад</button><div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    async function deleteUserSessions(telegramId) {
        if (!confirm('Удалить все auth-сессии пользователя ' + telegramId + '? Пользователю придётся авторизоваться заново.')) return;
        try {
            await apiCall('admin-users.php', { method: 'DELETE', params: { id: telegramId } });
            toast('Сессии удалены', 'success');
            loadUserDetail(telegramId);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    function showGameModal(userId, sessionId, index) {
        const detail = state.selectedUserDetail;
        if (!detail || !detail.games || !detail.games[index]) return;
        state.editingGame = { userId, index, source: 'userDetail' };
        renderGameEditor(detail.games[index], userId);
    }

    function showGameDetailModal(userId, index) {
        if (!state.selectedGameDetail || !state.selectedGameDetail.games) return;
        const game = state.selectedGameDetail.games[index];
        if (!game) return;
        state.editingGame = { userId, index, source: 'gameDetail' };
        renderGameEditor(game, userId);
    }

    function renderGameEditor(game, userId) {
        // --- Players table ---
        const peoples = game.peoples || [];
        const roles = game.roles || {};
        const fouls = game.fouls || {};
        const techFouls = game.techFouls || {};
        const removed = game.removed || {};
        const playersActions = game.playersActions || {};

        let playersRows = '';
        if (peoples.length > 0) {
            playersRows = peoples.map((p, i) => {
                const login = (p && (p.login || p.name)) || '';
                if (!login) return '';
                const role = roles[i] || '';
                const foul = fouls[i] || 0;
                const tf = techFouls[i] || 0;
                const isRemoved = removed[i] || false;
                const actions = playersActions[i] || {};
                const actionKeys = Object.keys(actions);
                const actionBadges = actionKeys.slice(0, 3).map(k => `<span class="admin-badge" style="font-size:0.68em;margin:1px">${escapeHtml(k)}</span>`).join('');
                const roleClass = (role === 'don' || role === 'mafia' || role === 'black' || role === 'maniac' || role === 'oyabun' || role === 'yakuza' || role === 'ripper' || role === 'swindler' || role === 'thief' || role === 'snitch' || role === 'fangirl' || role === 'lawyer') ? 'room-role-mafia' : role === 'sheriff' ? 'room-role-sheriff' : (role === 'doctor' || role === 'detective' || role === 'jailer' || role === 'bodyguard' || role === 'judge' || role === 'priest') ? 'room-role-sheriff' : '';
                return `<tr class="${isRemoved ? 'room-player-removed' : ''}">
                    <td><b>${i + 1}</b></td>
                    <td>${escapeHtml(login)}</td>
                    <td>
                        <select class="room-role-select ${roleClass}" data-field="roles" data-idx="${i}">
                            <option value="" ${!role ? 'selected' : ''}>—</option>
                            <option value="city" ${role === 'city' ? 'selected' : ''}>🏙 Мирный</option>
                            <option value="mafia" ${role === 'mafia' || role === 'black' ? 'selected' : ''}>🔫 Мафия</option>
                            <option value="don" ${role === 'don' ? 'selected' : ''}>🎩 Дон</option>
                            <option value="sheriff" ${role === 'sheriff' ? 'selected' : ''}>⭐ Шериф</option>
                            <option value="doctor" ${role === 'doctor' ? 'selected' : ''}>🩺 Доктор</option>
                            <option value="maniac" ${role === 'maniac' ? 'selected' : ''}>🔪 Маньяк</option>
                            <option value="detective" ${role === 'detective' ? 'selected' : ''}>🔍 Детектив</option>
                            <option value="kamikaze" ${role === 'kamikaze' ? 'selected' : ''}>💣 Камикадзе</option>
                            <option value="immortal" ${role === 'immortal' ? 'selected' : ''}>♾ Бессмертный</option>
                            <option value="beauty" ${role === 'beauty' ? 'selected' : ''}>🌸 Красотка</option>
                            <option value="oyabun" ${role === 'oyabun' ? 'selected' : ''}>☯ Оябун</option>
                            <option value="yakuza" ${role === 'yakuza' ? 'selected' : ''}>⚔ Якудза</option>
                            <option value="peace" ${role === 'peace' ? 'selected' : ''}>🕊 Мирный (city)</option>
                        </select>
                    </td>
                    <td><input type="number" class="game-edit-num" data-field="fouls" data-idx="${i}" value="${foul}" min="0" max="4"></td>
                    <td><input type="number" class="game-edit-num" data-field="techFouls" data-idx="${i}" value="${tf}" min="0" max="4"></td>
                    <td>
                        <label class="game-edit-check"><input type="checkbox" data-field="removed" data-idx="${i}" ${isRemoved ? 'checked' : ''}><span>${isRemoved ? 'Выбыл' : 'В игре'}</span></label>
                    </td>
                    <td>${actionBadges}${actionKeys.length > 3 ? '<span style="font-size:0.7em;color:var(--text-muted)">+' + (actionKeys.length - 3) + '</span>' : ''}</td>
                </tr>`;
            }).filter(Boolean).join('');
        }

        const playersTable = playersRows ? `
            <div class="game-editor-section">
                <div class="game-editor-section-title">👥 Игроки (${peoples.filter(p => p && (p.login || p.name)).length})</div>
                <div class="admin-table-wrapper">
                    <table class="admin-table" id="game-editor-players">
                        <thead><tr><th>#</th><th>Игрок</th><th>Роль</th><th>Фолы</th><th>Тех.фолы</th><th>Статус</th><th>Действия</th></tr></thead>
                        <tbody>${playersRows}</tbody>
                    </table>
                </div>
            </div>` : '';

        // --- Game settings ---
        const mode = game.cityMode ? 'Городская мафия' : game.funkyMode ? 'Фанки' : (game.tournamentId ? 'Турнир #' + (game.tournamentId || '') : (game.manualMode ? 'Ручной' : 'GoMafia'));
        const bestMoveStr = (game.bestMove || []).map(b => b + 1).join(', ');
        const nominations = game.nominations || {};
        const nomStr = Object.entries(nominations).filter(([k, v]) => v).map(([k, v]) => `${parseInt(k)+1}→${v}`).join(', ');

        // Voting info
        let votingInfoHtml = '';
        if (game.votingHistory && game.votingHistory.length > 0) {
            const vhRows = game.votingHistory.map((vh, idx) => {
                const noms = Object.values(vh.nominations || {}).filter(Boolean).length;
                const winners = (vh.winners || []).map(w => w + 1).join(', ');
                return `<tr><td>${idx + 1}</td><td>${noms}</td><td>${winners || '—'}</td></tr>`;
            }).join('');
            votingInfoHtml = `
                <div class="game-editor-section">
                    <div class="game-editor-section-title">📜 История голосований</div>
                    <div class="admin-table-wrapper">
                        <table class="admin-table"><thead><tr><th>Круг</th><th>Номинаций</th><th>Выбыли</th></tr></thead><tbody>${vhRows}</tbody></table>
                    </div>
                </div>`;
        }

        // Protocol
        let protocolHtml = '';
        if (game.protocolData) {
            const pd = game.protocolData;
            const protoEntries = Object.entries(pd).filter(([k, v]) => v && v.length > 0);
            if (protoEntries.length > 0) {
                const protoRows = protoEntries.map(([seat, data]) => {
                    const d = Array.isArray(data) ? data.join(', ') : String(data);
                    return `<tr><td>Место ${parseInt(seat) + 1}</td><td>${escapeHtml(d)}</td></tr>`;
                }).join('');
                protocolHtml = `
                    <div class="game-editor-section">
                        <div class="game-editor-section-title">📋 Протокол</div>
                        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>Место</th><th>Данные</th></tr></thead><tbody>${protoRows}</tbody></table></div>
                    </div>`;
            }
        }

        showModal(`
            <div class="admin-modal-header">
                <div class="admin-modal-title">✏️ Редактор игры</div>
                <button class="admin-modal-close" onclick="AdminApp.closeModal()">✕</button>
            </div>

            <div class="game-editor-info-grid">
                <div class="game-editor-field">
                    <span class="game-editor-label">Session ID</span>
                    <span class="game-editor-val" style="font-size:0.78em">${escapeHtml(game.sessionId || '—')}</span>
                </div>
                <div class="game-editor-field">
                    <span class="game-editor-label">Режим</span>
                    <span class="game-editor-val">${escapeHtml(mode)}</span>
                </div>
                <div class="game-editor-field">
                    <span class="game-editor-label">Дата</span>
                    <span class="game-editor-val">${game.timestamp ? formatDate(new Date(game.timestamp)) : '—'}</span>
                </div>
                <div class="game-editor-field">
                    <span class="game-editor-label">Номер игры</span>
                    <span class="game-editor-val">${game.gameNumber || game.manualGameSelected || '—'}</span>
                </div>
                <div class="game-editor-field">
                    <span class="game-editor-label">Номинации</span>
                    <span class="game-editor-val">${nomStr || '—'}</span>
                </div>
                <div class="game-editor-field">
                    <span class="game-editor-label">Лучший ход</span>
                    <span class="game-editor-val">${bestMoveStr || '—'}</span>
                </div>
            </div>

            <div class="game-editor-section">
                <div class="game-editor-section-title">⚙️ Основные параметры</div>
                <div class="game-editor-controls">
                    <div class="game-editor-control">
                        <label>Победитель</label>
                        <select id="ge-winnerTeam">
                            <option value="" ${!game.winnerTeam ? 'selected' : ''}>Не определён</option>
                            <option value="civilians" ${game.winnerTeam === 'civilians' ? 'selected' : ''}>🔴 Мирные (civilians)</option>
                            <option value="city" ${game.winnerTeam === 'city' ? 'selected' : ''}>🏙 Мирные (city)</option>
                            <option value="mafia" ${game.winnerTeam === 'mafia' ? 'selected' : ''}>🔫 Мафия (mafia)</option>
                            <option value="draw" ${game.winnerTeam === 'draw' ? 'selected' : ''}>🤝 Ничья (draw)</option>
                        </select>
                    </div>
                    <div class="game-editor-control">
                        <label>ПКМ (первый убитый, 0-based)</label>
                        <input type="number" id="ge-firstKilledPlayer" value="${game.firstKilledPlayer !== null && game.firstKilledPlayer !== undefined ? game.firstKilledPlayer : ''}" min="-1" max="10" placeholder="—">
                    </div>
                    <div class="game-editor-control">
                        <label>Убит ночью (0-based)</label>
                        <input type="number" id="ge-killedOnNight" value="${game.killedOnNight !== null && game.killedOnNight !== undefined ? game.killedOnNight : ''}" min="-1" max="10" placeholder="—">
                    </div>
                    <div class="game-editor-control">
                        <label>Лучший ход (через запятую, 0-based)</label>
                        <input type="text" id="ge-bestMove" value="${(game.bestMove || []).join(', ')}" placeholder="0, 3, 5">
                    </div>
                </div>
            </div>

            ${playersTable}
            ${votingInfoHtml}
            ${protocolHtml}

            <div class="game-editor-section">
                <div class="game-editor-section-title">📄 Raw JSON</div>
                <textarea class="admin-input game-editor-json" id="ge-raw-json" rows="8">${escapeHtml(JSON.stringify(game, null, 2))}</textarea>
                <div style="font-size:0.72em;color:var(--text-muted);margin-top:4px">⚠️ Изменения в JSON перезапишут все поля. Используйте с осторожностью.</div>
            </div>

            <div class="game-editor-actions">
                <button class="admin-btn admin-btn-primary" onclick="AdminApp.saveGameEdit()">💾 Сохранить изменения</button>
                <button class="admin-btn admin-btn-secondary" onclick="AdminApp.saveGameFromJson()">📄 Сохранить из JSON</button>
                <button class="admin-btn admin-btn-danger" onclick="AdminApp.deleteGame('${userId}','${escapeHtml(game.sessionId || '')}'); AdminApp.closeModal();">🗑 Удалить</button>
            </div>
        `);
    }

    async function saveGameEdit() {
        const eg = state.editingGame;
        if (!eg) { toast('Нет данных для сохранения', 'error'); return; }

        // Собираем данные из UI
        const changes = {};

        // Winner
        const winnerEl = document.getElementById('ge-winnerTeam');
        if (winnerEl) changes.winnerTeam = winnerEl.value || null;

        // FirstKilledPlayer
        const fkpEl = document.getElementById('ge-firstKilledPlayer');
        if (fkpEl) changes.firstKilledPlayer = fkpEl.value !== '' ? parseInt(fkpEl.value) : null;

        // KilledOnNight
        const konEl = document.getElementById('ge-killedOnNight');
        if (konEl) changes.killedOnNight = konEl.value !== '' ? parseInt(konEl.value) : null;

        // BestMove
        const bmEl = document.getElementById('ge-bestMove');
        if (bmEl) {
            const val = bmEl.value.trim();
            changes.bestMove = val ? val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
        }

        // Players table: roles, fouls, techFouls, removed
        const table = document.getElementById('game-editor-players');
        if (table) {
            const newRoles = {};
            const newFouls = {};
            const newTechFouls = {};
            const newRemoved = {};

            table.querySelectorAll('[data-field]').forEach(el => {
                const field = el.dataset.field;
                const idx = parseInt(el.dataset.idx);
                if (isNaN(idx)) return;

                if (field === 'roles') newRoles[idx] = el.value;
                else if (field === 'fouls') newFouls[idx] = parseInt(el.value) || 0;
                else if (field === 'techFouls') newTechFouls[idx] = parseInt(el.value) || 0;
                else if (field === 'removed') newRemoved[idx] = el.checked;
            });

            changes.roles = newRoles;
            changes.fouls = newFouls;
            changes.techFouls = newTechFouls;
            changes.removed = newRemoved;
        }

        // Determine which game
        let game;
        if (eg.source === 'userDetail') {
            game = state.selectedUserDetail.games[eg.index];
        } else {
            game = state.selectedGameDetail.games[eg.index];
        }
        if (!game || !game.sessionId) { toast('Сессия не найдена', 'error'); return; }

        try {
            await apiCall('admin-sessions.php', {
                body: { userId: eg.userId, sessionId: game.sessionId, data: changes }
            });
            toast('Игра обновлена', 'success');
            closeModal();
            // Refresh
            if (eg.source === 'userDetail') loadUserDetail(eg.userId);
            else loadGameDetail(eg.userId);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    async function saveGameFromJson() {
        const eg = state.editingGame;
        if (!eg) { toast('Нет данных', 'error'); return; }

        const jsonEl = document.getElementById('ge-raw-json');
        if (!jsonEl) return;

        let parsed;
        try {
            parsed = JSON.parse(jsonEl.value);
        } catch (e) {
            toast('Некорректный JSON: ' + e.message, 'error');
            return;
        }

        if (!confirm('Перезаписать ВСЮ игру из JSON? Это заменит все данные сессии.')) return;

        let game;
        if (eg.source === 'userDetail') {
            game = state.selectedUserDetail.games[eg.index];
        } else {
            game = state.selectedGameDetail.games[eg.index];
        }
        if (!game || !game.sessionId) { toast('Сессия не найдена', 'error'); return; }

        // Remove sessionId from parsed to avoid overwrite, keep original
        const sessionId = game.sessionId;
        parsed.sessionId = sessionId;

        try {
            await apiCall('admin-sessions.php', {
                body: { userId: eg.userId, sessionId, data: parsed }
            });
            toast('Игра полностью перезаписана из JSON', 'success');
            closeModal();
            if (eg.source === 'userDetail') loadUserDetail(eg.userId);
            else loadGameDetail(eg.userId);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    async function deleteGame(userId, sessionId) {
        if (!confirm('Удалить эту игровую сессию?')) return;
        try {
            await apiCall('admin-sessions.php', {
                method: 'DELETE',
                params: { userId, sessionId }
            });
            toast('Игра удалена', 'success');
            closeModal();
            if (state.currentPage === 'userDetail') loadUserDetail(userId);
            else loadGameDetail(userId);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    // =============================================
    // Games (list of all users with games)
    // =============================================

    async function loadGames() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-sessions.php', {
                params: { page: state.gamesPage }
            });
            state.gamesData = data;

            let rows = '';
            if (data.items && data.items.length > 0) {
                rows = data.items.map(item => {
                    const name = (item.first_name || '') + ' ' + (item.last_name || '');
                    const username = item.username ? '@' + escapeHtml(item.username) : '—';
                    return `<tr class="clickable" onclick="AdminApp.navigate('gameDetail', '${item.telegram_id}')">
                        <td>${escapeHtml(item.telegram_id)}</td>
                        <td>${escapeHtml(name.trim()) || '—'}</td>
                        <td>${username}</td>
                        <td><span class="admin-badge admin-badge-accent">${item.games_count}</span></td>
                        <td title="${formatDate(item.updated_at)}">${timeAgo(item.updated_at)}</td>
                    </tr>`;
                }).join('');
            } else {
                rows = `<tr><td colspan="5" class="admin-empty" style="padding:40px"><h3>Нет данных</h3></td></tr>`;
            }

            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <span style="font-size:0.88em;color:var(--text-secondary)">Пользователи с сохранёнными играми</span>
                    </div>
                    <div class="admin-toolbar-right">
                        <span style="font-size:0.82em;color:var(--text-muted)">Всего: ${data.total}</span>
                    </div>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Telegram ID</th>
                                <th>Имя</th>
                                <th>Username</th>
                                <th>Игр</th>
                                <th>Обновлено</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${renderPagination(data.page, data.totalPages, 'AdminApp.gamesGoToPage')}
            `;
        } catch (e) {
            content.innerHTML = `<div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    function gamesGoToPage(p) {
        state.gamesPage = p;
        loadGames();
    }

    // =============================================
    // Game Detail (all games of specific user)
    // =============================================

    async function loadGameDetail(userId) {
        if (!userId && state.selectedGameUserId) userId = state.selectedGameUserId;
        state.selectedGameUserId = userId;
        const content = document.getElementById('admin-page-content');
        document.getElementById('admin-page-title').textContent = 'Игры пользователя #' + userId;

        try {
            const data = await apiCall('admin-sessions.php', { params: { userId } });

            let gamesHtml = '';
            if (data.games && data.games.length > 0) {
                gamesHtml = data.games.map((g, i) => {
                    const winner = g.winnerTeam
                        ? `<span class="admin-badge ${g.winnerTeam === 'mafia' ? 'admin-badge-error' : (g.winnerTeam === 'city' || g.winnerTeam === 'civilians') ? 'admin-badge-success' : 'admin-badge-muted'}">${escapeHtml(g.winnerTeam)}</span>`
                        : '<span class="admin-badge admin-badge-warning">В процессе</span>';
                    const mode = g.cityMode ? 'Городская' : g.funkyMode ? 'Фанки' : (g.tournamentId ? 'Турнир' : (g.manualMode ? 'Ручной' : 'gomafia'));
                    const gameNum = g.gameNumber || g.manualGameSelected || (i + 1);
                    const date = g.timestamp ? formatDate(new Date(g.timestamp)) : '—';

                    return `<div class="admin-game-card" onclick="AdminApp.showGameDetailModal('${userId}', ${i})">
                        <div class="admin-game-card-header">
                            <span class="admin-game-card-title">Игра #${gameNum}</span>
                            ${winner}
                        </div>
                        <div class="admin-game-card-meta">
                            <span>${escapeHtml(mode)}</span>
                            <span>•</span>
                            <span>${date}</span>
                            <span>•</span>
                            <span>ID: ${escapeHtml((g.sessionId || '').substring(0, 8))}...</span>
                        </div>
                    </div>`;
                }).join('');
            } else {
                gamesHtml = '<div class="admin-empty" style="padding:40px"><h3>Нет игр</h3></div>';
            }

            content.innerHTML = `
                <button class="admin-back-btn" onclick="AdminApp.navigate('games')">← К списку</button>
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <span style="font-size:0.88em;color:var(--text-secondary)">Всего игр: ${data.total}</span>
                        ${data.updatedAt ? `<span style="font-size:0.82em;color:var(--text-muted)">Обновлено: ${formatDate(data.updatedAt)}</span>` : ''}
                    </div>
                    <div class="admin-toolbar-right">
                        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteAllGames('${userId}')">Удалить все игры</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${gamesHtml}
                </div>
            `;

            // Store for modal use
            state.selectedGameDetail = data;

        } catch (e) {
            content.innerHTML = `<button class="admin-back-btn" onclick="AdminApp.navigate('games')">← Назад</button><div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }


    async function deleteAllGames(userId) {
        if (!confirm('Удалить ВСЕ игры пользователя ' + userId + '? Это действие нельзя отменить!')) return;
        try {
            await apiCall('admin-sessions.php', {
                method: 'DELETE',
                params: { userId }
            });
            toast('Все игры удалены', 'success');
            loadGameDetail(userId);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    // =============================================
    // Summaries
    // =============================================

    async function loadSummaries() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-summaries.php');
            state.summariesData = data;

            let rows = '';
            if (data.items && data.items.length > 0) {
                rows = data.items.map(s => {
                    return `<tr class="clickable" onclick="AdminApp.showSummaryModal('${escapeHtml(s.id)}')">
                        <td style="font-family:monospace;font-size:0.82em">${escapeHtml(s.id)}</td>
                        <td>${escapeHtml(s.tournamentName)}</td>
                        <td>${s.playersCount}</td>
                        <td>${s.gamesCount}</td>
                        <td title="${formatDate(s.createdAt)}">${timeAgo(s.createdAt)}</td>
                        <td title="${formatDate(s.savedAt)}">${timeAgo(s.savedAt)}</td>
                        <td>
                            <button class="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onclick="event.stopPropagation();AdminApp.deleteSummary('${escapeHtml(s.id)}')" title="Удалить">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </td>
                    </tr>`;
                }).join('');
            } else {
                rows = `<tr><td colspan="7" class="admin-empty" style="padding:40px"><h3>Нет итогов</h3></td></tr>`;
            }

            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <span style="font-size:0.88em;color:var(--text-secondary)">Сохранённые итоги фанки-вечеров</span>
                    </div>
                    <div class="admin-toolbar-right">
                        <span style="font-size:0.82em;color:var(--text-muted)">Всего: ${data.total}</span>
                    </div>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Турнир</th>
                                <th>Игроков</th>
                                <th>Игр</th>
                                <th>Создан</th>
                                <th>Сохранён</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            content.innerHTML = `<div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    async function showSummaryModal(id) {
        try {
            const data = await apiCall('admin-summaries.php', { params: { id } });
            const json = JSON.stringify(data, null, 2);
            const truncated = json.length > 3000 ? json.substring(0, 3000) + '\n...' : json;

            let playersHtml = '';
            if (data.data && data.data.length > 0) {
                playersHtml = '<div class="admin-section-title">Игроки</div><div class="admin-players-mini" style="margin-bottom:12px">' +
                    data.data.map(p => `<span>${escapeHtml(p.login || p.name || '?')}</span>`).join('') +
                    '</div>';
            }

            showModal(`
                <div class="admin-modal-header">
                    <div class="admin-modal-title">${escapeHtml(data.tournamentName || 'Итоги')}</div>
                    <button class="admin-modal-close" onclick="AdminApp.closeModal()">✕</button>
                </div>
                <div class="admin-detail-grid" style="margin-bottom:16px">
                    <div class="admin-detail-label">ID</div>
                    <div class="admin-detail-value" style="font-family:monospace">${escapeHtml(data.id)}</div>
                    <div class="admin-detail-label">Турнир</div>
                    <div class="admin-detail-value">${escapeHtml(data.tournamentName || '—')}</div>
                    <div class="admin-detail-label">Создан</div>
                    <div class="admin-detail-value">${formatDate(data.createdAt)}</div>
                    <div class="admin-detail-label">Сохранён</div>
                    <div class="admin-detail-value">${formatDate(data.savedAt)}</div>
                    <div class="admin-detail-label">Игроков</div>
                    <div class="admin-detail-value">${data.data ? data.data.length : 0}</div>
                    <div class="admin-detail-label">Игр</div>
                    <div class="admin-detail-value">${data.games ? data.games.length : 0}</div>
                </div>
                ${playersHtml}
                <div class="admin-section-title">Данные (JSON)</div>
                <div class="admin-json">${escapeHtml(truncated)}</div>
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                    <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteSummary('${escapeHtml(data.id)}');AdminApp.closeModal();">Удалить</button>
                </div>
            `);
        } catch (e) {
            toast('Ошибка загрузки: ' + e.message, 'error');
        }
    }

    async function deleteSummary(id) {
        if (!confirm('Удалить итог ' + id + '?')) return;
        try {
            await apiCall('admin-summaries.php', {
                method: 'DELETE',
                params: { id }
            });
            toast('Итог удалён', 'success');
            loadSummaries();
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    // =============================================
    // Rooms
    // =============================================

    async function loadRooms() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-rooms.php');
            const rooms = data.rooms || [];

            const toolbar = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <span style="font-size:0.88em;color:var(--text-muted)">Всего комнат: <b style="color:var(--text)">${rooms.length}</b></span>
                    </div>
                    <div class="admin-toolbar-right">
                        <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.loadRooms()">🔄 Обновить</button>
                        ${rooms.length > 0 ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.clearAllRooms()">🗑 Удалить все</button>` : ''}
                    </div>
                </div>`;

            if (rooms.length === 0) {
                content.innerHTML = toolbar + '<div class="admin-empty"><h3>Нет активных комнат</h3><p>Комнаты создаются автоматически при подключении к игровой панели</p></div>';
                return;
            }

            const cards = rooms.map(r => {
                const statusBadge = r.winnerTeam
                    ? `<span class="admin-badge ${r.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success'}">Победа: ${escapeHtml(r.winnerTeam)}</span>`
                    : r.hasRoles
                        ? '<span class="admin-badge admin-badge-accent">Идёт игра</span>'
                        : r.playersCount > 0
                            ? '<span class="admin-badge admin-badge-warning">Подготовка</span>'
                            : '<span class="admin-badge">Пусто</span>';

                const modeBadge = r.currentMode
                    ? `<span class="admin-badge" style="font-size:0.72em">${escapeHtml(r.currentMode)}</span>`
                    : '';

                return `
                    <div class="room-card" onclick="AdminApp.navigate('roomDetail','${escapeHtml(r.roomId)}')">
                        <div class="room-card-header">
                            <div class="room-card-id">#${escapeHtml(r.roomId)}</div>
                            ${statusBadge}
                        </div>
                        <div class="room-card-stats">
                            <div class="room-card-stat">
                                <span class="room-card-stat-val">${r.playersCount}</span>
                                <span class="room-card-stat-label">игроков</span>
                            </div>
                            <div class="room-card-stat">
                                <span class="room-card-stat-val">${r.totalSeats}</span>
                                <span class="room-card-stat-label">мест</span>
                            </div>
                            <div class="room-card-stat">
                                <span class="room-card-stat-val">${r.activeNominations}</span>
                                <span class="room-card-stat-label">номинаций</span>
                            </div>
                        </div>
                        <div class="room-card-footer">
                            <span class="room-card-time">${timeAgo(r.modified)}</span>
                            <div class="room-card-badges">
                                ${modeBadge}
                                ${r.hasAvatars ? '<span class="room-card-tag">🖼️</span>' : ''}
                                ${r.hasRoles ? '<span class="room-card-tag">🎭</span>' : ''}
                            </div>
                        </div>
                        <div class="room-card-actions" onclick="event.stopPropagation()">
                            <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearRoom('${escapeHtml(r.roomId)}')" title="Очистить">🧹</button>
                            <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.deleteRoom('${escapeHtml(r.roomId)}')" title="Удалить">🗑</button>
                            <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.openRoomPanel('${escapeHtml(r.roomId)}')" title="Открыть панель">🎯</button>
                        </div>
                    </div>`;
            }).join('');

            content.innerHTML = toolbar + `<div class="rooms-grid">${cards}</div>`;
        } catch (e) {
            content.innerHTML = `<div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    async function loadRoomDetail(roomId) {
        const content = document.getElementById('admin-page-content');
        if (!roomId) { content.innerHTML = '<div class="admin-empty"><h3>roomId не указан</h3></div>'; return; }

        document.getElementById('admin-page-title').textContent = 'Комната #' + roomId;

        try {
            const data = await apiCall('admin-rooms.php', { params: { action: 'detail', roomId } });

            // --- Header ---
            const statusBadge = data.winnerTeam
                ? `<span class="admin-badge ${data.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success'}">Победа: ${escapeHtml(data.winnerTeam)}</span>`
                : data.players && data.players.some(p => p.role)
                    ? '<span class="admin-badge admin-badge-accent">Идёт игра</span>'
                    : '<span class="admin-badge admin-badge-warning">Подготовка</span>';

            const headerHtml = `
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                    <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('rooms')">← Комнаты</button>
                    <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.openRoomPanel('${escapeHtml(roomId)}')">🎯 Открыть панель</button>
                    <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('roomDetail','${escapeHtml(roomId)}')">🔄 Обновить</button>
                    <button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearRoom('${escapeHtml(roomId)}')">🧹 Очистить</button>
                    <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.deleteRoom('${escapeHtml(roomId)}')">🗑 Удалить</button>
                </div>`;

            // --- Info card ---
            const infoHtml = `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <div class="admin-card-title">📋 Информация</div>
                        ${statusBadge}
                    </div>
                    <div class="admin-grid-2" style="gap:12px">
                        <div class="room-detail-field"><span class="room-detail-label">Комната</span><span class="room-detail-val">#${escapeHtml(roomId)}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Режим</span><span class="room-detail-val">${escapeHtml(data.currentMode || '—')}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Победитель</span><span class="room-detail-val">${escapeHtml(data.winnerTeam || '—')}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Ручной режим</span><span class="room-detail-val">${data.manualMode ? 'Да' : 'Нет'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Городская мафия</span><span class="room-detail-val">${data.cityMode ? 'Да (' + (data.cityPlayersCount || '?') + ' игроков)' : 'Нет'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Игра</span><span class="room-detail-val">${data.gameSelected !== null ? '#' + data.gameSelected : '—'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Стол</span><span class="room-detail-val">${data.tableSelected !== null ? '#' + data.tableSelected : '—'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Файл</span><span class="room-detail-val">${formatBytes(data.fileSize)}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Обновлён</span><span class="room-detail-val">${formatDate(data.modified)}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">ПКМ</span><span class="room-detail-val">${data.firstKilledPlayer !== null ? 'Место ' + (data.firstKilledPlayer + 1) : '—'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Ночной убит</span><span class="room-detail-val">${data.killedOnNight !== null ? 'Место ' + (data.killedOnNight + 1) : '—'}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Тема/Схема</span><span class="room-detail-val">${escapeHtml(data.selectedBackgroundTheme || '—')} / ${escapeHtml(data.selectedColorScheme || '—')}</span></div>
                        <div class="room-detail-field"><span class="room-detail-label">Ключей в JSON</span><span class="room-detail-val">${data.rawKeys ? data.rawKeys.length : 0}</span></div>
                    </div>
                </div>`;

            // --- Players table ---
            let playersHtml = '';
            if (data.players && data.players.length > 0) {
                const rows = data.players.map(p => {
                    const avatar = data.avatars && data.avatars[p.login]
                        ? `<img src="${escapeHtml(data.avatars[p.login])}" alt="" class="room-player-avatar" onerror="this.style.display='none'">`
                        : '';
                    const roleClass = (p.role === 'don' || p.role === 'mafia' || p.role === 'black' || p.role === 'maniac' || p.role === 'oyabun' || p.role === 'yakuza') ? 'room-role-mafia' : (p.role === 'sheriff' || p.role === 'doctor' || p.role === 'detective') ? 'room-role-sheriff' : '';
                    const removedClass = p.removed ? 'room-player-removed' : '';
                    return `<tr class="${removedClass}">
                        <td><b>${p.seat}</b></td>
                        <td>${avatar}${escapeHtml(p.login || p.name)}</td>
                        <td>
                            <select class="room-role-select ${roleClass}" onchange="AdminApp.setRoomRole('${escapeHtml(roomId)}',${p.seat - 1},this.value)">
                                <option value="" ${!p.role ? 'selected' : ''}>—</option>
                                <option value="city" ${p.role === 'city' ? 'selected' : ''}>🏙 Мирный</option>
                                <option value="mafia" ${p.role === 'mafia' || p.role === 'black' ? 'selected' : ''}>🔫 Мафия</option>
                                <option value="don" ${p.role === 'don' ? 'selected' : ''}>🎩 Дон</option>
                                <option value="sheriff" ${p.role === 'sheriff' ? 'selected' : ''}>⭐ Шериф</option>
                                <option value="doctor" ${p.role === 'doctor' ? 'selected' : ''}>🩺 Доктор</option>
                                <option value="maniac" ${p.role === 'maniac' ? 'selected' : ''}>🔪 Маньяк</option>
                                <option value="detective" ${p.role === 'detective' ? 'selected' : ''}>🔍 Детектив</option>
                                <option value="kamikaze" ${p.role === 'kamikaze' ? 'selected' : ''}>💣 Камикадзе</option>
                                <option value="immortal" ${p.role === 'immortal' ? 'selected' : ''}>♾ Бессмертный</option>
                                <option value="beauty" ${p.role === 'beauty' ? 'selected' : ''}>🌸 Красотка</option>
                                <option value="oyabun" ${p.role === 'oyabun' ? 'selected' : ''}>☯ Оябун</option>
                                <option value="yakuza" ${p.role === 'yakuza' ? 'selected' : ''}>⚔ Якудза</option>
                            </select>
                        </td>
                        <td>${p.fouls > 0 ? '<span class="admin-badge admin-badge-warning">' + p.fouls + ' фол' + (p.fouls > 1 ? 'а' : '') + '</span>' : '—'}</td>
                        <td>${p.removed ? '<span class="admin-badge admin-badge-error">Выбыл</span>' : '<span class="admin-badge admin-badge-success">В игре</span>'}</td>
                        <td>
                            <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.kickRoomPlayer('${escapeHtml(roomId)}',${p.seat - 1},'${escapeHtml(p.login || p.name)}')" title="Убрать">✕</button>
                        </td>
                    </tr>`;
                }).join('');

                playersHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header"><div class="admin-card-title">👥 Игроки (${data.players.length})</div></div>
                        <div class="admin-table-wrapper">
                            <table class="admin-table">
                                <thead><tr><th>#</th><th>Игрок</th><th>Роль</th><th>Фолы</th><th>Статус</th><th></th></tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>`;
            } else {
                playersHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">👥 Игроки</div></div><div class="admin-empty" style="padding:20px"><p>Нет игроков в комнате</p></div></div>';
            }

            // --- Voting info ---
            let votingHtml = '';
            if (data.voting) {
                const v = data.voting;
                const nomList = (v.nominations || []).map((n, i) => n ? `<span class="admin-badge admin-badge-accent" style="margin:2px">Место ${i + 1} → ${n}</span>` : '').filter(Boolean).join('');
                const voteResults = (v.votingResults || []).map((r, i) => r !== null && r !== undefined ? `<span class="admin-badge" style="margin:2px">Место ${i + 1}: ${r} гол.</span>` : '').filter(Boolean).join('');
                const winners = (v.votingWinners || []).map(w => `<b>${w + 1}</b>`).join(', ');

                votingHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <div class="admin-card-title">🗳 Голосование</div>
                            ${v.votingFinished ? '<span class="admin-badge admin-badge-success">Завершено</span>' : v.nominationsLocked ? '<span class="admin-badge admin-badge-accent">Идёт</span>' : '<span class="admin-badge admin-badge-warning">Номинации</span>'}
                        </div>
                        ${nomList ? `<div style="margin-bottom:8px"><div style="font-size:0.78em;color:var(--text-muted);margin-bottom:4px">Номинации:</div>${nomList}</div>` : ''}
                        ${voteResults ? `<div style="margin-bottom:8px"><div style="font-size:0.78em;color:var(--text-muted);margin-bottom:4px">Результаты:</div>${voteResults}</div>` : ''}
                        ${winners ? `<div><div style="font-size:0.78em;color:var(--text-muted);margin-bottom:4px">Победители голосования:</div><span>Места: ${winners}</span></div>` : ''}
                        ${v.votingStage ? `<div style="margin-top:6px;font-size:0.8em;color:var(--text-muted)">Стадия: ${escapeHtml(v.votingStage)}</div>` : ''}
                    </div>`;
            }

            // --- Voting history ---
            let voteHistHtml = '';
            if (data.votingHistory && data.votingHistory.length > 0) {
                const histRows = data.votingHistory.map((vh, idx) => {
                    const noms = (vh.nominations || []).filter(Boolean).length;
                    const winnersStr = (vh.winners || []).map(w => w + 1).join(', ');
                    return `<tr><td>${idx + 1}</td><td>${noms} номинаций</td><td>${winnersStr || '—'}</td><td>${vh.stage || '—'}</td></tr>`;
                }).join('');
                voteHistHtml = `
                    <div class="admin-card">
                        <div class="admin-card-header"><div class="admin-card-title">📜 История голосований</div></div>
                        <div class="admin-table-wrapper">
                            <table class="admin-table">
                                <thead><tr><th>Круг</th><th>Номинации</th><th>Выбыли</th><th>Стадия</th></tr></thead>
                                <tbody>${histRows}</tbody>
                            </table>
                        </div>
                    </div>`;
            }

            // --- Best move ---
            let bestMoveHtml = '';
            if (data.bestMove && data.bestMove.length > 0) {
                const bmList = data.bestMove.map(bm => `<span class="admin-badge admin-badge-accent" style="margin:2px">Место ${bm + 1}</span>`).join('');
                bestMoveHtml = `<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">🎯 Лучший ход</div></div><div>${bmList}</div></div>`;
            }

            // --- UI settings ---
            const uiHtml = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">⚙️ Настройки отображения</div></div>
                    <div class="room-toggles-grid">
                        <label class="room-toggle-item">
                            <input type="checkbox" ${data.hideSeating ? 'checked' : ''} onchange="AdminApp.updateRoomField('${escapeHtml(roomId)}','hideSeating',this.checked)">
                            <span>Скрыть рассадку</span>
                        </label>
                        <label class="room-toggle-item">
                            <input type="checkbox" ${data.hideLeaveOrder ? 'checked' : ''} onchange="AdminApp.updateRoomField('${escapeHtml(roomId)}','hideLeaveOrder',this.checked)">
                            <span>Скрыть порядок выбывания</span>
                        </label>
                        <label class="room-toggle-item">
                            <input type="checkbox" ${data.hideRolesStatus ? 'checked' : ''} onchange="AdminApp.updateRoomField('${escapeHtml(roomId)}','hideRolesStatus',this.checked)">
                            <span>Скрыть статус ролей</span>
                        </label>
                        <label class="room-toggle-item">
                            <input type="checkbox" ${data.hideBestMove ? 'checked' : ''} onchange="AdminApp.updateRoomField('${escapeHtml(roomId)}','hideBestMove',this.checked)">
                            <span>Скрыть лучший ход</span>
                        </label>
                    </div>
                </div>`;

            // --- Text fields ---
            const textsHtml = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">📝 Текстовые поля</div></div>
                    <div style="display:flex;flex-direction:column;gap:10px">
                        <div>
                            <label style="font-size:0.78em;color:var(--text-muted)">Основная информация</label>
                            <textarea class="admin-input" id="room-mainInfo" rows="2" style="margin-top:4px">${escapeHtml(data.mainInfoText || '')}</textarea>
                            <button class="admin-btn admin-btn-sm admin-btn-primary" style="margin-top:4px" onclick="AdminApp.updateRoomField('${escapeHtml(roomId)}','mainInfoText',document.getElementById('room-mainInfo').value)">Сохранить</button>
                        </div>
                        <div>
                            <label style="font-size:0.78em;color:var(--text-muted)">Дополнительная информация</label>
                            <textarea class="admin-input" id="room-addInfo" rows="2" style="margin-top:4px">${escapeHtml(data.additionalInfoText || '')}</textarea>
                            <button class="admin-btn admin-btn-sm admin-btn-primary" style="margin-top:4px" onclick="AdminApp.updateRoomField('${escapeHtml(roomId)}','additionalInfoText',document.getElementById('room-addInfo').value)">Сохранить</button>
                        </div>
                    </div>
                </div>`;

            content.innerHTML = `
                ${headerHtml}
                ${infoHtml}
                ${playersHtml}
                <div class="admin-grid-2">
                    ${votingHtml}
                    ${bestMoveHtml}
                </div>
                ${voteHistHtml}
                <div class="admin-grid-2">
                    ${uiHtml}
                    ${textsHtml}
                </div>
            `;
        } catch (e) {
            content.innerHTML = `<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate('rooms')">← Комнаты</button><div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    function formatBytes(bytes) {
        if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    async function clearRoom(roomId) {
        if (!confirm('Очистить комнату #' + roomId + '? Все данные игры будут сброшены.')) return;
        try {
            await apiCall('admin-rooms.php', { body: { action: 'clear', roomId } });
            toast('Комната очищена', 'success');
            if (state.currentPage === 'roomDetail') loadRoomDetail(roomId);
            else loadRooms();
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function deleteRoom(roomId) {
        if (!confirm('Удалить комнату #' + roomId + ' полностью?')) return;
        try {
            await apiCall('admin-rooms.php', { body: { action: 'delete', roomId } });
            toast('Комната удалена', 'success');
            navigate('rooms');
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function clearAllRooms() {
        if (!confirm('Удалить ВСЕ комнаты? Это действие необратимо!')) return;
        if (!confirm('Вы уверены? Все файлы комнат и аватаров будут удалены.')) return;
        try {
            const result = await apiCall('admin-rooms.php', { body: { action: 'clearAll' } });
            toast(result.message || 'Все комнаты удалены', 'success');
            loadRooms();
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function kickRoomPlayer(roomId, seat, name) {
        if (!confirm('Убрать игрока ' + name + ' (место ' + (seat + 1) + ')?')) return;
        try {
            await apiCall('admin-rooms.php', { body: { action: 'kickPlayer', roomId, seat } });
            toast('Игрок убран', 'success');
            loadRoomDetail(roomId);
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function setRoomRole(roomId, seat, role) {
        try {
            await apiCall('admin-rooms.php', { body: { action: 'setRole', roomId, seat, role } });
            toast('Роль обновлена', 'success');
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function updateRoomField(roomId, field, value) {
        try {
            await apiCall('admin-rooms.php', { body: { action: 'updateField', roomId, field, value } });
            toast('Сохранено', 'success');
        } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    function openRoomPanel(roomId) {
        window.open('../panel.html?room=' + encodeURIComponent(roomId), '_blank');
    }

    // =============================================
    // Players (from players table) + GoMafia Sync
    // =============================================

    let syncPollTimer = null;

    async function loadPlayers() {
        const content = document.getElementById('admin-page-content');
        const searchVal = escapeHtml(state.playersSearch);

        // Получаем статус синхронизации
        let syncStatus = null;
        try {
            syncStatus = await apiCall('admin-sync-players.php', { params: { action: 'status' } });
        } catch (e) { /* ignore */ }

        const isRunning = syncStatus && syncStatus.running;

        // Sync panel HTML
        const syncPanelHtml = renderSyncPanel(syncStatus);

        content.innerHTML = `
            ${syncPanelHtml}
            <div class="admin-toolbar" style="margin-top:20px">
                <div class="admin-toolbar-left">
                    <div class="admin-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input class="admin-input" id="players-search" placeholder="Поиск по никнейму..." value="${searchVal}" onkeydown="if(event.key==='Enter')AdminApp.searchPlayers()">
                    </div>
                    <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.searchPlayers()">Найти</button>
                    ${state.playersSearch ? `<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearPlayerSearch()">✕ Сбросить</button>` : ''}
                </div>
            </div>
            <div id="players-results"><div class="admin-loading" style="display:none"><div class="admin-spinner"></div></div></div>
        `;

        // Если синхронизация идёт — запускаем поллинг
        if (isRunning) {
            startSyncPolling();
        }

        // Если есть поисковый запрос — выполняем
        if (state.playersSearch) {
            await performPlayerSearch();
        } else {
            document.getElementById('players-results').innerHTML = '<div class="admin-empty"><h3>Введите имя игрока</h3><p>Поиск по таблице players из gomafia</p></div>';
        }
    }

    function renderSyncPanel(syncStatus) {
        const isRunning = syncStatus && syncStatus.running;
        const isDone = syncStatus && syncStatus.status === 'done';
        const isStopped = syncStatus && syncStatus.status === 'stopped';
        const isError = syncStatus && syncStatus.status === 'error';
        const isStalled = syncStatus && syncStatus.status === 'stalled';

        let progressHtml = '';
        let statsHtml = '';

        if (isRunning && syncStatus) {
            const checked = syncStatus.checked || 0;
            const total = (syncStatus.rangeEnd || 0) - (syncStatus.rangeStart || 0);
            const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;
            const found = syncStatus.found || 0;
            const lastPlayer = syncStatus.lastPlayer || '';
            const currentId = syncStatus.currentId || 0;
            const updated = syncStatus.updated || 0;
            const inserted = syncStatus.inserted || 0;
            const elapsed = syncStatus.startedAt ? Math.round((Date.now() - new Date(syncStatus.startedAt).getTime()) / 1000) : 0;
            const elapsedStr = elapsed >= 60 ? Math.floor(elapsed / 60) + ' мин ' + (elapsed % 60) + ' сек' : elapsed + ' сек';

            const statusText = syncStatus.status === 'getting_build_id'
                ? '🔍 Получение buildId с gomafia.pro...'
                : `⏳ ID: ${currentId}${lastPlayer ? ' — ' + escapeHtml(lastPlayer) : ''}`;

            progressHtml = `
                <div class="sync-progress-section">
                    <div class="sync-progress-header">
                        <span class="sync-progress-status">${statusText}</span>
                        <span class="sync-progress-pct">${pct}%</span>
                    </div>
                    <div class="sync-progress-track">
                        <div class="sync-progress-fill" id="sync-progress-bar" style="width:${pct}%"></div>
                    </div>
                    <div class="sync-stats-row">
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${checked}</span>
                            <span class="sync-stat-label">Проверено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--success)">${found}</span>
                            <span class="sync-stat-label">Найдено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${updated}</span>
                            <span class="sync-stat-label">Обновлено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--accent)">${inserted}</span>
                            <span class="sync-stat-label">Добавлено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${elapsedStr}</span>
                            <span class="sync-stat-label">Прошло</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if ((isDone || isStopped || isError || isStalled) && syncStatus) {
            const badgeClass = isDone ? 'admin-badge-success' : (isError || isStalled) ? 'admin-badge-error' : 'admin-badge-warning';
            const badgeText = isDone ? '✅ Завершено' : isError ? '❌ Ошибка' : isStalled ? '⚠️ Зависло' : '⏸ Остановлено';

            statsHtml = `
                <div class="sync-progress-section">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span class="admin-badge ${badgeClass}">${badgeText}</span>
                        ${syncStatus.error ? `<span style="font-size:0.82em;color:var(--error)">${escapeHtml(syncStatus.error)}</span>` : ''}
                        ${syncStatus.note ? `<span style="font-size:0.82em;color:var(--warning)">${escapeHtml(syncStatus.note)}</span>` : ''}
                    </div>
                    <div class="sync-stats-row" style="margin-top:10px">
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${syncStatus.checked || 0}</span>
                            <span class="sync-stat-label">Проверено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--success)">${syncStatus.found || 0}</span>
                            <span class="sync-stat-label">Найдено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${syncStatus.updated || 0}</span>
                            <span class="sync-stat-label">Обновлено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--accent)">${syncStatus.inserted || 0}</span>
                            <span class="sync-stat-label">Добавлено</span>
                        </div>
                    </div>
                    ${syncStatus.finishedAt ? `<div style="font-size:0.75em;color:var(--text-muted);margin-top:6px">Завершено: ${formatDate(syncStatus.finishedAt)}</div>` : ''}
                </div>
            `;
        }

        // Карточка ручного добавления игрока
        const addPlayerHtml = `
            <div class="admin-card" style="margin-top:16px">
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-title">➕ Добавить игрока вручную</div>
                        <div class="admin-card-subtitle">Вставьте ссылку на профиль GoMafia или числовой ID</div>
                    </div>
                </div>
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:220px">
                        <input class="admin-input" id="add-player-input" placeholder="https://gomafia.pro/stats/9382  или  9382" onkeydown="if(event.key==='Enter')AdminApp.addPlayer()">
                    </div>
                    <button class="admin-btn admin-btn-primary" id="add-player-btn" onclick="AdminApp.addPlayer()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                        Добавить
                    </button>
                </div>
                <div id="add-player-result" style="margin-top:10px"></div>
            </div>
        `;

        return `
            <div class="admin-card">
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-title">🔄 Массовая синхронизация с GoMafia.pro</div>
                        <div class="admin-card-subtitle">Загрузка логинов, аватаров и клубов по диапазону ID</div>
                    </div>
                </div>
                <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:120px">
                        <label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">ID с</label>
                        <input class="admin-input" id="sync-range-start" type="number" value="1" min="1" style="max-width:140px" ${isRunning ? 'disabled' : ''}>
                    </div>
                    <div style="flex:1;min-width:120px">
                        <label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">ID по</label>
                        <input class="admin-input" id="sync-range-end" type="number" value="10000" min="2" style="max-width:140px" ${isRunning ? 'disabled' : ''}>
                    </div>
                    ${isRunning
                        ? `<button class="admin-btn admin-btn-danger" onclick="AdminApp.stopSync()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                            Остановить
                           </button>`
                        : `<button class="admin-btn admin-btn-primary" onclick="AdminApp.startSync()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Запустить
                           </button>`
                    }
                </div>
                <div id="sync-status-area">
                    ${progressHtml}
                    ${statsHtml}
                </div>
            </div>
            ${addPlayerHtml}
        `;
    }

    async function startSync() {
        const rangeStart = parseInt(document.getElementById('sync-range-start').value) || 1;
        const rangeEnd = parseInt(document.getElementById('sync-range-end').value) || 10000;

        if (rangeStart >= rangeEnd) {
            toast('Начальный ID должен быть меньше конечного', 'error');
            return;
        }
        if (rangeEnd - rangeStart > 50000) {
            toast('Максимальный диапазон — 50 000', 'error');
            return;
        }

        try {
            await apiCall('admin-sync-players.php', {
                body: { action: 'start', rangeStart, rangeEnd }
            });
            toast('Синхронизация запущена', 'success');
            startSyncPolling();
            // Перерендерим страницу
            loadPlayers();
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    async function stopSync() {
        try {
            await apiCall('admin-sync-players.php', {
                body: { action: 'stop' }
            });
            toast('Сигнал остановки отправлен', 'info');
            stopSyncPolling();
            setTimeout(() => loadPlayers(), 1500);
        } catch (e) {
            toast('Ошибка: ' + e.message, 'error');
        }
    }

    function startSyncPolling() {
        stopSyncPolling();
        syncPollTimer = setInterval(async () => {
            if (state.currentPage !== 'players') {
                stopSyncPolling();
                return;
            }
            try {
                const syncStatus = await apiCall('admin-sync-players.php', { params: { action: 'status' } });
                updateSyncUI(syncStatus);
                if (!syncStatus.running) {
                    stopSyncPolling();
                }
            } catch (e) { /* ignore */ }
        }, 2000);
    }

    function stopSyncPolling() {
        if (syncPollTimer) {
            clearInterval(syncPollTimer);
            syncPollTimer = null;
        }
    }

    function updateSyncUI(syncStatus) {
        const area = document.getElementById('sync-status-area');
        if (!area) return;

        if (syncStatus && syncStatus.running) {
            const checked = syncStatus.checked || 0;
            const total = (syncStatus.rangeEnd || 0) - (syncStatus.rangeStart || 0);
            const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;
            const found = syncStatus.found || 0;
            const lastPlayer = syncStatus.lastPlayer || '';
            const currentId = syncStatus.currentId || 0;
            const updated = syncStatus.updated || 0;
            const inserted = syncStatus.inserted || 0;
            const elapsed = syncStatus.startedAt ? Math.round((Date.now() - new Date(syncStatus.startedAt).getTime()) / 1000) : 0;
            const elapsedStr = elapsed >= 60 ? Math.floor(elapsed / 60) + ' мин ' + (elapsed % 60) + ' сек' : elapsed + ' сек';

            const statusText = syncStatus.status === 'getting_build_id'
                ? '🔍 Получение buildId с gomafia.pro...'
                : `⏳ ID: ${currentId}${lastPlayer ? ' — ' + escapeHtml(lastPlayer) : ''}`;

            area.innerHTML = `
                <div class="sync-progress-section">
                    <div class="sync-progress-header">
                        <span class="sync-progress-status">${statusText}</span>
                        <span class="sync-progress-pct">${pct}%</span>
                    </div>
                    <div class="sync-progress-track">
                        <div class="sync-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="sync-stats-row">
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${checked}</span>
                            <span class="sync-stat-label">Проверено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--success)">${found}</span>
                            <span class="sync-stat-label">Найдено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${updated}</span>
                            <span class="sync-stat-label">Обновлено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num" style="color:var(--accent)">${inserted}</span>
                            <span class="sync-stat-label">Добавлено</span>
                        </div>
                        <div class="sync-stat-item">
                            <span class="sync-stat-num">${elapsedStr}</span>
                            <span class="sync-stat-label">Прошло</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (syncStatus && !syncStatus.running && syncStatus.status !== 'idle') {
            // Finished — full reload to show final state
            loadPlayers();
        }
    }

    async function performPlayerSearch() {
        const resultsEl = document.getElementById('players-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';

        try {
            const resp = await fetch('../api/players-search.php?za&q=' + encodeURIComponent(state.playersSearch));
            const data = await resp.json();
            state.playersData = data;

            let rows = '';
            if (data && data.length > 0) {
                rows = data.map(p => {
                    const avatar = p.avatar_link ? `<img src="${escapeHtml(p.avatar_link)}" alt="" width="28" height="28" style="border-radius:50%;vertical-align:middle;margin-right:8px" onerror="this.style.display='none'">` : '';
                    return `<tr>
                        <td>${avatar}${escapeHtml(p.login)}</td>
                        <td>${escapeHtml(p.title || '—')}</td>
                        <td>${escapeHtml(p.id || '—')}</td>
                    </tr>`;
                }).join('');
            } else {
                rows = `<tr><td colspan="3" class="admin-empty" style="padding:40px"><h3>Ничего не найдено</h3></td></tr>`;
            }

            resultsEl.innerHTML = `
                <div class="admin-table-wrapper">
                    <table class="admin-table">
                        <thead><tr><th>Логин</th><th>Клуб</th><th>gomafia ID</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            resultsEl.innerHTML = `<div class="admin-empty"><h3>Ошибка</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
    }

    async function addPlayer() {
        const input = document.getElementById('add-player-input');
        const resultEl = document.getElementById('add-player-result');
        const btn = document.getElementById('add-player-btn');
        if (!input || !resultEl) return;

        const value = input.value.trim();
        if (!value) {
            toast('Введите ссылку или ID игрока', 'error');
            return;
        }

        // Disable button, show loading
        btn.disabled = true;
        btn.innerHTML = '<span class="admin-refreshing"></span> Загрузка...';
        resultEl.innerHTML = '';

        try {
            const data = await apiCall('admin-sync-players.php', {
                body: { action: 'addPlayer', gomafiaId: value }
            });

            if (data.ok && data.player) {
                const p = data.player;
                const avatar = p.avatar_link ? `<img src="${escapeHtml(p.avatar_link)}" alt="" style="width:36px;height:36px;border-radius:50%;vertical-align:middle;margin-right:10px" onerror="this.style.display='none'">` : '';
                const actionText = data.action === 'inserted' ? 'Добавлен' : 'Обновлён';
                const actionBadge = data.action === 'inserted' ? 'admin-badge-success' : 'admin-badge-accent';

                resultEl.innerHTML = `
                    <div class="sync-add-result success">
                        ${avatar}
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:0.92em">${escapeHtml(p.login)}</div>
                            <div style="font-size:0.78em;color:var(--text-muted)">${escapeHtml(p.title || '')} · ID: ${escapeHtml(p.id || '')}</div>
                        </div>
                        <span class="admin-badge ${actionBadge}">${actionText}</span>
                    </div>
                `;
                input.value = '';
                toast(`${actionText}: ${p.login}`, 'success');
            }
        } catch (e) {
            resultEl.innerHTML = `
                <div class="sync-add-result error">
                    <span style="color:var(--error);font-size:0.88em">${escapeHtml(e.message)}</span>
                </div>
            `;
            toast('Ошибка: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Добавить`;
        }
    }

    function searchPlayers() {
        state.playersSearch = document.getElementById('players-search').value.trim();
        if (state.playersSearch) {
            performPlayerSearch();
        } else {
            document.getElementById('players-results').innerHTML = '<div class="admin-empty"><h3>Введите имя игрока</h3><p>Поиск по таблице players из gomafia</p></div>';
        }
    }

    function clearPlayerSearch() {
        state.playersSearch = '';
        loadPlayers();
    }

    // =============================================
    // Pagination Helper
    // =============================================

    function renderPagination(current, total, callbackName) {
        if (total <= 1) return '';

        let buttons = '';
        buttons += `<button ${current <= 1 ? 'disabled' : ''} onclick="${callbackName}(${current - 1})">←</button>`;

        const maxVisible = 7;
        let start = Math.max(1, current - Math.floor(maxVisible / 2));
        let end = Math.min(total, start + maxVisible - 1);
        if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

        if (start > 1) {
            buttons += `<button onclick="${callbackName}(1)">1</button>`;
            if (start > 2) buttons += `<button disabled>...</button>`;
        }

        for (let i = start; i <= end; i++) {
            buttons += `<button class="${i === current ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
        }

        if (end < total) {
            if (end < total - 1) buttons += `<button disabled>...</button>`;
            buttons += `<button onclick="${callbackName}(${total})">${total}</button>`;
        }

        buttons += `<button ${current >= total ? 'disabled' : ''} onclick="${callbackName}(${current + 1})">→</button>`;

        return `<div class="admin-pagination">${buttons}</div>`;
    }

    // =============================================
    // Sidebar Toggle
    // =============================================

    function initSidebar() {
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const closeBtn = document.getElementById('sidebar-close-btn');
        const sidebar = document.getElementById('admin-sidebar');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
        }

        // Close on click outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    // =============================================
    // Init
    // =============================================

    function init() {
        initSidebar();
        checkAuth();
    }

    // =============================================
    // Public API
    // =============================================

    window.AdminApp = {
        navigate,
        logout,
        closeModal,
        loadDashboard,
        // Users
        searchUsers,
        clearUserSearch,
        sortUsers,
        usersGoToPage,
        deleteUserSessions,
        showGameModal,
        deleteGame,
        saveGameEdit,
        saveGameFromJson,
        // Games
        gamesGoToPage,
        showGameDetailModal,
        deleteAllGames,
        loadGameDetail,
        // Summaries
        showSummaryModal,
        deleteSummary,
        // Rooms
        loadRooms,
        clearRoom,
        deleteRoom,
        clearAllRooms,
        kickRoomPlayer,
        setRoomRole,
        updateRoomField,
        openRoomPanel,
        // Players
        searchPlayers,
        clearPlayerSearch,
        addPlayer,
        // Sync
        startSync,
        stopSync,
    };

    // Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

