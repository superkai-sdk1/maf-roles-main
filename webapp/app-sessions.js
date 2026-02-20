// =====================================================
// Методы для работы с сессиями и восстановлением данных
// Часть 3 из 5: app-sessions.js
// Версия 2: Главное меню с историей игр
// =====================================================

console.log('📦 Загружается app-sessions.js v2...');

// Расширяем Vue приложение методами для работы с сессиями
window.app = window.app || {};
if (!window.app.methods) window.app.methods = {};

// Принудительно добавляем методы для работы с сессиями
Object.assign(window.app.methods, {

    // =============================================
    // Главное меню с историей игр
    // =============================================

    loadMainMenu() {
        console.log('🏠 loadMainMenu: Загружаем главное меню с историей игр');

        const self = this;

        if (!window.sessionManager) {
            console.log('🏠 loadMainMenu: sessionManager недоступен, показываем пустое меню');
            this.sessionsList = [];
            this.showMainMenu = true;
            return;
        }

        // Функция фильтрации и применения сессий к UI
        function applySessionsList(sessions) {
            self.sessionsList = (sessions || []).filter(s =>
                window.sessionManager.hasSignificantData(s) || s.roomId || s.tournamentId
            );
            console.log('🏠 loadMainMenu: Показано сессий:', self.sessionsList.length);
            self.showMainMenu = true;
            self.showRoomModal = false;
            self.showModal = false;
            self.showSessionRestoreModal = false;
        }

        // Функция фоновой серверной синхронизации
        function doServerSync() {
            if (window.sessionManager.syncFromServer) {
                window.sessionManager.syncFromServer(function(error, mergedSessions) {
                    if (!error && mergedSessions) {
                        applySessionsList(mergedSessions);
                        console.log('🏠 loadMainMenu: Обновлено после серверной синхронизации');
                    }
                });
            }
        }

        // Проверяем Telegram Cloud Storage (асинхронный путь)
        if (window.sessionManager.hasTelegramCloudStorage && window.sessionManager.hasTelegramCloudStorage()) {
            console.log('🏠 loadMainMenu: Используем Telegram Cloud Storage (асинхронно)');

            window.sessionManager.getSessions((error, sessions) => {
                if (error) {
                    console.error('🏠 loadMainMenu: Ошибка загрузки сессий:', error);
                    this.sessionsList = [];
                    this.showMainMenu = true;
                } else {
                    applySessionsList(sessions);
                }
                // Фоновая синхронизация с сервером
                doServerSync();
            });
        } else {
            // Синхронный вызов для localStorage
            console.log('🏠 loadMainMenu: Используем localStorage (синхронно)');
            const sessions = window.sessionManager.getSessions() || [];
            applySessionsList(sessions);
            // Фоновая синхронизация с сервером
            doServerSync();
        }
    },
    
    // Открыть игру из истории
    openSession(sessionId) {
        console.log('📂 openSession: Открываем сессию:', sessionId);

        const session = this.sessionsList.find(s => s.sessionId === sessionId);
        if (!session) {
            console.error('📂 openSession: Сессия не найдена:', sessionId);
            return;
        }
        
        // Сохраняем текущую сессию перед переключением
        if (this.currentSessionId && this.currentSessionId !== sessionId) {
            if (this.roomId || this.tournamentId || this.manualMode) {
                this.saveCurrentSession();
            }
        }

        // Закрываем WebSocket текущей сессии
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Сбрасываем состояние перед применением новой сессии
        this._resetGameState();

        this.isRestoringSession = true;
        this.currentSessionId = session.sessionId;

        // Восстанавливаем данные из сессии
        this._applySessionData(session);

        // Скрываем главное меню
        this.showMainMenu = false;
        this.showRoomModal = false;
        this.showModal = false;
        this.showGameTableModal = false;
        this.showSessionRestoreModal = false;

        // Подключаемся к WebSocket если есть комната
        if (session.tournamentId) {
            console.log('📂 openSession: Загружаем турнир', session.tournamentId);
            this.loadTournament();
        } else if (session.roomId) {
            console.log('📂 openSession: Подключаемся к комнате', session.roomId);
            this.connectWS();
        }
        
        // Если нет ни комнаты ни турнира
        if (!session.roomId && !session.tournamentId) {
            // Если ручной режим с уже созданными игроками — показываем стол
            if (session.manualMode && session.manualPlayers && session.manualPlayers.length > 0) {
                console.log('📂 openSession: Ручной режим с игроками, показываем стол');
                // Стол уже восстановлен через _applySessionData
            } else {
                console.log('📂 openSession: Игра без комнаты, показываем выбор режима');
                this.showModal = true;
            }
        }
    },

    // Начать новую игру
    startNewGame() {
        console.log('🆕 startNewGame: Начинаем новую игру');

        // Сохраняем текущую сессию перед переключением (только если уже есть активная)
        if (this.currentSessionId && (this.roomId || this.tournamentId || this.manualMode)) {
            this.saveCurrentSession();
        }
        
        // Закрываем WebSocket текущей сессии
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Сбрасываем все игровые данные (обнуляет currentSessionId)
        this._resetGameState();

        // Генерируем новый ID сессии ПОСЛЕ сброса
        this.currentSessionId = window.sessionManager ? window.sessionManager.generateSessionId() : ('sess_' + Date.now());

        // Сразу переходим к выбору режима (комната вводится в настройках трансляции)
        this.showMainMenu = false;
        this.showRoomModal = false;
        this.showModal = true;
        this.showSessionRestoreModal = false;
    },

    // Выход в главное меню
    returnToMainMenu() {
        console.log('🏠 returnToMainMenu: Возвращаемся в главное меню');

        // Сохраняем текущую сессию только если есть данные
        if (this.currentSessionId && (this.roomId || this.tournamentId || this.manualMode)) {
            this.saveCurrentSession();
        }

        // Закрываем WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Сбрасываем новые экраны
        this.showBroadcastSettings = false;
        this.showProfileScreen = false;
        this.showThemesScreen = false;
        this.broadcastDraft = null;

        // Сбрасываем состояние
        this._resetGameState();

        // Перезагружаем историю и показываем меню
        this.loadMainMenu();
    },

    // Удалить игру из истории
    deleteSession(sessionId) {
        console.log('🗑️ deleteSession: Удаляем сессию:', sessionId);
        if (window.sessionManager) {
            window.sessionManager.removeSession(sessionId);
        }
        this.sessionsList = this.sessionsList.filter(s => s.sessionId !== sessionId);
    },

    // =============================================
    // Вспомогательные методы
    // =============================================

    // Применить данные сессии к Vue-инстансу
    _applySessionData(session) {
        console.log('🔄 _applySessionData: Применяем данные сессии');

        // Основные данные комнаты и турнира
        if (session.roomId) {
            this.roomId = session.roomId;
            this.roomInput = session.roomId;
        }
        
        if (session.tournamentId) {
            this.tournamentId = session.tournamentId;
            this.inputMode = 'gomafia';
            this.manualMode = false;
            
            if (session.gameSelected !== undefined) {
                this.gameSelected = session.gameSelected;
            }
            if (session.tableSelected !== undefined) {
                this.tableSelected = session.tableSelected;
            }
        } else if (session.manualMode) {
            this.inputMode = 'manual';
            this.manualMode = true;
            if (session.manualPlayers) {
                this.manualPlayers = session.manualPlayers;
            }
            if (session.manualGames) {
                this.manualGames = session.manualGames;
            }
            if (session.manualGameSelected) {
                this.manualGameSelected = session.manualGameSelected;
            }
        }
        
        // Режимы работы
        if (session.inputMode) {
            this.inputMode = session.inputMode;
        }
        if (session.editRoles !== undefined) {
            this.editRoles = session.editRoles;
        }
        
        // Роли и статусы игроков
        if (session.roles) this.roles = session.roles;
        if (session.playersActions) this.playersActions = session.playersActions;
        if (session.fouls) this.fouls = session.fouls;
        if (session.techFouls) this.techFouls = session.techFouls;
        if (session.removed) this.removed = session.removed;

        // Информационные тексты
        if (session.mainInfoText !== undefined) this.mainInfoText = session.mainInfoText;
        if (session.additionalInfoText !== undefined) this.additionalInfoText = session.additionalInfoText;

        // Настройки отображения
        if (session.mainInfoVisible !== undefined) this.mainInfoVisible = session.mainInfoVisible;
        if (session.additionalInfoVisible !== undefined) this.additionalInfoVisible = session.additionalInfoVisible;
        if (session.hideSeating !== undefined) this.hideSeating = session.hideSeating;
        if (session.hideLeaveOrder !== undefined) this.hideLeaveOrder = session.hideLeaveOrder;
        if (session.hideRolesStatus !== undefined) this.hideRolesStatus = session.hideRolesStatus;
        if (session.hideBestMove !== undefined) this.hideBestMove = session.hideBestMove;
        if (session.showRoomNumber !== undefined) this.showRoomNumber = session.showRoomNumber;

        // Лучший ход
        if (session.highlightedPlayer !== undefined) this.highlightedPlayer = session.highlightedPlayer;
        if (session.bestMove) this.bestMove = session.bestMove;
        if (session.bestMoveSelected !== undefined) this.bestMoveSelected = session.bestMoveSelected;
        if (session.firstKilledPlayer !== undefined) this.firstKilledPlayer = session.firstKilledPlayer;
        if (session.showBestMoveModal !== undefined) this.showBestMoveModal = session.showBestMoveModal;

        // Номинации и голосования
        if (session.nominations) this.nominations = session.nominations;
        if (session.nominationsLocked !== undefined) this.nominationsLocked = session.nominationsLocked;
        if (session.votingOrder) this.votingOrder = session.votingOrder;
        if (session.votingCurrentIndex !== undefined) this.votingCurrentIndex = session.votingCurrentIndex;
        if (session.votingResults) this.votingResults = session.votingResults;
        if (session.votingVotedPlayers) this.votingVotedPlayers = session.votingVotedPlayers;
        if (session.votingFinished !== undefined) this.votingFinished = session.votingFinished;
        if (session.votingWinners) this.votingWinners = session.votingWinners;
        if (session.votingStage) this.votingStage = session.votingStage;
        if (session.votingTiePlayers) this.votingTiePlayers = session.votingTiePlayers;
        if (session.votingLiftResults) this.votingLiftResults = session.votingLiftResults;
        if (session.votingHistory) this.votingHistory = session.votingHistory;

        // Тема
        if (session.selectedColorScheme) {
            this.selectedColorScheme = session.selectedColorScheme;
            if (this.applyColorScheme) {
                this.applyColorScheme(session.selectedColorScheme);
            }
        }
        if (session.selectedBackgroundTheme) {
            this.selectedBackgroundTheme = session.selectedBackgroundTheme;
            if (this.applyBackgroundTheme) {
                this.applyBackgroundTheme(session.selectedBackgroundTheme);
            }
        }
        
        // Победители и режимы
        if (session.winnerTeam !== undefined) this.winnerTeam = session.winnerTeam;
        if (session.currentMode) this.currentMode = session.currentMode;
        if (session.rolesDistributed !== undefined) this.rolesDistributed = session.rolesDistributed;
        // Если роли раздали, но режим всё ещё 'roles' — переключаем на 'day'
        if (this.rolesDistributed && this.currentMode === 'roles') {
            this.currentMode = 'day';
        }

        // Аватары
        if (session.avatarsFromServer) this.avatarsFromServer = session.avatarsFromServer;
        if (session.avatarsJustLoaded !== undefined) this.avatarsJustLoaded = session.avatarsJustLoaded;

        // Протокол и мнения
        if (session.protocolData) this.protocolData = session.protocolData;
        if (session.opinionData) this.opinionData = session.opinionData;
        if (session.opinionText) this.opinionText = session.opinionText;

        // Ночные проверки
        if (session.nightCheckHistory) this.nightCheckHistory = session.nightCheckHistory;
        if (session.nightNumber !== undefined) this.nightNumber = session.nightNumber;
        if (session.killedCardPhase) this.killedCardPhase = session.killedCardPhase;
        if (session.protocolAccepted) this.protocolAccepted = session.protocolAccepted;
        if (session.bestMoveAccepted !== undefined) this.bestMoveAccepted = session.bestMoveAccepted;

        // Game Phase System
        if (session.gamePhase) this.gamePhase = session.gamePhase;
        if (session.dayNumber !== undefined) this.dayNumber = session.dayNumber;
        if (session.dayVoteOuts) this.dayVoteOuts = session.dayVoteOuts;
        if (session.nightMisses) this.nightMisses = session.nightMisses;
        if (session.firstKilledEver !== undefined) this.firstKilledEver = session.firstKilledEver;
        // Note: timers are not restored, discussion/freeSeating phases reset on restore
        if (this.gamePhase === 'discussion' || this.gamePhase === 'freeSeating') {
            // If session was saved during a timed phase, skip to day
            this.gamePhase = 'day';
            this.currentMode = 'day';
        }

        // Баллы
        if (session.playerScores) this.playerScores = session.playerScores;
    },

    // Сбросить игровое состояние
    _resetGameState() {
        console.log('🔄 _resetGameState: Сбрасываем игровые данные');

        this.currentSessionId = null;
        this.tournament = undefined;
        this.gameSelected = undefined;
        this.tableSelected = undefined;
        this.playersData = new Map();
        this.roles = {};
        this.playersAvatarEx = new Map();
        this.playersActions = {};
        this.protocolData = {};
        this.opinionData = {};
        this.opinionText = {};
        this.playersDataOnline = new Map();
        this.avatarsFromServer = null;
        this.tournamentId = '';
        this.inputMode = 'gomafia';
        this.manualMode = false;
        this.manualPlayersCount = 10;
        this.manualPlayers = [];
        this.manualGames = [];
        this.manualGameSelected = 1;
        this.editRoles = true;
        this.mainInfoText = '';
        this.additionalInfoText = '';
        this.highlightedPlayer = null;
        this.showBestMoveModal = false;
        this.firstKilledPlayer = null;
        this.bestMove = [];
        this.bestMoveSelected = false;
        this.roomInput = '';
        this.roomId = null;
        this.showGameTableModal = false;
        this.stateReceived = false;
        this.waitingForState = false;
        this.avatarsJustLoaded = false;
        this.winnerTeam = null;
        this.showWinnerModal = false;
        this.playerScores = {};
        this.currentMode = 'roles';
        this.rolesDistributed = false;
        this.rolesHoldActive = false;
        this.rolesHoldTimer = null;
        this.rolesValidationError = '';
        this.fouls = {};
        this.techFouls = {};
        this.removed = {};
        this.dayHoldActive = false;
        this._dayHoldTimer = null;
        this._dayHoldTarget = null;
        this._dayHoldType = null;
        this.nightChecks = {};
        this.nightCheckHistory = [];
        this.nightNumber = 0;
        this.nightPhase = null;
        this._freshlyKilledThisNight = null;
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
            this.nightAutoCloseTimer = null;
        }
        this.protocolAccepted = {};
        this.killedCardPhase = {};
        this.bestMoveAccepted = false;
        this.dayButtonBlink = false;
        this.killedPlayerBlink = {};
        this.isRestoringSession = false;

        // Game Phase System
        this.gamePhase = 'roles';
        this.dayNumber = 0;
        this.dayVoteOuts = {};
        this.nightMisses = {};
        this.firstKilledEver = false;
        this.discussionTimeLeft = 60;
        this.freeSeatingTimeLeft = 40;
        if (this.discussionTimerId) { clearInterval(this.discussionTimerId); this.discussionTimerId = null; }
        if (this.freeSeatingTimerId) { clearInterval(this.freeSeatingTimerId); this.freeSeatingTimerId = null; }
        this.discussionRunning = false;
        this.freeSeatingRunning = false;
        this.skipHoldActive = false;
        if (this.skipHoldTimer) { clearTimeout(this.skipHoldTimer); this.skipHoldTimer = null; }

        // Номинации и голосования
        if (this.nominations !== undefined) this.nominations = {};
        if (this.nominationsLocked !== undefined) this.nominationsLocked = false;
        if (this.votingOrder !== undefined) this.votingOrder = [];
        if (this.votingCurrentIndex !== undefined) this.votingCurrentIndex = 0;
        if (this.votingResults !== undefined) this.votingResults = {};
        if (this.votingVotedPlayers !== undefined) this.votingVotedPlayers = [];
        if (this.votingFinished !== undefined) this.votingFinished = false;
        if (this.votingWinners !== undefined) this.votingWinners = [];
        if (this.votingStage !== undefined) this.votingStage = null;
        if (this.votingTiePlayers !== undefined) this.votingTiePlayers = [];
        if (this.votingLiftResults !== undefined) this.votingLiftResults = [];
        if (this.votingHistory !== undefined) this.votingHistory = [];
    },

    // =============================================
    // Старые методы (обратная совместимость)
    // =============================================

    checkAndShowSessionRestore() {
        // Перенаправляем на новую систему
        this.loadMainMenu();
    },

    processSessionData(sessionData) {
        // Перенаправляем на новую систему
        this.loadMainMenu();
    },

    showDefaultModals() {
        this.showMainMenu = true;
        this.showRoomModal = false;
        this.showModal = false;
    },

    restoreSession() {
        if (!this.previousSession) return;
        this.openSession(this.previousSession.sessionId);
    },
    
    skipSessionRestore() {
        if (window.sessionManager) {
            // Не очищаем все сессии, просто переходим к новой игре
        }
        this.isRestoringSession = false;
        this.showSessionRestoreModal = false;
        this.startNewGame();
    },

    // =============================================
    // Сохранение и WebSocket sync
    // =============================================

    sendRestoredDataToRoles(session) {
        console.log('🔄 sendRestoredDataToRoles: Отправляем восстановленные данные на roles.html');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ sendRestoredDataToRoles: WebSocket не подключен, повторяем через 500ms');
            setTimeout(() => this.sendRestoredDataToRoles(session), 500);
            return;
        }
        
        // Отправляем роли
        if (session.roles && Object.keys(session.roles).length > 0) {
            Object.entries(session.roles).forEach(([roleKey, role]) => {
                this.sendToRoom({ type: "roleChange", roleKey, role });
            });
        }
        
        // Отправляем статусы игроков
        if (session.playersActions && Object.keys(session.playersActions).length > 0) {
            Object.entries(session.playersActions).forEach(([roleKey, action]) => {
                this.sendToRoom({ type: "actionChange", roleKey, action });
            });
        }
        
        // Отправляем фолы
        if (session.fouls && Object.keys(session.fouls).length > 0) {
            Object.entries(session.fouls).forEach(([roleKey, value]) => {
                if (value > 0) {
                    this.sendToRoom({ type: "foulChange", roleKey, value });
                }
            });
        }
        
        // Отправляем техфолы
        if (session.techFouls && Object.keys(session.techFouls).length > 0) {
            Object.entries(session.techFouls).forEach(([roleKey, value]) => {
                if (value > 0) {
                    this.sendToRoom({ type: "techFoulChange", roleKey, value });
                }
            });
        }
        
        // Отправляем статусы удаления
        if (session.removed && Object.keys(session.removed).length > 0) {
            Object.entries(session.removed).forEach(([roleKey, value]) => {
                if (value) {
                    this.sendToRoom({ type: "removeChange", roleKey, value });
                }
            });
        }
        
        // Отправляем выделенного игрока
        if (session.highlightedPlayer !== undefined && session.highlightedPlayer !== null) {
            this.sendToRoom({ type: "highlight", roleKey: session.highlightedPlayer });
        }
        
        // Отправляем лучший ход
        if (session.bestMove && session.bestMove.length > 0) {
            this.sendToRoom({
                type: "bestMoveChange",
                bestMove: session.bestMove,
                firstKilledPlayer: session.firstKilledPlayer
            });
        }
        
        if (session.bestMoveSelected) {
            this.sendToRoom({
                type: "bestMoveConfirm",
                bestMove: session.bestMove || [],
                firstKilledPlayer: session.firstKilledPlayer
            });
        }
        
        // Отправляем состояние панели
        this.sendToRoom({
            type: "panelStateChange",
            panelState: {
                mainInfoText: session.mainInfoText || this.mainInfoText,
                additionalInfoText: session.additionalInfoText || this.additionalInfoText,
                mainInfoVisible: session.mainInfoVisible !== undefined ? session.mainInfoVisible : this.mainInfoVisible,
                additionalInfoVisible: session.additionalInfoVisible !== undefined ? session.additionalInfoVisible : this.additionalInfoVisible,
                hideSeating: session.hideSeating !== undefined ? session.hideSeating : this.hideSeating,
                hideLeaveOrder: session.hideLeaveOrder !== undefined ? session.hideLeaveOrder : this.hideLeaveOrder,
                hideRolesStatus: session.hideRolesStatus !== undefined ? session.hideRolesStatus : this.hideRolesStatus,
                hideBestMove: session.hideBestMove !== undefined ? session.hideBestMove : this.hideBestMove,
                showRoomNumber: session.showRoomNumber !== undefined ? session.showRoomNumber : this.showRoomNumber,
                colorScheme: session.selectedColorScheme || this.selectedColorScheme,
                backgroundTheme: session.selectedBackgroundTheme || this.selectedBackgroundTheme,
                gameSelected: session.gameSelected || this.gameSelected,
                tableSelected: session.tableSelected || this.tableSelected
            }
        });
        
        // Победители
        if (session.winnerTeam) {
            this.sendToRoom({ type: "winnerTeamChange", winnerTeam: session.winnerTeam });
        }
        
        // Полное состояние
        setTimeout(() => {
            this.sendFullState();
            console.log('✅ Все восстановленные данные отправлены на roles.html');
        }, 300);
    },
    
    saveCurrentSession() {
        if (!window.sessionManager) return;

        // Не сохраняем если нет значимых данных
        if (!this.roomId && !this.tournamentId && !this.manualMode) return;

        // Генерируем sessionId если его ещё нет
        if (!this.currentSessionId) {
            this.currentSessionId = window.sessionManager.generateSessionId();
        }
        
        const sessionData = {
            sessionId: this.currentSessionId,

            // Основные данные комнаты и турнира
            roomId: this.roomId,
            tournamentId: this.tournamentId,
            gameSelected: this.gameSelected,
            tableSelected: this.tableSelected,
            
            // Режимы работы
            manualMode: this.manualMode,
            manualPlayers: this.manualPlayers,
            manualGames: this.manualGames,
            manualGameSelected: this.manualGameSelected,
            inputMode: this.inputMode,
            editRoles: this.editRoles,
            
            // Роли и статусы игроков
            roles: this.roles,
            playersActions: this.playersActions,
            fouls: this.fouls,
            techFouls: this.techFouls,
            removed: this.removed,
            
            // Информационные тексты
            mainInfoText: this.mainInfoText,
            additionalInfoText: this.additionalInfoText,
            
            // Настройки отображения
            mainInfoVisible: this.mainInfoVisible,
            additionalInfoVisible: this.additionalInfoVisible,
            hideSeating: this.hideSeating,
            hideLeaveOrder: this.hideLeaveOrder,
            hideRolesStatus: this.hideRolesStatus,
            hideBestMove: this.hideBestMove,
            showRoomNumber: this.showRoomNumber,
            
            // Лучший ход
            highlightedPlayer: this.highlightedPlayer,
            bestMove: this.bestMove,
            bestMoveSelected: this.bestMoveSelected,
            firstKilledPlayer: this.firstKilledPlayer,
            showBestMoveModal: this.showBestMoveModal,
            
            // Номинации и голосования
            nominations: this.nominations,
            nominationsLocked: this.nominationsLocked,
            votingOrder: this.votingOrder,
            votingCurrentIndex: this.votingCurrentIndex,
            votingResults: this.votingResults,
            votingVotedPlayers: this.votingVotedPlayers,
            votingFinished: this.votingFinished,
            votingWinners: this.votingWinners,
            votingStage: this.votingStage,
            votingTiePlayers: this.votingTiePlayers,
            votingLiftResults: this.votingLiftResults,
            votingHistory: this.votingHistory,
            
            // Темы и визуал
            selectedColorScheme: this.selectedColorScheme,
            selectedBackgroundTheme: this.selectedBackgroundTheme,
            
            // Победители и режимы
            winnerTeam: this.winnerTeam,
            currentMode: this.currentMode,
            rolesDistributed: this.rolesDistributed,

            // Game Phase System
            gamePhase: this.gamePhase,
            dayNumber: this.dayNumber,
            dayVoteOuts: this.dayVoteOuts,
            nightMisses: this.nightMisses,
            firstKilledEver: this.firstKilledEver,

            // Аватары
            avatarsFromServer: this.avatarsFromServer,
            avatarsJustLoaded: this.avatarsJustLoaded,

            // Протокол и мнения
            protocolData: this.protocolData,
            opinionData: this.opinionData,
            opinionText: this.opinionText,

            // Ночные проверки
            nightCheckHistory: this.nightCheckHistory,
            nightNumber: this.nightNumber,
            killedCardPhase: this.killedCardPhase,
            protocolAccepted: this.protocolAccepted,
            bestMoveAccepted: this.bestMoveAccepted,

            // Баллы
            playerScores: this.playerScores
        };
        
        try {
            window.sessionManager.addOrUpdateSession(sessionData);
        } catch (error) {
            console.error('Ошибка сохранения сессии:', error);
        }
    },
    
    // =============================================
    // Утилиты отображения
    // =============================================

    formatSessionTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffMinutes < 1) {
            return 'только что';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} мин назад`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);
            const remainingMinutes = diffMinutes % 60;
            if (remainingMinutes === 0) {
                return `${diffHours} ч назад`;
            } else {
                return `${diffHours} ч ${remainingMinutes} мин назад`;
            }
        }
    },

    getSessionDisplayName(session) {
        if (session.mainInfoText && session.mainInfoText.trim() && session.mainInfoText.trim() !== 'Название турнира') {
            return session.mainInfoText;
        }
        if (session.tournamentId) {
            return 'Турнир #' + session.tournamentId;
        }
        if (session.manualMode) {
            const count = session.manualPlayers ? session.manualPlayers.length : 0;
            return 'Ручная игра (' + count + ' игроков)';
        }
        if (session.roomId) {
            return 'Комната ' + session.roomId;
        }
        return 'Игра';
    },

    getSessionStatusText(session) {
        if (session.winnerTeam === 'civilians') return '🔴 Победа мирных';
        if (session.winnerTeam === 'mafia') return '⚫ Победа мафии';
        if (session.winnerTeam === 'draw') return '⚪ Ничья';

        const playersCount = session.manualPlayers ? session.manualPlayers.length : 0;
        const rolesCount = session.roles ? Object.keys(session.roles).length : 0;

        if (rolesCount > 0) return '🎮 В процессе';
        if (playersCount > 0) return '📋 Подготовка';
        return '🆕 Новая';
    },

    getSessionModeText(session) {
        if (session.tournamentId) return 'GoMafia';
        if (session.manualMode) return 'GoРучками';
        return '';
    },

    getSessionRoomText(session) {
        if (session.roomId) return 'Комната: ' + session.roomId;
        return 'Без комнаты';
    },

    // =============================================
    // Фильтрация сессий для разделов
    // =============================================
    
    getActiveSessions() {
        if (!this.sessionsList) return [];
        
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        return this.sessionsList.filter(s => {
            // Игра завершена, если есть победитель
            const isFinished = !!s.winnerTeam;
            
            // Если игра завершена, она не активна
            if (isFinished) return false;
            
            // Если прошло больше 24 часов, игра считается завершенной автоматически
            if (s.timestamp && (now - s.timestamp) > oneDay) return false;
            
            return true;
        });
    },
    
    getHistorySessions() {
        if (!this.sessionsList) return [];
        
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        return this.sessionsList.filter(s => {
            // Игра завершена, если есть победитель
            const isFinished = !!s.winnerTeam;
            
            // Если игра завершена, она в истории
            if (isFinished) return true;
            
            // Если прошло больше 24 часов, игра автоматически попадает в историю
            if (s.timestamp && (now - s.timestamp) > oneDay) return true;
            
            return false;
        });
    }
});

console.log('✅ app-sessions.js v2 загружен, методы добавлены в window.app.methods');
