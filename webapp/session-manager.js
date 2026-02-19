/**
 * Session Manager для сохранения и восстановления сессий мафии
 * Поддерживает localStorage и Telegram Cloud Storage
 */
window.sessionManager = (function() {
    const SESSION_KEY = 'maf-session';
    const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах    // Проверяем доступность Telegram Cloud Storage
    function hasTelegramCloudStorage() {
        try {
            // Дополнительно проверяем, что мы в Telegram окружении
            if (!window.Telegram || !window.Telegram.WebApp) {
                return false;
            }
            
            // Проверяем версию и поддержку CloudStorage
            const webApp = window.Telegram.WebApp;
            if (!webApp.CloudStorage || typeof webApp.CloudStorage.setItem !== 'function') {
                return false;
            }
            
            // Проверяем, что версия поддерживает CloudStorage
            if (webApp.version && parseFloat(webApp.version) < 6.1) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.warn('Telegram Cloud Storage недоступен:', error);
            return false;
        }
    }
    
    // Сохранение сессии
    function saveSession(sessionData) {
        const sessionWithTimestamp = {
            ...sessionData,
            timestamp: Date.now()
        };
        
        const dataString = JSON.stringify(sessionWithTimestamp);
          try {
            // Пробуем сохранить в Telegram Cloud Storage только если он действительно доступен
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.setItem(SESSION_KEY, dataString, function(error) {
                    if (error) {
                        console.warn('Ошибка сохранения в Telegram Cloud Storage:', error);
                        // Fallback на localStorage
                        try {
                            localStorage.setItem(SESSION_KEY, dataString);
                            console.log('✅ Сессия сохранена в localStorage (fallback)');
                        } catch (localError) {
                            console.error('Ошибка сохранения в localStorage:', localError);
                        }
                    } else {
                        console.log('✅ Сессия сохранена в Telegram Cloud Storage');
                    }
                });
            } else {
                // Используем localStorage
                localStorage.setItem(SESSION_KEY, dataString);
                console.log('✅ Сессия сохранена в localStorage');
            }
        } catch (error) {
            console.error('Ошибка сохранения сессии:', error);
            // Финальный fallback на localStorage
            try {
                localStorage.setItem(SESSION_KEY, dataString);
                console.log('✅ Сессия сохранена в localStorage (emergency fallback)');
            } catch (localError) {
                console.error('Критическая ошибка: не удается сохранить сессию нигде:', localError);
            }
        }
    }
    
    // Загрузка сессии
    function getSession(callback) {
        // Если передан callback, это асинхронный вызов для Telegram Cloud Storage
        if (callback && typeof callback === 'function') {
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.getItem(SESSION_KEY, function(error, data) {
                    if (error || !data) {                        // Fallback на localStorage
                        const localData = localStorage.getItem(SESSION_KEY);
                        if (localData) {
                            try {
                                // Дополнительная проверка на корректность данных из localStorage
                                if (localData.startsWith('<?') || localData.includes('<html>') || localData.includes('Fatal error')) {
                                    console.warn('localStorage содержит HTML/PHP вместо JSON:', localData.substring(0, 100));
                                    localStorage.removeItem(SESSION_KEY); // Очищаем некорректные данные
                                    callback(null, null);
                                    return;
                                }
                                
                                const parsed = JSON.parse(localData);
                                callback(null, parsed);
                            } catch (e) {
                                console.error('Ошибка парсинга JSON из localStorage:', e, 'Данные:', localData?.substring(0, 100));
                                // Очищаем поврежденные данные
                                try {
                                    localStorage.removeItem(SESSION_KEY);
                                    console.log('🗑️ Очищены поврежденные данные из localStorage');
                                } catch (clearError) {
                                    console.error('Ошибка очистки localStorage:', clearError);
                                }
                                callback(e, null);
                            }
                        } else {
                            callback(null, null);
                        }                    } else {
                        try {
                            // Дополнительная проверка на корректность данных
                            if (!data || typeof data !== 'string') {
                                console.warn('Telegram Cloud Storage вернул некорректные данные:', typeof data, data);
                                callback(new Error('Некорректные данные из Cloud Storage'), null);
                                return;
                            }
                            
                            // Проверяем, что это не HTML/PHP ошибка
                            if (data.startsWith('<?') || data.includes('<html>') || data.includes('Fatal error')) {
                                console.warn('Telegram Cloud Storage вернул HTML/PHP вместо JSON:', data.substring(0, 100));
                                callback(new Error('Cloud Storage вернул HTML вместо JSON'), null);
                                return;
                            }
                            
                            const parsed = JSON.parse(data);
                            callback(null, parsed);
                        } catch (e) {
                            console.error('Ошибка парсинга JSON из Telegram Cloud Storage:', e, 'Данные:', data?.substring(0, 100));
                            callback(e, null);
                        }
                    }
                });
                return;
            }
        }
          // Синхронный вызов для localStorage
        try {
            const data = localStorage.getItem(SESSION_KEY);
            if (data) {
                // Дополнительная проверка на корректность данных
                if (data.startsWith('<?') || data.includes('<html>') || data.includes('Fatal error')) {
                    console.warn('localStorage содержит HTML/PHP вместо JSON:', data.substring(0, 100));
                    localStorage.removeItem(SESSION_KEY); // Очищаем некорректные данные
                    return null;
                }
                
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки сессии из localStorage:', error);
            // Пытаемся очистить поврежденные данные
            try {
                localStorage.removeItem(SESSION_KEY);
                console.log('🗑️ Очищены поврежденные данные из localStorage');
            } catch (clearError) {
                console.error('Ошибка очистки localStorage:', clearError);
            }
        }
        return null;
    }
    
    // Проверка валидности сессии
    function isSessionValid(sessionData) {
        if (!sessionData || !sessionData.timestamp) {
            return false;
        }
        
        const now = Date.now();
        const sessionAge = now - sessionData.timestamp;
        
        return sessionAge < SESSION_DURATION;
    }
      // Проверка наличия значимых данных в сессии
    function hasSignificantData(sessionData) {
        if (!sessionData) return false;
        
        // Проверяем наличие важных данных
        const hasRoomId = sessionData.roomId && sessionData.roomId.trim();
        const hasTournamentId = sessionData.tournamentId && sessionData.tournamentId.trim();
        const hasManualMode = sessionData.manualMode;
        const hasRoles = sessionData.roles && Object.keys(sessionData.roles).length > 0;
        const hasActions = sessionData.playersActions && Object.keys(sessionData.playersActions).length > 0;
        const hasFouls = sessionData.fouls && Object.keys(sessionData.fouls).length > 0;
        const hasTechFouls = sessionData.techFouls && Object.keys(sessionData.techFouls).length > 0;
        const hasRemoved = sessionData.removed && Object.keys(sessionData.removed).length > 0;
        const hasBestMove = sessionData.bestMove && sessionData.bestMove.length > 0;
        
        // Дополнительно логируем для отладки
        console.log('🔍 hasSignificantData проверка:', {
            hasRoomId, hasTournamentId, hasManualMode, hasRoles, hasActions, 
            hasFouls, hasTechFouls, hasRemoved, hasBestMove
        });
        
        // Сессия значима, если есть комната и хотя бы одно из важных состояний
        return hasRoomId && (hasTournamentId || hasManualMode || hasRoles || hasActions || hasFouls || hasTechFouls || hasRemoved || hasBestMove);
    }
      // Очистка сессии
    function clearSession() {
        try {
            // Очищаем из Telegram Cloud Storage только если он доступен
            if (hasTelegramCloudStorage()) {
                window.Telegram.WebApp.CloudStorage.removeItem(SESSION_KEY, function(error) {
                    if (error) {
                        console.warn('Ошибка удаления из Telegram Cloud Storage:', error);
                    } else {
                        console.log('🗑️ Сессия удалена из Telegram Cloud Storage');
                    }
                });
            }
            
            // Всегда очищаем localStorage
            localStorage.removeItem(SESSION_KEY);
            console.log('🗑️ Сессия удалена из localStorage');
        } catch (error) {
            console.error('Ошибка удаления сессии:', error);
            // Попытка очистить хотя бы localStorage
            try {
                localStorage.removeItem(SESSION_KEY);
                console.log('🗑️ Сессия удалена из localStorage (fallback)');
            } catch (localError) {
                console.error('Критическая ошибка: не удается очистить сессию:', localError);
            }
        }
    }
      // Публичный API
    return {
        saveSession: saveSession,
        getSession: getSession,
        isSessionValid: isSessionValid,
        hasSignificantData: hasSignificantData,
        clearSession: clearSession,
        hasTelegramCloudStorage: hasTelegramCloudStorage
    };
})();

console.log('✅ Session Manager инициализирован');
