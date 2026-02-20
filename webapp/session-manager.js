/**
 * Session Manager для сохранения и восстановления сессий мафии
 * Поддерживает localStorage, Telegram Cloud Storage и серверную синхронизацию
 * Версия 4: серверная синхронизация через MySQL для единого хранилища между устройствами
 */
window.sessionManager = (function() {
    const SESSIONS_KEY = 'maf-sessions';
    // Увеличиваем срок хранения до 365 дней, так как теперь есть история игр
    const SESSION_DURATION = 365 * 24 * 60 * 60 * 1000; 
    const MAX_SESSIONS = 50; // Максимум сессий в истории
    const SYNC_DEBOUNCE_MS = 5000; // Debounce для sync на сервер (5 сек)
    const SYNC_API_URL = './api/sessions-sync.php';

    // ============================================
    // In-memory кэш сессий
    // ============================================
    let _cachedSessions = null;
    let _cacheReady = false;

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
            if (!window.Telegram || !window.Telegram.WebApp) {
                return false;
            }
            const webApp = window.Telegram.WebApp;
            if (!webApp.CloudStorage || typeof webApp.CloudStorage.setItem !== 'function') {
                return false;
            }
            if (webApp.version && parseFloat(webApp.version) < 6.1) {
                return false;
            }
            return true;
        } catch (error) {
            console.warn('Telegram Cloud Storage недоступен:', error);
            return false;
        }
    }

    // Очистка сессий старше SESSION_DURATION
    function cleanExpiredSessions(sessions) {
        const now = Date.now();
        return sessions.filter(s => s.timestamp && (now - s.timestamp) < SESSION_DURATION);
    }

    // Парсинг данных сессий из строки
    function parseSessionsData(data) {
        if (!data || typeof data !== 'string') return [];
        if (data.startsWith('<?') || data.includes('<html>') || data.includes('Fatal error')) {
            console.warn('Хранилище содержит HTML/PHP вместо JSON:', data.substring(0, 100));
            return [];
        }
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return cleanExpiredSessions(parsed);
            }
            if (parsed && typeof parsed === 'object' && parsed.timestamp) {
                console.log('🔄 Миграция: конвертируем одну сессию в массив');
                const session = parsed;
                if (!session.sessionId) {
                    session.sessionId = generateSessionId();
                }
                return cleanExpiredSessions([session]);
            }
            return [];
        } catch (e) {
            console.error('Ошибка парсинга сессий:', e);
            return [];
        }
    }

    // ============================================
    // Серверная синхронизация — функции
    // ============================================

    function _getAuthToken() {
        try {
            return localStorage.getItem('maf_auth_token') || null;
        } catch (e) {
            return null;
        }
    }

    function _scheduleSyncToServer() {
        if (!_getAuthToken()) return;
        if (_syncTimer) {
            clearTimeout(_syncTimer);
        }
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
            if (s && s.sessionId) {
                sessionsMap[s.sessionId] = s;
            }
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

            // Сохраняем merged результат локально (без повторного debounce push)
            var cleaned = cleanExpiredSessions(merged).slice(0, MAX_SESSIONS);

            try {
                _cachedSessions = JSON.parse(JSON.stringify(cleaned));
            } catch (e) {
                _cachedSessions = cleaned;
            }
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
        const cleaned = cleanExpiredSessions(sessions).slice(0, MAX_SESSIONS);

        try {
            _cachedSessions = JSON.parse(JSON.stringify(cleaned));
        } catch (e) {
            _cachedSessions = cleaned;
        }
        _cacheReady = true;

        const dataString = JSON.stringify(cleaned);

        try {
            try {
                localStorage.setItem(SESSIONS_KEY, dataString);
            } catch (localError) {
                console.warn('Ошибка сохранения в localStorage:', localError);
            }

            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.setItem(SESSIONS_KEY, dataString, function(error) {
                    if (error) {
                        console.warn('Ошибка сохранения в Telegram Cloud Storage:', error);
                    } else {
                        console.log('✅ Сессии сохранены в Telegram Cloud Storage');
                    }
                });
            } else {
                console.log('✅ Сессии сохранены в localStorage');
            }
        } catch (error) {
            console.error('Ошибка сохранения сессий:', error);
        }

        // Планируем синхронизацию на сервер (debounced)
        _scheduleSyncToServer();
    }

    function getSessions(callback) {
        // === Асинхронный путь (с callback) ===
        if (callback && typeof callback === 'function') {
            if (_cacheReady && _cachedSessions !== null) {
                console.log('📦 getSessions: отдаём из кэша (' + _cachedSessions.length + ' сессий)');
                callback(null, JSON.parse(JSON.stringify(_cachedSessions)));
                return;
            }

            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.getItem(SESSIONS_KEY, function(error, data) {
                    let sessions;
                    if (error || !data) {
                        const localData = localStorage.getItem(SESSIONS_KEY);
                        const oldData = !localData ? localStorage.getItem('maf-session') : null;
                        sessions = parseSessionsData(localData || oldData);
                    } else {
                        sessions = parseSessionsData(data);
                    }
                    _cachedSessions = JSON.parse(JSON.stringify(sessions));
                    _cacheReady = true;
                    console.log('📦 getSessions: кэш прогрет из Cloud Storage (' + sessions.length + ' сессий)');
                    callback(null, sessions);
                });
                return;
            }

            const sessions = _getFromLocalStorage();
            callback(null, sessions);
            return;
        }

        // === Синхронный путь (без callback) ===
        if (_cacheReady && _cachedSessions !== null) {
            return JSON.parse(JSON.stringify(_cachedSessions));
        }
        return _getFromLocalStorage();
    }

    function _getFromLocalStorage() {
        try {
            const data = localStorage.getItem(SESSIONS_KEY);
            const oldData = !data ? localStorage.getItem('maf-session') : null;
            const sessions = parseSessionsData(data || oldData);

            if (oldData && !data) {
                saveSessions(sessions);
                try { localStorage.removeItem('maf-session'); } catch(e) {}
            }

            if (!_cacheReady && !hasTelegramCloudStorage()) {
                _cachedSessions = JSON.parse(JSON.stringify(sessions));
                _cacheReady = true;
            }

            return sessions;
        } catch (error) {
            console.error('Ошибка загрузки сессий из localStorage:', error);
            return [];
        }
    }

    // ============================================
    // CRUD операции
    // ============================================

    function addOrUpdateSession(sessionData) {
        if (!sessionData.sessionId) {
            sessionData.sessionId = generateSessionId();
        }
        sessionData.timestamp = Date.now();

        const sessions = getSessions() || [];
        const existingIndex = sessions.findIndex(s => s.sessionId === sessionData.sessionId);

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
                if (error) {
                    callback(error, null);
                    return;
                }
                const session = sessions.find(s => s.sessionId === sessionId);
                callback(null, session || null);
            });
            return;
        }

        const sessions = getSessions() || [];
        return sessions.find(s => s.sessionId === sessionId) || null;
    }

    function removeSession(sessionId) {
        const sessions = getSessions() || [];
        const filtered = sessions.filter(s => s.sessionId !== sessionId);
        saveSessions(filtered);
    }

    function isSessionValid(sessionData) {
        if (!sessionData || !sessionData.timestamp) {
            return false;
        }
        const now = Date.now();
        const sessionAge = now - sessionData.timestamp;
        return sessionAge < SESSION_DURATION;
    }

    function hasSignificantData(sessionData) {
        if (!sessionData) return false;

        const hasRoles = sessionData.roles && Object.keys(sessionData.roles).length > 0;
        const hasActions = sessionData.playersActions && Object.keys(sessionData.playersActions).length > 0;
        const hasFouls = sessionData.fouls && Object.keys(sessionData.fouls).length > 0;
        const hasTechFouls = sessionData.techFouls && Object.keys(sessionData.techFouls).length > 0;
        const hasRemoved = sessionData.removed && Object.keys(sessionData.removed).length > 0;
        const hasBestMove = sessionData.bestMove && sessionData.bestMove.length > 0;
        const hasManualPlayers = sessionData.manualPlayers && sessionData.manualPlayers.length > 0;
        const hasTournamentId = sessionData.tournamentId && sessionData.tournamentId.toString().trim();

        return hasRoles || hasActions || hasFouls || hasTechFouls || hasRemoved || hasBestMove || hasManualPlayers || hasTournamentId;
    }

    function clearAllSessions() {
        _cachedSessions = [];
        _cacheReady = true;

        try {
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.removeItem(SESSIONS_KEY, function(error) {
                    if (error) {
                        console.warn('Ошибка удаления из Telegram Cloud Storage:', error);
                    }
                });
            }
            localStorage.removeItem(SESSIONS_KEY);
            localStorage.removeItem('maf-session');
            console.log('🗑️ Все сессии удалены');
        } catch (error) {
            console.error('Ошибка удаления сессий:', error);
        }

        // Синхронизируем пустой массив на сервер
        _scheduleSyncToServer();
    }

    // Обратная совместимость
    function clearSession() {
        clearAllSessions();
    }

    function saveSession(sessionData) {
        return addOrUpdateSession(sessionData);
    }

    function getSession(callback) {
        if (callback && typeof callback === 'function') {
            getSessions(function(error, sessions) {
                if (error || !sessions || sessions.length === 0) {
                    callback(error, null);
                    return;
                }
                callback(null, sessions[0]);
            });
            return;
        }
        const sessions = getSessions();
        return sessions && sessions.length > 0 ? sessions[0] : null;
    }

    // ============================================
    // Публичный API
    // ============================================

    const api = {
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
        // Обратная совместимость
        saveSession: saveSession,
        getSession: getSession,
        clearSession: clearSession
    };

    // ============================================
    // Инициализация
    // ============================================

    // Автоматический прогрев кэша при инициализации (для Telegram)
    if (hasTelegramCloudStorage()) {
        console.log('📦 Session Manager: прогреваем кэш из Telegram Cloud Storage...');
        window.Telegram.WebApp.CloudStorage.getItem(SESSIONS_KEY, function(error, data) {
            if (!_cacheReady) {
                let sessions;
                if (error || !data) {
                    const localData = localStorage.getItem(SESSIONS_KEY);
                    const oldData = !localData ? localStorage.getItem('maf-session') : null;
                    sessions = parseSessionsData(localData || oldData);
                } else {
                    sessions = parseSessionsData(data);
                }
                _cachedSessions = JSON.parse(JSON.stringify(sessions));
                _cacheReady = true;
                console.log('📦 Session Manager: кэш прогрет при инициализации (' + sessions.length + ' сессий)');
            }
        });
    }

    // При закрытии страницы — мгновенный push через sendBeacon
    window.addEventListener('beforeunload', function() {
        var token = _getAuthToken();
        if (!token) return;

        if (_syncTimer) {
            clearTimeout(_syncTimer);
            _syncTimer = null;
        }

        var sessions = _cachedSessions || [];
        var payload = JSON.stringify({ token: token, sessions: sessions });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(SYNC_API_URL, payload);
            console.log('☁️ Финальная синхронизация через sendBeacon');
        }
    });

    // При возвращении в приложение — pull с сервера
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && _getAuthToken()) {
            console.log('☁️ Страница стала видимой, синхронизируем с сервером...');
            syncFromServer(function(error, sessions) {
                if (window.app && window.app.showMainMenu && window.app.loadMainMenu) {
                    window.app.loadMainMenu();
                }
            });
        }
    });

    return api;
})();

console.log('✅ Session Manager v4 (серверная синхронизация) инициализирован');
