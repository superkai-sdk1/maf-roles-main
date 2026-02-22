// =====================================================
// Главный файл app-core.js - подключает все части приложения
// Система модулей для MafBoard
// =====================================================

// Базовая проверка доступности Vue.js
if (typeof Vue === 'undefined') {
    console.error('Vue.js не найден! Убедитесь, что Vue.js подключен перед app-core.js');
}

// Инициализация глобального объекта для хранения ссылок
window.mafApp = window.mafApp || {};

console.log('🚀 Запуск MafBoard - модульная система');
console.log('📦 Загружаем основные модули...');

// Глобальный обработчик ошибок для отлова проблем с JSON
window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('Unexpected token')) {
        console.error('🚨 Обнаружена ошибка парсинга JSON:', event.error);
        console.error('🚨 Файл:', event.filename, 'Строка:', event.lineno);
        console.error('🚨 Сообщение:', event.error.message);
        console.error('🚨 Stack trace:', event.error.stack);
        event.preventDefault(); // Предотвращаем показ ошибки в консоли
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('Unexpected token')) {
        console.error('🚨 Обнаружен необработанный Promise rejection с JSON ошибкой:', event.reason);
        console.error('🚨 Сообщение:', event.reason.message);
        console.error('🚨 Stack trace:', event.reason.stack);
        event.preventDefault(); // Предотвращаем показ ошибки в консоли
    }
});

// Глобальный перехватчик fetch для отладки JSON ошибок
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    console.log('🌐 Fetch запрос:', url);
    
    return originalFetch.apply(this, args).then(async response => {
        const clonedResponse = response.clone();
        try {
            const text = await clonedResponse.text();
            if (text.startsWith('<?') || text.includes('<html>')) {
                console.warn('⚠️ Сервер вернул HTML/PHP вместо JSON для:', url);
                console.warn('⚠️ Начало ответа:', text.substring(0, 200));
            }
        } catch (e) {
            // Игнорируем ошибки проверки
        }
        return response;
    });
};

// Проверяем, что все модули загружены
function checkModules() {
    const requiredModules = [
        'goMafia', // из app-connector.js
        'app' // из app-data.js
    ];
    
    const missingModules = requiredModules.filter(module => !window[module]);
    
    if (missingModules.length > 0) {
        console.error('❌ Отсутствуют модули:', missingModules);
        console.error('Убедитесь, что все файлы загружены в правильном порядке:');
        console.error('1. app-connector.js');
        console.error('2. app-data.js');
        console.error('3. app-sessions.js');
        console.error('4. app-game-logic.js');
        console.error('5. app-ui-integration.js');
        console.error('6. app-core.js');
        return false;
    }
    
    return true;
}

// Функция финальной инициализации приложения
function finalizeApp() {
    if (!checkModules()) {
        _removeSplash();
        return;
    }
    
    console.log('✅ Все модули загружены успешно');
    console.log('🔧 Финализируем приложение...');      // Убеждаемся, что все методы добавлены в Vue приложение
    if (window.app && window.app.methods) {
        console.log('📝 Методов в приложении:', Object.keys(window.app.methods).length);
        
        // КРИТИЧНО: Принудительно обновляем методы в экземпляре Vue
        console.log('🔄 Принудительно обновляем методы в Vue экземпляре...');

        // Фильтруем: только функции (исключаем 'watch' и другие объекты)
        var cleanMethods = {};
        Object.keys(window.app.methods).forEach(function(key) {
            if (typeof window.app.methods[key] === 'function') {
                cleanMethods[key] = window.app.methods[key];
            }
        });
        Object.assign(window.app.$options.methods, cleanMethods);

        // Перезаписываем методы напрямую в экземпляре
        Object.keys(cleanMethods).forEach(function(methodName) {
            window.app[methodName] = cleanMethods[methodName].bind(window.app);
        });

        // Регистрируем watchers если они были добавлены через methods.watch
        if (window.app.methods.watch && typeof window.app.methods.watch === 'object') {
            Object.keys(window.app.methods.watch).forEach(function(key) {
                var handler = window.app.methods.watch[key];
                if (typeof handler === 'function') {
                    window.app.$watch(key, handler.bind(window.app));
                }
            });
            console.log('👁️ Watchers зарегистрированы:', Object.keys(window.app.methods.watch));
        }

        console.log('✅ Методы успешно обновлены в Vue экземпляре');
    }
    
    // Дополнительная настройка приложения
    if (window.app) {
        // Добавляем глобальные обработчики ошибок
        window.app.$on('error', (error) => {
            console.error('Vue Error:', error);
        });
        
        // Добавляем отладочную информацию
        window.mafApp.instance = window.app;

        // ПРИМЕНЯЕМ ТЕМУ ИЗ localStorage (глобальный выбор пользователя) — теперь методы точно привязаны
        try {
            var savedColor = localStorage.getItem('maf_color_scheme');
            var savedBg = localStorage.getItem('maf_bg_theme');
            if (savedColor) window.app.selectedColorScheme = savedColor;
            if (savedBg) window.app.selectedBackgroundTheme = savedBg;
            if (typeof window.app.applyColorScheme === 'function') {
                window.app.applyColorScheme(window.app.selectedColorScheme);
            }
            if (typeof window.app.applyBackgroundTheme === 'function') {
                window.app.applyBackgroundTheme(window.app.selectedBackgroundTheme);
            }
            console.log('🎨 Тема применена из localStorage:', window.app.selectedColorScheme, window.app.selectedBackgroundTheme);
        } catch(e) {
            console.warn('⚠️ Ошибка применения темы:', e);
        }

        console.log('🎉 MafBoard успешно инициализирован!');

        // Инициализация слайдеров при изменении состояния UI
        var _sliderInitTimeout = null;
        var _sliderInitElems = {};
        function _debouncedSliderInit() {
            if (_sliderInitTimeout) clearTimeout(_sliderInitTimeout);
            _sliderInitTimeout = setTimeout(function() {
                var a = window.app;
                if (!a) return;
                a.$nextTick(function() {
                    var ids = ['roles', 'skip_discussion', 'skip_freeseating', 'finish_game', 'exit_game', 'save_results', 'go_night', 'go_day'];
                    ids.forEach(function(id) {
                        var el = a.$refs['slider_' + id];
                        if (el && el !== _sliderInitElems[id]) {
                            // New or changed DOM element — (re)init slider
                            if (a.slideStates[id] && a.slideStates[id]._cleanup) a.slideStates[id]._cleanup();
                            delete a.slideStates[id];
                            a.initSlider(id);
                            _sliderInitElems[id] = el;
                        } else if (!el && _sliderInitElems[id]) {
                            // Element removed from DOM — cleanup
                            if (a.slideStates[id] && a.slideStates[id]._cleanup) a.slideStates[id]._cleanup();
                            delete a.slideStates[id];
                            delete _sliderInitElems[id];
                        }
                    });
                });
            }, 120);
        }

        // Watch relevant state changes to init sliders
        ['rolesDistributed', 'gamePhase', 'winnerTeam', 'showMainMenu', 'showVotingScreen', 'currentMode', 'nightPhase', 'dayButtonBlink'].forEach(function(prop) {
            window.app.$watch(prop, function() { _debouncedSliderInit(); });
        });

        // Periodic check for sliders (handles edge cases where watchers miss DOM changes)
        setInterval(function() {
            if (window.app && !window.app.showMainMenu) {
                _debouncedSliderInit();
            }
        }, 500);

        // Загружаем главное меню ПОСЛЕ привязки всех методов
        if (typeof window.app.loadMainMenu === 'function') {
            window.app.loadMainMenu();
        } else {
            window.app.showMainMenu = true;
        }
    }

    // Убираем splash
    _removeSplash();
}

// ==============================================
// Удаление splash-экрана
// ==============================================

var _splashRemoved = false;

function _removeSplash() {
    if (_splashRemoved) return;
    _splashRemoved = true;

    var splash = document.getElementById('maf-splash');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        setTimeout(function() { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 400);
    }
    console.log('✅ Splash убран, приложение показано');
}

// Инициализируем приложение после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finalizeApp);
} else {
    // DOM уже загружен
    finalizeApp();
}

// Безопасный таймаут: если splash всё ещё на экране через 4 сек — убираем принудительно
setTimeout(_removeSplash, 4000);

// Экспортируем функцию для ручной инициализации
window.mafApp.initialize = finalizeApp;

// Добавляем глобальные утилиты для отладки
window.mafApp.debug = {
    checkModules,
    getAppInstance: () => window.app,
    getConnector: () => window.goMafia,
    logAppState: () => {
        if (window.app) {
            console.log('App State:', {
                roomId: window.app.roomId,
                tournamentId: window.app.tournamentId,
                gameSelected: window.app.gameSelected,
                tableSelected: window.app.tableSelected,
                roles: window.app.roles,
                playersActions: window.app.playersActions
            });
        }
    }
};

console.log('📋 Доступные команды отладки:');
console.log('  - window.mafApp.debug.checkModules() - проверка модулей');
console.log('  - window.mafApp.debug.logAppState() - состояние приложения');
console.log('  - window.mafApp.instance - экземпляр Vue');