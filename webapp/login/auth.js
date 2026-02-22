// =====================================================
// MafBoard - Система авторизации через Telegram
// v2: Авторизация в фоне, без мелькания оверлея при наличии токена
// =====================================================

(function() {
    'use strict';

    const AUTH_TOKEN_KEY = 'maf_auth_token';
    const AUTH_USER_KEY = 'maf_auth_user';
    const AUTH_API_BASE = './login/';
    const CODE_POLL_INTERVAL = 2500;

    let pollTimer = null;
    let codeExpiryTimer = null;
    let currentCode = null;

    // Promise для сигнализации готовности авторизации
    let _authResolve = null;
    window._authReady = new Promise(function(resolve) { _authResolve = resolve; });

    // =============================================
    // Утилиты
    // =============================================

    function getStoredToken() {
        try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch (e) { return null; }
    }
    function setStoredToken(token) {
        try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch (e) {}
    }
    function getStoredUser() {
        try { var d = localStorage.getItem(AUTH_USER_KEY); return d ? JSON.parse(d) : null; } catch (e) { return null; }
    }
    function setStoredUser(user) {
        try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)); } catch (e) {}
    }
    function clearAuth() {
        try { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY); } catch (e) {}
    }
    function isTelegramMiniApp() {
        return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData && window.Telegram.WebApp.initData.length > 0);
    }

    // =============================================
    // UI: Экран авторизации (создаётся только когда нужен)
    // =============================================

    function createAuthOverlay() {
        var existing = document.getElementById('maf-auth-overlay');
        if (existing) existing.remove();

        // Убираем splash — auth overlay его заменяет
        var splash = document.getElementById('maf-splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
            setTimeout(function() { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 400);
        }

        var overlay = document.createElement('div');
        overlay.id = 'maf-auth-overlay';
        overlay.innerHTML =
            '<div class="auth-card">' +
                '<div class="auth-logo">' +
                    '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="rgba(168,85,247,0.15)"/><path d="M34.5 13.5L13.5 22.5L20.5 25L25.5 34.5L34.5 13.5Z" stroke="#a855f7" stroke-width="2" stroke-linejoin="round" fill="rgba(168,85,247,0.1)"/></svg>' +
                '</div>' +
                '<h2 class="auth-title">Авторизация</h2>' +
                '<div id="auth-loading" class="auth-state"><div class="auth-spinner"></div><p class="auth-text">Проверка авторизации...</p></div>' +
                '<div id="auth-code-state" class="auth-state" style="display:none;">' +
                    '<p class="auth-text">Отправьте этот код боту в Telegram</p>' +
                    '<div class="auth-code-display"><span id="auth-code-digits">----</span></div>' +
                    '<a id="auth-bot-link" href="#" target="_blank" class="auth-bot-btn">' +
                        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.98-1.73 6.63-2.87 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.53.17.14.12.18.28.2.47-.01.06.01.24 0 .38z"/></svg>' +
                        'Открыть бота' +
                    '</a>' +
                    '<div class="auth-timer-bar"><div id="auth-timer-fill" class="auth-timer-fill"></div></div>' +
                    '<p class="auth-hint" id="auth-status-text">Ожидание подтверждения...</p>' +
                    '<button id="auth-refresh-btn" class="auth-refresh-btn" style="display:none;" onclick="window.mafAuth.requestNewCode()">Получить новый код</button>' +
                '</div>' +
                '<div id="auth-error-state" class="auth-state" style="display:none;">' +
                    '<p class="auth-error-text" id="auth-error-message">Ошибка авторизации</p>' +
                    '<button class="auth-retry-btn" onclick="window.mafAuth.retry()">Попробовать снова</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        return overlay;
    }

    function showAuthState(stateId) {
        ['auth-loading', 'auth-code-state', 'auth-error-state'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = (id === stateId) ? 'flex' : 'none';
        });
    }

    function removeAuthOverlay() {
        var overlay = document.getElementById('maf-auth-overlay');
        if (overlay) {
            overlay.classList.add('auth-fade-out');
            setTimeout(function() { overlay.remove(); }, 400);
        }
        stopPolling();
    }

    // =============================================
    // API вызовы
    // =============================================

    async function validateToken(token) {
        try {
            var resp = await fetch(AUTH_API_BASE + 'session-validate.php?token=' + encodeURIComponent(token));
            return await resp.json();
        } catch (e) {
            console.error('Auth: ошибка валидации токена:', e);
            return { valid: false };
        }
    }

    async function telegramAutoAuth(initData) {
        try {
            var resp = await fetch(AUTH_API_BASE + 'tg-auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'initData=' + encodeURIComponent(initData)
            });
            return await resp.json();
        } catch (e) {
            console.error('Auth: ошибка TG авторизации:', e);
            return { error: 'Network error' };
        }
    }

    async function requestCode() {
        try {
            var resp = await fetch(AUTH_API_BASE + 'code-generate.php', { method: 'POST' });
            var text = await resp.text();
            try { return JSON.parse(text); } catch (e) { return { error: 'Некорректный ответ сервера' }; }
        } catch (e) { return { error: 'Network error' }; }
    }

    async function checkCode(code) {
        try {
            var resp = await fetch(AUTH_API_BASE + 'code-check.php?code=' + encodeURIComponent(code));
            return await resp.json();
        } catch (e) { return { confirmed: false }; }
    }

    // =============================================
    // Polling
    // =============================================

    function startPolling(code) {
        stopPolling();
        pollTimer = setInterval(async function() {
            var result = await checkCode(code);
            if (result.confirmed && result.token) {
                stopPolling();
                onAuthSuccess(result.token, result.user);
            } else if (result.expired) {
                stopPolling();
                showExpired();
            }
        }, CODE_POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (codeExpiryTimer) { clearTimeout(codeExpiryTimer); codeExpiryTimer = null; }
    }

    function showExpired() {
        var el;
        el = document.getElementById('auth-status-text'); if (el) el.textContent = 'Код истёк';
        el = document.getElementById('auth-refresh-btn'); if (el) el.style.display = 'block';
        el = document.getElementById('auth-timer-fill'); if (el) { el.style.transition = 'none'; el.style.width = '0%'; }
    }

    // =============================================
    // Логика авторизации
    // =============================================

    function onAuthSuccess(token, user) {
        setStoredToken(token);
        if (user) setStoredUser(user);
        removeAuthOverlay();
        console.log('✅ Auth: Авторизация успешна', user);
        if (window.app) window.app.authUser = user;
        // Сигнализируем что авторизация завершена
        if (_authResolve) { _authResolve(true); _authResolve = null; }
    }

    function onAuthNeeded() {
        // Создаём оверлей только когда реально нужна авторизация
        createAuthOverlay();
    }

    async function startAuth() {
        // 1. Есть сохранённый токен — проверяем в фоне БЕЗ оверлея
        var savedToken = getStoredToken();
        if (savedToken) {
            console.log('🔐 Auth: проверяем токен в фоне...');
            var validation = await validateToken(savedToken);
            if (validation.valid) {
                onAuthSuccess(savedToken, validation.user);
                return;
            } else {
                clearAuth();
            }
        }

        // 2. Telegram Mini App — пробуем авто-авторизацию в фоне
        if (isTelegramMiniApp()) {
            console.log('🔐 Auth: Telegram авто-авторизация...');
            var result = await telegramAutoAuth(window.Telegram.WebApp.initData);
            if (result.token) {
                onAuthSuccess(result.token, result.user);
                return;
            }
        }

        // 3. Нужна ручная авторизация — ТОЛЬКО СЕЙЧАС показываем оверлей
        onAuthNeeded();
        await showCodeAuth();
    }

    async function showCodeAuth() {
        showAuthState('auth-code-state');
        var result = await requestCode();
        if (result.error) {
            showAuthState('auth-error-state');
            var errMsg = document.getElementById('auth-error-message');
            if (errMsg) errMsg.textContent = result.error;
            return;
        }

        currentCode = result.code;
        var el;
        el = document.getElementById('auth-code-digits'); if (el) el.textContent = result.code;
        el = document.getElementById('auth-bot-link'); if (el) el.href = result.bot_link;
        el = document.getElementById('auth-status-text'); if (el) el.textContent = 'Ожидание подтверждения...';
        el = document.getElementById('auth-refresh-btn'); if (el) el.style.display = 'none';

        var timerFill = document.getElementById('auth-timer-fill');
        if (timerFill) {
            timerFill.style.transition = 'none';
            timerFill.style.width = '100%';
            timerFill.offsetHeight; // force reflow
            timerFill.style.transition = 'width ' + result.expires_in + 's linear';
            timerFill.style.width = '0%';
        }

        codeExpiryTimer = setTimeout(function() { showExpired(); stopPolling(); }, result.expires_in * 1000);
        startPolling(result.code);
    }

    // =============================================
    // Публичный API
    // =============================================

    window.mafAuth = {
        start: startAuth,
        logout: function() { clearAuth(); stopPolling(); startAuth(); },
        retry: function() { startAuth(); },
        requestNewCode: async function() { stopPolling(); await showCodeAuth(); },
        getUser: getStoredUser,
        getToken: getStoredToken,
        isAuthenticated: function() { return !!getStoredToken(); }
    };

    // =============================================
    // Автозапуск
    // =============================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAuth);
    } else {
        startAuth();
    }
})();
