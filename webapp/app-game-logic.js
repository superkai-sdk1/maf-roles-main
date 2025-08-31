// =====================================================
// Основные игровые методы и логика
// Часть 4 из 5: app-game-logic.js
// =====================================================

console.log('📦 Загружается app-game-logic.js...');

// Расширяем Vue приложение основными игровыми методами
window.app = window.app || {};
if (!window.app.methods) window.app.methods = {};

// Принудительно добавляем основные игровые методы
Object.assign(window.app.methods, {
    // Загрузка турнира
    loadTournament() {
        if (!this.tournamentId) {
            this.showAlert('Введите номер турнира');
            return;
        }
        
        console.log('🔄 Начинаем загрузку турнира:', this.tournamentId);
        
        goMafia.getTournament(this.tournamentId).then(value => {
            console.log('🏆 Данные турнира получены:', value);
            
            if (!value) {
                console.error('❌ Турнир не найден или ошибка загрузки');
                this.showAlert('Турнир не найден. Проверьте ID турнира.');
                return;
            }
            
            console.log('📊 Структура данных турнира:', {
                hasProps: !!value.props,
                hasPageProps: !!value.props?.pageProps,
                hasServerData: !!value.props?.pageProps?.serverData,
                tournamentName: value.props?.pageProps?.serverData?.name
            });
            
            if (value && value.props && value.props.pageProps && value.props.pageProps.serverData) {
                this.manualMode = false;
                this.tournament = value;
                const games = value?.props?.pageProps?.serverData?.games;
                
                console.log('🎮 Игры в турнире:', games);
                console.log('📈 Количество игр:', games?.length || 0);
                
                if (games && games.length > 0) {
                    console.log('🎯 Первая игра:', games[0]);
                    
                    // При восстановлении сессии не переопределяем выбранную игру и стол
                    if (!this.isRestoringSession) {
                        this.gameSelected = Number(games[0].gameNum);
                        const tables = games[0].game;
                        console.log('🪑 Столы в первой игре:', tables);
                        
                        if (tables && tables.length > 0) {
                            this.tableSelected = Number(tables[0].tableNum);
                            console.log('✅ Выбрана игра:', this.gameSelected, 'стол:', this.tableSelected);
                        } else {
                            this.tableSelected = undefined;
                            console.warn('⚠️ Нет столов в первой игре');
                        }
                    } else {
                        console.log('🔄 loadTournament: Восстановление сессии - сохраняем gameSelected:', this.gameSelected, 'tableSelected:', this.tableSelected);
                    }
                } else {
                    console.error('❌ В турнире нет доступных игр');
                    this.gameSelected = undefined;
                    this.tableSelected = undefined;                    this.showAlert('В турнире нет доступных игр');
                    return;                }

                this.showModal = false;
                this.editRoles = true;
                
                // При восстановлении сессии не сбрасываем лучший ход
                if (!this.isRestoringSession) {
                    this.resetBestMove();
                }
                
                // Обновляем информационные тексты только если не восстанавливаем сессию
                if (!this.isRestoringSession) {
                    this.mainInfoText = this.tournamentName || "Название турнира";
                    let tableCount = games && games[0]?.game?.length || 1;
                    let gameCount = games?.length || 1;
                    let currentGame = this.gameSelected || 1;
                    let tableNum = this.tableSelected || 1;
                    let additional = "";
                    if (tableCount > 1) {
                        additional += `Номер стола: ${tableNum} | `;
                    }
                    additional += `Игра ${currentGame} из ${gameCount}`;
                    this.additionalInfoText = additional;
                } else {
                    console.log('🔄 loadTournament: Восстановление сессии - сохраняем информационные тексты');
                }

                // Отправляем состояние только если WebSocket подключен и метод доступен
                if (this.sendFullState && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.sendFullState();
                }
                
                // Сохраняем сессию после успешной загрузки турнира
                this.saveCurrentSession();
                
                // Если мы восстанавливаем сессию, подключаемся к WebSocket для отправки данных
                if (this.isRestoringSession && this.roomId) {
                    console.log('🔄 loadTournament: Турнир загружен при восстановлении сессии, подключаемся к WebSocket');
                    this.connectWS();
                }                  console.log('✅ Турнир успешно загружен');
                
                // Автоматически загружаем аватары игроков после загрузки турнира
                console.log('🔄 Автоматическая загрузка аватаров игроков...');
                this.playersLoad();
                
                // Принудительно обновляем Vue для отображения данных
                this.$forceUpdate();
                this.$nextTick(() => {
                    console.log('🔄 Vue обновлён, проверяем tableOut:', this.tableOut?.length || 0, 'игроков');
                });
            } else {
                console.error('❌ Неверная структура данных турнира');
                console.log('Полученные данные:', value);
                this.showAlert('Не удалось загрузить турнир. Неверная структура данных.');
            }
        }).catch(error => {
            console.error('❌ Ошибка загрузки турнира:', error);
            this.showAlert('Ошибка при загрузке турнира: ' + error.message);
        });
    },    // Загрузка данных игроков
    playersLoad() {
        const playersLogin = this.tournament?.props?.pageProps?.serverData?.games[0]?.game?.map(g => g.table).flat(2).map(p => p.login);
        if (playersLogin?.length) {
            goMafia.playersGet(playersLogin)
                .then(value => {
                    if (value && Array.isArray(value)) {
                        value.forEach(p => this.playersData.set(p.login, p));
                        console.log('✅ Данные игроков загружены:', value.length, 'игроков');
                        return value;
                    } else {
                        console.warn('⚠️ playersLoad: Не удалось загрузить данные игроков (сервер вернул некорректный ответ)');
                        return [];
                    }
                })
                .catch(error => {
                    console.error('❌ playersLoad: Ошибка загрузки данных игроков:', error);
                });
        }
    },    async playersLoadOnline() {
        console.log('🔄 playersLoadOnline: Начинаем загрузку аватарок...');
        
        let playersId = this.tournament?.props?.pageProps?.serverData?.games[0]?.game?.map(g => g.table).flat(2).map(p => p.id);
        playersId = playersId?.filter(i => !!i);
        let buildId = this.buildId;
        
        console.log('🔍 playersLoadOnline: playersId:', playersId);
        console.log('🔍 playersLoadOnline: buildId:', buildId);
        
        if (playersId?.length && buildId) {
            console.log('✅ playersLoadOnline: Условия выполнены, загружаем данные пользователей...');
            goMafia.getUsersData(buildId, playersId)                .then(value => {
                    console.log('📦 playersLoadOnline: Получены сырые данные от getUsersData:', value);
                    
                    const processedValue = value
                        .map(i => i?.user)
                        .filter(i => !!i)
                        .reduce((m, current) => m.set(current.login, current), new Map());
                    
                    console.log('🔄 playersLoadOnline: Обработанные данные пользователей:', processedValue);
                    return processedValue;
                })
                .then(async value => {
                    this.playersDataOnline = value;
                    console.log('💾 playersLoadOnline: Сохранены playersDataOnline:', this.playersDataOnline);
                    
                    const avatars = {};
                    this.playersDataOnline.forEach((v, k) => {
                        console.log(`🖼️ playersLoadOnline: Проверяем аватар для ${k}:`, v.avatar_link);
                        if (v.avatar_link) avatars[k] = v.avatar_link;
                    });
                    
                    console.log('🎭 playersLoadOnline: Собранные аватары:', avatars);
                    
                    await this.saveAvatarsToServer(avatars);
                    this.avatarsFromServer = avatars;
                    this.$forceUpdate();
                    console.log('✅ Avatars loaded from gomafia:', avatars);
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.sendFullState();
                    }
                })
                .catch(error => {
                    console.error('❌ playersLoadOnline: Ошибка загрузки аватаров:', error);
                });
        } else {
            console.warn('⚠️ playersLoadOnline: Не удалось загрузить аватарки');
            console.warn('⚠️ playersId length:', playersId?.length);
            console.warn('⚠️ buildId:', buildId);
            console.warn('⚠️ tournament:', this.tournament);
        }
    },

    // Работа с ролями игроков
    roleSet(roleKey, type) {
        const r = this.roles[roleKey];
        if (r === type) {
            this.$delete(this.roles, roleKey);
        } else {
            const lastTypesKey = Object.entries(this.roles)
                .filter(([k, v]) => v === type && k !== roleKey)
                .map(([k]) => k);
            switch (type) {
                case 'don':
                case 'sheriff': {
                    lastTypesKey.forEach(k => this.$delete(this.roles, k));
                    break;
                }
                case 'black': {
                    if (lastTypesKey.length >= 2) {
                        this.$delete(this.roles, lastTypesKey[0]);
                    }
                    break;
                }
            }
            this.$set(this.roles, roleKey, type);
        }

        this.roles = { ...this.roles };
        this.sendToRoom({ type: "roleChange", roleKey, role: this.roles[roleKey] || null });
        this.sendFullState();
        
        // Сохраняем сессию при изменении ролей
        this.saveCurrentSession();
    },

    setRole(roleKey, role) {
        this.$set(this.roles, roleKey, role);
        this.saveRoomStateIncremental({ roles: this.roles });
        this.sendFullState();
        this.sendTelegramHapticFeedback('light');
        
        // Сохраняем сессию при изменении ролей
        this.saveCurrentSession();
    },

    // Работа со статусами игроков
    isPlayerActive(roleKey) {
        const action = this.playersActions[roleKey];
        // Игрок неактивен если он убит, заголосован, удален или удален по нарушениям
        return !action || !['killed', 'voted', 'removed', 'tech_fall_removed', 'fall_removed'].includes(action);
    },

    actionSet(roleKey, action, options = {}) {
        console.log(`🎯 actionSet: игрок ${roleKey}, действие ${action}, текущее действие ${this.playersActions[roleKey]}`);
        
        const lastAction = this.playersActions[roleKey];
        
        // Простое переключение статуса: если статус уже есть - убираем, если нет - ставим
        if (lastAction === action) {
            console.log(`🔄 actionSet: Сбрасываем действие ${action} для игрока ${roleKey}`);
            this.$delete(this.playersActions, roleKey);
            
            // Если снимаем статус 'killed', проверяем логику лучшего хода
            if (action === 'killed') {
                const remainingKilledCount = Object.values(this.playersActions).filter(a => a === 'killed').length;
                
                // Если больше нет убитых игроков, сбрасываем лучший ход
                if (remainingKilledCount === 0) {
                    this.resetBestMove();
                }
                // Если снимаемый игрок был первым убитым, сбрасываем лучший ход
                else if (this.firstKilledPlayer === roleKey) {
                    this.resetBestMove();
                }
            }
        } else {
            console.log(`✅ actionSet: Устанавливаем действие ${action} для игрока ${roleKey}`);
            this.$set(this.playersActions, roleKey, action);
            
            // Логика для показа модального окна "Лучший ход" при первом убийстве
            if (action === 'killed') {
                // Проверяем, есть ли уже убитые игроки (исключая текущего)
                const otherKilledPlayers = Object.entries(this.playersActions)
                    .filter(([key, value]) => key !== roleKey && value === 'killed');
                
                // Если это первое убийство в игре и лучший ход еще не был подтвержден и модальное окно еще не показано
                if (otherKilledPlayers.length === 0 && !this.bestMoveSelected && !this.showBestMoveModal) {
                    console.log(`🎯 Первое убийство! Игрок ${roleKey} установлен как firstKilledPlayer`);
                    this.firstKilledPlayer = roleKey;
                    this.showBestMoveModal = true;
                    this.bestMoveSelected = false;
                    this.bestMove = [];
                    
                    // Сохраняем состояние лучшего хода
                    this.saveRoomStateIncremental({
                        firstKilledPlayer: roleKey,
                        showBestMoveModal: true,
                        bestMoveSelected: false,
                        bestMove: []
                    });
                }
            }
        }
        
        // Если устанавливается статус 'removed', также обновляем поле removed
        if (action === 'removed') {
            this.$set(this.removed, roleKey, true);
        }
        
        // Сохраняем состояние
        this.saveRoomStateIncremental({ 
            playersActions: this.playersActions,
            removed: this.removed
        });
        
        // Отправляем изменение
        const currentAction = this.playersActions[roleKey] || null;
        console.log(`📡 actionSet: Отправляем actionChange для игрока ${roleKey}, действие ${currentAction}`);
        
        this.sendToRoom({ 
            type: "actionChange", 
            roleKey, 
            action: currentAction
        });
        
        this.sendFullState();
    },

    async setStatus(roleKey, status) {
        console.log(`🎯 setStatus: игрок ${roleKey}, новый статус ${status}, текущий статус ${this.playersActions[roleKey]}`);
        
        // Проверяем если статус не меняется
        if (this.playersActions[roleKey] === status) {
            return;
        }
        
        // ЗАЩИТА: НЕ сбрасываем статусы 'killed' и 'voted'
        const currentStatus = this.playersActions[roleKey];
        if ((currentStatus === 'killed' || currentStatus === 'voted') && (status === null || status === undefined)) {
            console.log(`🛡️ Защита: НЕ сбрасываем статус '${currentStatus}' для игрока ${roleKey}`);
            return;
        }
        
        // Устанавливаем новый статус
        if (status === null || status === undefined) {
            console.log(`🗑️ setStatus: Удаляем статус для игрока ${roleKey}`);
            this.$delete(this.playersActions, roleKey);
        } else {
            console.log(`✅ setStatus: Устанавливаем статус ${status} для игрока ${roleKey}`);
            this.$set(this.playersActions, roleKey, status);
        }
        
        this.saveRoomStateIncremental({ playersActions: this.playersActions });
        this.sendToRoom({ type: "actionChange", roleKey, action: status });
        this.sendFullState();
        
        // Сохраняем сессию при изменении статуса игрока
        this.saveCurrentSession();
        
        // Тактильная обратная связь для важных действий
        if (status === 'killed' || status === 'voted') {
            this.sendTelegramHapticFeedback('heavy');
        } else if (status) {
            this.sendTelegramHapticFeedback('medium');
        } else {
            this.sendTelegramHapticFeedback('light');
        }
    },

    // Работа с фолами и нарушениями
    setFoul(roleKey, value) {
        if (!this.fouls) this.fouls = {};
        this.$set(this.fouls, roleKey, value);
        this.saveRoomStateIncremental({ fouls: this.fouls });
        this.sendFullState();
    },

    setTechFoul(roleKey, value) {
        if (!this.techFouls) this.techFouls = {};
        this.$set(this.techFouls, roleKey, value);
        this.saveRoomStateIncremental({ techFouls: this.techFouls });
        this.sendFullState();
    },

    setRemoved(roleKey, value) {
        if (!this.removed) this.removed = {};
        if (!this.playersActions) this.playersActions = {};
        this.$set(this.removed, roleKey, value);
        if (value === true || value === 'removed') {
            this.setStatus(roleKey, 'removed');
        } else if (value === 'fall_removed') {
            this.setStatus(roleKey, 'fall_removed');
        } else if (value === 'tech_fall_removed') {
            this.setStatus(roleKey, 'tech_fall_removed');
        } else {
            // value === false или сброс
            // ЗАЩИТА: НЕ сбрасываем статусы 'killed' и 'voted'
            const currentStatus = this.playersActions[roleKey];
            if (currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.setStatus(roleKey, null);
            }
        }
        this.saveRoomStateIncremental({ removed: this.removed });
        this.sendFullState();
    },

    // Работа с лучшим ходом
    confirmBestMove() {
        this.bestMoveSelected = true;
        this.showBestMoveModal = false;
        
        this.saveRoomStateIncremental({
            bestMoveSelected: true,
            showBestMoveModal: false
        });
        
        this.sendToRoom({
            type: "bestMoveConfirm",
            bestMove: [...this.bestMove],
            firstKilledPlayer: this.firstKilledPlayer
        });
        this.sendFullState();
    },

    closeBestMoveModal() {
        this.showBestMoveModal = false;
        this.saveRoomStateIncremental({
            showBestMoveModal: false
        });
        this.sendFullState();
    },

    openBestMoveModal() {
        // Можно открыть модальное окно только если есть убитые игроки и лучший ход еще не подтвержден
        const killedPlayers = Object.values(this.playersActions).filter(a => a === 'killed');
        if (killedPlayers.length > 0 && !this.bestMoveSelected) {
            this.showBestMoveModal = true;
            this.saveRoomStateIncremental({
                showBestMoveModal: true
            });
            this.sendFullState();
        }
    },

    setBestMove(bestMoveArr) {
        this.bestMove = bestMoveArr;
        this.saveRoomStateIncremental({ bestMove: bestMoveArr });
        this.sendFullState();
        
        // Сохраняем сессию при изменении лучшего хода
        this.saveCurrentSession();
    },

    setBestMoveSelected(val) {
        this.bestMoveSelected = val;
        this.saveRoomStateIncremental({ bestMoveSelected: val });
        this.sendFullState();
        
        // Сохраняем сессию при выборе лучшего хода
        this.saveCurrentSession();
    },

    toggleBestMove(playerNumber) {
        // Функция для добавления/удаления игрока из списка лучшего хода
        const index = this.bestMove.indexOf(playerNumber);
        if (index === -1) {
            // Добавляем игрока, если его нет в списке (максимум 3 игрока)
            if (this.bestMove.length < 3) {
                this.bestMove.push(playerNumber);
                this.bestMove.sort((a, b) => a - b); // Сортируем по возрастанию
            }
        } else {
            // Удаляем игрока из списка
            this.bestMove.splice(index, 1);
        }
        
        // Отправляем изменения лучшего хода
        this.sendToRoom({
            type: "bestMoveChange",
            bestMove: [...this.bestMove],
            firstKilledPlayer: this.firstKilledPlayer
        });
        
        this.saveRoomStateIncremental({ bestMove: this.bestMove });
        this.sendFullState();
        
        // Сохраняем сессию при изменении лучшего хода
        this.saveCurrentSession();
    },

    // Инициализация таймеров
    initializeAllTimers() {
        // Инициализируем таймеры для всех игроков в таблице
        if (this.tableOut && this.initTimer) {
            this.tableOut.forEach(player => {
                const fouls = this.fouls[player.roleKey] || 0;
                this.initTimer(player.roleKey, fouls);
            });
        }
    },

    handleTimerStart(playerKey) {
        console.log('handleTimerStart called for player:', playerKey);
        
        // Проверяем, доступны ли методы таймера
        if (!this.getTimerDisplay || !this.startPlayerTimer || !this.resumePlayerTimer) {
            console.error('Timer methods not available');
            return;
        }
        
        const timerDisplay = this.getTimerDisplay(playerKey);
        console.log('Timer display for player:', playerKey, timerDisplay);
        
        if (timerDisplay.isPaused) {
            console.log('Resuming timer for player:', playerKey);
            this.resumePlayerTimer(playerKey);
        } else {
            console.log('Starting timer for player:', playerKey);
            this.startPlayerTimer(playerKey);
        }
    },

    // Настройки отображения
    setMainInfoText(text) {
        this.mainInfoText = text;
        this.saveRoomStateIncremental({ mainInfoText: text });
        this.sendFullState();
    },

    setAdditionalInfoText(text) {
        this.additionalInfoText = text;
        this.saveRoomStateIncremental({ additionalInfoText: text });
        this.sendFullState();
    },

    setMainInfoVisible(val) {
        this.mainInfoVisible = val;
        this.saveRoomStateIncremental({ mainInfoVisible: val });
        this.sendFullState();
    },

    setAdditionalInfoVisible(val) {
        this.additionalInfoVisible = val;
        this.saveRoomStateIncremental({ additionalInfoVisible: val });
        this.sendFullState();
    },

    setHideSeating(val) {
        this.hideSeating = val;
        this.saveRoomStateIncremental({ hideSeating: val });
        this.sendFullState();
    },

    setHideLeaveOrder(val) {
        this.hideLeaveOrder = val;
        this.saveRoomStateIncremental({ hideLeaveOrder: val });
        this.sendFullState();
    },

    setHideRolesStatus(val) {
        this.hideRolesStatus = val;
        this.saveRoomStateIncremental({ hideRolesStatus: val });
        this.sendFullState();
    },

    setHideBestMove(val) {
        this.hideBestMove = val;
        this.saveRoomStateIncremental({ hideBestMove: val });
        this.sendFullState();
    },

    setHighlightedPlayer(val) {
        this.highlightedPlayer = val;
        
        // Инициализируем таймер для выбранного игрока
        if (val && this.initTimer) {
            const fouls = this.fouls[val] || 0;
            this.initTimer(val, fouls);
        }
        
        this.saveRoomStateIncremental({ highlightedPlayer: val });
        this.sendFullState();
    },

    // Работа с фолами и нарушениями (продолжение)
    toggleFoul(roleKey) {
        // Защита от undefined объектов
        if (!this.fouls) this.fouls = {};
        if (!this.techFouls) this.techFouls = {};
        if (!this.removed) this.removed = {};
        if (!this.playersActions) this.playersActions = {};
        
        let val = this.fouls[roleKey] || 0;
        if (this.removed[roleKey]) {
            this.$set(this.fouls, roleKey, 0);
            this.$set(this.techFouls, roleKey, 0);
            this.$set(this.removed, roleKey, false);
            // ЗАЩИТА: НЕ сбрасываем критические статусы 'killed' и 'voted'
            const currentStatus = this.playersActions[roleKey];
            if (["killed","removed","tech_fall_removed","fall_removed"].includes(currentStatus) && 
                currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.$delete(this.playersActions, roleKey);
            }
            this.saveRoomStateIncremental({
                fouls: this.fouls,
                techFouls: this.techFouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "removeChange", roleKey, value: false });
            // ЗАЩИТА: НЕ отправляем actionChange с null для критических статусов
            if (currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
            
            // Обновляем таймер при сбросе фолов
            if (this.updateTimerFouls) {
                this.updateTimerFouls(roleKey, 0);
            }
            
            this.sendFullState();
            this.$forceUpdate();
            return;
        }
        val = (val + 1) % 5;
        this.$set(this.fouls, roleKey, val);
        if (val === 4) {
            this.setRemoved(roleKey, 'fall_removed');
            // НЕ устанавливаем прямо через playersActions.set - это делает setRemoved
            // --- синхронизация ---
            this.saveRoomStateIncremental({
                fouls: this.fouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "foulChange", roleKey, value: val });
            this.sendToRoom({ type: "removeChange", roleKey, value: 'fall_removed' });
            this.sendToRoom({ type: "actionChange", roleKey, action: 'fall_removed' });
            this.sendFullState();
            this.$forceUpdate();
            return;
        } else if (["removed","fall_removed"].includes(this.removed[roleKey]) && val < 4) {
            this.setRemoved(roleKey, false);
            // Удаляем только если это действительно 'fall_removed', а не критический статус
            const currentStatus = this.playersActions[roleKey];
            if (currentStatus === 'fall_removed') {
                this.$delete(this.playersActions, roleKey);
            }
        }
        
        this.saveRoomStateIncremental({
            fouls: this.fouls,
            removed: this.removed,
            playersActions: this.playersActions
        });
        this.sendToRoom({ type: "foulChange", roleKey, value: val });
        this.sendToRoom({ type: "removeChange", roleKey, value: this.removed[roleKey] });
        this.sendToRoom({ type: "actionChange", roleKey, action: this.playersActions[roleKey] || null });
        
        // Обновляем таймер при изменении фолов
        if (this.updateTimerFouls) {
            this.updateTimerFouls(roleKey, val);
        }
        
        this.sendFullState();
        this.$forceUpdate();
        
        // Сохраняем сессию при изменении фолов
        this.saveCurrentSession();
    },

    toggleTechFoul(roleKey) {
        // Защита от undefined объектов
        if (!this.fouls) this.fouls = {};
        if (!this.techFouls) this.techFouls = {};
        if (!this.removed) this.removed = {};
        if (!this.playersActions) this.playersActions = {};
        
        let val = this.techFouls[roleKey] || 0;
        if (this.removed[roleKey]) {
            this.$set(this.fouls, roleKey, 0);
            this.$set(this.techFouls, roleKey, 0);
            this.$set(this.removed, roleKey, false);
            // ЗАЩИТА: НЕ сбрасываем критические статусы 'killed' и 'voted'
            const currentStatus = this.playersActions[roleKey];
            if (["killed","removed","tech_fall_removed","fall_removed"].includes(currentStatus) && 
                currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.$delete(this.playersActions, roleKey);
            }
            this.saveRoomStateIncremental({
                fouls: this.fouls,
                techFouls: this.techFouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "removeChange", roleKey, value: false });
            // ЗАЩИТА: НЕ отправляем actionChange с null для критических статусов
            if (currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
            this.sendFullState();
            this.$forceUpdate();
            return;
        }
        val = (val + 1) % 3;
        this.$set(this.techFouls, roleKey, val);
        if (val === 2) {
            this.setRemoved(roleKey, 'tech_fall_removed');
            // НЕ устанавливаем прямо через playersActions.set - это делает setRemoved
            // --- синхронизация ---
            this.saveRoomStateIncremental({
                techFouls: this.techFouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: val });
            this.sendToRoom({ type: "removeChange", roleKey, value: 'tech_fall_removed' });
            this.sendToRoom({ type: "actionChange", roleKey, action: 'tech_fall_removed' });
            this.sendFullState();
            this.$forceUpdate();
            return;
        } else if (["removed","tech_fall_removed"].includes(this.removed[roleKey]) && val < 2) {
            this.setRemoved(roleKey, false);
            // Удаляем только если это действительно 'tech_fall_removed', а не критический статус
            const currentStatus = this.playersActions[roleKey];
            if (currentStatus === 'tech_fall_removed') {
                this.$delete(this.playersActions, roleKey);
            }
        }
        this.saveRoomStateIncremental({
            techFouls: this.techFouls,
            removed: this.removed,
            playersActions: this.playersActions
        });
        this.sendToRoom({ type: "techFoulChange", roleKey, value: val });
        this.sendToRoom({ type: "removeChange", roleKey, value: this.removed[roleKey] });
        this.sendToRoom({ type: "actionChange", roleKey, action: this.playersActions[roleKey] || null });
        this.sendFullState();
        this.$forceUpdate();
        
        // Сохраняем сессию при изменении техфолов
        this.saveCurrentSession();
    },

    toggleRemove(roleKey) {
        // Защита от undefined объектов
        if (!this.fouls) this.fouls = {};
        if (!this.techFouls) this.techFouls = {};
        if (!this.removed) this.removed = {};
        if (!this.playersActions) this.playersActions = {};
        
        const isRemoved = !!this.removed[roleKey];
        if (isRemoved) {
            // Сброс всех статусов при снятии удаления
            this.$set(this.fouls, roleKey, 0);
            this.$set(this.techFouls, roleKey, 0);
            this.$set(this.removed, roleKey, false);
            // ЗАЩИТА: НЕ сбрасываем критические статусы 'killed' и 'voted'
            const currentStatus = this.playersActions[roleKey];
            if (["killed","removed","tech_fall_removed","fall_removed"].includes(currentStatus) && 
                currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.$delete(this.playersActions, roleKey);
            }
            this.saveRoomStateIncremental({
                fouls: this.fouls,
                techFouls: this.techFouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "removeChange", roleKey, value: false });
            // ЗАЩИТА: НЕ отправляем actionChange с null для критических статусов
            if (currentStatus !== 'killed' && currentStatus !== 'voted') {
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
            this.sendFullState();
            this.$forceUpdate();
            return;
        }
        // Устанавливаем статус "removed" при нажатии кнопки удаления
        this.$set(this.removed, roleKey, true);
        this.$set(this.playersActions, roleKey, 'removed');
        this.saveRoomStateIncremental({
            removed: this.removed,
            playersActions: this.playersActions
        });
        this.sendToRoom({ type: "removeChange", roleKey, value: true });
        this.sendToRoom({ type: "actionChange", roleKey, action: 'removed' });
        this.sendFullState();
        this.$forceUpdate();
        
        // Сохраняем сессию при изменении статуса удаления
        this.saveCurrentSession();
    },

    resetPlayerStatus(roleKey, fullRestore = false) {
        const wasKilled = this.playersActions[roleKey] === 'killed';
        
        this.$set(this.fouls, roleKey, 0);
        this.$set(this.techFouls, roleKey, 0);
        this.$set(this.removed, roleKey, false);
        
        if (fullRestore) {
            // Не сбрасываем статус 'voted' при полном восстановлении
            if (!['voted'].includes(this.playersActions[roleKey])) {
                this.$delete(this.playersActions, roleKey);
            } else {
                // Для voted игроков только сбрасываем фолы и удаление
            }
            this.saveRoomStateIncremental({
                fouls: this.fouls,
                techFouls: this.techFouls,
                removed: this.removed,
                playersActions: this.playersActions
            });
            this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
            this.sendToRoom({ type: "removeChange", roleKey, value: false });
            if (!['voted'].includes(this.playersActions[roleKey])) {
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
        } else {
            const action = this.playersActions[roleKey];
            if (["killed","removed","tech_fall_removed","fall_removed"].includes(action)) {
                this.$delete(this.playersActions, roleKey);
                this.saveRoomStateIncremental({
                    fouls: this.fouls,
                    techFouls: this.techFouls,
                    removed: this.removed,
                    playersActions: this.playersActions
                });
                this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
                this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
                this.sendToRoom({ type: "removeChange", roleKey, value: false });
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            } else {
                this.saveRoomStateIncremental({
                    fouls: this.fouls,
                    techFouls: this.techFouls,
                    removed: this.removed,
                    playersActions: this.playersActions
                });
                this.sendToRoom({ type: "foulChange", roleKey, value: 0 });
                this.sendToRoom({ type: "techFoulChange", roleKey, value: 0 });
                this.sendToRoom({ type: "removeChange", roleKey, value: false });
                // Не отправляем actionChange с null для voted
            }
        }
        
        // Если возвращаем убитого игрока, проверяем нужно ли сбросить лучший ход
        if (wasKilled) {
            const remainingKilledCount = Object.values(this.playersActions).filter(a => a === 'killed').length;
            
            // Если больше нет убитых игроков, сбрасываем лучший ход
            if (remainingKilledCount === 0) {
                this.resetBestMove();
            }
            // Если возвращаемый игрок был первым убитым, сбрасываем лучший ход 
            // чтобы он мог быть выбран заново при следующем убийстве
            else if (this.firstKilledPlayer === roleKey) {
                this.resetBestMove();
            }
        }
        
        this.sendFullState();
        this.$forceUpdate();
    },

    // Логика для двойного клика возврата игрока
    handleReturnPlayerClick(roleKey) {
        if (!this._returnPlayerConfirm) this._returnPlayerConfirm = {};
        if (!this._returnPlayerConfirm[roleKey]) {
            window.showPanelNotification('Повторное нажатие вернет игрока в игру', 2500);
            this._returnPlayerConfirm[roleKey] = setTimeout(() => {
                this._returnPlayerConfirm[roleKey] = null;
            }, 2500);
        } else {
            clearTimeout(this._returnPlayerConfirm[roleKey]);
            this._returnPlayerConfirm[roleKey] = null;
            this.resetPlayerStatus(roleKey);
        }
    },

    // Пустые функции для совместимости (модальное окно отключено)
    showReturnPlayerModal(number, roleKey) {
        // Функция отключена - модальное окно не показывается
        console.log('showReturnPlayerModal отключено');
        // Гарантируем, что модальное окно остается скрытым
        this.showReturnPlayerModal = false;
    },

    confirmReturnPlayer() {
        // Функция отключена
        console.log('confirmReturnPlayer отключено');
        this.showReturnPlayerModal = false;
    },

    // Функции для ручного режима
    createManualTable() {
        if (!this.manualPlayersCount || this.manualPlayersCount < 1 || this.manualPlayersCount > 15) {
            this.showAlert('Количество игроков должно быть от 1 до 15');
            return;
        }
        
        this.manualMode = true;
        this.inputMode = 'manual';
        
        // Создаем первую игру с пустыми игроками
        const players = [];
        for (let i = 1; i <= this.manualPlayersCount; i++) {
            players.push({
                id: i,
                login: '',
                avatar_link: null,
                avatarCss: ''
            });
        }
        
        this.manualGames = [{
            num: 1,
            players: players
        }];
        this.manualGameSelected = 1;
        
        this.showModal = false;
        this.showRoomModal = false;
        
        // Сохраняем сессию после создания ручного стола
        this.saveCurrentSession();
    },
    
    onManualGameSelect(event) {
        const value = event.target.value;
        if (value === 'new') {
            // Создаем новую игру
            const newGameNum = this.manualGames.length + 1;
            const playersCount = this.manualGames[0]?.players?.length || 10;
            
            const players = [];
            for (let i = 1; i <= playersCount; i++) {
                players.push({
                    id: i,
                    login: '',
                    avatar_link: null,
                    avatarCss: ''
                });
            }
            
            this.manualGames.push({
                num: newGameNum,
                players: players
            });
            this.manualGameSelected = newGameNum;
        } else {
            this.manualGameSelected = Number(value);
        }
        
        // Сохраняем сессию при смене игры
        this.saveCurrentSession();
    },
    
    onManualSelectPlayer(index) {
        // Логика для выбора игрока из предыдущих игр
        const currentGame = this.manualGames.find(g => g.num === this.manualGameSelected);
        if (currentGame && currentGame.players[index]) {
            // Можно добавить дополнительную логику здесь
            this.saveCurrentSession();
        }
    },
    
    resetManualMode() {
        this.manualMode = false;
        this.manualGames = [];
        this.manualGameSelected = 1;
        this.inputMode = 'gomafia';
        this.showModal = true;
        this.showSettingsModal = false;
        
        // Очищаем сессию при сбросе ручного режима
        if (window.sessionManager) {
            window.sessionManager.clearSession();
        }
    }
});

console.log('✅ app-game-logic.js загружен, методы добавлены в window.app.methods');
