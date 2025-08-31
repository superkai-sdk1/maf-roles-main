// =====================================================
// Методы для работы с сессиями и восстановлением данных
// Часть 3 из 5: app-sessions.js
// =====================================================

console.log('📦 Загружается app-sessions.js...');

// Расширяем Vue приложение методами для работы с сессиями
window.app = window.app || {};
if (!window.app.methods) window.app.methods = {};

// Принудительно добавляем методы для работы с сессиями
Object.assign(window.app.methods, {
    // Методы для работы с сессиями
    checkAndShowSessionRestore() {
        console.log('🔍 checkAndShowSessionRestore: Начинаем проверку');
        
        if (this.sessionRestoreChecked) {
            console.log('🔍 checkAndShowSessionRestore: Проверка уже проводилась');
            return;
        }
        
        this.sessionRestoreChecked = true;
        
        if (!window.sessionManager) {
            console.log('🔍 checkAndShowSessionRestore: sessionManager недоступен');
            return;
        }
        
        // Проверяем, если мы в Telegram, используем асинхронный вызов
        if (window.sessionManager.hasTelegramCloudStorage && window.sessionManager.hasTelegramCloudStorage()) {
            console.log('🔍 checkAndShowSessionRestore: Используем Telegram Cloud Storage (асинхронно)');
            
            window.sessionManager.getSession((error, sessionData) => {
                if (error) {
                    console.error('🔍 checkAndShowSessionRestore: Ошибка получения сессии из Telegram Cloud Storage:', error);
                    return;
                }
                
                console.log('🔍 checkAndShowSessionRestore: Получены данные сессии из Telegram Cloud Storage:', sessionData);
                this.processSessionData(sessionData);
            });
        } else {
            // Синхронный вызов для localStorage
            console.log('🔍 checkAndShowSessionRestore: Используем localStorage (синхронно)');
            const sessionData = window.sessionManager.getSession();
            console.log('🔍 checkAndShowSessionRestore: Получены данные сессии из localStorage:', sessionData);
            this.processSessionData(sessionData);
        }
    },
    
    processSessionData(sessionData) {
        console.log('🔍 processSessionData: Обрабатываем данные сессии:', sessionData);
        
        if (!sessionData) {
            console.log('🔍 processSessionData: Данные сессии отсутствуют');
            this.showDefaultModals();
            return;
        }
        
        // Проверяем валидность сессии (3 часа)
        const isValid = window.sessionManager.isSessionValid(sessionData);
        console.log('🔍 processSessionData: Сессия валидна:', isValid);
        
        if (!isValid) {
            // Сессия устарела, удаляем её
            console.log('🔍 processSessionData: Сессия устарела, очищаем');
            window.sessionManager.clearSession();
            this.showDefaultModals();
            return;
        }
        
        // Проверяем, есть ли значимые данные
        const hasSignificant = window.sessionManager.hasSignificantData(sessionData);
        console.log('🔍 processSessionData: Есть значимые данные:', hasSignificant);
        
        if (!hasSignificant) {
            console.log('🔍 processSessionData: Нет значимых данных, не показываем диалог');
            this.showDefaultModals();
            return;
        }
        
        // Показываем модальное окно восстановления
        console.log('🔍 processSessionData: Показываем диалог восстановления');
        this.previousSession = sessionData;
        this.showSessionRestoreModal = true;
    },
    
    showDefaultModals() {
        console.log('🔍 showDefaultModals: Показываем стандартные модальные окна');
        this.showRoomModal = true;
        this.showModal = false;
    },

    restoreSession() {
        if (!this.previousSession) {
            return;
        }
        
        // Устанавливаем флаг восстановления сессии
        this.isRestoringSession = true;
        
        const session = this.previousSession;
        
        // Восстанавливаем основные данные комнаты и турнира
        if (session.roomId) {
            this.roomId = session.roomId;
            this.roomInput = session.roomId;
        }
        
        if (session.tournamentId) {
            this.tournamentId = session.tournamentId;
            this.inputMode = 'gomafia';
            this.manualMode = false;
            
            // ВАЖНО: Восстанавливаем gameSelected и tableSelected ПЕРЕД загрузкой турнира
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
        
        // Восстанавливаем режимы работы
        if (session.inputMode) {
            this.inputMode = session.inputMode;
        }
        if (session.editRoles !== undefined) {
            this.editRoles = session.editRoles;
        }
        
        // Восстанавливаем роли и статусы игроков
        if (session.roles) {
            this.roles = session.roles;
        }
        if (session.playersActions) {
            this.playersActions = session.playersActions;
        }
        if (session.fouls) {
            this.fouls = session.fouls;
        }
        if (session.techFouls) {
            this.techFouls = session.techFouls;
        }
        if (session.removed) {
            this.removed = session.removed;
        }
        
        // Восстанавливаем информационные тексты
        if (session.mainInfoText !== undefined) {
            this.mainInfoText = session.mainInfoText;
        }
        if (session.additionalInfoText !== undefined) {
            this.additionalInfoText = session.additionalInfoText;
        }
        
        // Восстанавливаем настройки отображения
        if (session.mainInfoVisible !== undefined) {
            this.mainInfoVisible = session.mainInfoVisible;
        }
        if (session.additionalInfoVisible !== undefined) {
            this.additionalInfoVisible = session.additionalInfoVisible;
        }
        if (session.hideSeating !== undefined) {
            this.hideSeating = session.hideSeating;
        }
        if (session.hideLeaveOrder !== undefined) {
            this.hideLeaveOrder = session.hideLeaveOrder;
        }
        if (session.hideRolesStatus !== undefined) {
            this.hideRolesStatus = session.hideRolesStatus;
        }
        if (session.hideBestMove !== undefined) {
            this.hideBestMove = session.hideBestMove;
        }
        if (session.showRoomNumber !== undefined) {
            this.showRoomNumber = session.showRoomNumber;
        }
        
        // Восстанавливаем лучший ход
        if (session.highlightedPlayer !== undefined) {
            this.highlightedPlayer = session.highlightedPlayer;
        }
        if (session.bestMove) {
            this.bestMove = session.bestMove;
        }
        if (session.bestMoveSelected !== undefined) {
            this.bestMoveSelected = session.bestMoveSelected;
        }
        if (session.firstKilledPlayer !== undefined) {
            this.firstKilledPlayer = session.firstKilledPlayer;
        }
        if (session.showBestMoveModal !== undefined) {
            this.showBestMoveModal = session.showBestMoveModal;
        }
        
        // Восстанавливаем номинации и голосования
        if (session.nominations) {
            this.nominations = session.nominations;
        }
        if (session.nominationsLocked !== undefined) {
            this.nominationsLocked = session.nominationsLocked;
        }
        if (session.votingOrder) {
            this.votingOrder = session.votingOrder;
        }
        if (session.votingCurrentIndex !== undefined) {
            this.votingCurrentIndex = session.votingCurrentIndex;
        }
        if (session.votingResults) {
            this.votingResults = session.votingResults;
        }
        if (session.votingVotedPlayers) {
            this.votingVotedPlayers = session.votingVotedPlayers;
        }
        if (session.votingFinished !== undefined) {
            this.votingFinished = session.votingFinished;
        }
        if (session.votingWinners) {
            this.votingWinners = session.votingWinners;
        }
        if (session.votingStage) {
            this.votingStage = session.votingStage;
        }
        if (session.votingTiePlayers) {
            this.votingTiePlayers = session.votingTiePlayers;
        }
        if (session.votingLiftResults) {
            this.votingLiftResults = session.votingLiftResults;
        }
        if (session.votingHistory) {
            this.votingHistory = session.votingHistory;
        }
          // Восстанавливаем тему
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
        
        // Восстанавливаем победителей и режимы
        if (session.winnerTeam !== undefined) {
            this.winnerTeam = session.winnerTeam;
        }
        if (session.currentMode) {
            this.currentMode = session.currentMode;
        }
        
        // Восстанавливаем аватары и дополнительные данные
        if (session.avatarsFromServer) {
            this.avatarsFromServer = session.avatarsFromServer;
        }
        if (session.avatarsJustLoaded !== undefined) {
            this.avatarsJustLoaded = session.avatarsJustLoaded;
        }
        
        // Скрываем модальные окна
        this.showSessionRestoreModal = false;
        this.showRoomModal = false;
        this.showModal = false;
        
        console.log('🔄 restoreSession: Сессия восстановлена, подключаемся к WebSocket для отправки данных');
        
        // Если есть tournamentId, загружаем турнир
        if (session.tournamentId) {
            console.log('🔄 restoreSession: Загружаем турнир', session.tournamentId);
            this.loadTournament();
        } else if (session.roomId) {
            // Подключаемся к комнате (как для ручного режима, так и для обычного)
            console.log('🔄 restoreSession: Подключаемся к комнате', session.roomId);
            this.connectWS();
        }
    },
    
    skipSessionRestore() {
        // Очищаем старую сессию
        if (window.sessionManager) {
            window.sessionManager.clearSession();
        }
        
        // Сбрасываем флаг восстановления
        this.isRestoringSession = false;
        
        // Скрываем модальное окно восстановления
        this.showSessionRestoreModal = false;
        
        // Показываем стандартные модальные окна
        this.showRoomModal = true;
        this.showModal = false;
    },
    
    sendRestoredDataToRoles(session) {
        console.log('🔄 sendRestoredDataToRoles: Отправляем восстановленные данные на roles.html');
        
        // Проверяем, что WebSocket подключен
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ sendRestoredDataToRoles: WebSocket не подключен, повторяем через 500ms');
            setTimeout(() => this.sendRestoredDataToRoles(session), 500);
            return;
        }
        
        // Отправляем роли
        if (session.roles && Object.keys(session.roles).length > 0) {
            console.log('📤 Отправляем роли:', Object.keys(session.roles));
            Object.entries(session.roles).forEach(([roleKey, role]) => {
                this.sendToRoom({ type: "roleChange", roleKey, role });
            });
        }
        
        // Отправляем статусы игроков (actions)
        if (session.playersActions && Object.keys(session.playersActions).length > 0) {
            console.log('📤 Отправляем статусы игроков:', Object.keys(session.playersActions));
            Object.entries(session.playersActions).forEach(([roleKey, action]) => {
                this.sendToRoom({ type: "actionChange", roleKey, action });
            });
        }
        
        // Отправляем фолы
        if (session.fouls && Object.keys(session.fouls).length > 0) {
            console.log('📤 Отправляем фолы:', Object.keys(session.fouls));
            Object.entries(session.fouls).forEach(([roleKey, value]) => {
                if (value > 0) {
                    this.sendToRoom({ type: "foulChange", roleKey, value });
                }
            });
        }
        
        // Отправляем техфолы
        if (session.techFouls && Object.keys(session.techFouls).length > 0) {
            console.log('📤 Отправляем техфолы:', Object.keys(session.techFouls));
            Object.entries(session.techFouls).forEach(([roleKey, value]) => {
                if (value > 0) {
                    this.sendToRoom({ type: "techFoulChange", roleKey, value });
                }
            });
        }
        
        // Отправляем статусы удаления
        if (session.removed && Object.keys(session.removed).length > 0) {
            console.log('📤 Отправляем статусы удаления:', Object.keys(session.removed));
            Object.entries(session.removed).forEach(([roleKey, value]) => {
                if (value) {
                    this.sendToRoom({ type: "removeChange", roleKey, value });
                }
            });
        }
        
        // Отправляем выделенного игрока
        if (session.highlightedPlayer !== undefined && session.highlightedPlayer !== null) {
            console.log('📤 Отправляем выделенного игрока:', session.highlightedPlayer);
            this.sendToRoom({ type: "highlight", roleKey: session.highlightedPlayer });
        }
        
        // Отправляем лучший ход
        if (session.bestMove && session.bestMove.length > 0) {
            console.log('📤 Отправляем лучший ход:', session.bestMove);
            this.sendToRoom({
                type: "bestMoveChange",
                bestMove: session.bestMove,
                firstKilledPlayer: session.firstKilledPlayer
            });
        }
        
        // Отправляем подтверждение лучшего хода
        if (session.bestMoveSelected) {
            console.log('📤 Отправляем подтверждение лучшего хода');
            this.sendToRoom({
                type: "bestMoveConfirm",
                bestMove: session.bestMove || [],
                firstKilledPlayer: session.firstKilledPlayer
            });
        }
        
        // Отправляем состояние панели
        console.log('📤 Отправляем состояние панели');
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
        
        // Отправляем команду победителей
        if (session.winnerTeam) {
            console.log('📤 Отправляем команду победителей:', session.winnerTeam);
            this.sendToRoom({ type: "winnerTeamChange", winnerTeam: session.winnerTeam });
        }
        
        // В конце отправляем полное состояние
        setTimeout(() => {
            console.log('📤 Отправляем полное состояние');
            this.sendFullState();
            console.log('✅ Все восстановленные данные отправлены на roles.html');
        }, 300);
    },
    
    saveCurrentSession() {
        if (!window.sessionManager || !this.roomId) {
            return;
        }
        
        const sessionData = {
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
            
            // Аватары и дополнительные данные
            avatarsFromServer: this.avatarsFromServer,
            avatarsJustLoaded: this.avatarsJustLoaded
        };
        
        // Безопасное сохранение сессии
        try {
            if (window.sessionManager) {
                window.sessionManager.saveSession(sessionData);
            } else {
                console.warn('Session manager недоступен, используем localStorage напрямую');
                localStorage.setItem('maf-session', JSON.stringify({
                    ...sessionData,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('Ошибка сохранения сессии:', error);
        }
    },
    
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
    }
});

console.log('✅ app-sessions.js загружен, методы добавлены в window.app.methods');
