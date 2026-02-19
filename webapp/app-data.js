// =====================================================
// Основные данные и конфигурация Vue приложения
// Часть 2 из 5: app-data.js
// =====================================================

console.log('📦 Загружается app-data.js...');

// Инициализация Vue приложения с основными данными
Vue.mixin(window.votingMixin);
Vue.mixin(window.timerMixin || {});

window.app = new Vue({
    el: '#app',
    data: {
        tournament: undefined,
        gameSelected: undefined,
        tableSelected: undefined,
        playersData: new Map(),
        roles: {},        playersAvatarEx: new Map(),
        playersActions: {},
        protocolData: {},
        opinionData: {},
        opinionText: {},
        sendAuto: true,
        playersDataOnline: new Map(),
        avatarsFromServer: {}, // Добавляем поле для аватаров с сервера
        showModal: true,        tournamentId: '',
        inputMode: 'gomafia',
        manualMode: false,
        manualPlayersCount: 10,
        manualPlayers: [], // Добавляем массив игроков для ручного режима
        manualGames: [],
        manualGameSelected: 1,        editRoles: true,
        isObs: false, // Добавляем переменную isObs
        mainInfoText: "",
        additionalInfoText: "",
        mainInfoVisible: true,
        additionalInfoVisible: true,
        hideSeating: false,
        hideLeaveOrder: false,
        hideRolesStatus: false,
        hideBestMove: false,
        highlightedPlayer: null,
        showBestMoveModal: false,
        firstKilledPlayer: null,
        bestMove: [],
        bestMoveSelected: false,
        showRoomModal: true,
        roomInput: '',
        ws: null,
        roomId: null,
        showRoomNumber: false,
        stateReceived: false,
        waitingForState: false,
        avatarsFromServer: null,        avatarsJustLoaded: false,
        isMasterPanel: false,
        panelId: null,
        activePanelId: null,
        isActivePanel: true,
        showSettingsModal: false,
        showThemeModal: false,
        userEditedAdditionalInfo: false,
        sendFullStateTimer: null, // Таймер для дебаунсинга sendFullState
        activeVotingTab: 0, // Индекс активной вкладки в истории голосований
        
        // Переменные для модального окна возврата игрока (отключено)
        showReturnPlayerModal: false,
        returnPlayerNumber: null,
        returnPlayerRoleKey: null,
        
        // Цветовые схемы
        colorSchemes: [
            { key: 'purple', name: 'TITAN (по умолчанию)', accent: '#ae8cff', glow: '#ae8cff', preview: 'linear-gradient(135deg,#ae8cff 60%,#5b3e9c 100%)', icon: '💜' },
            { key: 'blue', name: 'Голубой лед', accent: '#4fc3f7', glow: '#4fc3f7', preview: 'linear-gradient(135deg,#4fc3f7 60%,#1976d2 100%)', icon: '💧' },
            { key: 'green', name: 'Изумруд', accent: '#6fe7b7', glow: '#6fe7b7', preview: 'linear-gradient(135deg,#6fe7b7 60%,#11998e 100%)', icon: '🌿' },
            { key: 'red', name: 'Вишня', accent: '#e63946', glow: '#e63946', preview: 'linear-gradient(135deg,#e63946 60%,#b12329 100%)', icon: '🍒' },
            { key: 'orange', name: 'Мандарин', accent: '#ffb347', glow: '#ffb347', preview: 'linear-gradient(135deg,#ffb347 60%,#ff7f50 100%)', icon: '🍊' },
            { key: 'pink', name: 'Розовый кварц', accent: '#ff6fcb', glow: '#ff6fcb', preview: 'linear-gradient(135deg,#ff6fcb 60%,#b24592 100%)', icon: '🌸' },
            { key: 'yellow', name: 'Лимон', accent: '#ffe066', glow: '#ffe066', preview: 'linear-gradient(135deg,#ffe066 60%,#f9d423 100%)', icon: '🍋' },
            { key: 'teal', name: 'Бирюза', accent: '#1de9b6', glow: '#1de9b6', preview: 'linear-gradient(135deg,#1de9b6 60%,#1a2980 100%)', icon: '🦚' },
            { key: 'gold', name: 'Золото', accent: '#ffd700', glow: '#ffd700', preview: 'linear-gradient(135deg,#ffd700 60%,#b8860b 100%)', icon: '🏆' },
            { key: 'silver', name: 'Серебро', accent: '#b0c4de', glow: '#b0c4de', preview: 'linear-gradient(135deg,#b0c4de 60%,#8e9eab 100%)', icon: '🥈' },
            { key: 'aqua', name: 'Аквамарин', accent: '#00eaff', glow: '#00eaff', preview: 'linear-gradient(135deg,#00eaff 60%,#005bea 100%)', icon: '🌊' },
            { key: 'lime', name: 'Лайм', accent: '#cddc39', glow: '#cddc39', preview: 'linear-gradient(135deg,#cddc39 60%,#8bc34a 100%)', icon: '🥝' },
            { key: 'violet', name: 'Фиалка', accent: '#9f5afd', glow: '#9f5afd', preview: 'linear-gradient(135deg,#9f5afd 60%,#6a3093 100%)', icon: '🔮' },
            { key: 'brown', name: 'Кофе', accent: '#a0522d', glow: '#a0522d', preview: 'linear-gradient(135deg,#a0522d 60%,#6f4e37 100%)', icon: '☕' },
            { key: 'black', name: 'Тёмная ночь', accent: '#222', glow: '#333', preview: 'linear-gradient(135deg,#222 60%,#444 100%)', icon: '🌑' },
            { key: 'mint', name: 'Мята', accent: '#98ff98', glow: '#98ff98', preview: 'linear-gradient(135deg,#98ff98 60%,#38ef7d 100%)', icon: '🌱' },
            { key: 'peach', name: 'Персик', accent: '#ffb07c', glow: '#ffb07c', preview: 'linear-gradient(135deg,#ffb07c 60%,#ff6e7f 100%)', icon: '🍑' },
            { key: 'sky', name: 'Небо', accent: '#87ceeb', glow: '#87ceeb', preview: 'linear-gradient(135deg,#87ceeb 60%,#4682b4 100%)', icon: '☁️' },
            { key: 'rose', name: 'Роза', accent: '#ff007f', glow: '#ff007f', preview: 'linear-gradient(135deg,#ff007f 60%,#ffafcc 100%)', icon: '🌹' },
            { key: 'olive', name: 'Олива', accent: '#808000', glow: '#808000', preview: 'linear-gradient(135deg,#808000 60%,#bfc000 100%)', icon: '🫒' },
            { key: 'navy', name: 'Морской', accent: '#001f54', glow: '#001f54', preview: 'linear-gradient(135deg,#001f54 60%,#034078 100%)', icon: '⚓' },
            { key: 'coral', name: 'Коралл', accent: '#ff7f50', glow: '#ff7f50', preview: 'linear-gradient(135deg,#ff7f50 60%,#ffb347 100%)', icon: '🪸' },
            { key: 'sand', name: 'Песок', accent: '#ffe4b5', glow: '#ffe4b5', preview: 'linear-gradient(135deg,#ffe4b5 60%,#ffd700 100%)', icon: '🏖️' },
            { key: 'plum', name: 'Слива', accent: '#8e4585', glow: '#8e4585', preview: 'linear-gradient(135deg,#8e4585 60%,#d291bc 100%)', icon: '🍇' },
            { key: 'ice', name: 'Лёд', accent: '#b2f7ef', glow: '#b2f7ef', preview: 'linear-gradient(135deg,#b2f7ef 60%,#40c9ff 100%)', icon: '🧊' },
            { key: 'fire', name: 'Огонь', accent: '#ff512f', glow: '#ff512f', preview: 'linear-gradient(135deg,#ff512f 60%,#dd2476 100%)', icon: '🔥' },
            { key: 'forest', name: 'Лес', accent: '#228b22', glow: '#228b22', preview: 'linear-gradient(135deg,#228b22 60%,#a8e063 100%)', icon: '🌲' },
            { key: 'steel', name: 'Сталь', accent: '#4682b4', glow: '#4682b4', preview: 'linear-gradient(135deg,#4682b4 60%,#b0c4de 100%)', icon: '🔩' },
            { key: 'ruby', name: 'Рубин', accent: '#e0115f', glow: '#e0115f', preview: 'linear-gradient(135deg,#e0115f 60%,#ff6fcb 100%)', icon: '💎' },
            { key: 'amber', name: 'Янтарь', accent: '#ffbf00', glow: '#ffbf00', preview: 'linear-gradient(135deg,#ffbf00 60%,#ff8008 100%)', icon: '🟡' },
        ],
        selectedColorScheme: 'purple',
        
        // Темы фона
        backgroundThemes: [
            { key: 'ultradark', name: 'Очень тёмная', bgMain: '#101014', bgSecondary: '#18181d', bgAccent: '#23232a', icon: '🌑' },
            { key: 'dark', name: 'Тёмная', bgMain: '#18181d', bgSecondary: '#23232a', bgAccent: '#2c2c36', icon: '🌘' },
            { key: 'default', name: 'Стандарт', bgMain: '#23232a', bgSecondary: '#2c2c36', bgAccent: '#37374a', icon: '🌗' },
            { key: 'light', name: 'Светлая', bgMain: '#f5f6fa', bgSecondary: '#e9eaf3', bgAccent: '#d8d9e6', icon: '🌤️' },
            { key: 'ultralight', name: 'Очень светлая', bgMain: '#ffffff', bgSecondary: '#f5f6fa', bgAccent: '#e9eaf3', icon: '🌕' },
        ],
        selectedBackgroundTheme: 'default',
        
        winnerTeam: null,
        showWinnerModal: false,
        playerScores: {}, // {roleKey: {bonus: 0, penalty: 0, reveal: false}}
        editVotingHistory: false,
        currentMode: 'roles',
        fouls: {}, // {roleKey: 0-4}
        
        // Telegram Web App integration
        tg: null,
        isTelegramApp: false,
        telegramUser: null,
        
        techFouls: {}, // {roleKey: 0-2}
        removed: {}, // {roleKey: true/false}
        
        // Данные для восстановления сессии
        showSessionRestoreModal: false,
        previousSession: null,        sessionRestoreChecked: false,
        isRestoringSession: false,
    },
    
    // Базовые computed свойства - будут расширены в других модулях
    computed: {
        // Базовое определение tableOut - будет переопределено в app-ui-integration.js
        tableOut() {
            return this.manualPlayers || [];
        }    },
    
    // Методы - будут расширены и перезаписаны в других модулях
    methods: {        // Безопасная заглушка для joinRoom - предотвращает ошибку до загрузки модулей
        joinRoom() {
            console.log('⚠️ joinRoom заглушка вызвана, попытка найти реальный метод...');
            
            // Пытаемся найти реальный метод в window.app.methods
            if (window.app.methods && typeof window.app.methods.joinRoom === 'function' && window.app.methods.joinRoom !== this.joinRoom) {
                console.log('🔄 Найден реальный joinRoom, вызываем его...');
                return window.app.methods.joinRoom.call(this);
            }
              console.log('⚠️ Реальный joinRoom не найден');
            console.log('⚠️ roomInput:', this.roomInput);
            // Этот метод будет перезаписан реальной реализацией из app-ui-integration.js
        },
        
        // Загрузка настроек панели
        loadPanelSettings() {
            try {
                const savedSettings = localStorage.getItem('maf-panel-settings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    
                    // Применяем сохраненные настройки
                    if (typeof settings.mainInfoVisible === 'boolean') {
                        this.mainInfoVisible = settings.mainInfoVisible;
                    }
                    if (typeof settings.additionalInfoVisible === 'boolean') {
                        this.additionalInfoVisible = settings.additionalInfoVisible;
                    }
                    if (typeof settings.hideSeating === 'boolean') {
                        this.hideSeating = settings.hideSeating;
                    }
                    if (typeof settings.hideLeaveOrder === 'boolean') {
                        this.hideLeaveOrder = settings.hideLeaveOrder;
                    }
                    if (typeof settings.hideRolesStatus === 'boolean') {
                        this.hideRolesStatus = settings.hideRolesStatus;
                    }
                    if (typeof settings.hideBestMove === 'boolean') {
                        this.hideBestMove = settings.hideBestMove;
                    }                    if (typeof settings.showRoomNumber === 'boolean') {
                        this.showRoomNumber = settings.showRoomNumber;
                    }
                    
                    console.log('✅ Настройки панели восстановлены:', settings);
                } else {
                    console.log('ℹ️ Сохраненные настройки панели не найдены, используем значения по умолчанию');
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки настроек панели:', error);
            }
        }
    },
      // Инициализация компонента
    mounted() {
        // Загружаем сохраненные настройки панели
        this.loadPanelSettings();
        
        // Защитная инициализация критических объектов
        if (!this.fouls) this.fouls = {};
        if (!this.techFouls) this.techFouls = {};
        if (!this.removed) this.removed = {};
        if (!this.playersActions) this.playersActions = {};
        if (!this.roles) this.roles = {};
        if (!this.protocolData) this.protocolData = {};
        if (!this.opinionData) this.opinionData = {};
        if (!this.opinionText) this.opinionText = {};
        if (!this.playerScores) this.playerScores = {};
        
        // ПРИНУДИТЕЛЬНАЯ БЛОКИРОВКА модального окна возврата игрока
        this.showReturnPlayerModal = false;
          // ВАЖНО: Автоматическое применение темы Telegram отключено!
        // Приложение использует только тему, выбранную пользователем в панели тем.
        // Telegram Web App больше не переопределяет цветовую схему автоматически.
        
        // Инициализация Telegram Web App с небольшой задержкой
        this.$nextTick(() => {
            if (this.initTelegramApp) {
                this.initTelegramApp();
            }
        });
        
        // Инициализация темы по умолчанию ПЕРЕД загрузкой состояния
        this.selectedColorScheme = 'purple';
        if (this.applyColorScheme) {
            this.applyColorScheme(this.selectedColorScheme);
        }
        this.selectedBackgroundTheme = 'default';
        if (this.applyBackgroundTheme) {
            this.applyBackgroundTheme(this.selectedBackgroundTheme);
        }
          // Проверяем и показываем восстановление сессии
        this.$nextTick(() => {
            setTimeout(() => {
                if (this.checkAndShowSessionRestore) {
                    this.checkAndShowSessionRestore();
                }
                
                // Для Telegram Cloud Storage логика показа стандартных модальных окон 
                // обрабатывается в processSessionData() после асинхронного получения данных
                if (!window.sessionManager || !window.sessionManager.hasTelegramCloudStorage || !window.sessionManager.hasTelegramCloudStorage()) {
                    // Если не Telegram, то сразу показываем стандартные модальные окна если не восстанавливаем сессию
                    setTimeout(() => {
                        if (!this.showSessionRestoreModal) {
                            this.showRoomModal = true;
                            this.showModal = false;
                        }
                    }, 100);
                }
            }, 500); // Небольшая задержка для корректной инициализации
        });
        
        this.roomId = null;
        if (!localStorage.getItem('maf-master-panel')) {
            localStorage.setItem('maf-master-panel', '1');
            this.isMasterPanel = true;
        }
        
        window.addEventListener('beforeunload', () => {
            if (this.isMasterPanel) {
                localStorage.removeItem('maf-master-panel');
            }
            // Уведомляем Telegram о закрытии
            if (this.isTelegramApp && this.tg) {
                this.tg.close();
            }        });
        
        if (this.applyBackgroundTheme) {
            this.applyBackgroundTheme(this.selectedBackgroundTheme);
        }
        
        window.addEventListener("message", (event) => {
            console.log("panel.html получил message:", event.data);
            if (event.data && event.data.source === "obs-mafia-bridge") {
                console.log("Получена команда от расширения:", event.data);
            }
        });        // Безопасный вызов loadRoomState
        if (this.loadRoomState) {
            this.loadRoomState();
        }
        
        // Восстановление настроек панели
        this.loadPanelSettings();
        
        // Инициализация таймеров для всех игроков при загрузке
        this.$nextTick(() => {
            if (this.initializeAllTimers) {
                this.initializeAllTimers();
            }
        });
        
        // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: убеждаемся, что модальное окно возврата игрока заблокировано
        this.$nextTick(() => {
            this.showReturnPlayerModal = false;
            console.log('🚫 Модальное окно возврата игрока принудительно заблокировано');
            
            // УЛЬТИМАТИВНАЯ ЗАЩИТА: делаем переменную неизменяемой
            const originalValue = this.showReturnPlayerModal;
            Object.defineProperty(this, 'showReturnPlayerModal', {
                get() { return false; },
                set(value) { 
                    if (value === true) {
                        console.log('🚫 БЛОКИРОВАНО: Попытка установить showReturnPlayerModal = true');
                    }
                    return false; 
                },                configurable: false            });
        });
    }
});

console.log('✅ app-data.js загружен, Vue приложение создано в window.app');

// **КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:**
// Эта строка вызывала ошибку, так как выполнялась до того, как другие модули успевали загрузиться.
// Система модулей в app-core.js обрабатывает инициализацию корректно, поэтому эта проверка не нужна.
// console.log('🔧 Заглушка joinRoom создана:', typeof window.app.methods.joinRoom);

// Создаём наблюдатель для обновления методов после загрузки модулей
let methodUpdateInterval = setInterval(() => {
    if (window.app && window.app.methods && Object.keys(window.app.methods).length > 1) {
        console.log('🔄 Обнаружены новые методы, обновляем Vue экземпляр...');
        
        // Принудительно обновляем все методы в Vue экземпляре
        Object.keys(window.app.methods).forEach(methodName => {
            if (typeof window.app.methods[methodName] === 'function') {
                window.app[methodName] = window.app.methods[methodName].bind(window.app);
            }
        });
        
        console.log('✅ Методы обновлены в Vue экземпляре');
        console.log('🔧 joinRoom тип в экземпляре:', typeof window.app.joinRoom);
        
        clearInterval(methodUpdateInterval);
    }
}, 100); // Проверяем каждые 100мс

// Очищаем интервал через 5 секунд в любом случае
setTimeout(() => {
    if (methodUpdateInterval) {
        clearInterval(methodUpdateInterval);
    }
}, 5000);
