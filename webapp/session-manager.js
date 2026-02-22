/**
 * Session Manager для сохранения и восстановления сессий мафии
 * Поддерживает localStorage, Telegram Cloud Storage и серверную синхронизацию
 * Версия 5: исправлены гонки инициализации между Cloud Storage, авторизацией и Vue
 */
window.sessionManager = (function() {
    const SESSIONS_KEY = 'maf-sessions';
    const SESSION_DURATION = 365 * 24 * 60 * 60 * 1000;
    const MAX_SESSIONS = 50;
    const SYNC_DEBOUNCE_MS = 2000;
    const SYNC_API_URL = './api/sessions-sync.php';

    // ============================================
    // In-memory кэш сессий
    // ============================================
    let _cachedSessions = null;
    let _cacheReady = false;

    // Promise, который разрешается когда кэш прогрет (из localStorage ИЛИ Cloud Storage)
    let _readyResolve = null;
    const _readyPromise = new Promise(function(resolve) { _readyResolve = resolve; });

    // ============================================
    // Серверная синхронизация
    // ============================================
    let _syncTimer = null;
    let _syncInProgress = false;

    // Генерация уникального ID сессии
    function generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Проверяем доступность Telegram Cloud Storage
    function hasTelegramCloudStorage() {
        try {
            if (!window.Telegram || !window.Telegram.WebApp) return false;
            var webApp = window.Telegram.WebApp;
            if (!webApp.CloudStorage || typeof webApp.CloudStorage.setItem !== 'function') return false;
            if (webApp.version && parseFloat(webApp.version) < 6.1) return false;
            return true;
        } catch (error) {
            return false;
        }
    }

    // Очистка сессий старше SESSION_DURATION
    function cleanExpiredSessions(sessions) {
        var now = Date.now();
        return sessions.filter(function(s) { return s.timestamp && (now - s.timestamp) < SESSION_DURATION; });
    }

    // Парсинг данных сессий из строки
    function parseSessionsData(data) {
        if (!data || typeof data !== 'string') return [];
        if (data.startsWith('<?') || data.includes('<html>') || data.includes('Fatal error')) {
            console.warn('Хранилище содержит HTML/PHP вместо JSON:', data.substring(0, 100));
            return [];
        }
        try {
            var parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return cleanExpiredSessions(parsed);
            if (parsed && typeof parsed === 'object' && parsed.timestamp) {
                if (!parsed.sessionId) parsed.sessionId = generateSessionId();
                return cleanExpiredSessions([parsed]);
            }
            return [];
        } catch (e) {
            console.error('Ошибка парсинга сессий:', e);
            return [];
        }
    }

    // ============================================
    // Прогрев кэша — вызывается один раз при инициализации
    // ============================================
    function _warmUpCache() {
        // Сначала сразу загружаем из localStorage (синхронно, мгновенно)
        var localSessions = [];
        try {
            var data = localStorage.getItem(SESSIONS_KEY);
            var oldData = !data ? localStorage.getItem('maf-session') : null;
            localSessions = parseSessionsData(data || oldData);
            if (oldData && !data) {
                try { localStorage.removeItem('maf-session'); } catch(e) {}
            }
        } catch(e) {}

        // Устанавливаем localStorage данные как baseline сразу (не ждём Cloud Storage)
        if (!_cacheReady) {
            _cachedSessions = localSessions.length > 0 ? JSON.parse(JSON.stringify(localSessions)) : [];
            _cacheReady = true;
            console.log('📦 Cache warm-up: localStorage baseline (' + _cachedSessions.length + ' сессий)');
        }

        // Если Cloud Storage доступен — дополнительно загружаем оттуда и мержим
        if (hasTelegramCloudStorage()) {
            console.log('📦 Cache warm-up: также загружаем из Telegram Cloud Storage...');
            window.Telegram.WebApp.CloudStorage.getItem(SESSIONS_KEY, function(error, data) {
                var cloudSessions = [];
                if (!error && data) {
                    cloudSessions = parseSessionsData(data);
                }
                if (cloudSessions.length > 0) {
                    // Мержим Cloud Storage + localStorage
                    var merged = _mergeSessions(_cachedSessions || [], cloudSessions);
                    _cachedSessions = JSON.parse(JSON.stringify(merged));
                    console.log('📦 Cache warm-up: Cloud Storage merge → ' + _cachedSessions.length + ' сессий');
                    // Сохраняем merged обратно в localStorage
                    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(_cachedSessions)); } catch(e) {}
                }
                _cacheReady = true;
                if (_readyResolve) { _readyResolve(); _readyResolve = null; }
            });
            // Таймаут на случай если Cloud Storage зависнет
            setTimeout(function() {
                if (_readyResolve) {
                    console.warn('⚠️ Cloud Storage timeout, используем localStorage');
                    _readyResolve();
                    _readyResolve = null;
                }
            }, 3000);
        } else {
            // Нет Cloud Storage — localStorage уже загружен
            if (_readyResolve) { _readyResolve(); _readyResolve = null; }
        }
    }

    // ============================================
    // Серверная синхронизация — функции
    // ============================================

    function _getAuthToken() {
        try { return localStorage.getItem('maf_auth_token') || null; } catch (e) { return null; }
    }

    function _scheduleSyncToServer() {
        if (!_getAuthToken()) return;
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(function() {
            _syncTimer = null;
            _pushToServer();
        }, SYNC_DEBOUNCE_MS);
    }

    function _pushToServer() {
        var token = _getAuthToken();
        if (!token || _syncInProgress) return;

        var sessions = _cachedSessions || [];
        _syncInProgress = true;

        fetch(SYNC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, sessions: sessions })
        })
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            _syncInProgress = false;
            if (data.error) {
                console.warn('⚠️ Sync push ошибка:', data.error);
            } else {
                console.log('☁️ Сессии синхронизированы на сервер');
                if (data.sessions && Array.isArray(data.sessions)) {
                    // Merge server response with current local cache (local wins on conflict by timestamp)
                    var merged = _mergeSessions(_cachedSessions || [], data.sessions);
                    var cleaned = cleanExpiredSessions(merged).slice(0, MAX_SESSIONS);
                    try { _cachedSessions = JSON.parse(JSON.stringify(cleaned)); } catch(e) { _cachedSessions = cleaned; }
                    _cacheReady = true;
                    var dataString = JSON.stringify(cleaned);
                    try { localStorage.setItem(SESSIONS_KEY, dataString); } catch(e) {}
                    if (hasTelegramCloudStorage()) {
                        window.Telegram.WebApp.CloudStorage.setItem(SESSIONS_KEY, dataString, function() {});
                    }
                }
            }
        })
        .catch(function(err) {
            _syncInProgress = false;
            console.warn('⚠️ Sync push сетевая ошибка:', err);
        });
    }

    function _mergeSessions(localSessions, serverSessions) {
        var sessionsMap = {};
        (localSessions || []).forEach(function(s) {
            if (s && s.sessionId) sessionsMap[s.sessionId] = s;
        });
        (serverSessions || []).forEach(function(s) {
            if (!s || !s.sessionId) return;
            var existing = sessionsMap[s.sessionId];
            if (!existing) {
                sessionsMap[s.sessionId] = s;
            } else {
                if ((s.timestamp || 0) > (existing.timestamp || 0)) {
                    sessionsMap[s.sessionId] = s;
                }
            }
        });
        var result = Object.keys(sessionsMap).map(function(key) { return sessionsMap[key]; });
        result.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        return result;
    }

    function syncFromServer(callback) {
        var token = _getAuthToken();
        if (!token) {
            console.log('☁️ syncFromServer: нет auth token, пропускаем');
            if (callback) callback(null, getSessions() || []);
            return;
        }

        console.log('☁️ syncFromServer: загружаем сессии с сервера...');

        fetch(SYNC_API_URL + '?token=' + encodeURIComponent(token))
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            if (data.error) {
                console.warn('⚠️ syncFromServer ошибка:', data.error);
                if (callback) callback(null, getSessions() || []);
                return;
            }

            var serverSessions = data.sessions || [];
            var localSessions = getSessions() || [];

            console.log('☁️ syncFromServer: сервер=' + serverSessions.length + ', локально=' + localSessions.length);

            var merged = _mergeSessions(localSessions, serverSessions);
            console.log('☁️ syncFromServer: после merge=' + merged.length);

            var cleaned = cleanExpiredSessions(merged).slice(0, MAX_SESSIONS);
            try { _cachedSessions = JSON.parse(JSON.stringify(cleaned)); } catch (e) { _cachedSessions = cleaned; }
            _cacheReady = true;

            var dataString = JSON.stringify(cleaned);
            try { localStorage.setItem(SESSIONS_KEY, dataString); } catch (e) {}
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.setItem(SESSIONS_KEY, dataString, function() {});
            }

            // Пушим merged результат обратно на сервер
            _pushToServer();

            if (callback) callback(null, cleaned);
        })
        .catch(function(err) {
            console.warn('⚠️ syncFromServer сетевая ошибка:', err);
            if (callback) callback(null, getSessions() || []);
        });
    }

    // ============================================
    // Сохранение и загрузка сессий
    // ============================================

    function saveSessions(sessions) {
        var cleaned = cleanExpiredSessions(sessions).slice(0, MAX_SESSIONS);
        try { _cachedSessions = JSON.parse(JSON.stringify(cleaned)); } catch (e) { _cachedSessions = cleaned; }
        _cacheReady = true;

        var dataString = JSON.stringify(cleaned);
        try { localStorage.setItem(SESSIONS_KEY, dataString); } catch (e) {}
        if (hasTelegramCloudStorage()) {
            window.Telegram.WebApp.CloudStorage.setItem(SESSIONS_KEY, dataString, function(error) {
                if (error) console.warn('Ошибка сохранения в Telegram Cloud Storage:', error);
            });
        }
        _scheduleSyncToServer();
    }

    function getSessions(callback) {
        // === Асинхронный путь (с callback) ===
        if (callback && typeof callback === 'function') {
            if (_cacheReady && _cachedSessions !== null) {
                callback(null, JSON.parse(JSON.stringify(_cachedSessions)));
                return;
            }
            // Ждём прогрева кэша
            _readyPromise.then(function() {
                callback(null, JSON.parse(JSON.stringify(_cachedSessions || [])));
            });
            return;
        }

        // === Синхронный путь (без callback) ===
        if (_cacheReady && _cachedSessions !== null) {
            return JSON.parse(JSON.stringify(_cachedSessions));
        }
        // Fallback: синхронно из localStorage
        try {
            var data = localStorage.getItem(SESSIONS_KEY);
            return parseSessionsData(data) || [];
        } catch(e) { return []; }
    }

    /**
     * Ждёт, пока кэш будет прогрет (localStorage + Cloud Storage), затем вызывает callback.
     * Используется приложением для гарантированной загрузки сессий перед показом UI.
     */
    function whenReady(callback) {
        if (_cacheReady && _cachedSessions !== null) {
            callback(_cachedSessions);
            return;
        }
        _readyPromise.then(function() {
            callback(_cachedSessions || []);
        });
    }

    // ============================================
    // CRUD операции
    // ============================================

    function addOrUpdateSession(sessionData) {
        if (!sessionData.sessionId) sessionData.sessionId = generateSessionId();
        sessionData.timestamp = Date.now();

        var sessions = getSessions() || [];
        var existingIndex = sessions.findIndex(function(s) { return s.sessionId === sessionData.sessionId; });
        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }
        saveSessions(sessions);
        return sessionData.sessionId;
    }

    function getSessionById(sessionId, callback) {
        if (callback && typeof callback === 'function') {
            getSessions(function(error, sessions) {
                if (error) { callback(error, null); return; }
                callback(null, (sessions || []).find(function(s) { return s.sessionId === sessionId; }) || null);
            });
            return;
        }
        var sessions = getSessions() || [];
        return sessions.find(function(s) { return s.sessionId === sessionId; }) || null;
    }

    function removeSession(sessionId) {
        var sessions = getSessions() || [];
        saveSessions(sessions.filter(function(s) { return s.sessionId !== sessionId; }));
    }

    function isSessionValid(sessionData) {
        if (!sessionData || !sessionData.timestamp) return false;
        return (Date.now() - sessionData.timestamp) < SESSION_DURATION;
    }

    function hasSignificantData(sessionData) {
        if (!sessionData) return false;
        var hasRoles = sessionData.roles && Object.keys(sessionData.roles).length > 0;
        var hasActions = sessionData.playersActions && Object.keys(sessionData.playersActions).length > 0;
        var hasFouls = sessionData.fouls && Object.keys(sessionData.fouls).length > 0;
        var hasTechFouls = sessionData.techFouls && Object.keys(sessionData.techFouls).length > 0;
        var hasRemoved = sessionData.removed && Object.keys(sessionData.removed).length > 0;
        var hasBestMove = sessionData.bestMove && sessionData.bestMove.length > 0;
        var hasManualPlayers = sessionData.manualPlayers && sessionData.manualPlayers.length > 0;
        var hasTournamentId = sessionData.tournamentId && sessionData.tournamentId.toString().trim();
        return hasRoles || hasActions || hasFouls || hasTechFouls || hasRemoved || hasBestMove || hasManualPlayers || hasTournamentId;
    }

    function clearAllSessions() {
        _cachedSessions = [];
        _cacheReady = true;
        try {
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.removeItem(SESSIONS_KEY, function() {});
            }
            localStorage.removeItem(SESSIONS_KEY);
            localStorage.removeItem('maf-session');
        } catch (e) {}
        _scheduleSyncToServer();
    }

    // Обратная совместимость
    function clearSession() { clearAllSessions(); }
    function saveSession(sessionData) { return addOrUpdateSession(sessionData); }
    function getSession(callback) {
        if (callback && typeof callback === 'function') {
            getSessions(function(error, sessions) {
                if (error || !sessions || sessions.length === 0) { callback(error, null); return; }
                callback(null, sessions[0]);
            });
            return;
        }
        var sessions = getSessions();
        return sessions && sessions.length > 0 ? sessions[0] : null;
    }

    // ============================================
    // Публичный API
    // ============================================
    var api = {
        generateSessionId: generateSessionId,
        saveSessions: saveSessions,
        getSessions: getSessions,
        addOrUpdateSession: addOrUpdateSession,
        getSessionById: getSessionById,
        removeSession: removeSession,
        isSessionValid: isSessionValid,
        hasSignificantData: hasSignificantData,
        clearAllSessions: clearAllSessions,
        hasTelegramCloudStorage: hasTelegramCloudStorage,
        syncFromServer: syncFromServer,
        whenReady: whenReady,
        // Обратная совместимость
        saveSession: saveSession,
        getSession: getSession,
        clearSession: clearSession
    };

    // ============================================
    // Инициализация
    // ============================================

    // Прогрев кэша: сначала localStorage (синхронно), потом Cloud Storage (async)
    _warmUpCache();

    // При закрытии страницы — мгновенный push через sendBeacon
    window.addEventListener('beforeunload', function() {
        var token = _getAuthToken();
        if (!token) return;
        if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
        var sessions = _cachedSessions || [];
        var payload = JSON.stringify({ token: token, sessions: sessions });
        if (navigator.sendBeacon) {
            var blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(SYNC_API_URL, blob);
        }
    });

    // При возвращении в приложение — pull с сервера
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && _getAuthToken()) {
            syncFromServer(function() {
                if (window.app && typeof window.app.loadMainMenu === 'function') {
                    window.app.loadMainMenu();
                }
            });
        }
    });

    // Периодическая фоновая синхронизация (каждые 30 сек)
    setInterval(function() {
        if (document.visibilityState !== 'visible') return;
        if (!_getAuthToken()) return;
        if (_syncInProgress) return;
        syncFromServer(function() {
            if (window.app && typeof window.app.loadMainMenu === 'function') {
                window.app.loadMainMenu();
            }
        });
    }, 30000);

    return api;
})();

console.log('✅ Session Manager v5 инициализирован');
