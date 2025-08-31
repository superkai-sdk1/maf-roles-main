// =====================================================
// UI, WebSocket, Telegram интеграция и методы
// Часть 5 из 5: app-ui-integration.js
// =====================================================

console.log('📦 Загружается app-ui-integration.js...');

// Расширяем Vue приложение методами для UI и интеграций
window.app = window.app || {};
if (!window.app.methods) window.app.methods = {};

// Принудительно добавляем методы, перезаписывая существующие
Object.assign(window.app.methods, {
    // Telegram Web App методы
    initTelegramApp() {
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                this.tg = window.Telegram.WebApp;
                this.isTelegramApp = true;
                this.telegramUser = this.tg.initDataUnsafe?.user;
                
                // Автоматическое применение темы Telegram отключено
                // this.applyTelegramTheme();
                
                // Настройка главной кнопки
                this.setupTelegramMainButton();
                
                // Настройка кнопки назад
                this.setupTelegramBackButton();
                
                // Автоматическое отслеживание изменения темы Telegram отключено
                // this.tg.onEvent('themeChanged', () => {
                //     this.applyTelegramTheme();
                // });
                
                this.tg.onEvent('viewportChanged', () => {
                    console.log('Viewport изменен в Telegram');
                });
                
                console.log('Telegram Web App инициализирован', this.telegramUser);
            } else {
                console.log('Telegram Web App не найден, работаем в обычном браузере');
            }
        } catch (error) {
            console.error('Ошибка инициализации Telegram Web App:', error);
            this.isTelegramApp = false;
            this.tg = null;
        }
    },

    applyTelegramTheme() {
        // Автоматическое применение темы Telegram отключено
        // Используется только тема, выбранная пользователем в панели
        return;
    },

    setupTelegramMainButton() {
        if (!this.tg) return;
        
        this.tg.MainButton.setText('Отправить состояние');
        this.tg.MainButton.onClick(() => {
            this.sendFullState();
            this.tg.HapticFeedback.impactOccurred('medium');
        });
    },

    setupTelegramBackButton() {
        if (!this.tg) return;
          this.tg.BackButton.onClick(() => {
            if (this.showBestMoveModal || this.showSettingsModal || this.showThemeModal) {
                // Закрываем модальные окна
                this.showBestMoveModal = false;
                this.showSettingsModal = false;
                this.showThemeModal = false;
                this.sendTelegramHapticFeedback('light');
            } else if (this.showModal && !this.showRoomModal) {
                // Возвращаемся к выбору комнаты
                this.showModal = false;
                this.showRoomModal = true;
                this.sendTelegramHapticFeedback('light');
            } else if (this.roomId && !this.showRoomModal) {
                // Показываем подтверждение выхода из комнаты
                this.showConfirm('Вы уверены, что хотите покинуть комнату?', (confirmed) => {
                    if (confirmed) {
                        this.showRoomModal = true;
                        this.roomId = null;
                        if (this.ws) {
                            this.ws.close();
                        }
                        this.tg.BackButton.hide();
                        this.hideTelegramMainButton();
                        this.sendTelegramHapticFeedback('medium');
                    }
                });
            } else {
                // Закрываем приложение
                this.tg.close();
            }
        });
    },

    showTelegramMainButton() {
        if (this.tg) {
            this.tg.MainButton.show();
        }
    },

    hideTelegramMainButton() {
        if (this.tg) {
            this.tg.MainButton.hide();
        }
    },

    sendTelegramHapticFeedback(type = 'medium') {
        if (this.tg) {
            this.tg.HapticFeedback.impactOccurred(type);
        }
    },

    showAlert(message) {
        if (this.isTelegramApp && this.tg) {
            this.tg.showAlert(message);
        } else {
            alert(message);
        }
    },

    showConfirm(message, callback) {
        if (this.isTelegramApp && this.tg) {
            this.tg.showConfirm(message, callback);
        } else {
            const result = confirm(message);
            callback(result);
        }
    },

    // WebSocket подключение
    async connectWS() {
        if (this.ws) {
            this.ws.close();
        }
        this.ws = new WebSocket('wss://minahor.ru/bridge');
        this.waitingForState = true;
        this.stateReceived = false;
        
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: "ping" }));
            }
        }, 30000);

        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({ joinRoom: this.roomId }));
            setTimeout(() => {
                this.sendFullState();
                
                // Если мы восстанавливаем сессию и уже подключились, отправляем данные
                if (this.isRestoringSession && this.previousSession) {
                    console.log('🔄 WebSocket onopen: Обнаружено восстановление сессии при подключении');
                    setTimeout(() => {
                        this.sendRestoredDataToRoles(this.previousSession);
                    }, 500);
                }
            }, 200);
        };

        this.ws.onmessage = (ev) => {
            let data;
            try { data = JSON.parse(ev.data); } catch { data = {}; }

            // КРИТИЧЕСКИ ВАЖНО: Панель НЕ принимает изменения состояния от WebSocket
            // Только сама панель управляет всем состоянием игроков
            if (data.type === "actionChange" || data.type === "roleChange") {
                console.log(`🚫 WebSocket: ИГНОРИРУЕМ ${data.type} от других источников (только эта панель управляет состоянием)`);
                console.log(`📨 Проигнорированное сообщение:`, data);
                return;
            }

            if (data.joinedRoom && data.panelId) {
                this.panelId = data.panelId;
            }
            if (data.type === "activePanelChanged") {
                this.activePanelId = data.activePanelId;
                this.isActivePanel = (this.panelId && this.panelId === this.activePanelId);
            }
            if (data.type === "notActivePanel" && data.activePanelId) {
                this.activePanelId = data.activePanelId;
                this.isActivePanel = (this.panelId && this.panelId === this.activePanelId);
            }
            if (data.type === "state") {
                if (!Array.isArray(data.tableOut) || data.tableOut.length === 0) {
                    this.resetAllState();
                    this.stateReceived = false;
                    this.waitingForState = false;
                    this.showModal = true;
                    this.showRoomModal = false;
                } else {
                    this.applyFullState(data);
                    this.stateReceived = true;
                    this.waitingForState = false;
                    this.showModal = false;
                    this.showRoomModal = false;
                    if (data.avatars && typeof data.avatars === 'object') {
                        this.avatarsFromServer = data.avatars;
                    }

                    if (!this.avatarsFromServer || Object.keys(this.avatarsFromServer).length === 0) {
                        this.playersLoadOnline();
                    }
                    
                    // Если мы восстанавливаем сессию, отправляем восстановленные данные
                    if (this.isRestoringSession && this.previousSession) {
                        console.log('🔄 connectWS: Обнаружено восстановление сессии, отправляем данные на roles.html');
                        // Увеличиваем задержку для гарантии подключения WebSocket
                        setTimeout(() => {
                            this.sendRestoredDataToRoles(this.previousSession);
                            this.isRestoringSession = false;
                            console.log('✅ connectWS: Восстановленные данные отправлены, флаг восстановления сброшен');
                        }, 1000);
                    }
                }
            }
        };

        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            setTimeout(() => {
                this.connectWS();
            }, 2000);
        };

        this.ws.onerror = () => {
            this.ws.close();
        };
    },    // Работа с аватарами
    async loadAvatarsFromServer() {
        if (!this.roomId) return;
        try {
            const res = await fetch(`/api/avatars-get.php?za=1&roomId=${this.roomId}`);
            
            // Проверяем, что получили JSON, а не HTML
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('⚠️ Сервер вернул не JSON ответ для аватаров:', contentType);
                return;
            }
            
            const avatars = await res.json();
            if (avatars && typeof avatars === 'object' && Object.keys(avatars).length > 0) {
                this.avatarsFromServer = avatars;
                this.$forceUpdate();
            }
        } catch (e) {
            console.warn('⚠️ Не удалось загрузить аватары:', e.message);
            // Fallback: avatars не загрузились
        }
    },

    async saveAvatarsToServer(avatarsOverride = null) {
        if (!this.roomId) return;
        let avatars = avatarsOverride;
        if (!avatars) {
            avatars = {};
            if (this.manualMode) {
                this.manualPlayers.forEach(p => {
                    if (p.login && p.avatar_link) avatars[p.login] = p.avatar_link;
                });
            } else if (this.tableOut) {
                this.tableOut.forEach(p => {
                    if (p.login && p.avatar_link) avatars[p.login] = p.avatar_link;
                });
            }        }
        if (Object.keys(avatars).length) {
            try {
                const response = await fetch('/api/avatars-save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `za=1&roomId=${encodeURIComponent(this.roomId)}&avatars=${encodeURIComponent(JSON.stringify(avatars))}`
                });
                
                if (!response.ok) {
                    console.warn('⚠️ Ошибка сохранения аватаров:', response.status, response.statusText);
                } else {
                    console.log('✅ Avatars sent to server:', avatars);
                }
            } catch (e) {
                console.warn('⚠️ Не удалось сохранить аватары:', e.message);
            }
        }
    },    // Работа с состоянием комнаты
    async saveRoomStateIncremental(data) {
        if (!this.roomId) return;
        try {
            const response = await fetch('/api/room-state.php?roomId=' + encodeURIComponent(this.roomId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                console.warn('⚠️ Ошибка сохранения состояния комнаты:', response.status, response.statusText);
            }
        } catch (e) { 
            console.error('❌ Ошибка сохранения состояния комнаты:', e.message); 
        }
    },

    async saveRoomStateAll() {
        if (!this.roomId) return;
        const state = {
            // ИСПРАВЛЕНО: НЕ сохраняем playersActions в полном состоянии
            // playersActions сохраняются только через инкрементальные обновления
            roles: this.roles,
            fouls: this.fouls,
            techFouls: this.techFouls,
            removed: this.removed,
            mainInfoText: this.mainInfoText,
            additionalInfoText: this.additionalInfoText,
            mainInfoVisible: this.mainInfoVisible,
            additionalInfoVisible: this.additionalInfoVisible,
            hideSeating: this.hideSeating,
            hideLeaveOrder: this.hideLeaveOrder,
            hideRolesStatus: this.hideRolesStatus,
            hideBestMove: this.hideBestMove,
            highlightedPlayer: this.highlightedPlayer,
            bestMove: this.bestMove,
            bestMoveSelected: this.bestMoveSelected,
            firstKilledPlayer: this.firstKilledPlayer,
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
            selectedColorScheme: this.selectedColorScheme,
            selectedBackgroundTheme: this.selectedBackgroundTheme,
            winnerTeam: this.winnerTeam,
            currentMode: this.currentMode,
            manualMode: this.manualMode,
            manualGames: this.manualGames,
            manualGameSelected: this.manualGameSelected,
            gameSelected: this.gameSelected,
            tableSelected: this.tableSelected,
            editRoles: this.editRoles,
            inputMode: this.inputMode,
            avatarsFromServer: this.avatarsFromServer,
            avatarsJustLoaded: this.avatarsJustLoaded,        };
        try {
            const response = await fetch('/api/room-state.php?roomId=' + encodeURIComponent(this.roomId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            
            if (!response.ok) {
                console.warn('⚠️ Ошибка полного сохранения состояния комнаты:', response.status, response.statusText);
            }
        } catch (e) { 
            console.error('❌ Ошибка полного сохранения состояния комнаты:', e.message); 
        }
    },

    async loadRoomState() {
        // ИЗМЕНЕНО: Загружаем состояние только при первой загрузке панели
        // Во время работы панели состояние не перезагружается из JSON
        if (!this.roomId || this.stateReceived) return;
        
        try {
            console.log(`📂 loadRoomState: Загружаем начальное состояние комнаты ${this.roomId}`);
            const resp = await fetch('/api/room-state.php?roomId=' + encodeURIComponent(this.roomId));
            if (resp.ok) {
                let state = null;
                try {
                    state = await resp.json();
                } catch (e) {
                    const text = await resp.text();
                    console.error('Ошибка парсинга JSON состояния комнаты:', text);
                    return;
                }
                
                // ИСПРАВЛЕНО: НЕ загружаем playersActions из JSON файла
                // playersActions управляются только активной панелью в реальном времени
                console.log(`🚫 loadRoomState: НЕ загружаем playersActions из JSON (управляется только активной панелью)`);

                // Применяем только безопасные поля
                if (state.roles) this.roles = state.roles;
                if (state.fouls) this.fouls = state.fouls;
                if (state.techFouls) this.techFouls = state.techFouls;
                if (state.removed) this.removed = state.removed;
                if (state.mainInfoText) this.mainInfoText = state.mainInfoText;
                if (state.additionalInfoText) this.additionalInfoText = state.additionalInfoText;
                if (state.mainInfoVisible !== undefined) this.mainInfoVisible = state.mainInfoVisible;
                if (state.additionalInfoVisible !== undefined) this.additionalInfoVisible = state.additionalInfoVisible;
                if (state.hideSeating !== undefined) this.hideSeating = state.hideSeating;
                if (state.hideLeaveOrder !== undefined) this.hideLeaveOrder = state.hideLeaveOrder;
                if (state.hideRolesStatus !== undefined) this.hideRolesStatus = state.hideRolesStatus;
                if (state.hideBestMove !== undefined) this.hideBestMove = state.hideBestMove;
                if (state.highlightedPlayer !== undefined) this.highlightedPlayer = state.highlightedPlayer;
                if (state.bestMove !== undefined) this.bestMove = state.bestMove;
                if (state.bestMoveSelected !== undefined) this.bestMoveSelected = state.bestMoveSelected;
                if (state.firstKilledPlayer !== undefined) this.firstKilledPlayer = state.firstKilledPlayer;
                if (state.nominations !== undefined) this.nominations = state.nominations;
                if (state.nominationsLocked !== undefined) this.nominationsLocked = state.nominationsLocked;
                if (state.votingOrder !== undefined) this.votingOrder = state.votingOrder;
                if (state.votingCurrentIndex !== undefined) this.votingCurrentIndex = state.votingCurrentIndex;
                if (state.votingResults !== undefined) this.votingResults = state.votingResults;
                if (state.votingVotedPlayers !== undefined) this.votingVotedPlayers = state.votingVotedPlayers;
                if (state.votingFinished !== undefined) this.votingFinished = state.votingFinished;
                if (state.votingWinners !== undefined) this.votingWinners = state.votingWinners;
                if (state.votingStage !== undefined) this.votingStage = state.votingStage;
                if (state.votingTiePlayers !== undefined) this.votingTiePlayers = state.votingTiePlayers;
                if (state.votingLiftResults !== undefined) this.votingLiftResults = state.votingLiftResults;
                if (state.votingHistory !== undefined) this.votingHistory = state.votingHistory;

                if (state.selectedColorScheme !== undefined) {
                    this.selectedColorScheme = state.selectedColorScheme;
                    this.applyColorScheme(this.selectedColorScheme);
                }
                if (state.selectedBackgroundTheme !== undefined) {
                    this.selectedBackgroundTheme = state.selectedBackgroundTheme;
                    this.applyBackgroundTheme(this.selectedBackgroundTheme);
                }
                if (state.winnerTeam !== undefined) this.winnerTeam = state.winnerTeam;
                if (state.currentMode) this.currentMode = state.currentMode;
                if (state.manualMode !== undefined) this.manualMode = state.manualMode;
                if (state.manualGames) this.manualGames = state.manualGames;
                if (state.manualGameSelected !== undefined) this.manualGameSelected = state.manualGameSelected;
                if (state.gameSelected !== undefined) this.gameSelected = state.gameSelected;
                if (state.tableSelected !== undefined) this.tableSelected = state.tableSelected;
                if (state.editRoles !== undefined) this.editRoles = state.editRoles;
                if (state.inputMode) this.inputMode = state.inputMode;
                if (state.avatarsFromServer) this.avatarsFromServer = state.avatarsFromServer;
                if (state.avatarsJustLoaded !== undefined) this.avatarsJustLoaded = state.avatarsJustLoaded;
                
                // Помечаем что состояние получено, чтобы больше не загружать из JSON
                this.stateReceived = true;
                console.log(`✅ loadRoomState: Начальное состояние загружено, больше не будем загружать из JSON`);
                
                // ПРИНУДИТЕЛЬНАЯ БЛОКИРОВКА модального окна возврата игрока
                this.showReturnPlayerModal = false;
                
                this.sendFullState();
            } else {
                const text = await resp.text();
                console.error('Ошибка загрузки состояния комнаты:', text);
            }
        } catch (e) { console.error('Ошибка загрузки состояния комнаты:', e); }
    },

    // Отправка данных в комнату через WebSocket
    sendToRoom(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    },
    
    // Отправка полного состояния приложения
    sendFullState() {
        // Дебаунсинг: отправляем полное состояние не чаще чем раз в 100мс
        if (this.sendFullStateTimer) {
            clearTimeout(this.sendFullStateTimer);
        }
        this.sendFullStateTimer = setTimeout(() => {
            this._sendFullStateNow();
        }, 100);
    },
    
    _sendFullStateNow() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const state = {
            type: "state",
            tableOut: this.tableOut,
            roles: this.roles,
            // ИСПРАВЛЕНО: НЕ отправляем playersActions через sendFullState
            // playersActions отправляются только через инкрементальные actionChange сообщения
            fouls: this.fouls,
            techFouls: this.techFouls,
            removed: this.removed,
            highlightedPlayer: this.highlightedPlayer,
            bestMove: this.bestMove,
            bestMoveSelected: this.bestMoveSelected,
            firstKilledPlayer: this.firstKilledPlayer,
            showBestMoveModal: this.showBestMoveModal,
            panelState: {
                mainInfoText: this.mainInfoText,
                additionalInfoText: this.additionalInfoText,
                mainInfoVisible: this.mainInfoVisible,
                additionalInfoVisible: this.additionalInfoVisible,
                hideSeating: this.hideSeating,
                hideLeaveOrder: this.hideLeaveOrder,
                hideRolesStatus: this.hideRolesStatus,
                hideBestMove: this.hideBestMove,
                showRoomNumber: this.showRoomNumber,
                colorScheme: this.selectedColorScheme,
                backgroundTheme: this.selectedBackgroundTheme,
                gameSelected: this.gameSelected,
                tableSelected: this.tableSelected,
                tableNumber: this.tableNumber,
                games: this.games
            },
            winnerTeam: this.winnerTeam,
            avatars: this.avatarsFromServer
        };
        
        this.sendToRoom(state);
    },

    // Применение полного состояния, полученного от сервера
    applyFullState(data) {
        if (data.tableOut !== undefined) {
            // Обновляем игроков если они пришли в данных
            if (Array.isArray(data.tableOut) && data.tableOut.length > 0) {
                // Применяем состояние игроков
                data.tableOut.forEach(player => {
                    if (player.roleKey) {
                        // Обновляем роли
                        if (player.role) {
                            this.$set(this.roles, player.roleKey, player.role);
                        }
                        // Обновляем действия
                        if (player.action) {
                            this.$set(this.playersActions, player.roleKey, player.action);
                        }
                        // Обновляем фолы
                        if (player.foul !== undefined) {
                            this.$set(this.fouls, player.roleKey, player.foul);
                        }
                        if (player.techFoul !== undefined) {
                            this.$set(this.techFouls, player.roleKey, player.techFoul);
                        }
                        if (player.removed !== undefined) {
                            this.$set(this.removed, player.roleKey, player.removed);
                        }
                    }
                });
            }
        }
        
        // Обновляем отдельные поля состояния
        if (data.roles !== undefined) this.roles = data.roles;
        
        // КРИТИЧЕСКИ ВАЖНО: НЕ применяем playersActions от других панелей!
        // Только эта панель управляет статусами игроков
        // ИСПРАВЛЕНО: ПОЛНОСТЬЮ отключена загрузка playersActions из внешних источников
        if (data.playersActions !== undefined) {
            console.log(`🚫 applyFullState: ПОЛНОСТЬЮ ИГНОРИРУЕМ playersActions (только эта панель управляет статусами)`);
        }

        if (data.fouls !== undefined) {
            this.fouls = data.fouls || {};
        }
        if (data.techFouls !== undefined) {
            this.techFouls = data.techFouls || {};
        }
        if (data.removed !== undefined) {
            this.removed = data.removed || {};
        }
        if (data.highlightedPlayer !== undefined) this.highlightedPlayer = data.highlightedPlayer;
        if (data.bestMove !== undefined) this.bestMove = data.bestMove;
        if (data.bestMoveSelected !== undefined) this.bestMoveSelected = data.bestMoveSelected;
        if (data.firstKilledPlayer !== undefined) this.firstKilledPlayer = data.firstKilledPlayer;
        if (data.showBestMoveModal !== undefined) this.showBestMoveModal = data.showBestMoveModal;
        if (data.winnerTeam !== undefined) this.winnerTeam = data.winnerTeam;
        
        // Обновляем состояние панели
        if (data.panelState !== undefined) {
            if (data.panelState.mainInfoText !== undefined) this.mainInfoText = data.panelState.mainInfoText;
            if (data.panelState.additionalInfoText !== undefined) this.additionalInfoText = data.panelState.additionalInfoText;
            if (data.panelState.mainInfoVisible !== undefined) this.mainInfoVisible = data.panelState.mainInfoVisible;
            if (data.panelState.additionalInfoVisible !== undefined) this.additionalInfoVisible = data.panelState.additionalInfoVisible;
            if (data.panelState.hideSeating !== undefined) this.hideSeating = data.panelState.hideSeating;
            if (data.panelState.hideLeaveOrder !== undefined) this.hideLeaveOrder = data.panelState.hideLeaveOrder;
            if (data.panelState.hideRolesStatus !== undefined) this.hideRolesStatus = data.panelState.hideRolesStatus;
            if (data.panelState.hideBestMove !== undefined) this.hideBestMove = data.panelState.hideBestMove;
            if (data.panelState.showRoomNumber !== undefined) this.showRoomNumber = data.panelState.showRoomNumber;
            if (data.panelState.colorScheme !== undefined) this.selectedColorScheme = data.panelState.colorScheme;
            if (data.panelState.backgroundTheme !== undefined) this.selectedBackgroundTheme = data.panelState.backgroundTheme;
            if (data.panelState.gameSelected !== undefined) this.gameSelected = data.panelState.gameSelected;
            if (data.panelState.tableSelected !== undefined) this.tableSelected = data.panelState.tableSelected;
        }
        
        // Обновляем аватары
        if (data.avatars !== undefined) this.avatarsFromServer = data.avatars;
        
        // Инициализируем таймеры после применения состояния
        this.$nextTick(() => {
            this.initializeAllTimers();
        });
        
        // ПРИНУДИТЕЛЬНАЯ БЛОКИРОВКА модального окна возврата игрока
        this.showReturnPlayerModal = false;
        
        this.$forceUpdate();
    },    // Управление комнатой
    joinRoom() {
        console.log('🚀 joinRoom: Метод вызван из app-ui-integration.js');
        console.log('🚀 joinRoom: roomInput =', this.roomInput);
        
        if (!this.roomInput || !this.roomInput.trim()) {
            console.log('❌ joinRoom: Пустой ввод комнаты');
            if (this.isTelegramApp) {
                this.tg.showAlert('Введите ID комнаты');
            } else {
                alert('Введите ID комнаты');
            }
            return;
        }

        this.roomId = this.roomInput.trim();
        
        // ВАЖНО: Сбрасываем флаг stateReceived для новой комнаты
        // чтобы можно было загрузить начальное состояние из JSON
        this.stateReceived = false;
        console.log(`🔄 joinRoom: Подключаемся к комнате ${this.roomId}, сброшен флаг stateReceived`);
        
        this.showRoomModal = false;
        
        // Сохраняем сессию при подключении к комнате
        this.saveCurrentSession();
        
        // Показываем кнопку назад в Telegram
        if (this.isTelegramApp) {
            this.tg.BackButton.show();
            this.showTelegramMainButton();
            this.sendTelegramHapticFeedback();
        }

        this.connectWS();
    },
    
    activateThisPanel() {
        // Активируем эту панель как основную
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "activatePanel", panelId: this.panelId }));
            console.log('🔧 Активируем панель:', this.panelId);
        } else {
            console.warn('⚠️ WebSocket не подключен, не можем активировать панель');
        }
    },

    // Управление режимами и темами
    setMode(mode) {
        this.currentMode = mode;
        // Синхронизируем режим с roles.html через activeInfoTab
        let activeInfoTab = null;
        if (mode === 'day') activeInfoTab = 'day';
        else if (mode === 'night') activeInfoTab = 'night';
        // Для режима 'roles' или других — null
        this.sendToRoom({
            type: "panelStateChange",
            panelState: {
                mainInfoText: this.mainInfoText,
                additionalInfoText: this.additionalInfoText,
                mainInfoVisible: this.mainInfoVisible,
                additionalInfoVisible: this.additionalInfoVisible,
                hideSeating: this.hideSeating,
                hideLeaveOrder: this.hideLeaveOrder,
                hideRolesStatus: this.hideRolesStatus,
                hideBestMove: this.hideBestMove,
                showRoomNumber: this.showRoomNumber,
                colorScheme: this.selectedColorScheme,
                backgroundTheme: this.selectedBackgroundTheme,
                activeInfoTab: activeInfoTab
            }
        });
        this.sendFullState();
    },

    applyColorScheme(schemeKey) {
        const scheme = this.colorSchemes.find(s => s.key === schemeKey) || this.colorSchemes[0];
        document.documentElement.style.setProperty('--maf-accent-color', scheme.accent);
        
        // Градиентные фоны для каждой темы (только для panel.html)
        const gradients = {
            'purple': 'linear-gradient(135deg, #1a1625 0%, #2d1b47 25%, #1f1a3a 50%, #2a1f45 75%, #1a1625 100%)',
            'blue': 'linear-gradient(135deg, #0e1a2e 0%, #1b2844 25%, #142235 50%, #1f2d47 75%, #0e1a2e 100%)',
            'green': 'linear-gradient(135deg, #0b1f14 0%, #183326 25%, #13251e 50%, #1d382b 75%, #0b1f14 100%)',
            'red': 'linear-gradient(135deg, #2b1017 0%, #4a1e28 25%, #381a21 50%, #4a2631 75%, #2b1017 100%)',
            'orange': 'linear-gradient(135deg, #2a1a0e 0%, #453218 25%, #3a2816 50%, #453a1f 75%, #2a1a0e 100%)',
            'pink': 'linear-gradient(135deg, #2b1224 0%, #4a1f41 25%, #381d34 50%, #4a2746 75%, #2b1224 100%)',
            'yellow': 'linear-gradient(135deg, #29240e 0%, #443f18 25%, #393416 50%, #44431f 75%, #29240e 100%)',
            'teal': 'linear-gradient(135deg, #0e2925 0%, #194440 25%, #163934 50%, #1f4446 75%, #0e2925 100%)',
            'gold': 'linear-gradient(135deg, #291e09 0%, #443a14 25%, #393111 50%, #443f1b 75%, #291e09 100%)',
            'silver': 'linear-gradient(135deg, #1b1d1f 0%, #34393e 25%, #292d31 50%, #393f44 75%, #1b1d1f 100%)',
            'aqua': 'linear-gradient(135deg, #092329 0%, #143f49 25%, #113439 50%, #1b444f 75%, #092329 100%)',
            'lime': 'linear-gradient(135deg, #19290e 0%, #2f4418 25%, #24391b 50%, #33441f 75%, #19290e 100%)',
            'violet': 'linear-gradient(135deg, #1e1324 0%, #342441 25%, #291d34 50%, #392746 75%, #1e1324 100%)',
            'brown': 'linear-gradient(135deg, #1e130f 0%, #39271f 25%, #2e2019 50%, #3f2f24 75%, #1e130f 100%)',
            'black': 'linear-gradient(135deg, #090909 0%, #191919 25%, #141414 50%, #1f1f1f 75%, #090909 100%)',
            'mint': 'linear-gradient(135deg, #0e2919 0%, #19442f 25%, #143729 50%, #1f443f 75%, #0e2919 100%)',
            'peach': 'linear-gradient(135deg, #291714 0%, #492f29 25%, #37251f 50%, #493731 75%, #291714 100%)',
            'sky': 'linear-gradient(135deg, #111f29 0%, #243746 25%, #192e39 50%, #243f4f 75%, #111f29 100%)',
            'rose': 'linear-gradient(135deg, #290e19 0%, #491e34 25%, #371624 50%, #49243f 75%, #290e19 100%)',
            'olive': 'linear-gradient(135deg, #19190e 0%, #322f18 25%, #272716 50%, #34341f 75%, #19190e 100%)',
            'navy': 'linear-gradient(135deg, #090e19 0%, #141f29 25%, #0f1721 50%, #19242f 75%, #090e19 100%)',
            'coral': 'linear-gradient(135deg, #29150e 0%, #492c18 25%, #372316 50%, #49341f 75%, #29150e 100%)',
            'sand': 'linear-gradient(135deg, #292319 0%, #443f39 25%, #39342f 50%, #444439 75%, #292319 100%)',
            'plum': 'linear-gradient(135deg, #1e1119 0%, #341f29 25%, #291921 50%, #39242f 75%, #1e1119 100%)',
            'ice': 'linear-gradient(135deg, #142229 0%, #243f46 25%, #193439 50%, #24444f 75%, #142229 100%)',
            'fire': 'linear-gradient(135deg, #290e09 0%, #491e14 25%, #371611 50%, #49241b 75%, #290e09 100%)',
            'forest': 'linear-gradient(135deg, #09190e 0%, #142918 25%, #112116 50%, #192f1f 75%, #09190e 100%)',
            'steel': 'linear-gradient(135deg, #14171f 0%, #242c34 25%, #1e2429 50%, #29343f 75%, #14171f 100%)',
            'ruby': 'linear-gradient(135deg, #290914 0%, #491424 25%, #37111e 50%, #49192f 75%, #290914 100%)',
            'amber': 'linear-gradient(135deg, #291e09 0%, #443414 25%, #392c11 50%, #443f1b 75%, #291e09 100%)'
        };
        
        const gradient = gradients[schemeKey] || gradients['purple'];
        document.documentElement.style.setProperty('--maf-gradient-bg', gradient);
        
        let rgb = scheme.accent;
        if (rgb.startsWith('#')) {
            let hex = rgb.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            rgb = `${r},${g},${b}`;
            
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness > 180) {
                document.body.setAttribute('data-accent-light', 'true');
                document.documentElement.style.setProperty('--maf-role-badge-text', '#222');
            } else {
                document.body.removeAttribute('data-accent-light');
                document.documentElement.style.setProperty('--maf-role-badge-text', '#fff');
            }
        }
        
        document.documentElement.style.setProperty('--maf-accent-color-rgb', rgb);
        document.documentElement.style.setProperty('--maf-panel-glow', `0 0 18px 4px rgba(${rgb},0.27), 0 0 1px 0px #31225c, 0 2px 8px #0003`);
    },

    applyBackgroundTheme(themeKey) {
        const theme = this.backgroundThemes.find(t => t.key === themeKey) || this.backgroundThemes[0];
        if (theme) {
            document.documentElement.style.setProperty('--maf-bg-main', theme.bgMain);
            document.documentElement.style.setProperty('--maf-bg-secondary', theme.bgSecondary);
            document.documentElement.style.setProperty('--maf-bg-accent', theme.bgAccent);
        }
    },

    applyColorSchemeAndSave(schemeKey) {
        this.selectedColorScheme = schemeKey;
        this.applyColorScheme(schemeKey);
        this.saveRoomStateIncremental({ selectedColorScheme: schemeKey });
        this.sendToRoom({
            type: "panelStateChange",
            panelState: {
                mainInfoText: this.mainInfoText,
                additionalInfoText: this.additionalInfoText,
                mainInfoVisible: this.mainInfoVisible,
                additionalInfoVisible: this.additionalInfoVisible,
                hideSeating: this.hideSeating,
                hideLeaveOrder: this.hideLeaveOrder,
                hideRolesStatus: this.hideRolesStatus,
                hideBestMove: this.hideBestMove,
                showRoomNumber: this.showRoomNumber,
                colorScheme: schemeKey,
                backgroundTheme: this.selectedBackgroundTheme,
                gameSelected: this.gameSelected,
                tableSelected: this.tableSelected
            }
        });
        this.sendFullState();
        this.saveCurrentSession();
    },

    applyBackgroundThemeAndSave(themeKey) {
        this.selectedBackgroundTheme = themeKey;
        this.applyBackgroundTheme(themeKey);
        this.saveRoomStateIncremental({ selectedBackgroundTheme: themeKey });
        this.sendToRoom({
            type: "panelStateChange",
            panelState: {
                mainInfoText: this.mainInfoText,
                additionalInfoText: this.additionalInfoText,
                mainInfoVisible: this.mainInfoVisible,
                additionalInfoVisible: this.additionalInfoVisible,
                hideSeating: this.hideSeating,
                hideLeaveOrder: this.hideLeaveOrder,
                hideRolesStatus: this.hideRolesStatus,
                hideBestMove: this.hideBestMove,
                showRoomNumber: this.showRoomNumber,
                colorScheme: this.selectedColorScheme,
                backgroundTheme: themeKey,
                gameSelected: this.gameSelected,
                tableSelected: this.tableSelected
            }
        });
        this.sendFullState();
        this.saveCurrentSession();
    },

    // Утилитарные функции
    removeFocus(event) {
        // Убирает фокус с элемента для предотвращения залипания hover-эффектов
        if (event.target) {
            event.target.blur();
        }
    },

    toggleHighlight(roleKey, event) {
        if (this.highlightedPlayer === roleKey) {
            this.highlightedPlayer = null;
        } else {
            this.highlightedPlayer = roleKey;
        }
        this.setHighlightedPlayer(this.highlightedPlayer);
    },

    clearPlayerStatus(roleKey) {
        this.resetPlayerStatus(roleKey, false);
    },

    setWinnerTeam(team) {
        this.winnerTeam = team;
        this.saveRoomStateIncremental({ winnerTeam: team });
        this.sendToRoom({ type: "winnerTeamChange", winnerTeam: team });
        this.sendFullState();
    },

    resetBestMove() {
        this.firstKilledPlayer = null;
        this.bestMove = [];
        this.bestMoveSelected = false;
        this.showBestMoveModal = false;
        this.saveRoomStateIncremental({
            firstKilledPlayer: null,
            bestMove: [],
            bestMoveSelected: false,
            showBestMoveModal: false
        });
        this.sendFullState();
    },

    avatarExHas(roleKey) {
        // Проверяет, есть ли кастомный аватар для игрока
        return this.playersAvatarEx && this.playersAvatarEx.has(roleKey);
    },

    resetAllState() {
        this.manualMode = false;
        this.manualGames = [];
        this.manualGameSelected = 1;
        this.tournamentId = '';
        this.inputMode = 'gomafia';
        this.stateReceived = false;
        
        // Сохраняем критические статусы 'voted' и 'killed' при очистке всей карты действий
        if (this.playersActions && Object.keys(this.playersActions).length) {
            const allEntries = Object.entries(this.playersActions);
            const criticalEntries = allEntries.filter(([_, v]) => v === 'voted' || v === 'killed');
            const removedEntries = allEntries.filter(([_, v]) => v !== 'voted' && v !== 'killed');
            
            const newPlayersActions = {};
            criticalEntries.forEach(([key, value]) => {
                newPlayersActions[key] = value;
            });
            this.playersActions = newPlayersActions;
            console.log(`🔄 resetAllState: Сохранены критические статусы для ${criticalEntries.length} игроков`);
            
            // Отправляем инкрементальные изменения для сброшенных статусов
            removedEntries.forEach(([roleKey, _]) => {
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            });
            
            // Проверяем, есть ли убитые игроки после сброса
            const killedPlayers = criticalEntries.filter(([_, v]) => v === 'killed');
            if (killedPlayers.length === 0) {
                // Если убитых игроков не осталось, полностью сбрасываем лучший ход
                this.resetBestMove();
            } else {
                // Если убитые игроки остались, но firstKilledPlayer не среди них, сбрасываем
                const killedKeys = killedPlayers.map(([key, _]) => key);
                if (this.firstKilledPlayer && !killedKeys.includes(this.firstKilledPlayer)) {
                    this.resetBestMove();
                }
            }
        } else {
            this.playersActions = {};
            this.resetBestMove();
        }
          this.highlightedPlayer = null;
        this.userEditedAdditionalInfo = false;
        this.sendFullState();
    },

    // Функция для обработки изменения выбранной игры
    onGameSelectChange(event) {
        const selectedValue = event.target.value;
        console.log('🎮 Выбрана игра:', selectedValue);
        
        if (this.manualMode) {
            // Используем существующую логику для ручного режима
            this.onManualGameSelect(event);
        } else {
            const selectedGame = Number(selectedValue);
            this.gameSelected = selectedGame;
            // При смене игры автоматически выбираем первый стол
            this.updateTableSelection();
        }
    },

    // Функция для обновления выбора стола при смене игры
    updateTableSelection() {
        if (!this.gameSelectedObject || this.gameSelectedObject.length === 0) {
            this.tableSelected = undefined;
            return;
        }
        
        // Выбираем первый доступный стол
        this.tableSelected = Number(this.gameSelectedObject[0].tableNum);
        console.log('🪑 Автоматически выбран стол:', this.tableSelected);
    },

    // Функция для обновления информационного текста
    updateInfoText() {
        if (this.manualMode) {
            return; // В ручном режиме не обновляем автоматически
        }

        if (!this.tournament || !this.tournament.props?.pageProps?.serverData?.games) {
            return;
        }

        const games = this.tournament.props.pageProps.serverData.games;
        const currentGameData = games.find(g => g.gameNum === this.gameSelected);
        
        if (!currentGameData) {
            return;
        }

        let tableCount = currentGameData.game?.length || 1;
        let gameCount = games.length || 1;
        let currentGame = this.gameSelected || 1;
        let tableNum = this.tableSelected || 1;
        let additional = "";
        
        if (tableCount > 1) {
            additional += `Номер стола: ${tableNum} | `;
        }
        additional += `Игра ${currentGame} из ${gameCount}`;
        
        this.additionalInfoText = additional;
        console.log('📝 Информационный текст обновлён:', additional);
    }
});

// Закрываем Vue приложение и добавляем computed свойства и watcher'ы
Object.assign(window.app, {
    computed: {
        // Добавляем computed свойства из оригинального файла
        buildId() {
            return this.tournament?.buildId;
        },
          tableOut() {
            const out = this.manualMode 
                ? this.manualPlayers 
                : this.tournament?.props?.pageProps?.serverData?.games
                    ?.find(g => g.gameNum === this.gameSelected)?.game
                    ?.find(t => t.tableNum === this.tableSelected)?.table
                    ?.map((p, i) => ({ ...p, num: i + 1, roleKey: `${this.gameSelected}-${this.tableSelected}-${i + 1}` }))
                    ?.filter(Boolean) || [];

            // Добавим статусы для дневных инструментов
            const result = out.map((p, i) => {
                // Дополнительная проверка на корректность данных игрока
                if (!p || !p.roleKey) {
                    console.warn('Игрок без roleKey:', p, 'индекс:', i);
                    return null;
                }
                
                const roleKey = p.roleKey;
                
                // Получаем аватар игрока (как в oldapp.js)
                const pd = this.playersData.get(p.login);
                const pdo = this.playersDataOnline.get(p.login);
                let avatarCss = '';
                let avatarLink = this.playersAvatarEx.get(this.gameSelected + '-' + p.id) || pdo?.avatar_link || pd?.avatar || this.avatarsFromServer?.[p.login];
                if (avatarLink) {
                    avatarCss = `url("${avatarLink}")`;
                }
                
                const playerData = {
                    ...p,
                    avatarCss,
                    avatar_link: avatarLink,
                    foul: (this.fouls && typeof this.fouls[roleKey] !== 'undefined') ? this.fouls[roleKey] : 0,
                    techFoul: (this.techFouls && typeof this.techFouls[roleKey] !== 'undefined') ? this.techFouls[roleKey] : 0,
                    removed: !!(this.removed && this.removed[roleKey]),
                };
                
                return playerData;
            }).filter(Boolean); // Убираем null значения            
            return result;
        },
        
        shouldShowFinishButton() {
            if (!this.votingFinished) return false;
            
            // Main голосование: все проголосовали и есть победитель
            if (this.votingStage === 'main' && this.votingWinners && this.votingWinners.length > 0) {
                const alivePlayers = this.tableOut
                    .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                    .filter(p => this.isPlayerActive(p.roleKey))
                    .map(p => p.num);
                const votedNumbers = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                return votedNumbers.length >= alivePlayers.length;
            }
            
            // Tie голосование: все проголосовали и есть победитель
            if (this.votingStage === 'tie' && this.votingWinners && this.votingWinners.length > 0) {
                const alivePlayers = this.tableOut
                    .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                    .filter(p => this.isPlayerActive(p.roleKey))
                    .map(p => p.num);
                const votedNumbers = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                return votedNumbers.length >= alivePlayers.length;
            }
              // Lift голосование: завершено
            if (this.votingStage === 'lift') {
                return true;
            }            return false;
        }
    },watch: {        // Отслеживаем изменение выбранной игры
        gameSelected(newGameNum, oldGameNum) {
            if (newGameNum !== oldGameNum && newGameNum !== undefined) {
                console.log('🔄 Игра изменена с', oldGameNum, 'на', newGameNum);
                  // Обновляем выбор стола
                this.updateTableSelection();
                
                // Обновляем информационный текст
                this.updateInfoText();
                  // Сохраняем состояние сессии
                this.saveCurrentSession();
            }
        },

        // Отслеживаем изменение выбранного стола
        tableSelected(newTableNum, oldTableNum) {
            if (newTableNum !== oldTableNum && newTableNum !== undefined) {                console.log('🪑 Стол изменён с', oldTableNum, 'на', newTableNum);
                
                // Обновляем информационный текст
                this.updateInfoText();
                  // Сохраняем состояние сессии
                this.saveCurrentSession();
            }
        },

        // Следим за модальными окнами для управления кнопкой назад в Telegram
        showRoomModal(newVal) {
            if (this.isTelegramApp && this.tg) {
                if (newVal) {
                    this.tg.BackButton.hide();
                    this.hideTelegramMainButton();
                } else {
                    this.tg.BackButton.show();
                    this.showTelegramMainButton();
                }
            }
        },
        showModal(newVal) {
            if (this.isTelegramApp && this.tg) {
                if (newVal) {
                    this.tg.BackButton.show();
                } else if (!this.showRoomModal) {
                    this.tg.BackButton.show();
                }
            }        },
        showBestMoveModal(newVal) {
            if (this.isTelegramApp && this.tg && newVal) {
                this.tg.BackButton.show();
            }
        },
        showSettingsModal(newVal) {
            if (this.isTelegramApp && this.tg && newVal) {
                this.tg.BackButton.show();
            }
        },
        showThemeModal(newVal) {
            if (this.isTelegramApp && this.tg && newVal) {
                this.tg.BackButton.show();
            }
        },
        // ПРИНУДИТЕЛЬНАЯ БЛОКИРОВКА модального окна возврата игрока
        showReturnPlayerModal(newVal) {
            if (newVal === true) {
                console.log('🚫 Попытка показать модальное окно возврата игрока заблокирована');
                this.$nextTick(() => {
                    this.showReturnPlayerModal = false;
                });
            }
        }
    }
});

// Добавляем computed свойства в глобальное хранилище для последующего обновления
window.app = window.app || {};
if (!window.app.computed) window.app.computed = {};

// Принудительно добавляем computed свойства
Object.assign(window.app.computed, {
    buildId() {
        return this.tournament?.buildId;
    },
    
    gameSelectedObject() {
        // Получаем массив столов для выбранной игры
        if (!this.tournament || this.manualMode) {
            return [];
        }
        
        const games = this.tournament?.props?.pageProps?.serverData?.games;
        if (!games || !this.gameSelected) {
            return [];
        }
        
        const selectedGame = games.find(g => g.gameNum === this.gameSelected);
        return selectedGame?.game || [];
    },
    
    games() {
        // Получаем все игры турнира
        if (this.manualMode) {
            return this.manualGames || [];
        }
        
        return this.tournament?.props?.pageProps?.serverData?.games || [];
    },
      tableOut() {
        const out = this.manualMode 
            ? this.manualPlayers 
            : this.tournament?.props?.pageProps?.serverData?.games
                ?.find(g => g.gameNum === this.gameSelected)?.game
                ?.find(t => t.tableNum === this.tableSelected)?.table
                ?.map((p, i) => ({ ...p, num: i + 1, roleKey: `${this.gameSelected}-${this.tableSelected}-${i + 1}` }))
                ?.filter(Boolean) || [];

        // Добавим статусы для дневных инструментов
        const result = out.map((p, i) => {
            // Дополнительная проверка на корректность данных игрока
            if (!p || !p.roleKey) {
                return null;
            }
            
            const roleKey = p.roleKey;
            
            // Получаем аватар игрока (как в oldapp.js)
            const pd = this.playersData.get(p.login);
            const pdo = this.playersDataOnline.get(p.login);
            let avatarCss = '';
            let avatarLink = this.playersAvatarEx.get(this.gameSelected + '-' + p.id) || pdo?.avatar_link || pd?.avatar || this.avatarsFromServer?.[p.login];
            if (avatarLink) {
                avatarCss = `url("${avatarLink}")`;
            }
            
            return {
                ...p,
                num: i + 1,
                roleKey: p.roleKey,
                avatarCss,
                avatar_link: avatarLink,
                role: this.roles[p.roleKey] || null,
                action: this.playersActions[p.roleKey] || null,
                fouls: this.fouls[p.roleKey] || 0,
                techFouls: this.techFouls[p.roleKey] || 0,
                removed: this.removed[p.roleKey] || false,
                isFirstKilled: p.roleKey === this.firstKilledPlayer,
                isHighlighted: p.roleKey === this.highlightedPlayer
            };
        }).filter(Boolean);
        
        return result;
    },
    tournamentName() {
        return this.tournament?.props?.pageProps?.serverData?.name || '';
    },
    
    manualPlayers() {
        const game = this.manualGames.find(g => g.num === this.manualGameSelected);
        return game?.players || [];
    },
    
    firstGamePlayers() {
        const game = this.manualGames.find(g => g.num === 1);        return game?.players || [];
    },
    
    // Сохранение состояния панели
    panelStateChanged() {
        try {
            const panelState = {
                mainInfoVisible: this.mainInfoVisible,                additionalInfoVisible: this.additionalInfoVisible,
                hideSeating: this.hideSeating,
                hideLeaveOrder: this.hideLeaveOrder,
                hideRolesStatus: this.hideRolesStatus,
                hideBestMove: this.hideBestMove,
                showRoomNumber: this.showRoomNumber
            };
            
            localStorage.setItem('maf-panel-settings', JSON.stringify(panelState));
            console.log('💾 Настройки панели сохранены:', panelState);
        } catch (error) {
            console.error('❌ Ошибка сохранения настроек панели:', error);
        }
    }
});

console.log('✅ app-ui-integration.js загружен, методы добавлены в window.app.methods');
console.log('🔧 joinRoom метод:', typeof window.app.methods.joinRoom);
console.log('🔧 computed свойства добавлены:', Object.keys(window.app.computed));

// Принудительно обновляем методы в Vue экземпляре
if (window.app && window.app.$options) {
    console.log('🔄 Принудительно обновляем joinRoom в Vue экземпляре...');
    window.app.joinRoom = window.app.methods.joinRoom.bind(window.app);
    console.log('✅ joinRoom обновлён в Vue экземпляре:', typeof window.app.joinRoom);
}
