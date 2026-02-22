// =====================================================
// Методы для работы с сессиями и восстановлением данных
// Часть 3 из 5: app-sessions.js
// Версия 2: Главное меню с историей игр
// =====================================================

console.log('📦 Загружается app-sessions.js v2...');

// Расширяем Vue приложение методами для работы с сессиями
window.app = window.app || {};
if (!window.app.methods) window.app.methods = {};

// Хелпер: статус серии игр (турнир/фанки)
function _getTournamentStatusText(group) {
    if (!group || !group.sessions || !group.sessions.length) return 'Создан';

    // Если турнир явно завершён
    const isFinished = group.sessions.some(s => s.tournamentFinishedFlag);
    if (isFinished) return 'Завершён';

    // Если все игры завершены (баллы сохранены)
    if (group.allGamesFinished) return 'Завершён';

    // Если есть хотя бы одна игра в процессе
    const hasInProgress = group.sessions.some(s => {
        // Игра с gameFinished = true считается завершённой
        if (s.gameFinished) return false;
        // Обратная совместимость: старые сессии без поля gameFinished
        if (s.winnerTeam && s.gameFinished === undefined) return false;
        // Всё остальное — в процессе (включая winnerTeam без gameFinished — расстановка баллов)
        if (s.winnerTeam) return true;
        if (s.rolesDistributed) return true;
        const rolesCount = s.roles ? Object.keys(s.roles).length : 0;
        if (rolesCount > 0) return true;
        return false;
    });
    if (hasInProgress) return 'Идёт';

    // Если есть хотя бы одна завершённая игра — тоже «Идёт»
    if (group.finishedGamesCount > 0) return 'Идёт';

    return 'Создан';
}

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

            // Не сбрасываем UI, если пользователь уже в активном режиме
            if (self.funkyMode || self.cityMode || self.tournamentId || self.manualMode ||
                self.showFunkySummary ||
                (self.newGameStep && self.newGameStep !== 'modes') ||
                (!self.showMainMenu && self.showModal)) {
                console.log('🏠 loadMainMenu: Пользователь в активном режиме, не сбрасываем UI');
                return;
            }

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

        // Единый путь: ждём готовности кэша (localStorage + Cloud Storage), потом sync с сервером
        if (window.sessionManager.whenReady) {
            window.sessionManager.whenReady(function(sessions) {
                applySessionsList(sessions);
                // Фоновая синхронизация с сервером
                doServerSync();
            });
        } else {
            // Fallback для старой версии sessionManager
            const sessions = window.sessionManager.getSessions() || [];
            applySessionsList(sessions);
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
            if (session.funkyMode) {
                // Funky mode: не загружаем турнир с gomafia
                console.log('📂 openSession: Фанки-режим, турнир', session.tournamentId);
                this.isRestoringSession = false;
                // Игроки подтверждены, если есть manualGames с игроками или manualMode уже включён
                const hasConfirmedPlayers = (session.manualGames && session.manualGames.length > 0 && session.manualGames[0].players && session.manualGames[0].players.length > 0)
                    || (session.manualMode && session.manualPlayers && session.manualPlayers.length > 0);
                if (hasConfirmedPlayers) {
                    // Игроки уже подтверждены — показываем стол
                    console.log('📂 openSession: Фанки с игроками, показываем стол');
                } else {
                    // Показываем экран ввода игроков
                    console.log('📂 openSession: Фанки без игроков, показываем ввод');
                    this.showModal = true;
                    this.newGameStep = 'funky';
                }
            } else if (session.cityMode) {
                // City Mafia mode: не загружаем турнир с gomafia
                console.log('📂 openSession: Городская мафия, турнир', session.tournamentId);
                this.isRestoringSession = false;
                const hasCityConfirmedPlayers = (session.manualGames && session.manualGames.length > 0 && session.manualGames[0].players && session.manualGames[0].players.length > 0)
                    || (session.manualMode && session.manualPlayers && session.manualPlayers.length > 0);
                if (hasCityConfirmedPlayers) {
                    console.log('📂 openSession: Городская мафия с игроками, показываем стол');
                } else {
                    console.log('📂 openSession: Городская мафия без игроков, показываем ввод');
                    this.showModal = true;
                    this.newGameStep = 'city';
                }
            } else {
                console.log('📂 openSession: Загружаем турнир', session.tournamentId);
                this.loadTournament();
            }
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
        if (this.currentSessionId && (this.roomId || this.tournamentId || this.manualMode || this.cityMode)) {
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

        // Сохраняем текущую сессию только если есть данные и не было только что сохранено
        if (!this._skipReturnSave && this.currentSessionId && (this.roomId || this.tournamentId || this.manualMode || this.cityMode)) {
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

        // Гарантируем показ главного меню (на случай если loadMainMenu не установил)
        this.$nextTick(() => {
            if (!this.showMainMenu) {
                console.warn('🏠 returnToMainMenu: showMainMenu не установлен, принудительно показываем');
                this.showMainMenu = true;
            }
        });
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

            if (session.tournamentName) {
                this._tournamentDisplayName = session.tournamentName;
            }
            if (session.tournamentFinishedFlag !== undefined) {
                this._tournamentFinishedFlag = session.tournamentFinishedFlag;
            }
            if (session.totalGamesInTournament) {
                this.totalGamesInTournament = session.totalGamesInTournament;
            }

            // Funky mode restoration
            if (session.funkyMode) {
                this.inputMode = 'funky';
                this.funkyMode = true;
                this.manualMode = session.manualMode || false;
                if (session.funkyPlayers) this.funkyPlayers = session.funkyPlayers;
                if (session.funkyPlayerInputs) this.funkyPlayerInputs = session.funkyPlayerInputs;
                if (session.funkyGameNumber) this.funkyGameNumber = session.funkyGameNumber;
                if (session.funkyTableNumber) this.funkyTableNumber = session.funkyTableNumber;
                // manualPlayers — data перекрывает computed, ставим напрямую
                if (session.manualGames) {
                    this.manualGames = session.manualGames;
                    // Извлекаем players из manualGames для tableOut
                    const activeGame = session.manualGames.find(g => g.num === (session.manualGameSelected || session.funkyGameNumber || 1));
                    if (activeGame && activeGame.players && activeGame.players.length > 0) {
                        this.manualPlayers = activeGame.players;
                    }
                } else if (session.manualPlayers && session.manualPlayers.length > 0) {
                    // Обратная совместимость: старые сессии хранили manualPlayers напрямую
                    this.manualGames = [{ num: session.funkyGameNumber || 1, players: session.manualPlayers }];
                    this.manualPlayers = session.manualPlayers;
                }
                if (session.manualGameSelected) this.manualGameSelected = session.manualGameSelected;
            } else if (session.cityMode) {
                // City Mafia mode restoration
                this.inputMode = 'city';
                this.cityMode = true;
                this.manualMode = session.manualMode || false;
                if (session.cityPlayers) this.cityPlayers = session.cityPlayers;
                if (session.cityPlayerInputs) this.cityPlayerInputs = session.cityPlayerInputs;
                if (session.cityPlayersCount) this.cityPlayersCount = session.cityPlayersCount;
                if (session.cityGameNumber) this.cityGameNumber = session.cityGameNumber;
                if (session.cityTableNumber) this.cityTableNumber = session.cityTableNumber;
                if (session.cityRoleToggles) this.cityRoleToggles = session.cityRoleToggles;
                if (session.cityAssignedRoles) this.cityAssignedRoles = session.cityAssignedRoles;
                if (session.cityStep) this.cityStep = session.cityStep;
                if (session.manualGames) {
                    this.manualGames = session.manualGames;
                    const activeGame = session.manualGames.find(g => g.num === (session.manualGameSelected || session.cityGameNumber || 1));
                    if (activeGame && activeGame.players && activeGame.players.length > 0) {
                        this.manualPlayers = activeGame.players;
                    }
                } else if (session.manualPlayers && session.manualPlayers.length > 0) {
                    this.manualGames = [{ num: session.cityGameNumber || 1, players: session.manualPlayers }];
                    this.manualPlayers = session.manualPlayers;
                }
                if (session.manualGameSelected) this.manualGameSelected = session.manualGameSelected;
            } else {
                this.inputMode = 'gomafia';
                this.manualMode = false;
            }

            if (session.gameSelected !== undefined) {
                this.gameSelected = session.gameSelected;
            }
            if (session.tableSelected !== undefined) {
                this.tableSelected = session.tableSelected;
            }
        } else if (session.manualMode) {
            this.inputMode = 'manual';
            this.manualMode = true;
            if (session.manualPlayers && session.manualPlayers.length > 0) {
                this.manualPlayers = session.manualPlayers;
            }
            if (session.manualGames) {
                this.manualGames = session.manualGames;
                // Если manualPlayers пуст — извлекаем из manualGames
                if (!this.manualPlayers || this.manualPlayers.length === 0) {
                    const selNum = session.manualGameSelected || 1;
                    const activeGame = session.manualGames.find(g => g.num === selNum);
                    if (activeGame && activeGame.players && activeGame.players.length > 0) {
                        this.manualPlayers = activeGame.players;
                    }
                }
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

        // Тема — localStorage (глобальный выбор пользователя) имеет приоритет над сессией
        try {
            const globalColorScheme = localStorage.getItem('maf_color_scheme');
            const globalBgTheme = localStorage.getItem('maf_bg_theme');
            const colorToApply = globalColorScheme || session.selectedColorScheme;
            const bgToApply = globalBgTheme || session.selectedBackgroundTheme;
            if (colorToApply) {
                this.selectedColorScheme = colorToApply;
                if (this.applyColorScheme) {
                    this.applyColorScheme(colorToApply);
                }
            }
            if (bgToApply) {
                this.selectedBackgroundTheme = bgToApply;
                if (this.applyBackgroundTheme) {
                    this.applyBackgroundTheme(bgToApply);
                }
            }
        } catch(e) {
            // Fallback: используем тему из сессии
            if (session.selectedColorScheme) {
                this.selectedColorScheme = session.selectedColorScheme;
                if (this.applyColorScheme) this.applyColorScheme(session.selectedColorScheme);
            }
            if (session.selectedBackgroundTheme) {
                this.selectedBackgroundTheme = session.selectedBackgroundTheme;
                if (this.applyBackgroundTheme) this.applyBackgroundTheme(session.selectedBackgroundTheme);
            }
        }
        
        // Победители и режимы
        if (session.winnerTeam !== undefined) this.winnerTeam = session.winnerTeam;
        if (session.gameFinished !== undefined) this.gameFinished = session.gameFinished;
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
        if (session.killedOnNight) this.killedOnNight = session.killedOnNight;
        if (session.killedCardPhase) this.killedCardPhase = session.killedCardPhase;
        if (session.protocolAccepted) this.protocolAccepted = session.protocolAccepted;
        if (session.bestMoveAccepted !== undefined) this.bestMoveAccepted = session.bestMoveAccepted;

        // Лечение доктора
        if (session.doctorHealHistory) this.doctorHealHistory = session.doctorHealHistory;
        if (session.doctorLastHealTarget !== undefined) this.doctorLastHealTarget = session.doctorLastHealTarget;

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
        this._tournamentDisplayName = '';
        this._tournamentFinishedFlag = false;
        this._isNextGameLoad = false;
        this.totalGamesInTournament = null;
        this._lockedTableNum = null;
        this._playedGameNums = [];
        this.gameSelected = undefined;
        this.tableSelected = undefined;

        // Сбрасываем навигационные флаги — без этого loadMainMenu не покажет главное меню
        this.newGameStep = 'modes';
        this.showVotingScreen = false;
        this.showFunkySummary = false;
        this.showTournamentBrowser = false;
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

        // Funky mode reset
        this.funkyMode = false;
        this.funkyPlayers = [];
        this.funkyPlayerInputs = [];
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;
        this.funkySearchLoading = false;
        this.funkyGameNumber = 1;
        this.funkyTableNumber = 1;

        // City Mafia mode reset
        this.cityMode = false;
        this.cityPlayers = [];
        this.cityPlayerInputs = [];
        this.cityPlayersCount = 10;
        this.citySearchResults = [];
        this.cityActiveInput = -1;
        this.citySearchLoading = false;
        this.cityGameNumber = 1;
        this.cityTableNumber = 1;
        this.cityRoleToggles = {};
        this.cityAssignedRoles = {};
        this.cityRolesAutoAssigned = false;
        this.cityStep = 'count';

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
        this.gameFinished = false;
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
        this.killedOnNight = {};
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
            this.nightAutoCloseTimer = null;
        }
        this.doctorHeal = null;
        this.doctorHealHistory = [];
        this.doctorLastHealTarget = null;
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
        if (!this.roomId && !this.tournamentId && !this.manualMode && !this.cityMode) return;

        // Генерируем sessionId если его ещё нет
        if (!this.currentSessionId) {
            this.currentSessionId = window.sessionManager.generateSessionId();
        }
        
        const sessionData = {
            sessionId: this.currentSessionId,

            // Основные данные комнаты и турнира
            roomId: this.roomId,
            tournamentId: this.tournamentId,
            tournamentName: this._tournamentDisplayName || this.mainInfoText || '',
            tournamentFinishedFlag: this._tournamentFinishedFlag || false,
            totalGamesInTournament: this.totalGamesInTournament || null,
            gameSelected: this.gameSelected,
            tableSelected: this.tableSelected,
            
            // Режимы работы
            manualMode: this.manualMode,
            manualPlayers: this.manualPlayers,
            manualGames: this.manualGames,
            manualGameSelected: this.manualGameSelected,
            inputMode: this.inputMode,

            // Funky mode
            funkyMode: this.funkyMode || false,
            funkyPlayers: this.funkyPlayers || [],
            funkyPlayerInputs: this.funkyPlayerInputs || [],
            funkyGameNumber: this.funkyGameNumber || 1,
            funkyTableNumber: this.funkyTableNumber || 1,

            // City Mafia mode
            cityMode: this.cityMode || false,
            cityPlayers: this.cityPlayers || [],
            cityPlayerInputs: this.cityPlayerInputs || [],
            cityPlayersCount: this.cityPlayersCount || 10,
            cityGameNumber: this.cityGameNumber || 1,
            cityTableNumber: this.cityTableNumber || 1,
            cityRoleToggles: this.cityRoleToggles || {},
            cityAssignedRoles: this.cityAssignedRoles || {},
            cityStep: this.cityStep || 'count',

            // GoMafia players (для подведения итогов)
            goMafiaPlayers: (this.inputMode === 'gomafia' && this.tableOut && this.tableOut.length > 0)
                ? this.tableOut.map(p => p ? { login: p.login, avatar_link: p.avatar_link || null, id: p.id || null, title: p.title || null, roleKey: p.roleKey, num: p.num } : null)
                : [],

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
            gameFinished: this.gameFinished || false,
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
            killedOnNight: this.killedOnNight,
            killedCardPhase: this.killedCardPhase,
            protocolAccepted: this.protocolAccepted,
            bestMoveAccepted: this.bestMoveAccepted,

            // Лечение доктора
            doctorHealHistory: this.doctorHealHistory,
            doctorLastHealTarget: this.doctorLastHealTarget,

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
        if (session.tournamentName) {
            return session.tournamentName;
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
        // Игра завершена (баллы сохранены)
        if (session.gameFinished) {
            if (session.winnerTeam === 'civilians') return 'Победа мирных';
            if (session.winnerTeam === 'mafia') return 'Победа мафии';
            if (session.winnerTeam === 'draw') return 'Ничья';
            return 'Завершена';
        }

        // Обратная совместимость: старые сессии без gameFinished
        if (session.winnerTeam && session.gameFinished === undefined) {
            if (session.winnerTeam === 'civilians') return 'Победа мирных';
            if (session.winnerTeam === 'mafia') return 'Победа мафии';
            if (session.winnerTeam === 'draw') return 'Ничья';
            return 'Завершена';
        }

        // Победитель выбран но баллы не сохранены
        if (session.winnerTeam) {
            return 'Расстановка баллов';
        }

        // Фазы игры (если роли уже розданы)
        if (session.rolesDistributed) {
            return 'В процессе';
        }

        // Рассадка (есть игроки или роли, но раздача не подтверждена)
        const rolesCount = session.roles ? Object.keys(session.roles).length : 0;
        const hasPlayers = (session.manualPlayers && session.manualPlayers.length > 0)
            || (session.funkyPlayers && session.funkyPlayers.length > 0)
            || (session.goMafiaPlayers && session.goMafiaPlayers.length > 0);
        if (rolesCount > 0 || hasPlayers) return 'Рассадка';

        return 'Создана';
    },

    getSessionModeText(session) {
        if (session.cityMode) return 'Городская мафия';
        if (session.funkyMode) return 'Фанки';
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
            // Турнирные сессии: остаются активными пока турнир не завершён
            if (s.tournamentId) {
                return !s.tournamentFinishedFlag;
            }

            // Не-турнирные сессии: завершена только если gameFinished
            const isFinished = s.gameFinished || (s.winnerTeam && s.gameFinished === undefined); // обратная совместимость
            if (isFinished) return false;
            if (s.timestamp && (now - s.timestamp) > oneDay) return false;
            
            return true;
        });
    },
    
    getHistorySessions() {
        if (!this.sessionsList) return [];
        
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        return this.sessionsList.filter(s => {
            // Турнирные сессии: попадают в историю только когда турнир явно завершён
            if (s.tournamentId) {
                return !!s.tournamentFinishedFlag;
            }

            // Не-турнирные: завершена если gameFinished (или обратная совместимость)
            const isFinished = s.gameFinished || (s.winnerTeam && s.gameFinished === undefined);
            if (isFinished) return true;
            if (s.timestamp && (now - s.timestamp) > oneDay) return true;
            
            return false;
        });
    },

    // =============================================
    // Группировка сессий по турнирам
    // =============================================

    getGroupedSessions(sessions) {
        if (!sessions || !sessions.length) return [];

        const tournamentGroups = {};
        const nonTournamentSessions = [];

        sessions.forEach(s => {
            if (s.tournamentId) {
                if (!tournamentGroups[s.tournamentId]) {
                    tournamentGroups[s.tournamentId] = {
                        tournamentId: s.tournamentId,
                        tournamentName: s.tournamentName || s.mainInfoText || ('Турнир #' + s.tournamentId),
                        sessions: [],
                        latestTimestamp: 0,
                        isTournament: true
                    };
                }
                const group = tournamentGroups[s.tournamentId];
                group.sessions.push(s);
                if ((s.timestamp || 0) > group.latestTimestamp) {
                    group.latestTimestamp = s.timestamp || 0;
                }
                // Обновляем название турнира если есть более свежее
                if (s.tournamentName && s.tournamentName !== ('Турнир #' + s.tournamentId)) {
                    group.tournamentName = s.tournamentName;
                }
            } else {
                nonTournamentSessions.push({
                    tournamentId: null,
                    tournamentName: null,
                    sessions: [s],
                    latestTimestamp: s.timestamp || 0,
                    isTournament: false
                });
            }
        });

        // Сортируем игры внутри каждого турнира по номеру игры
        Object.values(tournamentGroups).forEach(group => {
            // Дедупликация: если несколько сессий имеют одинаковый gameSelected+tableSelected,
            // оставляем только самую свежую (по timestamp)
            const deduped = {};
            group.sessions.forEach(s => {
                const key = (s.gameSelected || '?') + '-' + (s.tableSelected || '?');
                if (!deduped[key] || (s.timestamp || 0) > (deduped[key].timestamp || 0)) {
                    deduped[key] = s;
                }
            });
            group.sessions = Object.values(deduped);

            group.sessions.sort((a, b) => (a.gameSelected || 0) - (b.gameSelected || 0));
            // Игра считается завершённой только если gameFinished === true (баллы сохранены)
            // Для обратной совместимости: если gameFinished не установлен но winnerTeam есть и нет активных данных — считаем завершённой
            function isGameFinished(s) {
                if (s.gameFinished) return true;
                // Обратная совместимость: старые сессии без gameFinished
                if (s.winnerTeam && s.gameFinished === undefined) return true;
                return false;
            }
            group.hasActiveGame = group.sessions.some(s => !isGameFinished(s));
            group.allGamesFinished = group.sessions.every(s => isGameFinished(s));
            group.gamesCount = group.sessions.length;
            group.finishedGamesCount = group.sessions.filter(s => isGameFinished(s)).length;

            // Дополнительные метаданные для карточки
            group.isFunky = String(group.tournamentId).startsWith('funky_');

            // Последний стол (из последней сессии)
            const lastSession = group.sessions[group.sessions.length - 1];
            group.tableSelected = lastSession?.tableSelected || null;

            // Общее количество игр в турнире GoMafia (из любой сессии, где сохранено)
            group.totalGamesInTournament = null;
            for (let i = group.sessions.length - 1; i >= 0; i--) {
                if (group.sessions[i].totalGamesInTournament) {
                    group.totalGamesInTournament = group.sessions[i].totalGamesInTournament;
                    break;
                }
            }

            // Максимальный номер начатой игры
            let maxGame = 0;
            group.sessions.forEach(s => {
                const gn = Number(s.gameSelected || s.funkyGameNumber || 0);
                if (gn > maxGame) maxGame = gn;
            });
            group.lastStartedGameNumber = maxGame || group.gamesCount;

            // Статус серии
            group.tournamentStatusText = _getTournamentStatusText(group);
        });

        // Объединяем и сортируем по времени
        const allGroups = [...Object.values(tournamentGroups), ...nonTournamentSessions];
        allGroups.sort((a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0));

        return allGroups;
    },

    // Статус серии (турнир/фанки)
    // Вынесено для вызова из getGroupedSessions
    getTournamentStatusText(group) {
        return _getTournamentStatusText(group);
    },

    getGroupedActiveSessions() {
        return this.getGroupedSessions(this.getActiveSessions());
    },

    getGroupedHistorySessions() {
        return this.getGroupedSessions(this.getHistorySessions());
    },

    toggleTournamentExpanded(tournamentId) {
        if (!this.expandedTournaments) this.expandedTournaments = {};
        this.$set(this.expandedTournaments, tournamentId, !this.expandedTournaments[tournamentId]);
    },

    isTournamentExpanded(tournamentId) {
        return !!(this.expandedTournaments && this.expandedTournaments[tournamentId]);
    },

    // Получить результат игры для отображения в карточке
    getGameResultText(session) {
        // Игра завершена (баллы сохранены)
        if (session.gameFinished) {
            if (session.winnerTeam === 'civilians') return 'Победа мирных';
            if (session.winnerTeam === 'mafia') return 'Победа мафии';
            if (session.winnerTeam === 'draw') return 'Ничья';
            return 'Завершена';
        }

        // Победитель выбран но баллы ещё не сохранены
        if (session.winnerTeam) {
            return 'Расстановка баллов';
        }

        // Игра в процессе
        if (session.rolesDistributed) {
            return 'В процессе';
        }

        // Роли назначаются
        const rolesCount = session.roles ? Object.keys(session.roles).length : 0;
        if (rolesCount > 0) return 'Рассадка';

        return 'Создана';
    },

    // =============================================
    // Турнирный lifecycle
    // =============================================

    // Начать следующую игру в турнире
    startNextTournamentGame(tournamentId, tableNum) {
        console.log('🏆 startNextTournamentGame: Турнир', tournamentId, 'Стол', tableNum);

        // Перечитываем сессии из хранилища (sessionsList может быть устаревшим)
        const freshSessions = (window.sessionManager && window.sessionManager.getSessions)
            ? window.sessionManager.getSessions() || []
            : this.sessionsList || [];

        // Проверяем, есть ли незавершённая игра в этом турнире (только активные, не перемещённые в историю)
        // Дедупликация: если есть несколько сессий с одним gameSelected, берём только самую свежую
        const allTournamentSessions = freshSessions.filter(s => s.tournamentId === tournamentId && !s.tournamentFinishedFlag);
        const dedupedMap = {};
        allTournamentSessions.forEach(s => {
            const key = (s.gameSelected || s.funkyGameNumber || '?') + '-' + (s.tableSelected || '?');
            if (!dedupedMap[key] || (s.timestamp || 0) > (dedupedMap[key].timestamp || 0)) {
                dedupedMap[key] = s;
            }
        });
        const dedupedSessions = Object.values(dedupedMap);

        const hasUnfinishedGame = dedupedSessions.some(s => {
            if (s.gameFinished) return false;
            // Обратная совместимость: старые сессии без gameFinished
            if (s.winnerTeam && s.gameFinished === undefined) return false;
            // Если нет winnerTeam и нет gameFinished — игра не завершена
            return true;
        });

        if (hasUnfinishedGame) {
            console.warn('⚠️ startNextTournamentGame: Нельзя создать новую игру — есть незавершённая');
            if (window.haptic) window.haptic.notification('error');
            // Находим незавершённую игру и открываем её
            const unfinished = dedupedSessions.find(s => {
                if (s.gameFinished) return false;
                if (s.winnerTeam && s.gameFinished === undefined) return false;
                return true;
            });
            if (unfinished) {
                this.openSession(unfinished.sessionId);
            }
            return;
        }

        // Проверяем, не фанки ли это турнир
        const isFunky = String(tournamentId).startsWith('funky_');
        if (isFunky) {
            // Находим имя турнира из существующих сессий
            const existingSession = freshSessions.find(s => s.tournamentId === tournamentId);
            const tournamentName = existingSession?.tournamentName || this._tournamentDisplayName;

            // Определяем следующий номер игры (только из активного турнира)
            const tournamentSessions = freshSessions.filter(s => s.tournamentId === tournamentId && !s.tournamentFinishedFlag);
            let maxGame = 0;
            tournamentSessions.forEach(s => {
                const gn = Number(s.gameSelected) || 0;
                if (gn > maxGame) maxGame = gn;
            });

            // Сохраняем текущую
            if (this.currentSessionId) {
                this.saveCurrentSession();
            }

            // Закрываем WebSocket
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            // Сбрасываем состояние
            this._resetGameState();

            // Восстанавливаем турнирные данные для нового фанки-гейма
            this.currentSessionId = window.sessionManager ? window.sessionManager.generateSessionId() : ('sess_' + Date.now());
            this.funkyMode = true;
            this.manualMode = false;
            this.inputMode = 'funky';
            this.tournamentId = String(tournamentId);
            this._tournamentDisplayName = tournamentName;
            this.mainInfoText = tournamentName;
            this.funkyGameNumber = maxGame + 1;
            this.funkyTableNumber = 1;
            this.gameSelected = maxGame + 1;
            this.tableSelected = 1;

            // Инициализируем 10 слотов — предзаполняем из последней игры
            const lastSession = tournamentSessions.sort((a, b) => (b.gameSelected || 0) - (a.gameSelected || 0))[0];
            const prevPlayers = lastSession?.funkyPlayers || [];
            this.funkyPlayers = [];
            this.funkyPlayerInputs = [];
            this.funkySearchResults = [];
            this.funkyActiveInput = -1;
            for (let i = 0; i < 10; i++) {
                if (prevPlayers[i]) {
                    // Копируем игрока из предыдущей игры (без roleKey — он будет новый)
                    this.funkyPlayers.push({
                        login: prevPlayers[i].login,
                        avatar_link: prevPlayers[i].avatar_link || null,
                        id: prevPlayers[i].id || null,
                        title: prevPlayers[i].title || null,
                        roleKey: `${maxGame + 1}-1-${i + 1}`,
                        num: i + 1
                    });
                    this.funkyPlayerInputs.push(prevPlayers[i].login || '');
                } else {
                    this.funkyPlayers.push(null);
                    this.funkyPlayerInputs.push('');
                }
            }

            // Показываем экран ввода игроков
            this.showModal = true;
            this.showMainMenu = false;
            this.showRoomModal = false;
            this.showGameTableModal = false;
            this.newGameStep = 'funky';

            this.saveCurrentSession();
            return;
        }

        // Проверяем, не городская мафия ли это турнир
        const isCity = String(tournamentId).startsWith('city_');
        if (isCity) {
            const existingSession = freshSessions.find(s => s.tournamentId === tournamentId);
            const tournamentName = existingSession?.tournamentName || this._tournamentDisplayName;
            const prevPlayersCount = existingSession?.cityPlayersCount || 10;
            const prevRoleToggles = existingSession?.cityRoleToggles || {};

            const tournamentSessions = freshSessions.filter(s => s.tournamentId === tournamentId && !s.tournamentFinishedFlag);
            let maxGame = 0;
            tournamentSessions.forEach(s => {
                const gn = Number(s.gameSelected) || 0;
                if (gn > maxGame) maxGame = gn;
            });

            if (this.currentSessionId) {
                this.saveCurrentSession();
            }
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this._resetGameState();

            this.currentSessionId = window.sessionManager ? window.sessionManager.generateSessionId() : ('sess_' + Date.now());
            this.cityMode = true;
            this.manualMode = false;
            this.inputMode = 'city';
            this.tournamentId = String(tournamentId);
            this._tournamentDisplayName = tournamentName;
            this.mainInfoText = tournamentName;
            this.cityGameNumber = maxGame + 1;
            this.cityTableNumber = 1;
            this.gameSelected = maxGame + 1;
            this.tableSelected = 1;
            this.cityPlayersCount = prevPlayersCount;
            this.cityRoleToggles = JSON.parse(JSON.stringify(prevRoleToggles));

            // Предзаполняем игроков из последней игры
            const lastSession = tournamentSessions.sort((a, b) => (b.gameSelected || 0) - (a.gameSelected || 0))[0];
            const prevPlayers = lastSession?.cityPlayers || [];
            this.cityPlayers = [];
            this.cityPlayerInputs = [];
            this.citySearchResults = [];
            this.cityActiveInput = -1;
            for (let i = 0; i < prevPlayersCount; i++) {
                if (prevPlayers[i]) {
                    this.cityPlayers.push({
                        login: prevPlayers[i].login,
                        avatar_link: prevPlayers[i].avatar_link || null,
                        id: prevPlayers[i].id || null,
                        title: prevPlayers[i].title || null,
                        roleKey: `${maxGame + 1}-1-${i + 1}`,
                        num: i + 1
                    });
                    this.cityPlayerInputs.push(prevPlayers[i].login || '');
                } else {
                    this.cityPlayers.push(null);
                    this.cityPlayerInputs.push('');
                }
            }

            this.cityStep = 'players';
            this.cityAssignedRoles = {};
            this.cityRolesAutoAssigned = false;

            this.showModal = true;
            this.showMainMenu = false;
            this.showRoomModal = false;
            this.showGameTableModal = false;
            this.newGameStep = 'city';

            this.saveCurrentSession();
            return;
        }

        // Сохраняем текущую сессию
        if (this.currentSessionId) {
            this.saveCurrentSession();
        }

        // Находим все сессии этого турнира и определяем сыгранные игры + стол
        // Учитываем только сессии активного турнира (не перемещённые в историю)
        const tournamentSessions = freshSessions.filter(
            s => s.tournamentId === tournamentId && !s.tournamentFinishedFlag
        );
        const playedGameNums = tournamentSessions
            .filter(s => s.gameSelected)
            .map(s => Number(s.gameSelected));

        // Определяем зафиксированный стол из первой игры турнира
        const firstSession = tournamentSessions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0];
        const lockedTable = firstSession ? Number(firstSession.tableSelected) || Number(tableNum) : Number(tableNum);

        // Определяем следующий номер игры (первая не сыгранная)
        let nextGameNum = 1;
        while (playedGameNums.includes(nextGameNum)) {
            nextGameNum++;
        }

        console.log('🎮 Следующая игра:', nextGameNum, 'для стола', lockedTable, '(сыгранные:', playedGameNums, ')');

        // Закрываем WebSocket текущей сессии
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Сбрасываем состояние
        this._resetGameState();

        // Генерируем новый ID сессии
        this.currentSessionId = window.sessionManager ? window.sessionManager.generateSessionId() : ('sess_' + Date.now());

        // Устанавливаем данные турнира
        this.tournamentId = String(tournamentId);
        this.gameSelected = nextGameNum;
        this.tableSelected = lockedTable;
        this._lockedTableNum = lockedTable;
        this._playedGameNums = playedGameNums;
        this.inputMode = 'gomafia';
        this.manualMode = false;

        // Скрываем главное меню
        this.showMainMenu = false;
        this.showRoomModal = false;
        this.showModal = false;
        this.showGameTableModal = false;

        // Загружаем турнир и показываем окно выбора игры/стола
        this._isNextGameLoad = true;
        this.isRestoringSession = false;
        this.loadTournament();
    },

    // Завершить турнир — все игры турнира уходят в историю
    finishTournament(tournamentId) {
        console.log('🏁 finishTournament: Завершаем турнир', tournamentId);

        if (!this.sessionsList) return;

        // Помечаем все сессии этого турнира как завершённые
        this.sessionsList.forEach(s => {
            if (s.tournamentId === tournamentId) {
                s.tournamentFinishedFlag = true;
            }
        });

        // Если текущая сессия принадлежит этому турниру, помечаем тоже
        if (this.tournamentId === tournamentId) {
            this._tournamentFinishedFlag = true;
        }

        // Сохраняем все изменённые сессии
        if (window.sessionManager) {
            this.sessionsList.forEach(s => {
                if (s.tournamentId === tournamentId) {
                    try {
                        window.sessionManager.addOrUpdateSession(s);
                    } catch (e) {
                        console.error('Ошибка сохранения сессии при завершении турнира:', e);
                    }
                }
            });
        }

        // Сворачиваем карточку турнира
        if (this.expandedTournaments) {
            this.$set(this.expandedTournaments, tournamentId, false);
        }

        console.log('✅ Турнир', tournamentId, 'завершён');

        // Обновляем UI
        this.$forceUpdate();
    }
});

console.log('✅ app-sessions.js v2 загружен, методы добавлены в window.app.methods');
