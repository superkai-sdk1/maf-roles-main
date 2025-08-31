// =====================================================
// Главный файл app-core.js - подключает все части приложения
// Система модулей для Maf Roles Panel
// =====================================================

// Базовая проверка доступности Vue.js
if (typeof Vue === 'undefined') {
    console.error('Vue.js не найден! Убедитесь, что Vue.js подключен перед app-core.js');
}

// Инициализация глобального объекта для хранения ссылок
window.mafApp = window.mafApp || {};

console.log('🚀 Запуск Maf Roles Panel - модульная система');
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
        return;
    }
    
    console.log('✅ Все модули загружены успешно');
    console.log('🔧 Финализируем приложение...');      // Убеждаемся, что все методы добавлены в Vue приложение
    if (window.app && window.app.methods) {
        console.log('📝 Методов в приложении:', Object.keys(window.app.methods).length);
        
        // КРИТИЧНО: Принудительно обновляем методы в экземпляре Vue
        console.log('🔄 Принудительно обновляем методы в Vue экземпляре...');
        Object.assign(window.app.$options.methods, window.app.methods);
        
        // Перезаписываем методы напрямую в экземпляре
        Object.keys(window.app.methods).forEach(methodName => {
            window.app[methodName] = window.app.methods[methodName].bind(window.app);
        });
        
        console.log('✅ Методы успешно обновлены в Vue экземпляре');
        console.log('🔧 joinRoom тип:', typeof window.app.joinRoom);
    }
    
    // КРИТИЧНО: Обновляем computed свойства
    if (window.app && window.app.computed) {
        console.log('🔄 Принудительно обновляем computed свойства...');
        console.log('📝 Computed свойств:', Object.keys(window.app.computed).length);
        
        // Обновляем computed свойства в Vue экземпляре
        Object.assign(window.app.$options.computed, window.app.computed);
        
        // Принудительно обновляем computed свойства в экземпляре
        Object.keys(window.app.computed).forEach(computedName => {
            Object.defineProperty(window.app, computedName, {
                get: window.app.computed[computedName].bind(window.app),
                enumerable: true,
                configurable: true
            });
        });
        
        console.log('✅ Computed свойства успешно обновлены');
        console.log('🔧 tableOut тип:', typeof window.app.tableOut);
    }
    
    // Дополнительная настройка приложения
    if (window.app) {
        // Добавляем глобальные обработчики ошибок
        window.app.$on('error', (error) => {
            console.error('Vue Error:', error);
        });
        
        // Добавляем отладочную информацию
        window.mafApp.instance = window.app;
        
        console.log('🎉 Maf Roles Panel успешно инициализирован!');
        console.log('🔍 Отладка: window.mafApp.instance содержит экземпляр Vue');
    } else {
        console.error('❌ Не удалось найти экземпляр Vue приложения');
    }
}

// Инициализируем приложение после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finalizeApp);
} else {
    // DOM уже загружен
    finalizeApp();
}

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