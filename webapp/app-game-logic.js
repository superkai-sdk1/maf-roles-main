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
                    
                    // Устанавливаем значения по умолчанию (первая игра, первый стол)
                    if (!this.isRestoringSession) {
                        this.gameSelected = Number(games[0].gameNum);
                        const tables = games[0].game;
                        if (tables && tables.length > 0) {
                            this.tableSelected = Number(tables[0].tableNum);
                        } else {
                            this.tableSelected = undefined;
                        }
                    }
                } else {
                    console.error('❌ В турнире нет доступных игр');
                    this.gameSelected = undefined;
                    this.tableSelected = undefined;
                    this.showAlert('В турнире нет доступных игр');
                    return;
                }

                // Сохраняем название турнира
                const serverData = value.props?.pageProps?.serverData;
                const tName = value._pageTitle
                    || serverData?.name
                    || serverData?.title
                    || serverData?.tournamentName
                    || serverData?.tournament_name
                    || '';
                this._tournamentDisplayName = tName || ('Турнир #' + this.tournamentId);

                if (this.isRestoringSession) {
                    // При восстановлении — сразу в игру
                    console.log('🔄 loadTournament: Восстановление сессии — пропускаем выбор стола');
                    this._finalizeTournamentLoad();
                } else {
                    // Показываем экран выбора игры и стола
                    console.log('🎯 loadTournament: Показываем выбор игры и стола');
                    this.showModal = false;
                    this.showRoomModal = false;
                    this.showGameTableModal = true;
                }
            } else {
                console.error('❌ Неверная структура данных турнира');
                console.log('Полученные данные:', value);
                this.showAlert('Не удалось загрузить турнир. Неверная структура данных.');
            }
        }).catch(error => {
            console.error('❌ Ошибка загрузки турнира:', error);
            this.showAlert('Ошибка при загрузке турнира: ' + error.message);
        });
    },

    // Подтверждение выбора игры и стола
    confirmGameTable() {
        console.log('✅ confirmGameTable: Игра:', this.gameSelected, 'Стол:', this.tableSelected);
        this.showGameTableModal = false;
        this._finalizeTournamentLoad();
    },

    // Финализация загрузки турнира (общая для обычной и восстановленной сессии)
    _finalizeTournamentLoad() {
        const value = this.tournament;
        const games = value?.props?.pageProps?.serverData?.games;

        this.showModal = false;
        this.showMainMenu = false;
        this.showGameTableModal = false;
        this.editRoles = true;

        // При восстановлении сессии не сбрасываем лучший ход
        if (!this.isRestoringSession) {
            this.resetBestMove();
        }

        // Обновляем информационные тексты только если не восстанавливаем сессию
        if (!this.isRestoringSession) {
            this.mainInfoText = this._tournamentDisplayName || ('Турнир #' + this.tournamentId);
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
        }

        // Отправляем состояние только если WebSocket подключен
        if (this.sendFullState && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendFullState();
        }

        // Сохраняем сессию
        this.saveCurrentSession();

        // Если восстанавливаем сессию, подключаемся к WebSocket
        if (this.isRestoringSession && this.roomId) {
            console.log('🔄 _finalizeTournamentLoad: Подключаемся к WebSocket');
            this.connectWS();
        }

        console.log('✅ Турнир загружен, игра:', this.gameSelected, 'стол:', this.tableSelected);

        // Загружаем аватары игроков
        this.playersLoad();

        // Автоматически загружаем аватарки при открытии игрового интерфейса
        this.loadAvatarsAuto();

        // Обновляем Vue
        this.$forceUpdate();
        this.$nextTick(() => {
            console.log('🔄 Vue обновлён, tableOut:', this.tableOut?.length || 0, 'игроков');
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
    },

    // Автоматическая загрузка аватарок при открытии игрового интерфейса.
    // Сначала пробует глобальный кэш (30 дней), затем загружает недостающие с GoMafia.
    async loadAvatarsAuto() {
        console.log('🖼️ loadAvatarsAuto: Начинаем автоматическую загрузку аватарок...');

        // Собираем логины всех игроков турнира
        const allPlayers = this.tournament?.props?.pageProps?.serverData?.games[0]?.game
            ?.map(g => g.table).flat(2) || [];
        const logins = allPlayers.map(p => p.login).filter(Boolean);

        if (!logins.length) {
            console.warn('⚠️ loadAvatarsAuto: Нет логинов игроков');
            return;
        }

        // 1. Запрашиваем кэшированные аватарки с нашего сервера (через POST — надёжнее с кириллицей)
        let cached = {};
        try {
            const res = await fetch('/api/avatars-cache.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `za=1&action=get&logins=${encodeURIComponent(JSON.stringify(logins))}`
            });
            if (res.ok) {
                const ct = res.headers.get('content-type');
                if (ct && ct.includes('application/json')) {
                    cached = await res.json();
                }
            } else {
                console.warn('⚠️ loadAvatarsAuto: Сервер вернул статус', res.status, 'для кэша аватаров');
            }
        } catch (e) {
            console.warn('⚠️ loadAvatarsAuto: Ошибка получения кэша аватаров:', e.message);
        }

        const cachedCount = Object.keys(cached).length;
        console.log(`🖼️ loadAvatarsAuto: Из кэша получено ${cachedCount}/${logins.length} аватаров`);

        // 2. Определяем, какие логины остались без аватарки
        const missingLogins = logins.filter(l => !cached[l]);

        // Если все аватарки найдены в кэше — применяем сразу
        if (missingLogins.length === 0) {
            console.log('✅ loadAvatarsAuto: Все аватарки найдены в кэше!');
            this.avatarsFromServer = cached;
            this.$forceUpdate();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendFullState();
            }
            // Также сохраняем в room-файл для obs
            await this.saveAvatarsToServer(cached);
            return;
        }

        // 3. Применяем уже найденные из кэша (чтобы пользователь видел их быстро)
        if (cachedCount > 0) {
            this.avatarsFromServer = { ...cached };
            this.$forceUpdate();
            console.log('🖼️ loadAvatarsAuto: Показываем закэшированные аватарки, догружаем остальные...');
        }

        // 4. Загружаем недостающие с GoMafia
        const buildId = this.buildId;
        if (!buildId) {
            console.warn('⚠️ loadAvatarsAuto: buildId не найден, не можем загрузить аватарки с GoMafia');
            return;
        }

        // Собираем id игроков, чьи аватарки не закэшированы
        const missingLoginsSet = new Set(missingLogins);
        const missingPlayerIds = allPlayers
            .filter(p => p.id && missingLoginsSet.has(p.login))
            .map(p => p.id);

        if (!missingPlayerIds.length) {
            console.warn('⚠️ loadAvatarsAuto: Нет id для загрузки недостающих аватаров');
            return;
        }

        console.log(`🔄 loadAvatarsAuto: Загружаем ${missingPlayerIds.length} аватаров с GoMafia...`);

        try {
            const usersData = await goMafia.getUsersData(buildId, missingPlayerIds);
            const processedValue = usersData
                .map(i => i?.user)
                .filter(i => !!i)
                .reduce((m, current) => m.set(current.login, current), new Map());

            // Обновляем playersDataOnline
            processedValue.forEach((v, k) => {
                this.playersDataOnline.set(k, v);
            });

            // Собираем новые аватарки
            const newAvatars = {};
            processedValue.forEach((v, k) => {
                if (v.avatar_link) newAvatars[k] = v.avatar_link;
            });

            console.log(`🖼️ loadAvatarsAuto: Загружено ${Object.keys(newAvatars).length} новых аватаров с GoMafia`);

            // Сохраняем новые аватарки в глобальный кэш на сервере
            if (Object.keys(newAvatars).length > 0) {
                try {
                    await fetch('/api/avatars-cache.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `za=1&avatars=${encodeURIComponent(JSON.stringify(newAvatars))}`
                    });
                    console.log('✅ loadAvatarsAuto: Новые аватарки сохранены в глобальный кэш');
                } catch (e) {
                    console.warn('⚠️ loadAvatarsAuto: Ошибка сохранения в кэш:', e.message);
                }
            }

            // Объединяем кэшированные + новые
            const allAvatars = { ...cached, ...newAvatars };
            this.avatarsFromServer = allAvatars;
            this.$forceUpdate();

            // Сохраняем в room-файл для obs
            await this.saveAvatarsToServer(allAvatars);

            console.log('✅ loadAvatarsAuto: Все аватарки загружены:', Object.keys(allAvatars).length);

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendFullState();
            }
        } catch (error) {
            console.error('❌ loadAvatarsAuto: Ошибка загрузки аватаров с GoMafia:', error);
        }
    },

    async playersLoadOnline() {
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
                    
                    // Сохраняем в глобальный кэш на 30 дней
                    if (Object.keys(avatars).length > 0) {
                        try {
                            await fetch('/api/avatars-cache.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: `za=1&avatars=${encodeURIComponent(JSON.stringify(avatars))}`
                            });
                            console.log('✅ playersLoadOnline: Аватарки сохранены в глобальный кэш');
                        } catch (e) {
                            console.warn('⚠️ playersLoadOnline: Ошибка сохранения в глобальный кэш:', e.message);
                        }
                    }

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
        this.showMainMenu = false;

        // Генерируем sessionId если его ещё нет
        if (!this.currentSessionId && window.sessionManager) {
            this.currentSessionId = window.sessionManager.generateSessionId();
        }

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
        
        // Удаляем только текущую сессию при сбросе ручного режима
        if (window.sessionManager && this.currentSessionId) {
            window.sessionManager.removeSession(this.currentSessionId);
            this.currentSessionId = null;
        }
    },

    // Методы для протокола и мнения
    toggleProtocolRole(roleKey, playerIndex) {
        if (!this.protocolData) this.protocolData = {};
        if (!this.protocolData[roleKey]) {
            this.$set(this.protocolData, roleKey, {});
        }
        
        const currentRole = this.protocolData[roleKey][playerIndex] || '';
        let nextRole = '';
        
        // Цикл ролей: '' -> 'peace' -> 'sheriff' -> 'mafia' -> 'don' -> ''
        switch(currentRole) {
            case '': nextRole = 'peace'; break;
            case 'peace': nextRole = 'sheriff'; break;
            case 'sheriff': nextRole = 'mafia'; break;
            case 'mafia': nextRole = 'don'; break;
            case 'don': nextRole = ''; break;
            default: nextRole = '';
        }
        
        // Проверка ограничений: только один шериф и один дон
        if (nextRole === 'sheriff') {
            // Сбрасываем шерифа у других игроков в протоколе этого убитого
            Object.keys(this.protocolData[roleKey]).forEach(idx => {
                if (this.protocolData[roleKey][idx] === 'sheriff') {
                    this.$set(this.protocolData[roleKey], idx, '');
                }
            });
        } else if (nextRole === 'don') {
            // Сбрасываем дона у других игроков в протоколе этого убитого
            Object.keys(this.protocolData[roleKey]).forEach(idx => {
                if (this.protocolData[roleKey][idx] === 'don') {
                    this.$set(this.protocolData[roleKey], idx, '');
                }
            });
        }
        
        this.$set(this.protocolData[roleKey], playerIndex, nextRole);
        this.saveRoomStateIncremental({ protocolData: this.protocolData });
        this.sendFullState();
    },
    
    toggleOpinionRole(roleKey, playerIndex) {
        if (!this.opinionData) this.opinionData = {};
        if (!this.opinionData[roleKey]) {
            this.$set(this.opinionData, roleKey, {});
        }
        
        const currentRole = this.opinionData[roleKey][playerIndex] || '';
        let nextRole = '';
        
        // Цикл ролей: '' -> 'peace' -> 'sheriff' -> 'mafia' -> 'don' -> ''
        switch(currentRole) {
            case '': nextRole = 'peace'; break;
            case 'peace': nextRole = 'sheriff'; break;
            case 'sheriff': nextRole = 'mafia'; break;
            case 'mafia': nextRole = 'don'; break;
            case 'don': nextRole = ''; break;
            default: nextRole = '';
        }
        
        // Проверка ограничений: только один шериф и один дон
        if (nextRole === 'sheriff') {
            // Сбрасываем шерифа у других игроков в мнении этого убитого
            Object.keys(this.opinionData[roleKey]).forEach(idx => {
                if (this.opinionData[roleKey][idx] === 'sheriff') {
                    this.$set(this.opinionData[roleKey], idx, '');
                }
            });
        } else if (nextRole === 'don') {
            // Сбрасываем дона у других игроков в мнении этого убитого
            Object.keys(this.opinionData[roleKey]).forEach(idx => {
                if (this.opinionData[roleKey][idx] === 'don') {
                    this.$set(this.opinionData[roleKey], idx, '');
                }
            });
        }
        
        this.$set(this.opinionData[roleKey], playerIndex, nextRole);
        this.saveRoomStateIncremental({ opinionData: this.opinionData });
        this.sendFullState();
    },
    
    updateOpinionText(roleKey, text) {
        if (!this.opinionText) this.opinionText = {};
        this.$set(this.opinionText, roleKey, text);
        
        if (this._opinionSaveTimer) clearTimeout(this._opinionSaveTimer);
        this._opinionSaveTimer = setTimeout(() => {
            this.saveRoomStateIncremental({ opinionText: this.opinionText });
            this.sendFullState();
        }, 500);
    },
    
    getProtocolRoleClass(roleKey, playerIndex) {
        if (!this.protocolData) return '';
        const role = this.protocolData[roleKey] && this.protocolData[roleKey][playerIndex];
        if (!role) return '';
        return `role-${role}`;
    },
    
    getOpinionRoleClass(roleKey, playerIndex) {
        if (!this.opinionData) return '';
        const role = this.opinionData[roleKey] && this.opinionData[roleKey][playerIndex];
        if (!role) return '';
        return `role-${role}`;
    },
    
    getProtocolRoleLabel(roleKey, playerIndex) {
        if (!this.protocolData) return playerIndex;
        const role = this.protocolData[roleKey] && this.protocolData[roleKey][playerIndex];
        switch(role) {
            case 'peace': return 'Мирный';
            case 'sheriff': return 'Шериф';
            case 'mafia': return 'Мафия';
            case 'don': return 'Дон';
            default: return playerIndex;
        }
    },
    
    getOpinionRoleLabel(roleKey, playerIndex) {
        if (!this.opinionData) return playerIndex;
        const role = this.opinionData[roleKey] && this.opinionData[roleKey][playerIndex];
        switch(role) {
            case 'peace': return 'Мирный';
            case 'sheriff': return 'Шериф';
            case 'mafia': return 'Мафия';
            case 'don': return 'Дон';
            default: return playerIndex;
        }
    },

    // Методы для подсчета баллов и отправки результатов
    calculatePlayerScore(roleKey) {
        if (!this.winnerTeam) return 0;
        
        let score = 0;
        const role = this.roles[roleKey];
        
        // Балл за победу
        if (this.winnerTeam === 'civilians') {
            if (role === 'sheriff' || !role) { // Мирные и шериф
                score += 1;
            }
        } else if (this.winnerTeam === 'mafia') {
            if (role === 'don' || role === 'black') { // Мафия и дон
                score += 1;
            }
        }
        
        // Дополнительные баллы
        if (this.playerScores[roleKey]) {
            score += parseFloat(this.playerScores[roleKey].bonus || 0);
            score -= parseFloat(this.playerScores[roleKey].penalty || 0);
        }
        
        return parseFloat(score.toFixed(2));
    },

    checkProtocol(roleKey) {
        if (!this.protocolData || !this.protocolData[roleKey]) return null;
        
        const protocol = this.protocolData[roleKey];
        const results = {};
        let hasEntries = false;
        
        Object.keys(protocol).forEach(idx => {
            const predictedRole = protocol[idx];
            if (predictedRole) {
                hasEntries = true;
                // Находим roleKey игрока по индексу (idx - это номер игрока)
                const targetPlayer = this.tableOut.find(p => p.num === parseInt(idx));
                if (targetPlayer) {
                    const actualRole = this.roles[targetPlayer.roleKey];
                    // Логика проверки:
                    // peace -> !role (мирный)
                    // sheriff -> sheriff
                    // mafia -> black
                    // don -> don
                    let isCorrect = false;
                    if (predictedRole === 'peace' && !actualRole) isCorrect = true;
                    else if (predictedRole === 'sheriff' && actualRole === 'sheriff') isCorrect = true;
                    else if (predictedRole === 'mafia' && actualRole === 'black') isCorrect = true;
                    else if (predictedRole === 'don' && actualRole === 'don') isCorrect = true;
                    
                    results[idx] = { role: predictedRole, correct: isCorrect };
                }
            }
        });
        
        return hasEntries ? results : null;
    },

    checkOpinion(roleKey) {
        if (!this.opinionData || !this.opinionData[roleKey]) return null;
        
        const opinion = this.opinionData[roleKey];
        const results = {};
        let hasEntries = false;
        
        Object.keys(opinion).forEach(idx => {
            const predictedRole = opinion[idx];
            if (predictedRole) {
                hasEntries = true;
                const targetPlayer = this.tableOut.find(p => p.num === parseInt(idx));
                if (targetPlayer) {
                    const actualRole = this.roles[targetPlayer.roleKey];
                    let isCorrect = false;
                    if (predictedRole === 'peace' && !actualRole) isCorrect = true;
                    else if (predictedRole === 'sheriff' && actualRole === 'sheriff') isCorrect = true;
                    else if (predictedRole === 'mafia' && actualRole === 'black') isCorrect = true;
                    else if (predictedRole === 'don' && actualRole === 'don') isCorrect = true;
                    
                    results[idx] = { role: predictedRole, correct: isCorrect };
                }
            }
        });
        
        return hasEntries ? results : null;
    },
    
    getOpinionText(roleKey) {
        if (!this.opinionText) return '';
        return this.opinionText[roleKey] || '';
    },

    updatePlayerScore(roleKey, type, value) {
        if (!this.playerScores[roleKey]) {
            this.$set(this.playerScores, roleKey, { bonus: 0, penalty: 0, reveal: false });
        }
        
        this.$set(this.playerScores[roleKey], type, value);
        this.saveRoomStateIncremental({ playerScores: this.playerScores });
    },

    // Новый метод для корректировки баллов кнопками
    adjustScore(roleKey, type, delta) {
        if (!this.playerScores[roleKey]) {
            this.$set(this.playerScores, roleKey, { bonus: 0, penalty: 0, reveal: false });
        }
        
        let currentValue = parseFloat(this.playerScores[roleKey][type] || 0);
        let newValue = currentValue + delta;
        
        // Округляем до 1 знака после запятой, чтобы избежать 0.30000000000000004
        newValue = Math.round(newValue * 10) / 10;
        
        // Для штрафов значение должно быть положительным (оно вычитается при подсчете)
        // Для бонусов разрешаем отрицательные значения
        if (type === 'penalty' && newValue < 0) {
            newValue = 0;
        }
        
        this.$set(this.playerScores[roleKey], type, newValue);
        this.saveRoomStateIncremental({ playerScores: this.playerScores });
    },

    toggleReveal(roleKey) {
        if (!this.playerScores[roleKey]) {
            this.$set(this.playerScores, roleKey, { bonus: 0, penalty: 0, reveal: false });
        }
        
        this.$set(this.playerScores[roleKey], 'reveal', !this.playerScores[roleKey].reveal);
        this.saveRoomStateIncremental({ playerScores: this.playerScores });
    },

    getRoleLabel(role) {
        switch(role) {
            case 'peace': return 'Мирный';
            case 'sheriff': return 'Шериф';
            case 'mafia': return 'Мафия';
            case 'don': return 'Дон';
            case 'black': return 'Мафия';
            default: return 'Мирный';
        }
    }
});

console.log('✅ app-game-logic.js загружен, методы добавлены в window.app.methods');
