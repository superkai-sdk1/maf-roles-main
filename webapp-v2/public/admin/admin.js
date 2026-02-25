// ==========================================================================
// MafBoard Admin Panel — Professional Dashboard
// ==========================================================================

(function () {
    'use strict';

    const AUTH_TOKEN_KEY = 'maf_auth_token';
    const AUTH_USER_KEY = 'maf_auth_user';
    const API_BASE = './api/';
    const LOGIN_BASE = '../login/';

    // =======================================================================
    // State
    // =======================================================================
    const state = {
        token: null,
        user: null,
        currentPage: 'dashboard',
        dashboardData: null,
        usersData: null, usersPage: 1, usersSearch: '', usersSort: 'last_active', usersOrder: 'DESC',
        gamesData: null, gamesPage: 1,
        summariesData: null,
        playersSearch: '', playersData: null,
        profilesData: null, profilesPage: 1, profilesSearch: '',
        sessionsData: null, sessionsPage: 1,
        selectedUserId: null, selectedUserDetail: null,
        selectedGameUserId: null, selectedGameDetail: null,
        editingGame: null,
    };

    // =======================================================================
    // Utilities
    // =======================================================================
    function getToken() { try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch(e) { return null; } }
    function getUser() { try { const d = localStorage.getItem(AUTH_USER_KEY); return d ? JSON.parse(d) : null; } catch(e) { return null; } }

    function esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            const dt = new Date(d);
            if (isNaN(dt)) return String(d);
            return dt.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        } catch(e) { return String(d); }
    }

    function formatDateShort(d) {
        if (!d) return '—';
        try {
            const dt = new Date(d);
            if (isNaN(dt)) return String(d);
            return dt.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
        } catch(e) { return String(d); }
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
        } catch(e) { return String(d); }
    }

    function formatBytes(bytes) {
        if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
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
            try { data = JSON.parse(text); } catch(pe) {
                console.error('API non-JSON:', text.substring(0, 300));
                throw new Error('Сервер вернул некорректный ответ (HTTP ' + resp.status + ')');
            }
            if (!resp.ok && data.error) throw new Error(data.error);
            return data;
        } catch(e) { console.error('API Error:', e); throw e; }
    }

    function downloadCSV(filename, headers, rows) {
        const bom = '\uFEFF';
        const csv = bom + [headers.join(';'), ...rows.map(r => r.map(c => '"' + String(c||'').replace(/"/g,'""') + '"').join(';'))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    // =======================================================================
    // Toast
    // =======================================================================
    function toast(message, type = 'info') {
        const container = document.getElementById('admin-toast-container');
        const el = document.createElement('div');
        el.className = 'admin-toast ' + type;
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        el.innerHTML = '<span style="font-size:1.1em">' + (icons[type]||'ℹ') + '</span> ' + esc(message);
        container.appendChild(el);
        setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 200); }, 3500);
    }

    // =======================================================================
    // Modal
    // =======================================================================
    function showModal(html) {
        const modal = document.getElementById('admin-modal');
        document.getElementById('admin-modal-content').innerHTML = html;
        modal.style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('admin-modal').style.display = 'none';
    }

    // =======================================================================
    // Confirm Dialog
    // =======================================================================
    let confirmResolve = null;

    function confirmDialog(title, text, opts = {}) {
        return new Promise((resolve) => {
            confirmResolve = resolve;
            const icon = opts.icon || '⚠️';
            const confirmText = opts.confirmText || 'Подтвердить';
            const cancelText = opts.cancelText || 'Отмена';
            const danger = opts.danger ? 'admin-btn-danger' : 'admin-btn-primary';
            document.getElementById('admin-confirm-content').innerHTML = `
                <div class="admin-confirm-icon">${icon}</div>
                <div class="admin-confirm-title">${esc(title)}</div>
                <div class="admin-confirm-text">${esc(text)}</div>
                <div class="admin-confirm-actions">
                    <button class="admin-btn admin-btn-secondary" onclick="AdminApp._confirmResult(false)">${cancelText}</button>
                    <button class="admin-btn ${danger}" onclick="AdminApp._confirmResult(true)">${confirmText}</button>
                </div>`;
            document.getElementById('admin-confirm').style.display = 'flex';
        });
    }

    function _confirmResult(val) {
        document.getElementById('admin-confirm').style.display = 'none';
        if (confirmResolve) { confirmResolve(val); confirmResolve = null; }
    }

    // =======================================================================
    // Auth
    // =======================================================================
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
        } catch(e) {
            authSpinner.style.display = 'none';
            authErrorMsg.textContent = 'Ошибка подключения: ' + e.message;
            authError.style.display = 'block';
            authStatus.textContent = 'Ошибка';
        }
    }

    function onAuthSuccess() {
        const nameEl = document.getElementById('admin-user-name');
        const avatarEl = document.getElementById('admin-user-avatar');
        if (state.user) {
            const name = state.user.first_name || state.user.username || 'Admin';
            nameEl.textContent = name;
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
        const overlay = document.getElementById('admin-auth-overlay');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('admin-main').style.display = 'flex';
            navigate('dashboard');
        }, 350);
    }

    function logout() {
        try { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY); } catch(e) {}
        window.location.href = '/';
    }

    // =======================================================================
    // Navigation
    // =======================================================================
    const pageTitles = {
        dashboard: 'Дашборд', users: 'Пользователи', profiles: 'Профили',
        games: 'Игровые сессии', summaries: 'Итоги вечеров', rooms: 'Комнаты',
        roomDetail: 'Комната', players: 'GoMafia Sync', sessions: 'Auth Сессии',
        system: 'Система', userDetail: 'Пользователь', gameDetail: 'Игры пользователя',
    };

    function navigate(page, params) {
        state.currentPage = page;
        document.querySelectorAll('.admin-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });
        updateBreadcrumb(page, params);
        document.getElementById('admin-sidebar').classList.remove('open');
        const content = document.getElementById('admin-page-content');
        content.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';
        content.scrollTop = 0;

        switch (page) {
            case 'dashboard': loadDashboard(); break;
            case 'users': loadUsers(); break;
            case 'profiles': loadProfiles(); break;
            case 'games': loadGames(); break;
            case 'summaries': loadSummaries(); break;
            case 'rooms': loadRooms(); break;
            case 'roomDetail': loadRoomDetail(params); break;
            case 'players': loadPlayers(); break;
            case 'sessions': loadSessions(); break;
            case 'system': loadSystem(); break;
            case 'userDetail': loadUserDetail(params); break;
            case 'gameDetail': loadGameDetail(params); break;
            default: content.innerHTML = '<div class="admin-empty"><h3>Страница не найдена</h3></div>';
        }
    }

    function updateBreadcrumb(page, params) {
        const bc = document.getElementById('admin-breadcrumb');
        const parentPages = {
            userDetail: 'users', gameDetail: 'games', roomDetail: 'rooms'
        };
        if (parentPages[page]) {
            const parentTitle = pageTitles[parentPages[page]];
            const title = pageTitles[page] + (params ? ' #' + params : '');
            bc.innerHTML = `<span class="admin-breadcrumb-item link" onclick="AdminApp.navigate('${parentPages[page]}')">${parentTitle}</span><span class="admin-breadcrumb-sep">›</span><span class="admin-breadcrumb-item">${esc(title)}</span>`;
        } else {
            bc.innerHTML = `<span class="admin-breadcrumb-item">${pageTitles[page] || page}</span>`;
        }
    }

    function refreshCurrentPage() {
        navigate(state.currentPage, state.selectedUserId || state.selectedGameUserId);
    }

    // =======================================================================
    // Pagination Helper
    // =======================================================================
    function renderPagination(current, total, callbackName) {
        if (total <= 1) return '';
        let btns = '';
        btns += `<button ${current <= 1 ? 'disabled' : ''} onclick="${callbackName}(${current - 1})">‹</button>`;
        const maxV = 7;
        let start = Math.max(1, current - Math.floor(maxV / 2));
        let end = Math.min(total, start + maxV - 1);
        if (end - start < maxV - 1) start = Math.max(1, end - maxV + 1);
        if (start > 1) { btns += `<button onclick="${callbackName}(1)">1</button>`; if (start > 2) btns += `<button disabled>…</button>`; }
        for (let i = start; i <= end; i++) btns += `<button class="${i === current ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
        if (end < total) { if (end < total - 1) btns += `<button disabled>…</button>`; btns += `<button onclick="${callbackName}(${total})">${total}</button>`; }
        btns += `<button ${current >= total ? 'disabled' : ''} onclick="${callbackName}(${current + 1})">›</button>`;
        return `<div class="admin-pagination">${btns}</div>`;
    }


    // =======================================================================
    // Dashboard
    // =======================================================================
    async function loadDashboard() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-stats.php');
            state.dashboardData = data;

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
                </div>`;

            const secondaryCards = `
                <div class="admin-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
                    <div class="admin-stat-card mini"><div class="admin-stat-label">Среднее игр / юзер</div><div class="admin-stat-value">${data.avgGamesPerUser}</div></div>
                    <div class="admin-stat-card mini"><div class="admin-stat-label">Retention</div><div class="admin-stat-value">${data.retentionRate}%</div><div style="font-size:.7em;color:var(--text-3)">${data.retentionCount} вернулись</div></div>
                    <div class="admin-stat-card mini"><div class="admin-stat-label">Комнат</div><div class="admin-stat-value">${data.activeRooms ? data.activeRooms.length : 0}</div></div>
                </div>`;

            let chartHtml = '';
            if (data.activityByDay && data.activityByDay.length > 0) {
                const maxVal = Math.max(...data.activityByDay.map(d => d.count), 1);
                const bars = data.activityByDay.map(d => {
                    const h = Math.max(4, (d.count / maxVal) * 100);
                    return '<div class="admin-chart-bar" style="height:' + h + '%"><div class="tooltip">' + formatDateShort(d.date) + ': ' + d.count + '</div></div>';
                }).join('');
                const labels = data.activityByDay.length > 1
                    ? '<div class="admin-chart-labels"><span>' + formatDateShort(data.activityByDay[0].date) + '</span><span>' + formatDateShort(data.activityByDay[data.activityByDay.length-1].date) + '</span></div>' : '';
                chartHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Активность (30 дней)</div></div><div class="admin-chart">' + bars + '</div>' + labels + '</div>';
            }

            let regChartHtml = '';
            if (data.registrationsByDay && data.registrationsByDay.length > 0) {
                const maxVal = Math.max(...data.registrationsByDay.map(d => d.count), 1);
                const bars = data.registrationsByDay.map(d => {
                    const h = Math.max(4, (d.count / maxVal) * 100);
                    return '<div class="admin-chart-bar" style="height:' + h + '%"><div class="tooltip">' + formatDateShort(d.date) + ': ' + d.count + ' новых</div></div>';
                }).join('');
                const labels = data.registrationsByDay.length > 1
                    ? '<div class="admin-chart-labels"><span>' + formatDateShort(data.registrationsByDay[0].date) + '</span><span>' + formatDateShort(data.registrationsByDay[data.registrationsByDay.length-1].date) + '</span></div>' : '';
                regChartHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Регистрации (30 дней)</div></div><div class="admin-chart">' + bars + '</div>' + labels + '</div>';
            }

            const modes = data.modeBreakdown || {};
            const modeTotal = (modes.gomafia||0) + (modes.funky||0) + (modes.manual||0) + (modes.tournament||0) + (modes.city||0);
            const mp = (v) => modeTotal > 0 ? Math.round((v/modeTotal)*100) : 0;
            const modeColors = { gomafia:'#8b5cf6', funky:'#ec4899', city:'#3b82f6', manual:'#eab308', tournament:'#22c55e' };
            const modeNames = { gomafia:'GoMafia', funky:'Фанки', city:'Городская', manual:'Ручной', tournament:'Турнир' };
            let modeRows = '';
            for (const [k,v] of Object.entries(modes)) {
                modeRows += '<div class="dash-breakdown-row"><span class="dash-dot" style="background:' + modeColors[k] + '"></span><span class="dash-breakdown-label">' + (modeNames[k]||k) + '</span><span class="dash-breakdown-bar"><span style="width:' + mp(v) + '%;background:' + modeColors[k] + '"></span></span><span class="dash-breakdown-val">' + (v||0) + '</span></div>';
            }
            const modeHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Режимы игр</div></div><div class="dash-breakdown">' + modeRows + '</div></div>';

            const wins = data.winBreakdown || {};
            const wt = (wins.city||0) + (wins.mafia||0) + (wins.draw||0) + (wins.in_progress||0);
            const wp = (v) => wt > 0 ? Math.round((v/wt)*100) : 0;
            const winHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Победители</div></div><div class="dash-breakdown">' +
                '<div class="dash-breakdown-row"><span class="dash-dot" style="background:#22c55e"></span><span class="dash-breakdown-label">Мирные</span><span class="dash-breakdown-bar"><span style="width:'+wp(wins.city)+'%;background:#22c55e"></span></span><span class="dash-breakdown-val">'+(wins.city||0)+'</span></div>' +
                '<div class="dash-breakdown-row"><span class="dash-dot" style="background:#ef4444"></span><span class="dash-breakdown-label">Мафия</span><span class="dash-breakdown-bar"><span style="width:'+wp(wins.mafia)+'%;background:#ef4444"></span></span><span class="dash-breakdown-val">'+(wins.mafia||0)+'</span></div>' +
                '<div class="dash-breakdown-row"><span class="dash-dot" style="background:#eab308"></span><span class="dash-breakdown-label">Ничья</span><span class="dash-breakdown-bar"><span style="width:'+wp(wins.draw)+'%;background:#eab308"></span></span><span class="dash-breakdown-val">'+(wins.draw||0)+'</span></div>' +
                '<div class="dash-breakdown-row"><span class="dash-dot" style="background:var(--text-3)"></span><span class="dash-breakdown-label">В процессе</span><span class="dash-breakdown-bar"><span style="width:'+wp(wins.in_progress)+'%;background:var(--surface-4)"></span></span><span class="dash-breakdown-val">'+(wins.in_progress||0)+'</span></div>' +
                '</div></div>';

            let recentUsersHtml = '';
            if (data.recentUsers && data.recentUsers.length) {
                const rows = data.recentUsers.map(u => {
                    const name = ((u.telegram_first_name||'') + ' ' + (u.telegram_last_name||'')).trim() || 'Без имени';
                    const uname = u.telegram_username ? '@' + esc(u.telegram_username) : '';
                    return '<div class="dash-user-row clickable" onclick="AdminApp.navigate(\'userDetail\',\'' + u.telegram_id + '\')"><div class="dash-user-avatar">' + name.charAt(0).toUpperCase() + '</div><div class="dash-user-info"><div class="dash-user-name">' + esc(name) + '</div><div class="dash-user-sub">' + uname + ' · ID: ' + u.telegram_id + '</div></div><div class="dash-user-time">' + timeAgo(u.first_seen) + '</div></div>';
                }).join('');
                recentUsersHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Новые пользователи</div><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'users\')">Все →</button></div>' + rows + '</div>';
            }

            let lastActiveHtml = '';
            if (data.lastActiveUsers && data.lastActiveUsers.length) {
                const rows = data.lastActiveUsers.map(u => {
                    const name = ((u.telegram_first_name||'') + ' ' + (u.telegram_last_name||'')).trim() || 'Без имени';
                    return '<div class="dash-user-row clickable" onclick="AdminApp.navigate(\'userDetail\',\'' + u.telegram_id + '\')"><div class="dash-user-avatar">' + name.charAt(0).toUpperCase() + '</div><div class="dash-user-info"><div class="dash-user-name">' + esc(name) + '</div><div class="dash-user-sub">' + (u.telegram_username ? '@' + esc(u.telegram_username) : '') + '</div></div><div class="dash-user-time">' + timeAgo(u.last_active) + '</div></div>';
                }).join('');
                lastActiveHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Последняя активность</div><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'users\')">Все →</button></div>' + rows + '</div>';
            }

            let topGamesHtml = '';
            if (data.topGameUsers && data.topGameUsers.length) {
                const medals = ['🥇','🥈','🥉'];
                const rows = data.topGameUsers.map((u, i) => {
                    const name = ((u.first_name||'') + ' ' + (u.last_name||'')).trim() || 'Без имени';
                    const medal = i < 3 ? medals[i] : (i+1) + '.';
                    return '<div class="dash-user-row clickable" onclick="AdminApp.navigate(\'userDetail\',\'' + u.telegram_id + '\')"><div class="dash-rank">' + medal + '</div><div class="dash-user-info"><div class="dash-user-name">' + esc(name) + '</div><div class="dash-user-sub">' + (u.username ? '@' + esc(u.username) : '') + '</div></div><span class="admin-badge admin-badge-accent">' + u.games_count + ' игр</span></div>';
                }).join('');
                topGamesHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Топ по играм</div><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'games\')">Все →</button></div>' + rows + '</div>';
            }

            let recentGamesHtml = '';
            if (data.recentGames && data.recentGames.length) {
                const rows = data.recentGames.map(g => {
                    const name = g.first_name || g.username || 'user';
                    const mode = g.cityMode ? '🏙️' : g.funkyMode ? '🎉' : g.tournamentId ? '🏆' : g.manualMode ? '✋' : '🌐';
                    const winner = g.winnerTeam ? '<span class="admin-badge ' + (g.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success') + '">' + esc(g.winnerTeam) + '</span>' : '<span class="admin-badge admin-badge-warning">⏳</span>';
                    return '<div class="dash-game-row clickable" onclick="AdminApp.navigate(\'gameDetail\',\'' + g.telegram_id + '\')"><div class="dash-game-info"><span class="dash-game-mode">' + mode + '</span><span class="dash-game-user">' + esc(name) + '</span>' + (g.playersCount ? '<span class="dash-game-players">' + g.playersCount + ' игр.</span>' : '') + '</div><div class="dash-game-right">' + winner + '<span class="dash-game-time">' + timeAgo(g.updated_at) + '</span></div></div>';
                }).join('');
                recentGamesHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Последние игры</div><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'games\')">Все →</button></div>' + rows + '</div>';
            }

            let roomsHtml = '';
            if (data.activeRooms && data.activeRooms.length) {
                const chips = data.activeRooms.map(r => '<div class="dash-room-chip clickable" onclick="AdminApp.navigate(\'roomDetail\',\'' + esc(r.roomId) + '\')"><span class="dash-room-id">#' + esc(r.roomId) + '</span><span class="dash-room-count">' + r.playersCount + ' игр.</span></div>').join('');
                roomsHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Активные комнаты</div><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'rooms\')">Управление →</button></div><div style="display:flex;flex-wrap:wrap;gap:6px">' + chips + '</div></div>';
            }

            const quickActions = `
                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">Быстрые действия</div></div>
                    <div class="dash-actions-grid">
                        <button class="dash-action-btn" onclick="AdminApp.navigate('users')"><span class="dash-action-icon">👥</span><span>Пользователи</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('profiles')"><span class="dash-action-icon">🪪</span><span>Профили</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('games')"><span class="dash-action-icon">🎮</span><span>Все игры</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('rooms')"><span class="dash-action-icon">🏠</span><span>Комнаты</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('players')"><span class="dash-action-icon">🔄</span><span>Синхронизация</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('sessions')"><span class="dash-action-icon">🔐</span><span>Auth Сессии</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.navigate('system')"><span class="dash-action-icon">⚙️</span><span>Система</span></button>
                        <button class="dash-action-btn" onclick="AdminApp.refreshCurrentPage()"><span class="dash-action-icon">🔃</span><span>Обновить</span></button>
                    </div>
                </div>`;

            content.innerHTML = statCards + secondaryCards + quickActions +
                '<div class="admin-grid-2">' + chartHtml + regChartHtml + '</div>' +
                '<div class="admin-grid-2">' + modeHtml + winHtml + '</div>' +
                '<div class="admin-section-title">Пользователи и активность</div>' +
                '<div class="admin-grid-2">' + recentUsersHtml + lastActiveHtml + '</div>' +
                '<div class="admin-grid-2">' + topGamesHtml + recentGamesHtml + '</div>' +
                roomsHtml;

        } catch(e) {
            content.innerHTML = '<div class="admin-empty"><h3>Ошибка загрузки</h3><p>' + esc(e.message) + '</p></div>';
        }
    }


    // =======================================================================
    // Users
    // =======================================================================
    async function loadUsers() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-users.php', {
                params: { page: state.usersPage, search: state.usersSearch, sort: state.usersSort, order: state.usersOrder }
            });
            state.usersData = data;
            let rows = '';
            if (data.users && data.users.length > 0) {
                rows = data.users.map(u => {
                    const name = esc(u.telegram_first_name||'') + ' ' + esc(u.telegram_last_name||'');
                    const username = u.telegram_username ? '@' + esc(u.telegram_username) : '—';
                    return '<tr class="clickable" onclick="AdminApp.navigate(\'userDetail\',\'' + u.telegram_id + '\')"><td>' + esc(u.telegram_id) + '</td><td>' + (name.trim()||'—') + '</td><td>' + username + '</td><td><span class="admin-badge admin-badge-accent">' + u.games_count + '</span></td><td>' + u.sessions_count + '</td><td title="' + formatDate(u.first_seen) + '">' + timeAgo(u.first_seen) + '</td><td title="' + formatDate(u.last_active) + '">' + timeAgo(u.last_active) + '</td></tr>';
                }).join('');
            } else {
                rows = '<tr><td colspan="7" class="admin-empty" style="padding:30px"><h3>Нет пользователей</h3></td></tr>';
            }
            const si = (col) => state.usersSort === col ? (state.usersOrder === 'ASC' ? ' ↑' : ' ↓') : '';
            const sc = (col) => state.usersSort === col ? 'sorted' : '';
            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <div class="admin-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input class="admin-input" id="users-search" placeholder="Поиск..." value="${esc(state.usersSearch)}" onkeydown="if(event.key==='Enter')AdminApp.searchUsers()">
                        </div>
                        <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.searchUsers()">Найти</button>
                        ${state.usersSearch ? '<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearUserSearch()">✕</button>' : ''}
                    </div>
                    <div class="admin-toolbar-right">
                        <button class="admin-export-btn" onclick="AdminApp.exportUsers()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</button>
                        <span style="font-size:.78em;color:var(--text-3)">Всего: ${data.total}</span>
                    </div>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table"><thead><tr>
                        <th onclick="AdminApp.sortUsers('telegram_id')" class="${sc('telegram_id')}">ID${si('telegram_id')}</th>
                        <th>Имя</th>
                        <th onclick="AdminApp.sortUsers('telegram_username')" class="${sc('telegram_username')}">Username${si('telegram_username')}</th>
                        <th onclick="AdminApp.sortUsers('games_count')" class="${sc('games_count')}">Игр${si('games_count')}</th>
                        <th>Сессий</th>
                        <th onclick="AdminApp.sortUsers('created_at')" class="${sc('created_at')}">Регистрация${si('created_at')}</th>
                        <th onclick="AdminApp.sortUsers('last_active')" class="${sc('last_active')}">Активность${si('last_active')}</th>
                    </tr></thead><tbody>${rows}</tbody></table>
                </div>
                ${renderPagination(data.page, data.totalPages, 'AdminApp.usersGoToPage')}`;
        } catch(e) {
            content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>';
        }
    }

    function searchUsers() { state.usersSearch = document.getElementById('users-search').value.trim(); state.usersPage = 1; loadUsers(); }
    function clearUserSearch() { state.usersSearch = ''; state.usersPage = 1; loadUsers(); }
    function sortUsers(col) { if (state.usersSort === col) { state.usersOrder = state.usersOrder === 'ASC' ? 'DESC' : 'ASC'; } else { state.usersSort = col; state.usersOrder = 'DESC'; } state.usersPage = 1; loadUsers(); }
    function usersGoToPage(p) { state.usersPage = p; loadUsers(); }

    function exportUsers() {
        if (!state.usersData || !state.usersData.users) return;
        downloadCSV('users.csv', ['ID','Имя','Фамилия','Username','Игр','Сессий','Регистрация','Активность'],
            state.usersData.users.map(u => [u.telegram_id, u.telegram_first_name||'', u.telegram_last_name||'', u.telegram_username||'', u.games_count, u.sessions_count, u.first_seen, u.last_active]));
        toast('Экспорт завершён', 'success');
    }

    // =======================================================================
    // User Detail
    // =======================================================================
    async function loadUserDetail(telegramId) {
        if (!telegramId && state.selectedUserId) telegramId = state.selectedUserId;
        state.selectedUserId = telegramId;
        const content = document.getElementById('admin-page-content');
        updateBreadcrumb('userDetail', telegramId);

        try {
            const data = await apiCall('admin-users.php', { params: { id: telegramId } });
            state.selectedUserDetail = data;

            if (!data.user) {
                content.innerHTML = '<button class="admin-back-btn" onclick="AdminApp.navigate(\'users\')">← Назад</button><div class="admin-empty"><h3>Пользователь не найден</h3></div>';
                return;
            }

            const u = data.user;
            const name = (u.first_name||'') + ' ' + (u.last_name||'');
            const username = u.username ? '@' + u.username : '—';

            let gamesHtml = '';
            if (data.games && data.games.length > 0) {
                gamesHtml = data.games.map((g, i) => {
                    const winner = g.winnerTeam ? '<span class="admin-badge ' + (g.winnerTeam === 'mafia' ? 'admin-badge-error' : (g.winnerTeam === 'city' || g.winnerTeam === 'civilians') ? 'admin-badge-success' : 'admin-badge-muted') + '">' + esc(g.winnerTeam) + '</span>' : '<span class="admin-badge admin-badge-warning">В процессе</span>';
                    const mode = g.cityMode ? 'Городская' : g.funkyMode ? 'Фанки' : (g.tournamentId ? 'Турнир' : (g.manualMode ? 'Ручной' : 'gomafia'));
                    const gameNum = g.gameNumber || g.manualGameSelected || (i + 1);
                    const date = g.timestamp ? formatDate(new Date(g.timestamp)) : '—';
                    const modified = g.adminModified ? ' <span class="admin-badge admin-badge-warning">✎</span>' : '';
                    const players = [];
                    if (g.peoples && Array.isArray(g.peoples)) g.peoples.forEach(p => { if (p && p.login) players.push(p.login); });
                    const playersStr = players.length > 0 ? '<div class="admin-players-mini">' + players.slice(0,6).map(p => '<span>' + esc(p) + '</span>').join('') + (players.length > 6 ? '<span>+' + (players.length - 6) + '</span>' : '') + '</div>' : '';
                    return '<div class="admin-game-card" onclick="AdminApp.showGameModal(\'' + telegramId + '\',\'' + esc(g.sessionId||'') + '\',' + i + ')"><div class="admin-game-card-header"><span class="admin-game-card-title">Игра #' + gameNum + modified + '</span>' + winner + '</div><div class="admin-game-card-meta"><span>' + esc(mode) + '</span><span>•</span><span>' + date + '</span></div>' + playersStr + '</div>';
                }).join('');
            } else {
                gamesHtml = '<div class="admin-empty" style="padding:16px"><p>Нет игр</p></div>';
            }

            let sessionsHtml = '';
            if (data.authSessions && data.authSessions.length > 0) {
                const sRows = data.authSessions.map(s => {
                    const device = s.device_name || (s.user_agent ? s.user_agent.substring(0, 40) + '...' : 'Неизвестно');
                    const isActive = new Date(s.expires_at) > new Date();
                    return '<div class="session-row"><div class="session-device-icon">' + (isActive ? '🟢' : '⚪') + '</div><div class="session-info"><div class="session-device">' + esc(device) + '</div><div class="session-meta">IP: ' + esc(s.ip_address||'—') + ' · Метод: ' + esc(s.auth_method||'—') + ' · ' + timeAgo(s.last_active) + '</div></div></div>';
                }).join('');
                sessionsHtml = '<div class="admin-section-title">Auth сессии (' + data.authSessions.length + ')</div>' + sRows;
            }

            content.innerHTML = `
                <button class="admin-back-btn" onclick="AdminApp.navigate('users')">← К списку пользователей</button>
                <div class="admin-card" style="margin-bottom:14px">
                    <div class="admin-card-header">
                        <div>
                            <div class="admin-card-title">${esc(name.trim()) || 'Пользователь'}</div>
                            <div class="admin-card-subtitle">${username} · ID: ${u.telegram_id}</div>
                        </div>
                        <div style="display:flex;gap:6px">
                            <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.navigate('gameDetail','${u.telegram_id}')">Все игры</button>
                            <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteUserSessions('${u.telegram_id}')">Удалить сессии</button>
                        </div>
                    </div>
                    <div class="admin-detail-grid">
                        <div class="admin-detail-label">Telegram ID</div><div class="admin-detail-value">${u.telegram_id}</div>
                        <div class="admin-detail-label">Username</div><div class="admin-detail-value">${username}</div>
                        <div class="admin-detail-label">Имя</div><div class="admin-detail-value">${esc(name.trim()) || '—'}</div>
                        <div class="admin-detail-label">Первый визит</div><div class="admin-detail-value">${formatDate(u.first_seen)}</div>
                        <div class="admin-detail-label">Активность</div><div class="admin-detail-value">${formatDate(u.last_active)}</div>
                        <div class="admin-detail-label">Auth сессий</div><div class="admin-detail-value">${u.sessions_count}</div>
                        <div class="admin-detail-label">Всего игр</div><div class="admin-detail-value">${u.games_count}</div>
                    </div>
                </div>
                <div class="admin-section-title">Игры (${data.games ? data.games.length : 0})</div>
                <div style="display:flex;flex-direction:column;gap:6px">${gamesHtml}</div>
                ${sessionsHtml}`;
        } catch(e) {
            content.innerHTML = '<button class="admin-back-btn" onclick="AdminApp.navigate(\'users\')">← Назад</button><div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>';
        }
    }

    async function deleteUserSessions(telegramId) {
        const ok = await confirmDialog('Удалить все сессии?', 'Пользователю ' + telegramId + ' придётся авторизоваться заново.', { danger: true, confirmText: 'Удалить', icon: '🗑️' });
        if (!ok) return;
        try {
            await apiCall('admin-users.php', { method: 'DELETE', params: { id: telegramId } });
            toast('Сессии удалены', 'success');
            loadUserDetail(telegramId);
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }


    // =======================================================================
    // Game Modal / Editor
    // =======================================================================
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
        const peoples = game.peoples || [];
        const roles = game.roles || {};
        const fouls = game.fouls || {};
        const techFouls = game.techFouls || {};
        const removed = game.removed || {};
        const playersActions = game.playersActions || {};

        const roleOptions = [
            ['','—'],['city','🏙 Мирный'],['mafia','🔫 Мафия'],['don','🎩 Дон'],['sheriff','⭐ Шериф'],
            ['doctor','🩺 Доктор'],['maniac','🔪 Маньяк'],['detective','🔍 Детектив'],['kamikaze','💣 Камикадзе'],
            ['immortal','♾ Бессмертный'],['beauty','🌸 Красотка'],['oyabun','☯ Оябун'],['yakuza','⚔ Якудза'],['peace','🕊 Мирный']
        ];

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
                const actionBadges = Object.keys(actions).slice(0,3).map(k => '<span class="admin-badge" style="font-size:.65em;margin:1px">' + esc(k) + '</span>').join('');
                const darkRoles = ['don','mafia','black','maniac','oyabun','yakuza','ripper','swindler','thief','snitch','fangirl','lawyer'];
                const lightRoles = ['sheriff','doctor','detective','jailer','bodyguard','judge','priest'];
                const roleClass = darkRoles.includes(role) ? 'room-role-mafia' : lightRoles.includes(role) ? 'room-role-sheriff' : '';
                const opts = roleOptions.map(([v,l]) => '<option value="' + v + '"' + (role===v||(v==='mafia'&&role==='black') ? ' selected' : '') + '>' + l + '</option>').join('');
                return '<tr class="' + (isRemoved ? 'room-player-removed' : '') + '"><td><b>' + (i+1) + '</b></td><td>' + esc(login) + '</td><td><select class="room-role-select ' + roleClass + '" data-field="roles" data-idx="' + i + '">' + opts + '</select></td><td><input type="number" class="game-edit-num" data-field="fouls" data-idx="' + i + '" value="' + foul + '" min="0" max="4"></td><td><input type="number" class="game-edit-num" data-field="techFouls" data-idx="' + i + '" value="' + tf + '" min="0" max="4"></td><td><label class="game-edit-check"><input type="checkbox" data-field="removed" data-idx="' + i + '"' + (isRemoved ? ' checked' : '') + '><span>' + (isRemoved?'Выбыл':'В игре') + '</span></label></td><td>' + actionBadges + '</td></tr>';
            }).filter(Boolean).join('');
        }

        const playersTable = playersRows ? '<div class="game-editor-section"><div class="game-editor-section-title">Игроки (' + peoples.filter(p => p && (p.login||p.name)).length + ')</div><div class="admin-table-wrapper"><table class="admin-table" id="game-editor-players"><thead><tr><th>#</th><th>Игрок</th><th>Роль</th><th>Фолы</th><th>Тех.</th><th>Статус</th><th>Действия</th></tr></thead><tbody>' + playersRows + '</tbody></table></div></div>' : '';

        const mode = game.cityMode ? 'Городская мафия' : game.funkyMode ? 'Фанки' : (game.tournamentId ? 'Турнир #' + (game.tournamentId||'') : (game.manualMode ? 'Ручной' : 'GoMafia'));
        const bestMoveStr = (game.bestMove || []).map(b => b + 1).join(', ');

        let votingHtml = '';
        if (game.votingHistory && game.votingHistory.length > 0) {
            const vhRows = game.votingHistory.map((vh, idx) => {
                const noms = Object.values(vh.nominations || {}).filter(Boolean).length;
                const winners = (vh.winners || []).map(w => w + 1).join(', ');
                return '<tr><td>' + (idx+1) + '</td><td>' + noms + '</td><td>' + (winners||'—') + '</td></tr>';
            }).join('');
            votingHtml = '<div class="game-editor-section"><div class="game-editor-section-title">История голосований</div><div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>Круг</th><th>Номинаций</th><th>Выбыли</th></tr></thead><tbody>' + vhRows + '</tbody></table></div></div>';
        }

        showModal(`
            <div class="admin-modal-header">
                <div class="admin-modal-title">Редактор игры</div>
                <button class="admin-modal-close" onclick="AdminApp.closeModal()">✕</button>
            </div>
            <div class="game-editor-info-grid">
                <div class="game-editor-field"><span class="game-editor-label">Session ID</span><span class="game-editor-val" style="font-size:.74em">${esc(game.sessionId||'—')}</span></div>
                <div class="game-editor-field"><span class="game-editor-label">Режим</span><span class="game-editor-val">${esc(mode)}</span></div>
                <div class="game-editor-field"><span class="game-editor-label">Дата</span><span class="game-editor-val">${game.timestamp ? formatDate(new Date(game.timestamp)) : '—'}</span></div>
                <div class="game-editor-field"><span class="game-editor-label">Номер</span><span class="game-editor-val">${game.gameNumber||game.manualGameSelected||'—'}</span></div>
                <div class="game-editor-field"><span class="game-editor-label">Лучший ход</span><span class="game-editor-val">${bestMoveStr||'—'}</span></div>
            </div>
            <div class="game-editor-section"><div class="game-editor-section-title">Основные параметры</div>
                <div class="game-editor-controls">
                    <div class="game-editor-control"><label>Победитель</label><select id="ge-winnerTeam">
                        <option value="" ${!game.winnerTeam?'selected':''}>Не определён</option>
                        <option value="civilians" ${game.winnerTeam==='civilians'?'selected':''}>Мирные (civilians)</option>
                        <option value="city" ${game.winnerTeam==='city'?'selected':''}>Мирные (city)</option>
                        <option value="mafia" ${game.winnerTeam==='mafia'?'selected':''}>Мафия</option>
                        <option value="draw" ${game.winnerTeam==='draw'?'selected':''}>Ничья</option>
                    </select></div>
                    <div class="game-editor-control"><label>ПКМ (0-based)</label><input type="number" id="ge-firstKilledPlayer" value="${game.firstKilledPlayer!==null&&game.firstKilledPlayer!==undefined?game.firstKilledPlayer:''}" min="-1" max="10"></div>
                    <div class="game-editor-control"><label>Убит ночью (0-based)</label><input type="number" id="ge-killedOnNight" value="${game.killedOnNight!==null&&game.killedOnNight!==undefined?game.killedOnNight:''}" min="-1" max="10"></div>
                    <div class="game-editor-control"><label>Лучший ход (0-based, через запятую)</label><input type="text" id="ge-bestMove" value="${(game.bestMove||[]).join(', ')}" placeholder="0, 3, 5"></div>
                </div>
            </div>
            ${playersTable}
            ${votingHtml}
            <div class="game-editor-section"><div class="game-editor-section-title">Raw JSON</div>
                <textarea class="admin-input game-editor-json" id="ge-raw-json" rows="6">${esc(JSON.stringify(game, null, 2))}</textarea>
                <div style="font-size:.68em;color:var(--text-3);margin-top:3px">⚠️ Изменения в JSON перезапишут все поля.</div>
            </div>
            <div class="game-editor-actions">
                <button class="admin-btn admin-btn-primary" onclick="AdminApp.saveGameEdit()">Сохранить</button>
                <button class="admin-btn admin-btn-secondary" onclick="AdminApp.saveGameFromJson()">Из JSON</button>
                <button class="admin-btn admin-btn-danger" onclick="AdminApp.deleteGame('${userId}','${esc(game.sessionId||'')}');AdminApp.closeModal();">Удалить</button>
            </div>
        `);
    }

    async function saveGameEdit() {
        const eg = state.editingGame;
        if (!eg) { toast('Нет данных', 'error'); return; }
        const changes = {};
        const winnerEl = document.getElementById('ge-winnerTeam');
        if (winnerEl) changes.winnerTeam = winnerEl.value || null;
        const fkpEl = document.getElementById('ge-firstKilledPlayer');
        if (fkpEl) changes.firstKilledPlayer = fkpEl.value !== '' ? parseInt(fkpEl.value) : null;
        const konEl = document.getElementById('ge-killedOnNight');
        if (konEl) changes.killedOnNight = konEl.value !== '' ? parseInt(konEl.value) : null;
        const bmEl = document.getElementById('ge-bestMove');
        if (bmEl) { const val = bmEl.value.trim(); changes.bestMove = val ? val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : []; }
        const table = document.getElementById('game-editor-players');
        if (table) {
            const nr = {}, nf = {}, nt = {}, nrem = {};
            table.querySelectorAll('[data-field]').forEach(el => {
                const f = el.dataset.field, idx = parseInt(el.dataset.idx);
                if (isNaN(idx)) return;
                if (f === 'roles') nr[idx] = el.value;
                else if (f === 'fouls') nf[idx] = parseInt(el.value) || 0;
                else if (f === 'techFouls') nt[idx] = parseInt(el.value) || 0;
                else if (f === 'removed') nrem[idx] = el.checked;
            });
            changes.roles = nr; changes.fouls = nf; changes.techFouls = nt; changes.removed = nrem;
        }
        let game = eg.source === 'userDetail' ? state.selectedUserDetail.games[eg.index] : state.selectedGameDetail.games[eg.index];
        if (!game || !game.sessionId) { toast('Сессия не найдена', 'error'); return; }
        try {
            await apiCall('admin-sessions.php', { body: { userId: eg.userId, sessionId: game.sessionId, data: changes } });
            toast('Игра обновлена', 'success');
            closeModal();
            if (eg.source === 'userDetail') loadUserDetail(eg.userId); else loadGameDetail(eg.userId);
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function saveGameFromJson() {
        const eg = state.editingGame;
        if (!eg) { toast('Нет данных', 'error'); return; }
        const jsonEl = document.getElementById('ge-raw-json');
        if (!jsonEl) return;
        let parsed;
        try { parsed = JSON.parse(jsonEl.value); } catch(e) { toast('Некорректный JSON: ' + e.message, 'error'); return; }
        const ok = await confirmDialog('Перезаписать из JSON?', 'Все данные сессии будут полностью заменены.', { danger: true, confirmText: 'Перезаписать', icon: '📄' });
        if (!ok) return;
        let game = eg.source === 'userDetail' ? state.selectedUserDetail.games[eg.index] : state.selectedGameDetail.games[eg.index];
        if (!game || !game.sessionId) { toast('Сессия не найдена', 'error'); return; }
        parsed.sessionId = game.sessionId;
        try {
            await apiCall('admin-sessions.php', { body: { userId: eg.userId, sessionId: game.sessionId, data: parsed } });
            toast('Игра перезаписана из JSON', 'success');
            closeModal();
            if (eg.source === 'userDetail') loadUserDetail(eg.userId); else loadGameDetail(eg.userId);
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function deleteGame(userId, sessionId) {
        const ok = await confirmDialog('Удалить игру?', 'Это действие нельзя отменить.', { danger: true, confirmText: 'Удалить', icon: '🗑️' });
        if (!ok) return;
        try {
            await apiCall('admin-sessions.php', { method: 'DELETE', params: { userId, sessionId } });
            toast('Игра удалена', 'success');
            closeModal();
            if (state.currentPage === 'userDetail') loadUserDetail(userId); else loadGameDetail(userId);
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    // =======================================================================
    // Games List
    // =======================================================================
    async function loadGames() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-sessions.php', { params: { page: state.gamesPage } });
            state.gamesData = data;
            let rows = '';
            if (data.items && data.items.length > 0) {
                rows = data.items.map(item => {
                    const name = (item.first_name||'') + ' ' + (item.last_name||'');
                    const username = item.username ? '@' + esc(item.username) : '—';
                    return '<tr class="clickable" onclick="AdminApp.navigate(\'gameDetail\',\'' + item.telegram_id + '\')"><td>' + esc(item.telegram_id) + '</td><td>' + (esc(name.trim())||'—') + '</td><td>' + username + '</td><td><span class="admin-badge admin-badge-accent">' + item.games_count + '</span></td><td title="' + formatDate(item.updated_at) + '">' + timeAgo(item.updated_at) + '</td></tr>';
                }).join('');
            } else {
                rows = '<tr><td colspan="5" class="admin-empty" style="padding:30px"><h3>Нет данных</h3></td></tr>';
            }
            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left"><span style="font-size:.84em;color:var(--text-2)">Пользователи с сохранёнными играми</span></div>
                    <div class="admin-toolbar-right"><span style="font-size:.78em;color:var(--text-3)">Всего: ${data.total}</span></div>
                </div>
                <div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>Telegram ID</th><th>Имя</th><th>Username</th><th>Игр</th><th>Обновлено</th></tr></thead><tbody>${rows}</tbody></table></div>
                ${renderPagination(data.page, data.totalPages, 'AdminApp.gamesGoToPage')}`;
        } catch(e) { content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    function gamesGoToPage(p) { state.gamesPage = p; loadGames(); }

    // =======================================================================
    // Game Detail (all games of specific user)
    // =======================================================================
    async function loadGameDetail(userId) {
        if (!userId && state.selectedGameUserId) userId = state.selectedGameUserId;
        state.selectedGameUserId = userId;
        const content = document.getElementById('admin-page-content');
        updateBreadcrumb('gameDetail', userId);
        try {
            const data = await apiCall('admin-sessions.php', { params: { userId } });
            state.selectedGameDetail = data;
            let gamesHtml = '';
            if (data.games && data.games.length > 0) {
                gamesHtml = data.games.map((g, i) => {
                    const winner = g.winnerTeam ? '<span class="admin-badge ' + (g.winnerTeam === 'mafia' ? 'admin-badge-error' : (g.winnerTeam === 'city' || g.winnerTeam === 'civilians') ? 'admin-badge-success' : 'admin-badge-muted') + '">' + esc(g.winnerTeam) + '</span>' : '<span class="admin-badge admin-badge-warning">В процессе</span>';
                    const mode = g.cityMode ? 'Городская' : g.funkyMode ? 'Фанки' : (g.tournamentId ? 'Турнир' : (g.manualMode ? 'Ручной' : 'gomafia'));
                    const gameNum = g.gameNumber || g.manualGameSelected || (i + 1);
                    const date = g.timestamp ? formatDate(new Date(g.timestamp)) : '—';
                    return '<div class="admin-game-card" onclick="AdminApp.showGameDetailModal(\'' + userId + '\',' + i + ')"><div class="admin-game-card-header"><span class="admin-game-card-title">Игра #' + gameNum + '</span>' + winner + '</div><div class="admin-game-card-meta"><span>' + esc(mode) + '</span><span>•</span><span>' + date + '</span><span>•</span><span>ID: ' + esc((g.sessionId||'').substring(0,8)) + '…</span></div></div>';
                }).join('');
            } else {
                gamesHtml = '<div class="admin-empty" style="padding:30px"><h3>Нет игр</h3></div>';
            }
            content.innerHTML = `
                <button class="admin-back-btn" onclick="AdminApp.navigate('games')">← К списку</button>
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left"><span style="font-size:.84em;color:var(--text-2)">Всего игр: ${data.total}</span>${data.updatedAt ? '<span style="font-size:.78em;color:var(--text-3);margin-left:8px">Обновлено: ' + formatDate(data.updatedAt) + '</span>' : ''}</div>
                    <div class="admin-toolbar-right"><button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteAllGames('${userId}')">Удалить все</button></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">${gamesHtml}</div>`;
        } catch(e) { content.innerHTML = '<button class="admin-back-btn" onclick="AdminApp.navigate(\'games\')">← Назад</button><div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    async function deleteAllGames(userId) {
        const ok = await confirmDialog('Удалить ВСЕ игры?', 'Все игры пользователя ' + userId + ' будут удалены безвозвратно.', { danger: true, confirmText: 'Удалить всё', icon: '💀' });
        if (!ok) return;
        try {
            await apiCall('admin-sessions.php', { method: 'DELETE', params: { userId } });
            toast('Все игры удалены', 'success');
            loadGameDetail(userId);
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }


    // =======================================================================
    // Profiles (NEW)
    // =======================================================================
    async function loadProfiles() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-profiles.php', {
                params: { page: state.profilesPage, search: state.profilesSearch }
            });
            state.profilesData = data;

            let cardsHtml = '';
            if (data.profiles && data.profiles.length > 0) {
                cardsHtml = '<div class="admin-grid-3">' + data.profiles.map(p => {
                    const name = p.display_name || ((p.telegram_first_name||'') + ' ' + (p.telegram_last_name||'')).trim() || 'Без имени';
                    const avatarHtml = p.avatar_url
                        ? '<img src="' + esc(p.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                        : '';
                    const gomafia = p.gomafia_nickname ? '<span class="admin-badge admin-badge-accent">' + esc(p.gomafia_nickname) + '</span>' : '';
                    const gomafiaId = p.gomafia_id ? '<span class="admin-badge admin-badge-muted">GM#' + esc(p.gomafia_id) + '</span>' : '';
                    const tgUser = p.telegram_username ? '@' + esc(p.telegram_username) : '';

                    return '<div class="profile-card" onclick="AdminApp.editProfile(\'' + p.telegram_id + '\')">' +
                        '<div class="profile-avatar">' + avatarHtml + '<div style="' + (p.avatar_url ? 'display:none;' : '') + 'display:flex;align-items:center;justify-content:center;width:100%;height:100%">' + name.charAt(0).toUpperCase() + '</div></div>' +
                        '<div class="profile-info"><div class="profile-name">' + esc(name) + '</div>' +
                        '<div class="profile-sub">ID: ' + p.telegram_id + (tgUser ? ' · ' + tgUser : '') + '</div>' +
                        '<div class="profile-badges">' + gomafia + gomafiaId + '</div></div></div>';
                }).join('') + '</div>';
            } else {
                cardsHtml = '<div class="admin-empty" style="padding:30px"><h3>Нет профилей</h3><p>Профили создаются при первом входе пользователей</p></div>';
            }

            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left">
                        <div class="admin-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input class="admin-input" id="profiles-search" placeholder="Поиск по имени, GoMafia..." value="${esc(state.profilesSearch)}" onkeydown="if(event.key==='Enter')AdminApp.searchProfiles()">
                        </div>
                        <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.searchProfiles()">Найти</button>
                        ${state.profilesSearch ? '<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearProfileSearch()">✕</button>' : ''}
                    </div>
                    <div class="admin-toolbar-right">
                        <span style="font-size:.78em;color:var(--text-3)">Всего: ${data.total}</span>
                    </div>
                </div>
                ${cardsHtml}
                ${renderPagination(data.page, data.totalPages, 'AdminApp.profilesGoToPage')}`;
        } catch(e) {
            content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>';
        }
    }

    function searchProfiles() { state.profilesSearch = document.getElementById('profiles-search').value.trim(); state.profilesPage = 1; loadProfiles(); }
    function clearProfileSearch() { state.profilesSearch = ''; state.profilesPage = 1; loadProfiles(); }
    function profilesGoToPage(p) { state.profilesPage = p; loadProfiles(); }

    async function editProfile(telegramId) {
        try {
            const data = await apiCall('admin-profiles.php', { params: { id: telegramId } });
            const p = data.profile || {};
            const u = data.user || {};
            const a = data.auth || {};
            const name = p.display_name || ((a.telegram_first_name||'') + ' ' + (a.telegram_last_name||'')).trim() || 'Пользователь';

            showModal(`
                <div class="admin-modal-header">
                    <div class="admin-modal-title">Редактировать профиль #${telegramId}</div>
                    <button class="admin-modal-close" onclick="AdminApp.closeModal()">✕</button>
                </div>
                <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
                    <div class="profile-avatar" style="width:56px;height:56px;font-size:1.3em">
                        ${p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display=\'none\'">' : ''}
                        <div style="${p.avatar_url?'display:none':'display:flex;align-items:center;justify-content:center;width:100%;height:100%'}">${name.charAt(0).toUpperCase()}</div>
                    </div>
                    <div>
                        <div style="font-size:1.05em;font-weight:700">${esc(name)}</div>
                        <div style="font-size:.78em;color:var(--text-3)">ID: ${telegramId} ${a.telegram_username ? '· @' + esc(a.telegram_username) : ''}</div>
                    </div>
                </div>

                <div class="game-editor-section"><div class="game-editor-section-title">Основная информация</div>
                    <div class="game-editor-controls">
                        <div class="game-editor-control"><label>Отображаемое имя</label><input type="text" id="pe-display_name" value="${esc(p.display_name||'')}" placeholder="Имя пользователя"></div>
                        <div class="game-editor-control"><label>URL аватара</label><input type="text" id="pe-avatar_url" value="${esc(p.avatar_url||'')}" placeholder="https://..."></div>
                    </div>
                </div>

                <div class="game-editor-section"><div class="game-editor-section-title">Привязка GoMafia</div>
                    <div class="game-editor-controls">
                        <div class="game-editor-control"><label>GoMafia Nickname</label><input type="text" id="pe-gomafia_nickname" value="${esc(p.gomafia_nickname||'')}"></div>
                        <div class="game-editor-control"><label>GoMafia ID</label><input type="text" id="pe-gomafia_id" value="${esc(p.gomafia_id||'')}"></div>
                        <div class="game-editor-control"><label>GoMafia Title (клуб)</label><input type="text" id="pe-gomafia_title" value="${esc(p.gomafia_title||'')}"></div>
                        <div class="game-editor-control"><label>GoMafia Avatar URL</label><input type="text" id="pe-gomafia_avatar" value="${esc(p.gomafia_avatar||'')}"></div>
                    </div>
                </div>

                ${u.id ? '<div class="admin-section-title">Таблица users</div><div class="admin-detail-grid" style="margin-bottom:14px"><div class="admin-detail-label">User ID</div><div class="admin-detail-value">' + u.id + '</div><div class="admin-detail-label">GoMafia ID</div><div class="admin-detail-value">' + esc(u.gomafia_id||'—') + '</div><div class="admin-detail-label">GoMafia Nick</div><div class="admin-detail-value">' + esc(u.gomafia_nickname||'—') + '</div><div class="admin-detail-label">Создан</div><div class="admin-detail-value">' + formatDate(u.created_at) + '</div></div>' : ''}

                <div class="game-editor-actions">
                    <button class="admin-btn admin-btn-primary" onclick="AdminApp.saveProfile('${telegramId}')">Сохранить</button>
                    <button class="admin-btn admin-btn-danger" onclick="AdminApp.deleteProfile('${telegramId}')">Удалить профиль</button>
                    <button class="admin-btn admin-btn-secondary" onclick="AdminApp.closeModal()">Отмена</button>
                </div>
            `);
        } catch(e) { toast('Ошибка загрузки профиля: ' + e.message, 'error'); }
    }

    async function saveProfile(telegramId) {
        const fields = ['display_name', 'avatar_url', 'gomafia_nickname', 'gomafia_id', 'gomafia_title', 'gomafia_avatar'];
        const data = {};
        fields.forEach(f => {
            const el = document.getElementById('pe-' + f);
            if (el) data[f] = el.value.trim() || null;
        });
        try {
            await apiCall('admin-profiles.php', { body: { id: telegramId, data } });
            toast('Профиль обновлён', 'success');
            closeModal();
            loadProfiles();
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function deleteProfile(telegramId) {
        const ok = await confirmDialog('Удалить профиль?', 'Профиль пользователя ' + telegramId + ' будет удалён.', { danger: true, confirmText: 'Удалить', icon: '🗑️' });
        if (!ok) return;
        try {
            await apiCall('admin-profiles.php', { method: 'DELETE', params: { id: telegramId } });
            toast('Профиль удалён', 'success');
            closeModal();
            loadProfiles();
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }


    // =======================================================================
    // Summaries
    // =======================================================================
    async function loadSummaries() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-summaries.php');
            state.summariesData = data;
            let rows = '';
            if (data.items && data.items.length > 0) {
                rows = data.items.map(s => {
                    return '<tr class="clickable" onclick="AdminApp.showSummaryModal(\'' + esc(s.id) + '\')"><td style="font-family:monospace;font-size:.78em">' + esc(s.id) + '</td><td>' + esc(s.tournamentName) + '</td><td>' + s.playersCount + '</td><td>' + s.gamesCount + '</td><td title="' + formatDate(s.createdAt) + '">' + timeAgo(s.createdAt) + '</td><td title="' + formatDate(s.savedAt) + '">' + timeAgo(s.savedAt) + '</td><td><button class="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onclick="event.stopPropagation();AdminApp.deleteSummary(\'' + esc(s.id) + '\')" title="Удалить"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>';
                }).join('');
            } else {
                rows = '<tr><td colspan="7" class="admin-empty" style="padding:30px"><h3>Нет итогов</h3></td></tr>';
            }
            content.innerHTML = `
                <div class="admin-toolbar">
                    <div class="admin-toolbar-left"><span style="font-size:.84em;color:var(--text-2)">Сохранённые итоги фанки-вечеров</span></div>
                    <div class="admin-toolbar-right"><span style="font-size:.78em;color:var(--text-3)">Всего: ${data.total}</span></div>
                </div>
                <div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>ID</th><th>Турнир</th><th>Игроков</th><th>Игр</th><th>Создан</th><th>Сохранён</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
        } catch(e) { content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    async function showSummaryModal(id) {
        try {
            const data = await apiCall('admin-summaries.php', { params: { id } });
            const json = JSON.stringify(data, null, 2);
            const truncated = json.length > 3000 ? json.substring(0, 3000) + '\n...' : json;
            let playersHtml = '';
            if (data.data && data.data.length > 0) {
                playersHtml = '<div class="admin-section-title">Игроки</div><div class="admin-players-mini" style="margin-bottom:10px">' + data.data.map(p => '<span>' + esc(p.login||p.name||'?') + '</span>').join('') + '</div>';
            }
            showModal('<div class="admin-modal-header"><div class="admin-modal-title">' + esc(data.tournamentName||'Итоги') + '</div><button class="admin-modal-close" onclick="AdminApp.closeModal()">✕</button></div><div class="admin-detail-grid" style="margin-bottom:14px"><div class="admin-detail-label">ID</div><div class="admin-detail-value" style="font-family:monospace">' + esc(data.id) + '</div><div class="admin-detail-label">Турнир</div><div class="admin-detail-value">' + esc(data.tournamentName||'—') + '</div><div class="admin-detail-label">Создан</div><div class="admin-detail-value">' + formatDate(data.createdAt) + '</div><div class="admin-detail-label">Сохранён</div><div class="admin-detail-value">' + formatDate(data.savedAt) + '</div><div class="admin-detail-label">Игроков</div><div class="admin-detail-value">' + (data.data ? data.data.length : 0) + '</div><div class="admin-detail-label">Игр</div><div class="admin-detail-value">' + (data.games ? data.games.length : 0) + '</div></div>' + playersHtml + '<div class="admin-section-title">JSON</div><div class="admin-json">' + esc(truncated) + '</div><div style="display:flex;gap:6px;margin-top:14px;justify-content:flex-end"><button class="admin-btn admin-btn-danger admin-btn-sm" onclick="AdminApp.deleteSummary(\'' + esc(data.id) + '\');AdminApp.closeModal();">Удалить</button></div>');
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function deleteSummary(id) {
        const ok = await confirmDialog('Удалить итог?', 'Итог ' + id + ' будет удалён.', { danger: true, confirmText: 'Удалить', icon: '🗑️' });
        if (!ok) return;
        try {
            await apiCall('admin-summaries.php', { method: 'DELETE', params: { id } });
            toast('Итог удалён', 'success');
            loadSummaries();
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    // =======================================================================
    // Rooms
    // =======================================================================
    async function loadRooms() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-rooms.php');
            const rooms = data.rooms || [];
            const toolbar = '<div class="admin-toolbar"><div class="admin-toolbar-left"><span style="font-size:.84em;color:var(--text-3)">Всего комнат: <b style="color:var(--text)">' + rooms.length + '</b></span></div><div class="admin-toolbar-right"><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.loadRooms()">Обновить</button>' + (rooms.length > 0 ? '<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.clearAllRooms()">Удалить все</button>' : '') + '</div></div>';
            if (rooms.length === 0) {
                content.innerHTML = toolbar + '<div class="admin-empty"><h3>Нет активных комнат</h3><p>Комнаты создаются при подключении к игровой панели</p></div>';
                return;
            }
            const cards = rooms.map(r => {
                const statusBadge = r.winnerTeam ? '<span class="admin-badge ' + (r.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success') + '">Победа: ' + esc(r.winnerTeam) + '</span>' : r.hasRoles ? '<span class="admin-badge admin-badge-accent">Идёт игра</span>' : r.playersCount > 0 ? '<span class="admin-badge admin-badge-warning">Подготовка</span>' : '<span class="admin-badge admin-badge-muted">Пусто</span>';
                const modeBadge = r.currentMode ? '<span class="admin-badge admin-badge-muted" style="font-size:.68em">' + esc(r.currentMode) + '</span>' : '';
                return '<div class="room-card" onclick="AdminApp.navigate(\'roomDetail\',\'' + esc(r.roomId) + '\')"><div class="room-card-header"><div class="room-card-id">#' + esc(r.roomId) + '</div>' + statusBadge + '</div><div class="room-card-stats"><div class="room-card-stat"><span class="room-card-stat-val">' + r.playersCount + '</span><span class="room-card-stat-label">игроков</span></div><div class="room-card-stat"><span class="room-card-stat-val">' + r.totalSeats + '</span><span class="room-card-stat-label">мест</span></div><div class="room-card-stat"><span class="room-card-stat-val">' + r.activeNominations + '</span><span class="room-card-stat-label">номинаций</span></div></div><div class="room-card-footer"><span class="room-card-time">' + timeAgo(r.modified) + '</span><div class="room-card-badges">' + modeBadge + (r.hasRoles ? '<span class="room-card-tag">🎭</span>' : '') + '</div></div><div class="room-card-actions" onclick="event.stopPropagation()"><button class="admin-btn admin-btn-xs admin-btn-secondary" onclick="AdminApp.clearRoom(\'' + esc(r.roomId) + '\')">🧹</button><button class="admin-btn admin-btn-xs admin-btn-danger" onclick="AdminApp.deleteRoom(\'' + esc(r.roomId) + '\')">🗑</button><button class="admin-btn admin-btn-xs admin-btn-primary" onclick="AdminApp.openRoomPanel(\'' + esc(r.roomId) + '\')">🎯</button></div></div>';
            }).join('');
            content.innerHTML = toolbar + '<div class="rooms-grid">' + cards + '</div>';
        } catch(e) { content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    async function loadRoomDetail(roomId) {
        const content = document.getElementById('admin-page-content');
        if (!roomId) { content.innerHTML = '<div class="admin-empty"><h3>roomId не указан</h3></div>'; return; }
        updateBreadcrumb('roomDetail', roomId);
        try {
            const data = await apiCall('admin-rooms.php', { params: { action: 'detail', roomId } });
            const statusBadge = data.winnerTeam ? '<span class="admin-badge ' + (data.winnerTeam === 'mafia' ? 'admin-badge-error' : 'admin-badge-success') + '">Победа: ' + esc(data.winnerTeam) + '</span>' : data.players && data.players.some(p => p.role) ? '<span class="admin-badge admin-badge-accent">Идёт игра</span>' : '<span class="admin-badge admin-badge-warning">Подготовка</span>';

            const headerHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px"><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'rooms\')">← Комнаты</button><button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.openRoomPanel(\'' + esc(roomId) + '\')">🎯 Панель</button><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'roomDetail\',\'' + esc(roomId) + '\')">Обновить</button><button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearRoom(\'' + esc(roomId) + '\')">🧹 Очистить</button><button class="admin-btn admin-btn-sm admin-btn-danger" onclick="AdminApp.deleteRoom(\'' + esc(roomId) + '\')">🗑 Удалить</button></div>';

            const infoHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Информация</div>' + statusBadge + '</div><div class="admin-grid-2" style="gap:8px"><div class="room-detail-field"><span class="room-detail-label">Комната</span><span class="room-detail-val">#' + esc(roomId) + '</span></div><div class="room-detail-field"><span class="room-detail-label">Режим</span><span class="room-detail-val">' + esc(data.currentMode||'—') + '</span></div><div class="room-detail-field"><span class="room-detail-label">Победитель</span><span class="room-detail-val">' + esc(data.winnerTeam||'—') + '</span></div><div class="room-detail-field"><span class="room-detail-label">Ручной</span><span class="room-detail-val">' + (data.manualMode?'Да':'Нет') + '</span></div><div class="room-detail-field"><span class="room-detail-label">Городская</span><span class="room-detail-val">' + (data.cityMode ? 'Да (' + (data.cityPlayersCount||'?') + ')' : 'Нет') + '</span></div><div class="room-detail-field"><span class="room-detail-label">Игра</span><span class="room-detail-val">' + (data.gameSelected !== null ? '#'+data.gameSelected : '—') + '</span></div><div class="room-detail-field"><span class="room-detail-label">Файл</span><span class="room-detail-val">' + formatBytes(data.fileSize) + '</span></div><div class="room-detail-field"><span class="room-detail-label">Обновлён</span><span class="room-detail-val">' + formatDate(data.modified) + '</span></div></div></div>';

            const roleOptions = [['','—'],['city','🏙 Мирный'],['mafia','🔫 Мафия'],['don','🎩 Дон'],['sheriff','⭐ Шериф'],['doctor','🩺 Доктор'],['maniac','🔪 Маньяк'],['detective','🔍 Детектив'],['kamikaze','💣 Камикадзе'],['immortal','♾ Бессмертный'],['beauty','🌸 Красотка'],['oyabun','☯ Оябун'],['yakuza','⚔ Якудза']];

            let playersHtml = '';
            if (data.players && data.players.length > 0) {
                const pRows = data.players.map(p => {
                    const avatar = data.avatars && data.avatars[p.login] ? '<img src="' + esc(data.avatars[p.login]) + '" alt="" class="room-player-avatar" onerror="this.style.display=\'none\'">' : '';
                    const darkRoles = ['don','mafia','black','maniac','oyabun','yakuza'];
                    const lightRoles = ['sheriff','doctor','detective'];
                    const roleClass = darkRoles.includes(p.role) ? 'room-role-mafia' : lightRoles.includes(p.role) ? 'room-role-sheriff' : '';
                    const opts = roleOptions.map(([v,l]) => '<option value="' + v + '"' + ((p.role===v||(v==='mafia'&&p.role==='black')) ? ' selected' : '') + '>' + l + '</option>').join('');
                    return '<tr class="' + (p.removed?'room-player-removed':'') + '"><td><b>' + p.seat + '</b></td><td>' + avatar + esc(p.login||p.name) + '</td><td><select class="room-role-select ' + roleClass + '" onchange="AdminApp.setRoomRole(\'' + esc(roomId) + '\',' + (p.seat-1) + ',this.value)">' + opts + '</select></td><td>' + (p.fouls > 0 ? '<span class="admin-badge admin-badge-warning">' + p.fouls + '</span>' : '—') + '</td><td>' + (p.removed ? '<span class="admin-badge admin-badge-error">Выбыл</span>' : '<span class="admin-badge admin-badge-success">В игре</span>') + '</td><td><button class="admin-btn admin-btn-xs admin-btn-danger" onclick="AdminApp.kickRoomPlayer(\'' + esc(roomId) + '\',' + (p.seat-1) + ',\'' + esc(p.login||p.name) + '\')" title="Убрать">✕</button></td></tr>';
                }).join('');
                playersHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Игроки (' + data.players.length + ')</div></div><div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>#</th><th>Игрок</th><th>Роль</th><th>Фолы</th><th>Статус</th><th></th></tr></thead><tbody>' + pRows + '</tbody></table></div></div>';
            }

            let votingHtml = '';
            if (data.voting) {
                const v = data.voting;
                const nomList = (v.nominations||[]).map((n,i) => n ? '<span class="admin-badge admin-badge-accent" style="margin:2px">' + (i+1) + '→' + n + '</span>' : '').filter(Boolean).join('');
                votingHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Голосование</div>' + (v.votingFinished ? '<span class="admin-badge admin-badge-success">Завершено</span>' : v.nominationsLocked ? '<span class="admin-badge admin-badge-accent">Идёт</span>' : '<span class="admin-badge admin-badge-warning">Номинации</span>') + '</div>' + (nomList ? '<div style="margin-bottom:6px">' + nomList + '</div>' : '') + '</div>';
            }

            const uiHtml = '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Настройки</div></div><div class="room-toggles-grid"><label class="room-toggle-item"><input type="checkbox" ' + (data.hideSeating?'checked':'') + ' onchange="AdminApp.updateRoomField(\'' + esc(roomId) + '\',\'hideSeating\',this.checked)"><span>Скрыть рассадку</span></label><label class="room-toggle-item"><input type="checkbox" ' + (data.hideLeaveOrder?'checked':'') + ' onchange="AdminApp.updateRoomField(\'' + esc(roomId) + '\',\'hideLeaveOrder\',this.checked)"><span>Скрыть порядок выбывания</span></label><label class="room-toggle-item"><input type="checkbox" ' + (data.hideRolesStatus?'checked':'') + ' onchange="AdminApp.updateRoomField(\'' + esc(roomId) + '\',\'hideRolesStatus\',this.checked)"><span>Скрыть статус ролей</span></label><label class="room-toggle-item"><input type="checkbox" ' + (data.hideBestMove?'checked':'') + ' onchange="AdminApp.updateRoomField(\'' + esc(roomId) + '\',\'hideBestMove\',this.checked)"><span>Скрыть лучший ход</span></label></div></div>';

            content.innerHTML = headerHtml + infoHtml + playersHtml + '<div class="admin-grid-2">' + votingHtml + uiHtml + '</div>';
        } catch(e) { content.innerHTML = '<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.navigate(\'rooms\')">← Комнаты</button><div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    async function clearRoom(roomId) {
        const ok = await confirmDialog('Очистить комнату?', 'Все данные игры в комнате #' + roomId + ' будут сброшены.', { danger: true, confirmText: 'Очистить', icon: '🧹' });
        if (!ok) return;
        try { await apiCall('admin-rooms.php', { body: { action: 'clear', roomId } }); toast('Комната очищена', 'success'); if (state.currentPage === 'roomDetail') loadRoomDetail(roomId); else loadRooms(); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function deleteRoom(roomId) {
        const ok = await confirmDialog('Удалить комнату?', 'Комната #' + roomId + ' будет полностью удалена.', { danger: true, confirmText: 'Удалить', icon: '🗑️' });
        if (!ok) return;
        try { await apiCall('admin-rooms.php', { body: { action: 'delete', roomId } }); toast('Комната удалена', 'success'); navigate('rooms'); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function clearAllRooms() {
        const ok = await confirmDialog('Удалить ВСЕ комнаты?', 'Все файлы комнат и аватаров будут удалены безвозвратно.', { danger: true, confirmText: 'Удалить всё', icon: '💀' });
        if (!ok) return;
        try { const r = await apiCall('admin-rooms.php', { body: { action: 'clearAll' } }); toast(r.message || 'Все комнаты удалены', 'success'); loadRooms(); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function kickRoomPlayer(roomId, seat, name) {
        const ok = await confirmDialog('Убрать игрока?', 'Игрок ' + name + ' (место ' + (seat+1) + ') будет убран из комнаты.', { danger: true, confirmText: 'Убрать', icon: '👋' });
        if (!ok) return;
        try { await apiCall('admin-rooms.php', { body: { action: 'kickPlayer', roomId, seat } }); toast('Игрок убран', 'success'); loadRoomDetail(roomId); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function setRoomRole(roomId, seat, role) {
        try { await apiCall('admin-rooms.php', { body: { action: 'setRole', roomId, seat, role } }); toast('Роль обновлена', 'success'); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function updateRoomField(roomId, field, value) {
        try { await apiCall('admin-rooms.php', { body: { action: 'updateField', roomId, field, value } }); toast('Сохранено', 'success'); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    function openRoomPanel(roomId) { window.open('/?room=' + encodeURIComponent(roomId), '_blank'); }


    // =======================================================================
    // Players + GoMafia Sync
    // =======================================================================
    let syncPollTimer = null;

    async function loadPlayers() {
        const content = document.getElementById('admin-page-content');
        let syncStatus = null;
        try { syncStatus = await apiCall('admin-sync-players.php', { params: { action: 'status' } }); } catch(e) {}
        const isRunning = syncStatus && syncStatus.running;

        let progressHtml = '';
        if (isRunning && syncStatus) {
            const checked = syncStatus.checked || 0;
            const total = (syncStatus.rangeEnd||0) - (syncStatus.rangeStart||0);
            const pct = total > 0 ? Math.min(100, Math.round((checked/total)*100)) : 0;
            const elapsed = syncStatus.startedAt ? Math.round((Date.now() - new Date(syncStatus.startedAt).getTime()) / 1000) : 0;
            const elStr = elapsed >= 60 ? Math.floor(elapsed/60) + 'м ' + (elapsed%60) + 'с' : elapsed + 'с';
            const statusText = syncStatus.status === 'getting_build_id' ? 'Получение buildId...' : 'ID: ' + (syncStatus.currentId||0) + (syncStatus.lastPlayer ? ' — ' + esc(syncStatus.lastPlayer) : '');
            const speed = syncStatus.speed || (elapsed > 0 ? Math.round(checked / elapsed) : 0);
            const eta = speed > 0 ? Math.round((total - checked) / speed) : 0;
            const etaStr = eta >= 60 ? Math.floor(eta/60) + 'м ' + (eta%60) + 'с' : eta + 'с';
            progressHtml = '<div class="sync-progress-section"><div class="sync-progress-header"><span class="sync-progress-status">' + statusText + '</span><span class="sync-progress-pct">' + pct + '%</span></div><div class="sync-progress-track"><div class="sync-progress-fill" id="sync-progress-bar" style="width:' + pct + '%"></div></div><div class="sync-stats-row"><div class="sync-stat-item"><span class="sync-stat-num">' + checked + '</span><span class="sync-stat-label">Проверено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--green)">' + (syncStatus.found||0) + '</span><span class="sync-stat-label">Найдено</span></div><div class="sync-stat-item"><span class="sync-stat-num">' + (syncStatus.updated||0) + '</span><span class="sync-stat-label">Обновлено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--accent)">' + (syncStatus.inserted||0) + '</span><span class="sync-stat-label">Добавлено</span></div><div class="sync-stat-item"><span class="sync-stat-num">' + speed + '/с</span><span class="sync-stat-label">Скорость</span></div><div class="sync-stat-item"><span class="sync-stat-num">~' + etaStr + '</span><span class="sync-stat-label">Осталось</span></div></div></div>';
        }

        let statsHtml = '';
        if (syncStatus && !syncStatus.running && syncStatus.status !== 'idle') {
            const bc = syncStatus.status === 'done' ? 'admin-badge-success' : syncStatus.status === 'error' || syncStatus.status === 'stalled' ? 'admin-badge-error' : 'admin-badge-warning';
            const bt = syncStatus.status === 'done' ? '✅ Завершено' : syncStatus.status === 'error' ? '❌ Ошибка' : syncStatus.status === 'stalled' ? '⚠️ Зависло' : '⏸ Остановлено';
            statsHtml = '<div class="sync-progress-section"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="admin-badge ' + bc + '">' + bt + '</span>' + (syncStatus.error ? '<span style="font-size:.78em;color:var(--red)">' + esc(syncStatus.error) + '</span>' : '') + '</div><div class="sync-stats-row" style="margin-top:8px"><div class="sync-stat-item"><span class="sync-stat-num">' + (syncStatus.checked||0) + '</span><span class="sync-stat-label">Проверено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--green)">' + (syncStatus.found||0) + '</span><span class="sync-stat-label">Найдено</span></div><div class="sync-stat-item"><span class="sync-stat-num">' + (syncStatus.updated||0) + '</span><span class="sync-stat-label">Обновлено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--accent)">' + (syncStatus.inserted||0) + '</span><span class="sync-stat-label">Добавлено</span></div></div></div>';
        }

        const syncPanel = '<div class="admin-card"><div class="admin-card-header"><div><div class="admin-card-title">Массовая синхронизация с GoMafia.pro</div><div class="admin-card-subtitle">Загрузка логинов, аватаров и клубов по диапазону ID</div></div></div><div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><div style="flex:1;min-width:100px"><label style="font-size:.74em;color:var(--text-3);display:block;margin-bottom:3px">ID с</label><input class="admin-input" id="sync-range-start" type="number" value="1" min="1" style="max-width:120px" ' + (isRunning?'disabled':'') + '></div><div style="flex:1;min-width:100px"><label style="font-size:.74em;color:var(--text-3);display:block;margin-bottom:3px">ID по</label><input class="admin-input" id="sync-range-end" type="number" value="10000" min="2" style="max-width:120px" ' + (isRunning?'disabled':'') + '></div>' + (isRunning ? '<button class="admin-btn admin-btn-danger" onclick="AdminApp.stopSync()">Остановить</button>' : '<button class="admin-btn admin-btn-primary" onclick="AdminApp.startSync()">Запустить</button>') + '<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.runSyncDiagnostics()" title="Диагностика">🔧</button></div><div id="sync-status-area">' + progressHtml + statsHtml + '</div></div>';

        const addPlayerPanel = '<div class="admin-card" style="margin-top:12px"><div class="admin-card-header"><div><div class="admin-card-title">Добавить игрока вручную</div><div class="admin-card-subtitle">Ссылка на профиль GoMafia или числовой ID</div></div></div><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div style="flex:1;min-width:200px"><input class="admin-input" id="add-player-input" placeholder="https://gomafia.pro/stats/9382 или 9382" onkeydown="if(event.key===\'Enter\')AdminApp.addPlayer()"></div><button class="admin-btn admin-btn-primary" id="add-player-btn" onclick="AdminApp.addPlayer()">Добавить</button></div><div id="add-player-result" style="margin-top:8px"></div></div>';

        content.innerHTML = syncPanel + addPlayerPanel + '<div class="admin-toolbar" style="margin-top:16px"><div class="admin-toolbar-left"><div class="admin-search-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="admin-input" id="players-search" placeholder="Поиск по никнейму..." value="' + esc(state.playersSearch) + '" onkeydown="if(event.key===\'Enter\')AdminApp.searchPlayers()"></div><button class="admin-btn admin-btn-sm admin-btn-primary" onclick="AdminApp.searchPlayers()">Найти</button>' + (state.playersSearch ? '<button class="admin-btn admin-btn-sm admin-btn-secondary" onclick="AdminApp.clearPlayerSearch()">✕</button>' : '') + '</div></div><div id="players-results"></div>';

        if (isRunning) startSyncPolling();
        if (state.playersSearch) performPlayerSearch();
        else document.getElementById('players-results').innerHTML = '<div class="admin-empty"><h3>Введите имя игрока</h3><p>Поиск по таблице players из GoMafia</p></div>';
    }

    async function startSync() {
        const rs = parseInt(document.getElementById('sync-range-start').value) || 1;
        const re = parseInt(document.getElementById('sync-range-end').value) || 10000;
        if (rs >= re) { toast('Начальный ID < конечного', 'error'); return; }
        if (re - rs > 50000) { toast('Максимум 50 000', 'error'); return; }
        try {
            const result = await apiCall('admin-sync-players.php', { body: { action: 'start', rangeStart: rs, rangeEnd: re } });
            toast('Синхронизация запущена' + (result.method ? ' (' + result.method + ')' : ''), 'success');
            startSyncPolling(); loadPlayers();
        } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    async function stopSync() {
        try { await apiCall('admin-sync-players.php', { body: { action: 'stop' } }); toast('Остановка...', 'info'); stopSyncPolling(); setTimeout(() => loadPlayers(), 1500); } catch(e) { toast('Ошибка: ' + e.message, 'error'); }
    }

    function startSyncPolling() {
        stopSyncPolling();
        syncPollTimer = setInterval(async () => {
            if (state.currentPage !== 'players') { stopSyncPolling(); return; }
            try {
                const s = await apiCall('admin-sync-players.php', { params: { action: 'status' } });
                const area = document.getElementById('sync-status-area');
                if (!area) return;
                if (s && s.running) {
                    const checked = s.checked||0, total = (s.rangeEnd||0)-(s.rangeStart||0), pct = total > 0 ? Math.min(100, Math.round((checked/total)*100)) : 0;
                    const elapsed = s.startedAt ? Math.round((Date.now()-new Date(s.startedAt).getTime())/1000) : 0;
                    const elStr = elapsed >= 60 ? Math.floor(elapsed/60) + 'м ' + (elapsed%60) + 'с' : elapsed + 'с';
                    const speed = s.speed || (elapsed > 0 ? Math.round(checked / elapsed) : 0);
                    const eta = speed > 0 ? Math.round((total - checked) / speed) : 0;
                    const etaStr = eta >= 60 ? Math.floor(eta/60) + 'м ' + (eta%60) + 'с' : eta + 'с';
                    area.innerHTML = '<div class="sync-progress-section"><div class="sync-progress-header"><span class="sync-progress-status">ID: ' + (s.currentId||0) + (s.lastPlayer ? ' — ' + esc(s.lastPlayer) : '') + '</span><span class="sync-progress-pct">' + pct + '%</span></div><div class="sync-progress-track"><div class="sync-progress-fill" style="width:' + pct + '%"></div></div><div class="sync-stats-row"><div class="sync-stat-item"><span class="sync-stat-num">' + checked + '</span><span class="sync-stat-label">Проверено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--green)">' + (s.found||0) + '</span><span class="sync-stat-label">Найдено</span></div><div class="sync-stat-item"><span class="sync-stat-num">' + (s.updated||0) + '</span><span class="sync-stat-label">Обновлено</span></div><div class="sync-stat-item"><span class="sync-stat-num" style="color:var(--accent)">' + (s.inserted||0) + '</span><span class="sync-stat-label">Добавлено</span></div><div class="sync-stat-item"><span class="sync-stat-num">' + speed + '/с</span><span class="sync-stat-label">Скорость</span></div><div class="sync-stat-item"><span class="sync-stat-num">~' + etaStr + '</span><span class="sync-stat-label">Осталось</span></div></div></div>';
                } else if (s && !s.running) { stopSyncPolling(); loadPlayers(); }
            } catch(e) {}
        }, 2000);
    }

    function stopSyncPolling() { if (syncPollTimer) { clearInterval(syncPollTimer); syncPollTimer = null; } }

    async function performPlayerSearch() {
        const el = document.getElementById('players-results');
        if (!el) return;
        el.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';
        try {
            const resp = await fetch('../api/players-search.php?za&q=' + encodeURIComponent(state.playersSearch));
            const data = await resp.json();
            state.playersData = data;
            let rows = '';
            if (data && data.length > 0) {
                rows = data.map(p => '<tr><td>' + (p.avatar_link ? '<img src="' + esc(p.avatar_link) + '" alt="" width="24" height="24" style="border-radius:50%;vertical-align:middle;margin-right:6px" onerror="this.style.display=\'none\'">' : '') + esc(p.login) + '</td><td>' + esc(p.title||'—') + '</td><td>' + esc(p.id||'—') + '</td></tr>').join('');
            } else { rows = '<tr><td colspan="3" class="admin-empty" style="padding:30px"><h3>Не найдено</h3></td></tr>'; }
            el.innerHTML = '<div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>Логин</th><th>Клуб</th><th>GoMafia ID</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        } catch(e) { el.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    function searchPlayers() { state.playersSearch = document.getElementById('players-search').value.trim(); if (state.playersSearch) performPlayerSearch(); else document.getElementById('players-results').innerHTML = '<div class="admin-empty"><h3>Введите имя игрока</h3></div>'; }
    function clearPlayerSearch() { state.playersSearch = ''; loadPlayers(); }

    async function addPlayer() {
        const input = document.getElementById('add-player-input');
        const resultEl = document.getElementById('add-player-result');
        const btn = document.getElementById('add-player-btn');
        if (!input || !resultEl) return;
        const value = input.value.trim();
        if (!value) { toast('Введите ссылку или ID', 'error'); return; }
        btn.disabled = true; btn.innerHTML = '<span class="admin-refreshing"></span> Загрузка...'; resultEl.innerHTML = '';
        try {
            const data = await apiCall('admin-sync-players.php', { body: { action: 'addPlayer', gomafiaId: value } });
            if (data.ok && data.player) {
                const p = data.player;
                const avatar = p.avatar_link ? '<img src="' + esc(p.avatar_link) + '" alt="" style="width:32px;height:32px;border-radius:50%;vertical-align:middle;margin-right:8px" onerror="this.style.display=\'none\'">' : '';
                const at = data.action === 'inserted' ? 'Добавлен' : 'Обновлён';
                const ab = data.action === 'inserted' ? 'admin-badge-success' : 'admin-badge-accent';
                resultEl.innerHTML = '<div class="sync-add-result success">' + avatar + '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88em">' + esc(p.login) + '</div><div style="font-size:.74em;color:var(--text-3)">' + esc(p.title||'') + ' · ID: ' + esc(p.id||'') + '</div></div><span class="admin-badge ' + ab + '">' + at + '</span></div>';
                input.value = '';
                toast(at + ': ' + p.login, 'success');
            }
        } catch(e) { resultEl.innerHTML = '<div class="sync-add-result error"><span style="color:var(--red);font-size:.84em">' + esc(e.message) + '</span></div>'; toast('Ошибка: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Добавить'; }
    }

    async function runSyncDiagnostics() {
        try {
            const d = await apiCall('admin-sync-players.php', { params: { action: 'diagnostics' } });
            const lines = [
                'PHP SAPI: ' + (d.php_sapi || '?'),
                'PHP Binary: ' + (d.php_binary || '?'),
                'PHP CLI: ' + (d.php_cli || '?'),
                'exec(): ' + (d.exec_available ? '✅' : '❌'),
                'proc_open(): ' + (d.proc_open_available ? '✅' : '❌'),
                'fastcgi_finish_request(): ' + (d.fastcgi_finish_request ? '✅' : '❌'),
                'curl: ' + (d.curl_available ? '✅' : '❌'),
                'allow_url_fopen: ' + (d.allow_url_fopen ? '✅' : '❌'),
                'Worker exists: ' + (d.worker_exists ? '✅' : '❌'),
                'Dir writable: ' + (d.dir_writable ? '✅' : '❌'),
                'GoMafia reachable: ' + (d.gomafia_reachable ? '✅' : '❌'),
                d.gomafia_build_id ? 'BuildId: ' + d.gomafia_build_id : '',
                d.disabled_functions ? 'Disabled: ' + d.disabled_functions : '',
            ].filter(Boolean).join('\n');
            const logHtml = d.log_file ? '<div style="margin-top:10px"><div style="font-weight:700;font-size:.8em;margin-bottom:4px">Sync Log:</div><pre class="admin-json" style="max-height:200px">' + esc(d.log_file) + '</pre></div>' : '';
            showModal('Диагностика синхронизации', '<pre class="admin-json" style="white-space:pre-wrap">' + esc(lines) + '</pre>' + logHtml);
        } catch(e) { toast('Ошибка диагностики: ' + e.message, 'error'); }
    }

    // =======================================================================
    // Auth Sessions (NEW)
    // =======================================================================
    async function loadSessions() {
        const content = document.getElementById('admin-page-content');
        try {
            const data = await apiCall('admin-users.php', { params: { page: state.sessionsPage, sort: 'last_active', order: 'DESC' } });
            state.sessionsData = data;

            let totalSessions = 0;
            let rows = '';
            if (data.users && data.users.length > 0) {
                rows = data.users.map(u => {
                    totalSessions += u.sessions_count;
                    const name = esc(u.telegram_first_name||'') + ' ' + esc(u.telegram_last_name||'');
                    return '<tr><td>' + esc(u.telegram_id) + '</td><td>' + (name.trim()||'—') + '</td><td>' + (u.telegram_username ? '@' + esc(u.telegram_username) : '—') + '</td><td><span class="admin-badge admin-badge-blue">' + u.sessions_count + '</span></td><td title="' + formatDate(u.last_active) + '">' + timeAgo(u.last_active) + '</td><td><button class="admin-btn admin-btn-xs admin-btn-danger" onclick="AdminApp.deleteUserSessions(\'' + u.telegram_id + '\')">Завершить</button></td></tr>';
                }).join('');
            } else {
                rows = '<tr><td colspan="6" class="admin-empty" style="padding:30px"><h3>Нет данных</h3></td></tr>';
            }

            content.innerHTML = `
                <div class="admin-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">
                    <div class="admin-stat-card mini"><div class="admin-stat-label">Пользователей</div><div class="admin-stat-value">${data.total}</div></div>
                    <div class="admin-stat-card mini"><div class="admin-stat-label">Всего сессий (на стр.)</div><div class="admin-stat-value">${totalSessions}</div></div>
                </div>
                <div class="admin-table-wrapper"><table class="admin-table"><thead><tr><th>Telegram ID</th><th>Имя</th><th>Username</th><th>Сессий</th><th>Активность</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table></div>
                ${renderPagination(data.page, data.totalPages, 'AdminApp.sessionsGoToPage')}`;
        } catch(e) { content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }

    function sessionsGoToPage(p) { state.sessionsPage = p; loadSessions(); }

    // =======================================================================
    // System (NEW)
    // =======================================================================
    async function loadSystem() {
        const content = document.getElementById('admin-page-content');
        try {
            const stats = await apiCall('admin-stats.php');

            content.innerHTML = `
                <div class="admin-card" style="margin-bottom:14px">
                    <div class="admin-card-header"><div class="admin-card-title">Информация о системе</div></div>
                    <div class="sys-info-grid">
                        <div class="sys-info-item"><div class="sys-info-label">Пользователей</div><div class="sys-info-value">${stats.totalUsers}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Активны сегодня</div><div class="sys-info-value">${stats.activeToday}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">За неделю</div><div class="sys-info-value">${stats.activeWeek}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">За месяц</div><div class="sys-info-value">${stats.activeMonth}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Всего игр</div><div class="sys-info-value">${stats.totalGames}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Пользователей с играми</div><div class="sys-info-value">${stats.totalGameUsers}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Итогов</div><div class="sys-info-value">${stats.totalSummaries}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Игроков в БД</div><div class="sys-info-value">${stats.totalPlayers}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Активных комнат</div><div class="sys-info-value">${stats.activeRooms ? stats.activeRooms.length : 0}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Retention</div><div class="sys-info-value">${stats.retentionRate}% (${stats.retentionCount})</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Среднее игр/юзер</div><div class="sys-info-value">${stats.avgGamesPerUser}</div></div>
                    </div>
                </div>

                <div class="admin-card" style="margin-bottom:14px">
                    <div class="admin-card-header"><div class="admin-card-title">Администратор</div></div>
                    <div class="admin-detail-grid">
                        <div class="admin-detail-label">Telegram ID</div><div class="admin-detail-value">${state.user ? state.user.telegram_id : '—'}</div>
                        <div class="admin-detail-label">Username</div><div class="admin-detail-value">${state.user && state.user.username ? '@' + esc(state.user.username) : '—'}</div>
                        <div class="admin-detail-label">Имя</div><div class="admin-detail-value">${state.user ? esc((state.user.first_name||'') + ' ' + (state.user.last_name||'')) : '—'}</div>
                    </div>
                </div>

                <div class="admin-card" style="margin-bottom:14px">
                    <div class="admin-card-header"><div class="admin-card-title">Технические данные</div></div>
                    <div class="sys-info-grid">
                        <div class="sys-info-item"><div class="sys-info-label">Браузер</div><div class="sys-info-value" style="font-size:.78em;word-break:break-all">${navigator.userAgent.substring(0, 60)}…</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Разрешение</div><div class="sys-info-value">${screen.width}×${screen.height}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Окно</div><div class="sys-info-value">${window.innerWidth}×${window.innerHeight}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Время</div><div class="sys-info-value">${new Date().toLocaleString('ru-RU')}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">Часовой пояс</div><div class="sys-info-value">${Intl.DateTimeFormat().resolvedOptions().timeZone}</div></div>
                        <div class="sys-info-item"><div class="sys-info-label">API Base</div><div class="sys-info-value" style="font-size:.78em">${API_BASE}</div></div>
                    </div>
                </div>

                <div class="admin-card">
                    <div class="admin-card-header"><div class="admin-card-title">Быстрые действия</div></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="admin-btn admin-btn-primary" onclick="AdminApp.refreshCurrentPage()">Обновить данные</button>
                        <button class="admin-btn admin-btn-secondary" onclick="AdminApp.navigate('dashboard')">На дашборд</button>
                        <button class="admin-btn admin-btn-danger" onclick="AdminApp.logout()">Выйти</button>
                    </div>
                </div>`;
        } catch(e) { content.innerHTML = '<div class="admin-empty"><h3>Ошибка</h3><p>' + esc(e.message) + '</p></div>'; }
    }


    // =======================================================================
    // Sidebar
    // =======================================================================
    function initSidebar() {
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const closeBtn = document.getElementById('sidebar-close-btn');
        const sidebar = document.getElementById('admin-sidebar');
        if (toggleBtn) toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        if (closeBtn) closeBtn.addEventListener('click', () => sidebar.classList.remove('open'));
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    // =======================================================================
    // Keyboard Shortcuts
    // =======================================================================
    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'r' || e.key === 'R') { e.preventDefault(); refreshCurrentPage(); }
            if (e.key === 'Escape') {
                if (document.getElementById('admin-modal').style.display === 'flex') closeModal();
                else if (document.getElementById('admin-confirm').style.display === 'flex') _confirmResult(false);
            }
            if (e.key === '1') navigate('dashboard');
            if (e.key === '2') navigate('users');
            if (e.key === '3') navigate('profiles');
            if (e.key === '4') navigate('games');
            if (e.key === '5') navigate('rooms');
        });
    }

    // =======================================================================
    // Init
    // =======================================================================
    function init() {
        initSidebar();
        initKeyboard();
        checkAuth();
    }

    // =======================================================================
    // Public API
    // =======================================================================
    window.AdminApp = {
        navigate, logout, closeModal, refreshCurrentPage, loadDashboard, _confirmResult,
        // Users
        searchUsers, clearUserSearch, sortUsers, usersGoToPage, exportUsers,
        deleteUserSessions, showGameModal, deleteGame, saveGameEdit, saveGameFromJson,
        // Games
        gamesGoToPage, showGameDetailModal, deleteAllGames, loadGameDetail,
        // Profiles
        searchProfiles, clearProfileSearch, profilesGoToPage,
        editProfile, saveProfile, deleteProfile,
        // Summaries
        showSummaryModal, deleteSummary,
        // Rooms
        loadRooms, clearRoom, deleteRoom, clearAllRooms,
        kickRoomPlayer, setRoomRole, updateRoomField, openRoomPanel,
        // Players
        searchPlayers, clearPlayerSearch, addPlayer, startSync, stopSync, runSyncDiagnostics,
        // Sessions
        sessionsGoToPage,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
