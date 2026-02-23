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
        slideStates: {},
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
        showModal: false,        tournamentId: '',
        inputMode: 'gomafia',
        newGameStep: 'modes',   // 'modes' | 'gomafia' | 'manual' | 'funky' | 'city'
        manualMode: false,
        manualPlayersCount: 10,
        manualPlayers: [], // Добавляем массив игроков для ручного режима
        manualGames: [],
        manualGameSelected: 1,        editRoles: true,
        
        // Funky mode
        funkyMode: false,
        funkyPlayers: [],           // [{login, avatar_link, id, title, roleKey, num}, ...]  — 10 игроков
        funkyPlayerInputs: [],      // ['', '', ...] — текстовые значения 10 инпутов
        funkySearchResults: [],     // результаты поиска для текущего инпута
        funkyActiveInput: -1,       // индекс активного инпута (0–9)
        funkySearchLoading: false,
        funkyGameNumber: 1,         // текущий номер игры в фанки-турнире
        funkyTableNumber: 1,        // номер стола (всегда 1)

        // City Mafia mode (Городская мафия)
        cityMode: false,
        cityPlayers: [],            // [{login, avatar_link, id, title, roleKey, num}, ...]
        cityPlayerInputs: [],       // ['', '', ...] — текстовые значения инпутов
        cityPlayersCount: 10,       // количество игроков (8–30)
        citySearchResults: [],      // результаты поиска для текущего инпута
        cityActiveInput: -1,        // индекс активного инпута
        citySearchLoading: false,
        cityGameNumber: 1,          // текущий номер игры
        cityTableNumber: 1,         // номер стола (всегда 1)
        cityRoleToggles: {},        // {roleKey: true/false} — тумблеры опциональных ролей (для 17+)
        cityAssignedRoles: {},      // {playerIndex: roleId} — назначенные роли городской мафии
        cityRolesAutoAssigned: false, // были ли роли авто-раздаваны
        cityStep: 'count',          // 'count' | 'roles_config' | 'players' | 'roles_assign'

        // Funky итоги вечера
        showFunkySummary: false,
        funkySummaryData: [],       // [{login, avatar_link, totalScore, games, wins, ...}]
        funkySummaryExpanded: null,  // login раскрытой карточки
        funkySummaryTournamentName: '',
        funkySummarySharing: false,  // идёт ли сохранение для шеринга
        funkySummaryShareUrl: '',    // URL для шеринга итогов
        funkySummaryTab: 'overall',  // 'overall' | 'games'
        funkySummaryGames: [],       // [{gameNumber, winnerTeam, players: [...], votingHistory, nightCheckHistory, bestMove, ...}]
        funkySummaryGameExpanded: null, // gameNumber раскрытой карточки игры
        funkySummaryPlayerExpanded: null, // roleKey раскрытого игрока внутри игры

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
        showRoomModal: false,
        showGameTableModal: false,
        roomInput: '',
        ws: null,
        roomId: null,
        showRoomNumber: false,
        stateReceived: false,
        waitingForState: false,
        avatarsFromServer: null,        avatarsJustLoaded: false,

        // Главное меню с историей игр
        showMainMenu: true,
        sessionsList: [],
        activeHistoryTab: 'active', // 'active' или 'history'
        currentSessionId: null,
        expandedTournaments: {}, // { tournamentId: true/false } — раскрытые турнирные карточки
        totalGamesInTournament: null, // Общее количество игр в турнире GoMafia
        _lockedTableNum: null, // Зафиксированный номер стола (для следующих игр турнира)
        _playedGameNums: [],   // Номера уже сыгранных игр в турнире (для фильтрации выбора)
        isMasterPanel: false,
        panelId: null,
        activePanelId: null,
        isActivePanel: true,
        showBroadcastSettings: false,
        showProfileScreen: false,
        showThemesScreen: false,
        judgeNickname: '',
        judgeAvatarUrl: '',
        // Draft values for broadcast settings (for cancel-without-save)
        broadcastDraft: null,
        // Long-press exit
        exitHoldTimer: null,
        exitHoldActive: false,
        // Long-press roles confirm
        rolesHoldTimer: null,
        rolesHoldActive: false,
        rolesValidationError: '',
        // Day mode hold interactions
        _dayHoldTimer: null,
        _dayHoldTarget: null,
        _dayHoldType: null,
        dayHoldActive: false,
        // Night checks (Don/Sheriff)
        nightChecks: {},          // { roleKey: { target: playerNum, result: 'string' } } — current night only
        nightCheckHistory: [],    // [{ night: N, checker: roleKey, checkerRole: 'don'|'sheriff', target: playerNum, result: 'string', found: bool }]
        nightNumber: 0,           // tracks which night we're on
        nightPhase: null,         // null | 'kill' | 'don' | 'sheriff' | 'doctor' | 'done'
        killedOnNight: {},        // { roleKey: nightNumber } — tracks which night each player was killed on
        nightAutoCloseTimer: null,
        // Doctor healing (city mode)
        doctorHeal: null,         // { target: playerNum } — current night heal choice
        doctorHealHistory: [],    // [{ night: N, target: playerNum }]
        doctorLastHealTarget: null, // playerNum healed last night (can't repeat consecutive)
        // Protocol/Opinion acceptance per killed player
        protocolAccepted: {},     // { roleKey: true/false }
        // Killed card UI phase: 'bm' | 'timer' | 'protocol' | 'done'
        killedCardPhase: {},
        // Best move accepted flag
        bestMoveAccepted: false,
        // Day button blink after night (now used for slider pulse)
        dayButtonBlink: false,
        // No-voting alert modal
        showNoVotingAlert: false,
        // Auto-prompt to go to night after last speaker
        showGoToNightPrompt: false,
        // Killed player row blink
        killedPlayerBlink: {},
        // Auto-open card mechanics
        autoOpenedCard: false,        // true = текущая открытая карточка была авто-открыта (не запускать таймер)
        currentDaySpeakerIndex: -1,   // индекс текущего оратора в tableOut (для авто-перехода)
        userEditedAdditionalInfo: false,
        sendFullStateTimer: null, // Таймер для дебаунсинга sendFullState
        activeVotingTab: 0, // Индекс активной вкладки в истории голосований
        
        // Переменные для модального окна возврата игрока (отключено)
        showReturnPlayerModal: false,
        returnPlayerNumber: null,
        returnPlayerRoleKey: null,
        
        // Цветовые схемы
        colorSchemes: [
            { key: 'purple', name: 'TITAN (по умолчанию)', accent: '#a855f7', glow: '#a855f7', preview: 'linear-gradient(135deg,#a855f7 60%,#6366f1 100%)', icon: '💜' },
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
            { key: 'ultradark', name: 'Очень тёмная', bgMain: '#020208', bgSecondary: '#060612', bgAccent: '#0d0a2a', icon: '🌑' },
            { key: 'dark', name: 'Тёмная', bgMain: '#060612', bgSecondary: '#0d0a2a', bgAccent: '#1a0f4a', icon: '🌘' },
            { key: 'default', name: 'Стандарт', bgMain: '#040410', bgSecondary: '#0d0a2a', bgAccent: '#1a0f4a', icon: '🌗' },
            { key: 'light', name: 'Светлая', bgMain: '#f5f6fa', bgSecondary: '#e9eaf3', bgAccent: '#d8d9e6', icon: '🌤️' },
            { key: 'ultralight', name: 'Очень светлая', bgMain: '#ffffff', bgSecondary: '#f5f6fa', bgAccent: '#e9eaf3', icon: '🌕' },
        ],
        selectedBackgroundTheme: 'default',
        
        winnerTeam: null,
        showWinnerModal: false,
        gameFinished: false, // true = баллы сохранены, игра завершена
        playerScores: {}, // {roleKey: {bonus: 0, penalty: 0, reveal: false}}
        editVotingHistory: false,
        currentMode: 'roles',
        rolesDistributed: false, // флаг: роли раздали и сохранили
        fouls: {}, // {roleKey: 0-4}

        // ===== Game Phase System =====
        gamePhase: 'roles',       // 'roles' | 'discussion' (Договорка / Знакомство в cityMode) | 'freeSeating' | 'day' | 'night'
        dayNumber: 0,             // 0 = нулевой круг, 1 = первый день, ...
        dayVoteOuts: {},          // { dayNumber: true } — был ли голосованием удалён игрок на конкретном дне
        nightMisses: {},          // { nightNumber: true } — промахи мафии по ночам
        firstKilledEver: false,   // было ли хотя бы одно убийство за всю игру
        // Discussion timer
        discussionTimeLeft: 60,
        discussionTimerId: null,
        discussionRunning: false,
        // Free seating timer
        freeSeatingTimeLeft: 40,
        freeSeatingTimerId: null,
        freeSeatingRunning: false,
        // Hold-to-skip
        skipHoldTimer: null,
        skipHoldActive: false,

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

        // === Tournament Browser ===
        showTournamentBrowser: false,
        tournamentsList: [],
        tournamentsLoading: false,
        tournamentsError: '',
        tournamentsFilters: {
            period: '',      // '' = ближайшие 30 дней (default), 'past' = прошедшие, etc.
            type: '',        // '' = все, 'online', 'offline'
            fsm: '',         // '' = все, 'fsm' = в рейтинге ФСМ
            search: ''       // поиск по названию
        },
        tournamentsPage: 1,
        tournamentsHasMore: false,
        tournamentsTotalCount: 0,
    },
    
    // Базовые computed свойства - полные реализации
    computed: {
        buildId() {
            return this.tournament?.buildId;
        },
        gameSelectedObject() {
            if (!this.tournament || this.manualMode) return [];
            const games = this.tournament?.props?.pageProps?.serverData?.games;
            if (!games || !this.gameSelected) return [];
            const selectedGame = games.find(g => g.gameNum === this.gameSelected);
            return selectedGame?.game || [];
        },
        games() {
            if (this.manualMode) return this.manualGames || [];
            return this.tournament?.props?.pageProps?.serverData?.games || [];
        },
        availableGames() {
            // Фильтруем игры: убираем уже сыгранные (кроме текущей выбранной)
            const played = this._playedGameNums || [];
            if (!played.length) return this.games;
            return this.games.filter(g => {
                const gn = Number(g.gameNum);
                // Показываем текущую выбранную и все не сыгранные
                return gn === this.gameSelected || !played.includes(gn);
            });
        },
        tableOut() {
            const out = this.manualMode
                ? this.manualPlayers
                : this.tournament?.props?.pageProps?.serverData?.games
                    ?.find(g => g.gameNum === this.gameSelected)?.game
                    ?.find(t => t.tableNum === this.tableSelected)?.table
                    ?.map((p, i) => ({ ...p, num: i + 1, roleKey: `${this.gameSelected}-${this.tableSelected}-${i + 1}` }))
                    ?.filter(Boolean) || [];
            const result = out.map((p, i) => {
                if (!p || !p.roleKey) return null;
                const roleKey = p.roleKey;
                const pd = this.playersData.get(p.login);
                const pdo = this.playersDataOnline.get(p.login);
                let avatarCss = '';
                let avatarLink = this.playersAvatarEx.get(this.gameSelected + '-' + p.id) || pdo?.avatar_link || pd?.avatar || this.avatarsFromServer?.[p.login];
                if (avatarLink) avatarCss = `url("${avatarLink}")`;
                return {
                    ...p, num: i + 1, roleKey: p.roleKey, avatarCss, avatar_link: avatarLink,
                    role: this.roles[p.roleKey] || null,
                    action: this.playersActions[p.roleKey] || null,
                    fouls: this.fouls[p.roleKey] || 0, foul: this.fouls[p.roleKey] || 0,
                    techFouls: this.techFouls[p.roleKey] || 0, techFoul: this.techFouls[p.roleKey] || 0,
                    removed: this.removed[p.roleKey] || false,
                    isFirstKilled: p.roleKey === this.firstKilledPlayer,
                    isHighlighted: p.roleKey === this.highlightedPlayer
                };
            }).filter(Boolean);
            return result;
        },
        tournamentName() {
            const sd = this.tournament?.props?.pageProps?.serverData;
            return this.tournament?._pageTitle || sd?.name || sd?.title || sd?.tournamentName || sd?.tournament_name || '';
        },
        manualPlayers() {
            const game = this.manualGames.find(g => g.num === this.manualGameSelected);
            return game?.players || [];
        },
        firstGamePlayers() {
            const game = this.manualGames.find(g => g.num === 1);
            return game?.players || [];
        },
        panelStateChanged() {
            try {
                const panelState = {
                    mainInfoVisible: this.mainInfoVisible,
                    additionalInfoVisible: this.additionalInfoVisible,
                    hideSeating: this.hideSeating,
                    hideLeaveOrder: this.hideLeaveOrder,
                    hideRolesStatus: this.hideRolesStatus,
                    hideBestMove: this.hideBestMove,
                    showRoomNumber: this.showRoomNumber
                };
                localStorage.setItem('maf-panel-settings', JSON.stringify(panelState));
            } catch (error) {}
        },
        // Night sequence is fully complete: kill/miss happened, don checked, sheriff checked, doctor healed
        nightSequenceComplete() {
            return this.nightPhase === 'done';
        },
        // Check if voting happened on the current day
        hasVotingThisDay() {
            if (!this.votingHistory || !this.votingHistory.length) return false;
            return this.votingHistory.some(v => v.dayNumber === this.dayNumber);
        }
    },

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
        // Не-реактивные таймеры для 5-сек мигания убитых
        this._killedBlinkTimers = {};

        // Загружаем сохраненные настройки панели
        this.loadPanelSettings();
        
        // Загружаем никнейм судьи из localStorage
        try {
            const savedNickname = localStorage.getItem('maf_judge_nickname');
            if (savedNickname) this.judgeNickname = savedNickname;
        } catch(e) {}

        // Загружаем сохраненную тему из localStorage (глобальная настройка)
        try {
            const savedColorScheme = localStorage.getItem('maf_color_scheme');
            const savedBgTheme = localStorage.getItem('maf_bg_theme');
            if (savedColorScheme) this.selectedColorScheme = savedColorScheme;
            if (savedBgTheme) this.selectedBackgroundTheme = savedBgTheme;
        } catch(e) {}

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
            // Load Telegram avatar
            if (this.telegramUser && this.telegramUser.photo_url) {
                this.judgeAvatarUrl = this.telegramUser.photo_url;
            }
            // Fallback: try auth user data
            try {
                const authUser = JSON.parse(localStorage.getItem('maf_auth_user') || '{}');
                if (!this.judgeNickname && authUser.first_name) {
                    this.judgeNickname = authUser.first_name + (authUser.last_name ? ' ' + authUser.last_name : '');
                }
            } catch(e) {}
        });
        
        // Инициализация темы — применяем сохраненную тему
        if (this.applyColorScheme) {
            this.applyColorScheme(this.selectedColorScheme);
        }
        if (this.applyBackgroundTheme) {
            this.applyBackgroundTheme(this.selectedBackgroundTheme);
        }
          // Загружаем главное меню — вызывается из app-core.js finalizeApp() после привязки методов
        // Здесь НЕ вызываем loadMainMenu, т.к. методы из app-sessions.js ещё не привязаны

        // ЗАЩИТА: Следим чтобы всегда был виден хотя бы один экран.
        // Если showMainMenu стал false, а ничего другого не активно — возвращаем обратно.
        this.$watch('showMainMenu', function(val) {
            if (!val) {
                var self = this;
                setTimeout(function() {
                    var hasActiveScreen = self.showModal || self.showGameTableModal ||
                        self.funkyMode || self.tournamentId || self.manualMode ||
                        self.showFunkySummary || self.showProfileScreen ||
                        self.showThemesScreen || self.showRoomModal ||
                        self.showTournamentBrowser ||
                        (self.tableOut && self.tableOut.length > 0);
                    if (!hasActiveScreen && !self.showMainMenu) {
                        console.warn('⚠️ Пустой экран обнаружен, восстанавливаем главное меню');
                        self.showMainMenu = true;
                    }
                }, 200);
            }
        });

        this.roomId = null;
        if (!localStorage.getItem('maf-master-panel')) {
            localStorage.setItem('maf-master-panel', '1');
            this.isMasterPanel = true;
        }
        
        window.addEventListener('beforeunload', () => {
            // Сохраняем текущую сессию при закрытии страницы
            if (this.saveCurrentSession && this.currentSessionId) {
                this.saveCurrentSession();
            }

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
