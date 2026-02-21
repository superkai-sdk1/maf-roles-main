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

    // =====================================================
    // Tournament Browser Methods
    // =====================================================

    // Открыть браузер турниров
    openTournamentBrowser() {
        console.log('🏆 Открываем браузер турниров');
        this.showModal = false;
        this.showTournamentBrowser = true;
        this.tournamentsPage = 1;
        this.tournamentsList = [];
        this.tournamentsError = '';
        this.tournamentsFilters = {
            period: '',
            type: '',
            fsm: '',
            search: ''
        };
        this.fetchTournaments();
    },

    // Закрыть браузер турниров
    closeTournamentBrowser() {
        this.showTournamentBrowser = false;
        this.tournamentsList = [];
        this.tournamentsError = '';
        this.showModal = true;
        this.newGameStep = 'gomafia';
    },

    // Загрузить турниры с текущими фильтрами
    async fetchTournaments(append = false) {
        if (this.tournamentsLoading) return;

        this.tournamentsLoading = true;
        this.tournamentsError = '';

        if (!append) {
            this.tournamentsPage = 1;
        }

        try {
            const result = await goMafia.getTournamentsList({
                period: this.tournamentsFilters.period,
                type: this.tournamentsFilters.type,
                fsm: this.tournamentsFilters.fsm,
                search: this.tournamentsFilters.search,
                page: this.tournamentsPage
            });

            if (append) {
                this.tournamentsList = [...this.tournamentsList, ...result.tournaments];
            } else {
                this.tournamentsList = result.tournaments;
            }

            this.tournamentsTotalCount = result.totalCount;
            this.tournamentsHasMore = result.hasMore;

            console.log(`✅ Загружено ${this.tournamentsList.length} турниров`);
        } catch (error) {
            console.error('❌ Ошибка загрузки турниров:', error);
            this.tournamentsError = 'Не удалось загрузить список турниров';
        } finally {
            this.tournamentsLoading = false;
        }
    },

    // Загрузить ещё турниров (пагинация)
    loadMoreTournaments() {
        if (this.tournamentsLoading || !this.tournamentsHasMore) return;
        this.tournamentsPage++;
        this.fetchTournaments(true);
    },

    // Применить фильтр турниров
    applyTournamentFilter(filterName, value) {
        console.log(`🔍 Фильтр: ${filterName} = ${value}`);
        this.$set(this.tournamentsFilters, filterName, value);
        this.tournamentsPage = 1;
        this.tournamentsList = [];
        this.fetchTournaments();
    },

    // Проверить, доступна ли рассадка в турнире
    // Рассадка доступна если у турнира на gomafia.pro указан ELO (3-4 значное число).
    // PHP proxy парсит ELO из HTML и ставит _hasSeating=true, _elo=число.
    isTournamentSeatingReady(tournament) {
        if (!tournament) return false;

        // _hasSeating и _elo инжектируются PHP proxy из HTML gomafia.pro
        if (tournament._hasSeating === true && typeof tournament._elo === 'number' && tournament._elo >= 100) {
            return true;
        }

        return false;
    },

    // Выбрать турнир из браузера
    selectTournamentFromBrowser(tournament) {
        if (!this.isTournamentSeatingReady(tournament)) {
            console.log('⚠️ Турнир без рассадки, пропускаем');
            return;
        }

        const tid = tournament.id || tournament.tournamentId;
        if (!tid) {
            console.error('❌ Не удалось определить ID турнира:', tournament);
            return;
        }

        console.log('🏆 Выбран турнир:', tid, tournament.name || tournament.title);
        this.tournamentId = String(tid);
        this.showTournamentBrowser = false;
        this.loadTournament();
    },

    // Получить отображаемую дату турнира
    formatTournamentDate(tournament) {
        const dateStr = tournament.date || tournament.startDate || tournament.dateStart || tournament.created_at;
        if (!dateStr) return '';

        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;

            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            const day = d.getDate();
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            const now = new Date();

            if (year === now.getFullYear()) {
                return `${day} ${month}`;
            }
            return `${day} ${month} ${year}`;
        } catch (e) {
            return dateStr;
        }
    },

    // Получить город турнира
    getTournamentCity(tournament) {
        return tournament.city || tournament.cityName || tournament.location || '';
    },

    // Получить количество игроков
    getTournamentPlayersCount(tournament) {
        return tournament.playersCount || tournament.players_count || tournament.participantsCount || tournament.membersCount || '';
    },

    // Получить статус турнира (цвет бейджа)
    getTournamentStatus(tournament) {
        const status = tournament.status || tournament.state || '';
        if (status === 'active' || status === 'registration' || status === 'open') {
            return { text: 'Регистрация', class: 'status-active' };
        }
        if (status === 'started' || status === 'in_progress' || status === 'playing') {
            return { text: 'Идёт', class: 'status-playing' };
        }
        if (status === 'finished' || status === 'completed' || status === 'closed') {
            return { text: 'Завершён', class: 'status-finished' };
        }
        return { text: '', class: '' };
    },

    // Debounce поиска турниров
    onTournamentSearchInput(value) {
        clearTimeout(this._tournamentSearchTimeout);
        this._tournamentSearchTimeout = setTimeout(() => {
            this.applyTournamentFilter('search', value);
        }, 400);
    },

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
        const isNextGame = this._isNextGameLoad;
        this._isNextGameLoad = false;

        this.showModal = false;
        this.showMainMenu = false;
        this.showGameTableModal = false;
        this.editRoles = true;

        // При восстановлении сессии не сбрасываем лучший ход (кроме следующей игры)
        if (!this.isRestoringSession || isNextGame) {
            this.resetBestMove();
        }

        // Обновляем информационные тексты если не восстанавливаем сессию ИЛИ если это следующая игра
        if (!this.isRestoringSession || isNextGame) {
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

    // Валидация раздачи ролей: 1 дон, 2 мафии, 1 шериф
    validateRolesDistribution() {
        const roleValues = Object.values(this.roles);
        const donCount = roleValues.filter(r => r === 'don').length;
        const blackCount = roleValues.filter(r => r === 'black').length;
        const sheriffCount = roleValues.filter(r => r === 'sheriff').length;

        const errors = [];
        if (donCount !== 1) errors.push('Дон: ' + donCount + ' из 1');
        if (blackCount !== 2) errors.push('Мафия: ' + blackCount + ' из 2');
        if (sheriffCount !== 1) errors.push('Шериф: ' + sheriffCount + ' из 1');

        return { valid: errors.length === 0, donCount, blackCount, sheriffCount, errors };
    },

    // Начало удержания кнопки "Сохранить раздачу"
    startRolesHold() {
        const validation = this.validateRolesDistribution();
        if (!validation.valid) {
            this.rolesValidationError = 'Необходимо: 1 Дон, 2 Мафии, 1 Шериф.\n' + validation.errors.join(', ');
            window.haptic && window.haptic.notification('error');
            clearTimeout(this._rolesValidationTimeout);
            this._rolesValidationTimeout = setTimeout(() => {
                this.rolesValidationError = '';
            }, 3000);
            return;
        }
        this.rolesHoldActive = true;
        this.rolesHoldTimer = setTimeout(() => {
            if (this.rolesHoldActive) {
                this.rolesHoldActive = false;
                this.rolesDistributed = true;
                this.gamePhase = 'discussion';
                this.currentMode = 'discussion';
                this.dayNumber = 0;
                this.nightNumber = 0;
                this.sendFullState();
                this.saveCurrentSession();
                window.haptic && window.haptic.notification('success');
            }
        }, 1500);
    },

    // Отмена удержания кнопки "Сохранить раздачу"
    cancelRolesHold() {
        if (this.rolesHoldTimer) {
            clearTimeout(this.rolesHoldTimer);
            this.rolesHoldTimer = null;
        }
        if (this.rolesHoldActive) {
            this.rolesHoldActive = false;
            // Короткий тап — показать подсказку
            const validation = this.validateRolesDistribution();
            if (validation.valid) {
                this.showAlert('Удерживайте кнопку для сохранения раздачи');
            }
        }
    },

    // Подтверждение раздачи ролей — переход к дню/ночи (оставлен для совместимости)
    confirmRolesDistribution() {
        const validation = this.validateRolesDistribution();
        if (!validation.valid) {
            this.rolesValidationError = 'Необходимо: 1 Дон, 2 Мафии, 1 Шериф.\n' + validation.errors.join(', ');
            window.haptic && window.haptic.notification('error');
            return;
        }
        this.rolesDistributed = true;
        this.gamePhase = 'discussion';
        this.currentMode = 'discussion';
        this.dayNumber = 0;
        this.nightNumber = 0;
        this.sendFullState();
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
            
            // Логика для показа карточки убитого и лучшего хода
            if (action === 'killed') {
                // Clear miss for this night since a kill happened
                if (this.nightMisses && this.nightMisses[this.nightNumber]) {
                    this.$delete(this.nightMisses, this.nightNumber);
                }

                // Проверяем, есть ли уже убитые игроки (исключая текущего)
                const otherKilledPlayers = Object.entries(this.playersActions)
                    .filter(([key, value]) => key !== roleKey && value === 'killed');
                
                // Первое убийство за всю игру — показываем ЛХ (если разрешено)
                const isFirstKillEver = otherKilledPlayers.length === 0 && !this.firstKilledEver;
                if (isFirstKillEver && !this.bestMoveAccepted && this.canShowBestMove()) {
                    console.log(`🎯 Первое убийство! Игрок ${roleKey} установлен как firstKilledPlayer`);
                    this.firstKilledPlayer = roleKey;
                    this.firstKilledEver = true;
                    this.bestMoveSelected = false;
                    this.bestMove = [];
                    this.bestMoveAccepted = false;
                    this.$set(this.killedCardPhase, roleKey, 'bm');
                } else {
                    if (isFirstKillEver) this.firstKilledEver = true;
                    // Последующие убийства или ЛХ запрещён — сразу таймер
                    this.$set(this.killedCardPhase, roleKey, 'timer');
                }

                // Пометка на пульсирование днём
                this.$set(this.killedPlayerBlink, roleKey, true);

                // Начинаем ночную последовательность: Убийство → Дон → Шериф → День
                this.startNightSequence();

                this.saveRoomStateIncremental({
                    firstKilledPlayer: this.firstKilledPlayer,
                    bestMoveSelected: false,
                    bestMoveAccepted: this.bestMoveAccepted,
                    bestMove: this.bestMove,
                    killedCardPhase: this.killedCardPhase,
                    killedPlayerBlink: this.killedPlayerBlink,
                    nightPhase: this.nightPhase
                });
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

    // =============================================
    // New Day Mode interactions (tap / hold)
    // =============================================

    // Tap to add one foul
    tapAddFoul(roleKey) {
        if (!this.fouls) this.fouls = {};
        let val = this.fouls[roleKey] || 0;
        if (val >= 4) return; // already at max
        val++;
        this.$set(this.fouls, roleKey, val);
        if (val === 4) {
            this.setRemoved(roleKey, 'fall_removed');
            this.saveRoomStateIncremental({ fouls: this.fouls, removed: this.removed, playersActions: this.playersActions });
            this.sendToRoom({ type: "foulChange", roleKey, value: val });
            this.sendToRoom({ type: "removeChange", roleKey, value: 'fall_removed' });
            this.sendToRoom({ type: "actionChange", roleKey, action: 'fall_removed' });
        } else {
            this.saveRoomStateIncremental({ fouls: this.fouls });
            this.sendToRoom({ type: "foulChange", roleKey, value: val });
        }
        if (this.updateTimerFouls) this.updateTimerFouls(roleKey, val);
        this.sendFullState();
        this.$forceUpdate();
        this.saveCurrentSession();
    },

    // Tap to add one tech foul
    tapAddTechFoul(roleKey) {
        if (!this.techFouls) this.techFouls = {};
        let val = this.techFouls[roleKey] || 0;
        if (val >= 2) return;
        val++;
        this.$set(this.techFouls, roleKey, val);
        if (val === 2) {
            this.setRemoved(roleKey, 'tech_fall_removed');
            this.saveRoomStateIncremental({ techFouls: this.techFouls, removed: this.removed, playersActions: this.playersActions });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: val });
            this.sendToRoom({ type: "removeChange", roleKey, value: 'tech_fall_removed' });
            this.sendToRoom({ type: "actionChange", roleKey, action: 'tech_fall_removed' });
        } else {
            this.saveRoomStateIncremental({ techFouls: this.techFouls });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: val });
        }
        this.sendFullState();
        this.$forceUpdate();
        this.saveCurrentSession();
    },

    // Generic hold start for day actions
    startDayHold(roleKey, type) {
        this._dayHoldTarget = roleKey;
        this._dayHoldType = type;
        this.dayHoldActive = true;
        this._dayHoldTimestamp = Date.now();
        this._dayHoldTimer = setTimeout(() => {
            if (this.dayHoldActive && this._dayHoldTarget === roleKey && this._dayHoldType === type) {
                this.dayHoldActive = false;
                this._executeDayHold(roleKey, type);
            }
        }, 600);
    },

    cancelDayHold() {
        if (this._dayHoldTimer) {
            clearTimeout(this._dayHoldTimer);
            this._dayHoldTimer = null;
        }
        if (this.dayHoldActive) {
            this.dayHoldActive = false;
            this._dayHoldTimestamp = Date.now();
            const type = this._dayHoldType;
            const roleKey = this._dayHoldTarget;
            // Short tap — execute tap action
            if (type === 'foul') {
                this.tapAddFoul(roleKey);
                window.haptic && window.haptic.impact('light');
            } else if (type === 'techfoul') {
                this.tapAddTechFoul(roleKey);
                window.haptic && window.haptic.impact('light');
            } else if (type === 'remove') {
                this.showAlert('Удерживайте для удаления игрока');
            } else if (type === 'return') {
                this.showAlert('Удерживайте для возврата игрока');
            }
        }
        this._dayHoldTarget = null;
        this._dayHoldType = null;
    },

    _executeDayHold(roleKey, type) {
        if (type === 'foul') {
            // Hold = subtract one foul
            if (!this.fouls) this.fouls = {};
            let val = this.fouls[roleKey] || 0;
            if (val <= 0) return;
            val--;
            this.$set(this.fouls, roleKey, val);
            // If was removed by fouls, undo that
            if (this.playersActions[roleKey] === 'fall_removed') {
                this.$set(this.removed, roleKey, false);
                this.$delete(this.playersActions, roleKey);
                this.sendToRoom({ type: "removeChange", roleKey, value: false });
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
            this.saveRoomStateIncremental({ fouls: this.fouls, removed: this.removed, playersActions: this.playersActions });
            this.sendToRoom({ type: "foulChange", roleKey, value: val });
            if (this.updateTimerFouls) this.updateTimerFouls(roleKey, val);
            window.haptic && window.haptic.notification('warning');
        } else if (type === 'techfoul') {
            if (!this.techFouls) this.techFouls = {};
            let val = this.techFouls[roleKey] || 0;
            if (val <= 0) return;
            val--;
            this.$set(this.techFouls, roleKey, val);
            if (this.playersActions[roleKey] === 'tech_fall_removed') {
                this.$set(this.removed, roleKey, false);
                this.$delete(this.playersActions, roleKey);
                this.sendToRoom({ type: "removeChange", roleKey, value: false });
                this.sendToRoom({ type: "actionChange", roleKey, action: null });
            }
            this.saveRoomStateIncremental({ techFouls: this.techFouls, removed: this.removed, playersActions: this.playersActions });
            this.sendToRoom({ type: "techFoulChange", roleKey, value: val });
            window.haptic && window.haptic.notification('warning');
        } else if (type === 'remove') {
            // Hold = remove player
            this.$set(this.removed, roleKey, true);
            this.$set(this.playersActions, roleKey, 'removed');
            this.saveRoomStateIncremental({ removed: this.removed, playersActions: this.playersActions });
            this.sendToRoom({ type: "removeChange", roleKey, value: true });
            this.sendToRoom({ type: "actionChange", roleKey, action: 'removed' });
            window.haptic && window.haptic.notification('error');
        } else if (type === 'return') {
            // Hold = return player
            this.resetPlayerStatus(roleKey, false);
            window.haptic && window.haptic.notification('success');
        }
        this.sendFullState();
        this.$forceUpdate();
        this.saveCurrentSession();
    },

    // =============================================
    // Game Phase System
    // =============================================

    // --- Discussion Phase (Договорка) ---
    startDiscussionTimer() {
        if (this.discussionTimerId) return; // already running
        this.discussionRunning = true;
        this.discussionTimerId = setInterval(() => {
            this.discussionTimeLeft--;
            if (this.discussionTimeLeft <= 0) {
                this.stopDiscussionTimer();
                this.advanceFromDiscussion();
            }
        }, 1000);
    },

    stopDiscussionTimer() {
        if (this.discussionTimerId) {
            clearInterval(this.discussionTimerId);
            this.discussionTimerId = null;
        }
        this.discussionRunning = false;
    },

    // Hold-to-skip discussion
    startSkipDiscussionHold() {
        this.skipHoldActive = true;
        this.skipHoldTimer = setTimeout(() => {
            if (this.skipHoldActive) {
                this.skipHoldActive = false;
                this.stopDiscussionTimer();
                this.advanceFromDiscussion();
                window.haptic && window.haptic.notification('success');
            }
        }, 800);
    },

    cancelSkipHold() {
        if (this.skipHoldTimer) {
            clearTimeout(this.skipHoldTimer);
            this.skipHoldTimer = null;
        }
        if (this.skipHoldActive) {
            this.skipHoldActive = false;
            this.showAlert('Удерживайте для пропуска');
        }
    },

    advanceFromDiscussion() {
        this.stopDiscussionTimer();
        this.gamePhase = 'freeSeating';
        this.currentMode = 'freeSeating';
        this.freeSeatingTimeLeft = 40;
        this.saveRoomStateIncremental({ gamePhase: 'freeSeating', currentMode: 'freeSeating', freeSeatingTimeLeft: 40 });
        this.sendFullState();
        this.saveCurrentSession();
    },

    // --- Free Seating Phase (Свободная посадка) ---
    startFreeSeatingTimer() {
        if (this.freeSeatingTimerId) return;
        this.freeSeatingRunning = true;
        this.freeSeatingTimerId = setInterval(() => {
            this.freeSeatingTimeLeft--;
            if (this.freeSeatingTimeLeft <= 0) {
                this.stopFreeSeatingTimer();
                this.advanceFromFreeSeating();
            }
        }, 1000);
    },

    stopFreeSeatingTimer() {
        if (this.freeSeatingTimerId) {
            clearInterval(this.freeSeatingTimerId);
            this.freeSeatingTimerId = null;
        }
        this.freeSeatingRunning = false;
    },

    startSkipFreeSeatingHold() {
        this.skipHoldActive = true;
        this.skipHoldTimer = setTimeout(() => {
            if (this.skipHoldActive) {
                this.skipHoldActive = false;
                this.stopFreeSeatingTimer();
                this.advanceFromFreeSeating();
                window.haptic && window.haptic.notification('success');
            }
        }, 800);
    },

    advanceFromFreeSeating() {
        this.stopFreeSeatingTimer();
        this.gamePhase = 'day';
        this.currentMode = 'day';
        this.dayNumber = 1;
        this.saveRoomStateIncremental({ gamePhase: 'day', currentMode: 'day', dayNumber: 1 });
        this.sendFullState();
        this.saveCurrentSession();
    },

    // --- Night Miss (Промах) ---
    setNightMiss() {
        if (!this.nightMisses) this.nightMisses = {};
        this.$set(this.nightMisses, this.nightNumber, true);

        // Trigger day transition sequence (skip Don/Sheriff if no kill)
        this.nightPhase = 'done';
        this.dayButtonBlink = true;
        this.highlightedPlayer = null;

        // Clear any auto-close timers
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
            this.nightAutoCloseTimer = null;
        }

        window.haptic && window.haptic.notification('warning');
        this.saveRoomStateIncremental({
            nightMisses: this.nightMisses,
            nightPhase: 'done',
            dayButtonBlink: true
        });
        this.sendFullState();
        this.saveCurrentSession();
    },

    // --- BM (Best Move) Eligibility ---
    canShowBestMove() {
        // ЛХ показывается только первому убитому при условии:
        // 1. На нулевом круге (день 0) никого не заголосовали
        // 2. Это действительно первое убийство за всю игру
        if (this.dayVoteOuts && this.dayVoteOuts[0]) {
            // На нулевом круге был голосованием удалён игрок → ЛХ нет
            return false;
        }
        // ЛХ доступен для первого убитого
        return true;
    },

    // --- Phase label helpers ---
    getPhaseLabel() {
        if (this.gamePhase === 'discussion') return 'Договорка';
        if (this.gamePhase === 'freeSeating') return 'Свободная посадка';
        if (this.gamePhase === 'day' || this.currentMode === 'day') {
            if (this.dayNumber === 0) return 'День 0';
            return 'День ' + this.dayNumber;
        }
        if (this.gamePhase === 'night' || this.currentMode === 'night') {
            return 'Ночь ' + this.nightNumber;
        }
        return '';
    },

    getDaySubtitle() {
        // Subtitle for day (e.g., "Девятка", "Десятка")
        if (this.dayNumber === 1) {
            // Check if Night 1 was a miss
            if (this.nightMisses && this.nightMisses[1]) {
                return 'Десятка';
            }
            return 'Девятка';
        }
        if (this.dayNumber === 0) return 'Нулевой круг';
        return '';
    },

    // =============================================
    // Night Sequence: Kill → Don → Sheriff → Day
    // =============================================

    // Find the roleKey for a player with a given role (alive or dead — they still hold the role)
    _findRoleKey(role) {
        return Object.entries(this.roles).find(([k, v]) => v === role)?.[0] || null;
    },

    // Check if a role holder was killed BEFORE the current night (i.e. not freshly killed this night)
    _wasKilledBeforeThisNight(roleKey) {
        // If the player is killed AND this is NOT the first time we're entering the night phase for them
        // We track this by checking: if the kill happened this night, they can still check.
        // The kill always happens at the START of the night sequence (before Don/Sheriff phases).
        // So on the SAME night they die, they can still check.
        // On SUBSEQUENT nights, they cannot.
        // We use nightNumber: if they were killed and the phase was already processed,
        // they were killed on a previous night.
        if (!this.playersActions[roleKey] || this.playersActions[roleKey] !== 'killed') return false;
        // Player is killed. Check if killed this night (fresh kill) or before.
        // If this night's kill target includes this roleKey, they were killed NOW and can still check.
        // We store _freshlyKilledThisNight during the kill sequence.
        return !this._freshlyKilledThisNight || !this._freshlyKilledThisNight.includes(roleKey);
    },

    startNightSequence() {
        // Clear any previous auto-close timer
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
            this.nightAutoCloseTimer = null;
        }

        // Track freshly killed players this night
        this._freshlyKilledThisNight = Object.entries(this.playersActions)
            .filter(([k, v]) => v === 'killed')
            .map(([k]) => k);

        const donKey = this._findRoleKey('don');
        const sheriffKey = this._findRoleKey('sheriff');

        // Check if Don/Sheriff were killed before this night
        const donDead = donKey && this._wasKilledBeforeThisNight(donKey);
        const sheriffDead = sheriffKey && this._wasKilledBeforeThisNight(sheriffKey);

        // Close any open card first
        this.highlightedPlayer = null;

        if (donKey && !donDead) {
            this.nightPhase = 'don';
            this.$nextTick(() => {
                this.highlightedPlayer = donKey;
                this.$nextTick(() => {
                    this._scrollToPlayer && this._scrollToPlayer(donKey);
                });
            });
        } else if (sheriffKey && !sheriffDead) {
            this.nightPhase = 'sheriff';
            this.$nextTick(() => {
                this.highlightedPlayer = sheriffKey;
                this.$nextTick(() => {
                    this._scrollToPlayer && this._scrollToPlayer(sheriffKey);
                });
            });
        } else {
            // No Don or Sheriff available — go straight to day blink
            this.nightPhase = 'done';
            this.dayButtonBlink = true;
        }
    },

    advanceNightPhase() {
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
            this.nightAutoCloseTimer = null;
        }

        const sheriffKey = this._findRoleKey('sheriff');
        const sheriffDead = sheriffKey && this._wasKilledBeforeThisNight(sheriffKey);

        if (this.nightPhase === 'don') {
            // Don done → move to Sheriff
            if (sheriffKey && !sheriffDead) {
                this.nightPhase = 'sheriff';
                this.highlightedPlayer = null;
                this.$nextTick(() => {
                    this.highlightedPlayer = sheriffKey;
                    this.$nextTick(() => {
                        this._scrollToPlayer && this._scrollToPlayer(sheriffKey);
                    });
                });
            } else {
                // No sheriff available
                this.nightPhase = 'done';
                this.highlightedPlayer = null;
                this.dayButtonBlink = true;
            }
        } else if (this.nightPhase === 'sheriff') {
            // Sheriff done → day blink
            this.nightPhase = 'done';
            this.highlightedPlayer = null;
            this.dayButtonBlink = true;
        }

        this.saveRoomStateIncremental({ nightPhase: this.nightPhase, dayButtonBlink: this.dayButtonBlink });
        this.$forceUpdate();
    },

    // =============================================
    // Night Check (Don & Sheriff)
    // =============================================
    performNightCheck(checkerRoleKey, targetNum) {
        // Find checker's role
        const checkerRole = this.roles[checkerRoleKey];
        if (!checkerRole || (checkerRole !== 'don' && checkerRole !== 'sheriff')) return;

        // Already checked THIS night (one check per night per role)
        if (this.nightChecks[checkerRoleKey]) {
            window.haptic && window.haptic.notification('error');
            return;
        }

        // Find target's roleKey
        const targetPlayer = this.tableOut[targetNum - 1];
        if (!targetPlayer) return;
        const targetRole = this.roles[targetPlayer.roleKey] || null;

        let result = '';
        let found = false;
        if (checkerRole === 'don') {
            // Don checks for sheriff
            found = (targetRole === 'sheriff');
            result = found ? 'Шериф ✅' : 'Не шериф ❌';
        } else if (checkerRole === 'sheriff') {
            // Sheriff checks for mafia. IMPORTANT: Don shows as "Мафия"
            found = (targetRole === 'black' || targetRole === 'don');
            result = found ? 'Мафия ✅' : 'Мирный ❌';
        }

        // Save current night check (for UI display — one per night)
        this.$set(this.nightChecks, checkerRoleKey, { target: targetNum, result: result });

        // Record to persistent history
        if (!this.nightCheckHistory) this.nightCheckHistory = [];
        this.nightCheckHistory.push({
            night: this.nightNumber || 1,
            checker: checkerRoleKey,
            checkerRole: checkerRole,
            target: targetNum,
            targetLogin: targetPlayer.login || ('Игрок ' + targetNum),
            result: result,
            found: found
        });

        window.haptic && window.haptic.notification('success');
        this.saveRoomStateIncremental({
            nightChecks: this.nightChecks,
            nightCheckHistory: this.nightCheckHistory
        });
        this.sendFullState();
        this.saveCurrentSession();

        // Auto-close card after 5 seconds and advance to next phase
        if (this.nightAutoCloseTimer) {
            clearTimeout(this.nightAutoCloseTimer);
        }
        this.nightAutoCloseTimer = setTimeout(() => {
            this.nightAutoCloseTimer = null;
            this.advanceNightPhase();
        }, 5000);
    },

    clearNightChecks() {
        this.nightChecks = {};
        this.nightNumber = (this.nightNumber || 0) + 1;
        this.saveRoomStateIncremental({ nightChecks: {}, nightNumber: this.nightNumber });
    },

    // Get night check history for a specific checker (Don or Sheriff)
    getNightCheckHistoryFor(roleKey) {
        if (!this.nightCheckHistory || !Array.isArray(this.nightCheckHistory)) return [];
        return this.nightCheckHistory.filter(h => h.checker === roleKey);
    },

    // =============================================
    // Protocol/Opinion Acceptance (Hold-protected)
    // =============================================
    validateProtocolOpinion(roleKey) {
        const protocol = this.protocolData[roleKey] || {};
        const opinion = this.opinionData[roleKey] || {};
        const pVals = Object.values(protocol).filter(v => v);
        const oVals = Object.values(opinion).filter(v => v);

        const pDon = pVals.filter(r => r === 'don').length;
        const pSheriff = pVals.filter(r => r === 'sheriff').length;
        const oDon = oVals.filter(r => r === 'don').length;
        const oSheriff = oVals.filter(r => r === 'sheriff').length;

        const errors = [];
        // Протокол: допускается 0 или 1 шериф, 0 или 1 дон (не больше 1)
        if (pDon > 1) errors.push('Протокол: Дон ' + pDon + ' (макс. 1)');
        if (pSheriff > 1) errors.push('Протокол: Шериф ' + pSheriff + ' (макс. 1)');
        // Мнение: допускается 0 или 1 шериф, 0 или 1 дон (не больше 1), независимо от протокола
        if (oDon > 1) errors.push('Мнение: Дон ' + oDon + ' (макс. 1)');
        if (oSheriff > 1) errors.push('Мнение: Шериф ' + oSheriff + ' (макс. 1)');

        return { valid: errors.length === 0, errors };
    },

    startProtocolHold(roleKey) {
        const validation = this.validateProtocolOpinion(roleKey);
        if (!validation.valid) {
            this.showAlert(validation.errors.join(', '));
            window.haptic && window.haptic.notification('error');
            return;
        }
        this._dayHoldTarget = roleKey;
        this._dayHoldType = 'accept_protocol';
        this.dayHoldActive = true;
        this._dayHoldTimestamp = Date.now();
        this._dayHoldTimer = setTimeout(() => {
            if (this.dayHoldActive && this._dayHoldType === 'accept_protocol') {
                this.dayHoldActive = false;
                this.$set(this.protocolAccepted, roleKey, true);
                this.$set(this.killedCardPhase, roleKey, 'done');
                // Закрываем карточку и убираем пульсирование
                this.$set(this.killedPlayerBlink, roleKey, false);
                this.highlightedPlayer = null;
                window.haptic && window.haptic.notification('success');
                this.saveRoomStateIncremental({
                    protocolAccepted: this.protocolAccepted,
                    killedCardPhase: this.killedCardPhase,
                    killedPlayerBlink: this.killedPlayerBlink
                });
                this.sendFullState();
                this.saveCurrentSession();
            }
        }, 800);
    },

    startEditProtocolHold(roleKey) {
        this._dayHoldTarget = roleKey;
        this._dayHoldType = 'edit_protocol';
        this.dayHoldActive = true;
        this._dayHoldTimestamp = Date.now();
        this._dayHoldTimer = setTimeout(() => {
            if (this.dayHoldActive && this._dayHoldType === 'edit_protocol') {
                this.dayHoldActive = false;
                this.$set(this.protocolAccepted, roleKey, false);
                this.$set(this.killedCardPhase, roleKey, 'protocol');
                window.haptic && window.haptic.notification('warning');
                this.saveRoomStateIncremental({ protocolAccepted: this.protocolAccepted, killedCardPhase: this.killedCardPhase });
                this.sendFullState();
                this.saveCurrentSession();
            }
        }, 800);
    },

    // =============================================
    // Best Move Acceptance (Hold-protected)
    // =============================================
    startBestMoveHold(roleKey) {
        this._dayHoldTarget = roleKey;
        this._dayHoldType = 'accept_bm';
        this.dayHoldActive = true;
        this._dayHoldTimestamp = Date.now();
        this._dayHoldTimer = setTimeout(() => {
            if (this.dayHoldActive && this._dayHoldType === 'accept_bm') {
                this.dayHoldActive = false;
                this.bestMoveAccepted = true;
                this.bestMoveSelected = true;
                this.$set(this.killedCardPhase, roleKey, 'timer');
                window.haptic && window.haptic.notification('success');
                this.saveRoomStateIncremental({
                    bestMoveAccepted: true, bestMoveSelected: true, bestMove: this.bestMove,
                    killedCardPhase: this.killedCardPhase
                });
                this.sendFullState();
                this.saveCurrentSession();
            }
        }, 800);
    },

    startEditBestMoveHold(roleKey) {
        this._dayHoldTarget = roleKey;
        this._dayHoldType = 'edit_bm';
        this.dayHoldActive = true;
        this._dayHoldTimestamp = Date.now();
        this._dayHoldTimer = setTimeout(() => {
            if (this.dayHoldActive && this._dayHoldType === 'edit_bm') {
                this.dayHoldActive = false;
                this.bestMoveAccepted = false;
                this.$set(this.killedCardPhase, roleKey, 'bm');
                window.haptic && window.haptic.notification('warning');
                this.saveRoomStateIncremental({ bestMoveAccepted: false, killedCardPhase: this.killedCardPhase });
                this.sendFullState();
                this.saveCurrentSession();
            }
        }, 800);
    },

    // Переход к протоколу/мнению из таймера
    openProtocolForKilled(roleKey) {
        this.$set(this.killedCardPhase, roleKey, 'protocol');
        this.saveRoomStateIncremental({ killedCardPhase: this.killedCardPhase });
        this.sendFullState();
    },

    // Cancel any hold (reuses cancelDayHold logic for protocol/bm holds)
    cancelProtocolHold() {
        if (this._dayHoldTimer) {
            clearTimeout(this._dayHoldTimer);
            this._dayHoldTimer = null;
        }
        if (this.dayHoldActive) {
            this.dayHoldActive = false;
            const type = this._dayHoldType;
            if (type === 'accept_protocol' || type === 'accept_bm') {
                this.showAlert('Удерживайте для подтверждения');
            } else if (type === 'edit_protocol' || type === 'edit_bm') {
                this.showAlert('Удерживайте для редактирования');
            }
        }
        this._dayHoldTarget = null;
        this._dayHoldType = null;
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

    // =====================================================
    // Funky Mode — свободная игра с ручным вводом игроков
    // =====================================================

    startFunkyMode() {
        console.log('🎉 startFunkyMode: Запускаем режим Фанки');

        this.funkyMode = true;
        this.manualMode = false;
        this.inputMode = 'funky';
        this.funkyGameNumber = 1;
        this.funkyTableNumber = 1;

        // Генерируем название турнира — текущая дата
        const now = new Date();
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        this._tournamentDisplayName = `Фанки ${dateStr}`;
        this.mainInfoText = this._tournamentDisplayName;

        // Генерируем уникальный tournamentId для фанки-турнира
        this.tournamentId = 'funky_' + Date.now();

        // Инициализируем 10 пустых слотов для игроков
        this.funkyPlayers = [];
        this.funkyPlayerInputs = [];
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;
        this.funkySearchLoading = false;

        for (let i = 0; i < 10; i++) {
            this.funkyPlayers.push(null);
            this.funkyPlayerInputs.push('');
        }

        // Генерируем sessionId
        if (!this.currentSessionId && window.sessionManager) {
            this.currentSessionId = window.sessionManager.generateSessionId();
        }

        // Показываем экран ввода игроков (внутри showModal)
        this.showModal = true;
        this.showRoomModal = false;
        this.showMainMenu = false;
        this.showGameTableModal = false;
        this.newGameStep = 'funky';

        this.saveCurrentSession();
    },

    // Поиск игроков в базе данных
    async funkySearchPlayer(index) {
        const query = this.funkyPlayerInputs[index];

        if (!query || query.trim().length < 1) {
            this.funkySearchResults = [];
            this.funkySearchLoading = false;
            return;
        }

        // Показываем индикатор загрузки только если ещё нет результатов
        // (чтобы не мигал дропдаун при обновлении результатов)
        if (this.funkySearchResults.length === 0) {
            this.funkySearchLoading = true;
        }
        this.funkyActiveInput = index;
        console.log('🔍 funkySearchPlayer: Ищем "' + query.trim() + '" для слота', index);

        try {
            const url = `/api/players-search.php?za&q=${encodeURIComponent(query.trim())}`;
            console.log('🔍 funkySearchPlayer: URL:', url);
            const response = await fetch(url);

            // Проверяем, не переключился ли пользователь на другой инпут пока шёл запрос
            if (this.funkyActiveInput !== index) {
                console.log('🔍 funkySearchPlayer: Инпут сменился, результаты не применяем');
                return;
            }

            console.log('🔍 funkySearchPlayer: response.status:', response.status, 'ok:', response.ok);

            if (response.ok) {
                const text = await response.text();
                console.log('🔍 funkySearchPlayer: raw response:', text.substring(0, 300));

                // Повторная проверка после второго await
                if (this.funkyActiveInput !== index) {
                    console.log('🔍 funkySearchPlayer: Инпут сменился после text(), не применяем');
                    return;
                }

                let results;
                try {
                    results = JSON.parse(text);
                } catch (parseErr) {
                    console.error('❌ funkySearchPlayer: JSON parse error:', parseErr.message, 'raw:', text.substring(0, 200));
                    this.funkySearchResults = [];
                    return;
                }

                if (Array.isArray(results)) {
                    const selectedLogins = this.funkyPlayers
                        .filter(p => p !== null)
                        .map(p => p.login);
                    this.funkySearchResults = results.filter(r => !selectedLogins.includes(r.login));
                    console.log('🔍 funkySearchPlayer: Найдено', this.funkySearchResults.length, 'результатов');
                } else if (results && results.error) {
                    console.error('❌ funkySearchPlayer: API error:', results.error);
                    this.funkySearchResults = [];
                } else {
                    console.warn('⚠️ funkySearchPlayer: Unexpected response format:', results);
                    this.funkySearchResults = [];
                }
            } else {
                // Логируем тело ответа даже при ошибке, чтобы видеть причину
                try {
                    const errText = await response.text();
                    console.error('❌ funkySearchPlayer: HTTP error:', response.status, response.statusText, 'Body:', errText.substring(0, 500));
                } catch(_e) {
                    console.error('❌ funkySearchPlayer: HTTP error:', response.status, response.statusText);
                }
                this.funkySearchResults = [];
            }
        } catch (e) {
            console.error('❌ funkySearchPlayer: Fetch error:', e.message || e);
            this.funkySearchResults = [];
        } finally {
            this.funkySearchLoading = false;
        }
    },

    // Выбор игрока из результатов поиска
    funkySelectPlayer(index, player) {
        console.log(`✅ funkySelectPlayer: Слот ${index + 1} = ${player.login}`);

        const roleKey = `${this.funkyGameNumber}-${this.funkyTableNumber}-${index + 1}`;

        this.$set(this.funkyPlayers, index, {
            login: player.login,
            avatar_link: player.avatar_link || null,
            id: player.id || null,
            title: player.title || null,
            roleKey: roleKey,
            num: index + 1
        });

        this.$set(this.funkyPlayerInputs, index, player.login);
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;

        // Кэшируем аватарку
        if (player.avatar_link) {
            if (!this.avatarsFromServer) this.avatarsFromServer = {};
            this.$set(this.avatarsFromServer, player.login, player.avatar_link);
        }

        // Автоматически фокусируемся на следующем пустом слоте
        this.$nextTick(() => {
            const nextEmpty = this.funkyPlayers.findIndex(p => p === null);
            if (nextEmpty !== -1) {
                const nextInput = document.querySelector(`.funky-player-input[data-index="${nextEmpty}"]`);
                if (nextInput) nextInput.focus();
            }
        });

        this.saveCurrentSession();
    },

    // Ручной ввод имени игрока (если нет в базе)
    funkySetManualPlayer(index) {
        const name = this.funkyPlayerInputs[index];
        if (!name || !name.trim()) return;

        // Проверяем, не выбран ли уже этот игрок
        const existing = this.funkyPlayers.find(p => p && p.login === name.trim());
        if (existing) {
            console.warn('⚠️ Игрок уже выбран:', name.trim());
            return;
        }

        const roleKey = `${this.funkyGameNumber}-${this.funkyTableNumber}-${index + 1}`;

        this.$set(this.funkyPlayers, index, {
            login: name.trim(),
            avatar_link: null,
            id: null,
            title: null,
            roleKey: roleKey,
            num: index + 1
        });

        this.funkySearchResults = [];
        this.funkyActiveInput = -1;

        this.saveCurrentSession();
    },

    // Очистка слота игрока
    funkyClearPlayer(index) {
        const player = this.funkyPlayers[index];
        if (player && player.login && this.avatarsFromServer) {
            // Не удаляем аватарку из кэша — она может понадобиться
        }

        this.$set(this.funkyPlayers, index, null);
        this.$set(this.funkyPlayerInputs, index, '');
        this.funkySearchResults = [];

        this.saveCurrentSession();
    },

    // Проверка: все 10 игроков заполнены
    funkyAllPlayersFilled() {
        return this.funkyPlayers.length === 10 && this.funkyPlayers.every(p => p !== null);
    },

    // Подвести итоги Фанки-вечера
    funkyBuildSummary(tournamentId) {
        console.log('📊 funkyBuildSummary: Собираем статистику для', tournamentId);

        const sessions = (this.sessionsList || []).filter(s => s.tournamentId === tournamentId);
        if (!sessions.length) {
            this.showAlert && this.showAlert('Нет игр для подведения итогов');
            return;
        }

        // Собираем статистику по каждому игроку
        const stats = {}; // { login: { ... } }

        sessions.forEach(session => {
            if (!session.winnerTeam) return; // пропускаем незавершённые

            const players = session.funkyPlayers || session.manualPlayers || [];
            const roles = session.roles || {};
            const actions = session.playersActions || {};
            const fouls = session.fouls || {};
            const techFouls = session.techFouls || {};
            const removed = session.removed || {};
            const scores = session.playerScores || {};
            const firstKilled = session.firstKilledPlayer || null;
            const winnerTeam = session.winnerTeam;

            players.forEach((p, i) => {
                if (!p || !p.login) return;
                const login = p.login;
                const roleKey = p.roleKey || ((session.funkyGameNumber || session.gameSelected || 1) + '-' + (session.funkyTableNumber || 1) + '-' + (i + 1));
                const role = roles[roleKey] || null; // null = мирный, 'don', 'black', 'sheriff'

                if (!stats[login]) {
                    stats[login] = {
                        login: login,
                        avatar_link: p.avatar_link || null,
                        totalScore: 0,
                        games: 0,
                        wins: 0,
                        bonusTotal: 0,
                        penaltyTotal: 0,
                        firstKilled: 0,    // ПУ
                        killed: 0,         // убит ночью
                        selfKills: 0,      // самострелы
                        peacePlayed: 0, peaceWins: 0,
                        mafiaPlayed: 0, mafiaWins: 0,
                        donPlayed: 0, donWins: 0,
                        sheriffPlayed: 0, sheriffWins: 0,
                        foulsTotal: 0,
                        techFoulsTotal: 0,
                        removals: 0
                    };
                }
                const s = stats[login];
                if (p.avatar_link && !s.avatar_link) s.avatar_link = p.avatar_link;

                s.games++;

                // Роль
                const isCivilian = !role || role === 'sheriff';
                const isMafia = role === 'black' || role === 'don';
                if (role === 'don') { s.donPlayed++; }
                else if (role === 'black') { s.mafiaPlayed++; }
                else if (role === 'sheriff') { s.sheriffPlayed++; }
                else { s.peacePlayed++; }

                // Победа
                const won = (winnerTeam === 'civilians' && isCivilian) || (winnerTeam === 'mafia' && isMafia);
                if (won) {
                    s.wins++;
                    if (role === 'don') s.donWins++;
                    else if (role === 'black') s.mafiaWins++;
                    else if (role === 'sheriff') s.sheriffWins++;
                    else s.peaceWins++;
                }

                // Действия
                const action = actions[roleKey];
                if (action === 'killed') {
                    s.killed++;
                    // Самострел: мафия убита ночью
                    if (isMafia) s.selfKills++;
                }

                // ПУ — первый убитый
                if (firstKilled === roleKey) {
                    s.firstKilled++;
                }

                // Фолы
                const foulCount = Number(fouls[roleKey]) || 0;
                s.foulsTotal += foulCount;
                const tfCount = Number(techFouls[roleKey]) || 0;
                s.techFoulsTotal += tfCount;

                // Удаления
                if (removed[roleKey] || action === 'removed' || action === 'tech_fall_removed' || action === 'fall_removed') {
                    s.removals++;
                }

                // Баллы
                let gameScore = 0;
                if (won) gameScore += 1;
                const bonus = parseFloat(scores[roleKey]?.bonus || 0);
                const penalty = parseFloat(scores[roleKey]?.penalty || 0);
                gameScore += bonus - penalty;
                s.totalScore += gameScore;
                s.bonusTotal += bonus;
                s.penaltyTotal += penalty;
            });
        });

        // Сортируем по totalScore убыванию
        const sorted = Object.values(stats).sort((a, b) => b.totalScore - a.totalScore);
        sorted.forEach(s => { s.totalScore = parseFloat(s.totalScore.toFixed(2)); s.bonusTotal = parseFloat(s.bonusTotal.toFixed(2)); s.penaltyTotal = parseFloat(s.penaltyTotal.toFixed(2)); });

        // === Собираем данные по каждой игре для вкладки "По играм" ===
        const perGameData = [];
        sessions.forEach(session => {
            if (!session.winnerTeam) return;

            const players = session.funkyPlayers || session.manualPlayers || [];
            const roles = session.roles || {};
            const actions = session.playersActions || {};
            const fouls = session.fouls || {};
            const techFouls = session.techFouls || {};
            const scores = session.playerScores || {};
            const protocolData = session.protocolData || {};
            const opinionData = session.opinionData || {};
            const opinionText = session.opinionText || {};
            const winnerTeam = session.winnerTeam;
            const bestMove = session.bestMove || [];
            const firstKilledPlayer = session.firstKilledPlayer || null;
            const nightCheckHistory = session.nightCheckHistory || [];
            const votingHistory = session.votingHistory || [];
            const nightMisses = session.nightMisses || {};
            const nightNumber = session.nightNumber || 1;

            const gamePlayers = [];
            players.forEach((p, i) => {
                if (!p || !p.login) return;
                const roleKey = p.roleKey || ((session.funkyGameNumber || session.gameSelected || 1) + '-' + (session.funkyTableNumber || 1) + '-' + (i + 1));
                const role = roles[roleKey] || null;
                const action = actions[roleKey] || null;
                const isCivilian = !role || role === 'sheriff';
                const isMafia = role === 'black' || role === 'don';
                const won = (winnerTeam === 'civilians' && isCivilian) || (winnerTeam === 'mafia' && isMafia);

                let gameScore = 0;
                if (won) gameScore += 1;
                const bonus = parseFloat(scores[roleKey]?.bonus || 0);
                const penalty = parseFloat(scores[roleKey]?.penalty || 0);
                gameScore += bonus - penalty;

                // Protocol check results
                let protocolResults = null;
                if (protocolData[roleKey]) {
                    const pr = {};
                    let has = false;
                    Object.keys(protocolData[roleKey]).forEach(idx => {
                        const predicted = protocolData[roleKey][idx];
                        if (predicted) {
                            has = true;
                            const targetIdx = parseInt(idx);
                            const targetP = players[targetIdx - 1];
                            const targetRoleKey = targetP?.roleKey || ((session.funkyGameNumber || session.gameSelected || 1) + '-' + (session.funkyTableNumber || 1) + '-' + targetIdx);
                            const actualRole = roles[targetRoleKey] || null;
                            let isCorrect = false;
                            if (predicted === 'peace' && !actualRole) isCorrect = true;
                            else if (predicted === 'sheriff' && actualRole === 'sheriff') isCorrect = true;
                            else if (predicted === 'mafia' && actualRole === 'black') isCorrect = true;
                            else if (predicted === 'don' && actualRole === 'don') isCorrect = true;
                            pr[idx] = { role: predicted, correct: isCorrect };
                        }
                    });
                    if (has) protocolResults = pr;
                }

                // Opinion check results
                let opinionResults = null;
                if (opinionData[roleKey]) {
                    const or = {};
                    let has = false;
                    Object.keys(opinionData[roleKey]).forEach(idx => {
                        const predicted = opinionData[roleKey][idx];
                        if (predicted) {
                            has = true;
                            const targetIdx = parseInt(idx);
                            const targetP = players[targetIdx - 1];
                            const targetRoleKey = targetP?.roleKey || ((session.funkyGameNumber || session.gameSelected || 1) + '-' + (session.funkyTableNumber || 1) + '-' + targetIdx);
                            const actualRole = roles[targetRoleKey] || null;
                            let isCorrect = false;
                            if (predicted === 'peace' && !actualRole) isCorrect = true;
                            else if (predicted === 'sheriff' && actualRole === 'sheriff') isCorrect = true;
                            else if (predicted === 'mafia' && actualRole === 'black') isCorrect = true;
                            else if (predicted === 'don' && actualRole === 'don') isCorrect = true;
                            or[idx] = { role: predicted, correct: isCorrect };
                        }
                    });
                    if (has) opinionResults = or;
                }

                const playerNightChecks = nightCheckHistory.filter(h => h.checker === roleKey);

                gamePlayers.push({
                    num: i + 1,
                    login: p.login,
                    avatar_link: p.avatar_link || null,
                    roleKey: roleKey,
                    role: role,
                    action: action,
                    won: won,
                    foul: Number(fouls[roleKey]) || 0,
                    techFoul: Number(techFouls[roleKey]) || 0,
                    bonus: parseFloat(bonus.toFixed(2)),
                    penalty: parseFloat(penalty.toFixed(2)),
                    reveal: scores[roleKey]?.reveal || false,
                    totalScore: parseFloat(gameScore.toFixed(2)),
                    isFirstKilled: firstKilledPlayer === roleKey,
                    isSelfKill: isMafia && action === 'killed',
                    protocolResults: protocolResults,
                    opinionResults: opinionResults,
                    opinionText: opinionText[roleKey] || '',
                    nightChecks: playerNightChecks
                });
            });

            perGameData.push({
                gameNumber: session.funkyGameNumber || session.gameSelected || perGameData.length + 1,
                winnerTeam: winnerTeam,
                players: gamePlayers,
                bestMove: bestMove,
                firstKilledPlayer: firstKilledPlayer,
                votingHistory: votingHistory,
                nightCheckHistory: nightCheckHistory,
                nightMisses: nightMisses,
                nightNumber: nightNumber
            });
        });

        this.funkySummaryData = sorted;
        this.funkySummaryGames = perGameData;
        this.funkySummaryExpanded = null;
        this.funkySummaryGameExpanded = null;
        this.funkySummaryPlayerExpanded = null;
        this.funkySummaryTab = 'overall';
        this.funkySummaryTournamentName = sessions[0]?.tournamentName || sessions[0]?.mainInfoText || 'Фанки';
        this.funkySummarySharing = false;
        this.funkySummaryShareUrl = '';
        this.showFunkySummary = true;
        this.showMainMenu = false;

        console.log('📊 funkyBuildSummary: Готово,', sorted.length, 'игроков,', perGameData.length, 'игр');
    },

    // Сохранить результаты игры (кнопка «Сохранить» в интерфейсе расстановки баллов)
    funkySaveGameResults() {
        // Помечаем игру как завершённую с сохранёнными баллами
        this._funkyGameSaved = true;

        // Сохраняем сессию
        this.saveCurrentSession();

        // Возвращаемся в главное меню
        this.showMainMenu = true;
        this.showModal = false;
        this.showRoomModal = false;
        this.showGameTableModal = false;

        console.log('💾 funkySaveGameResults: Игра сохранена');

        // Если это фанки — можно создать следующую игру из меню
        if (window.haptic) window.haptic.notification('success');
    },

    // Поделиться итогами вечера — сохраняет на сервер и копирует ссылку
    async funkyShareSummary() {
        if (this.funkySummarySharing) return;

        // Если ссылка уже есть — сразу открываем шеринг Telegram
        if (this.funkySummaryShareUrl) {
            this._funkyOpenTelegramShare(this.funkySummaryShareUrl);
            return;
        }

        this.funkySummarySharing = true;
        try {
            const payload = {
                tournamentName: this.funkySummaryTournamentName || 'Фанки',
                data: this.funkySummaryData,
                games: this.funkySummaryGames || [],
                createdAt: new Date().toISOString()
            };

            const res = await fetch('/api/summary-save.php?za', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('❌ funkyShareSummary: HTTP error:', res.status, text);
                this.funkySummarySharing = false;
                return;
            }

            const result = await res.json();
            if (result.id) {
                const baseUrl = window.location.origin;
                const shareUrl = baseUrl + '/summary.html?id=' + result.id;
                this.funkySummaryShareUrl = shareUrl;
                console.log('📋 Ссылка создана:', shareUrl);

                // Открываем интерфейс «Поделиться» в Telegram
                this._funkyOpenTelegramShare(shareUrl);
            } else {
                console.error('❌ funkyShareSummary: No ID in response', result);
            }
        } catch (err) {
            console.error('❌ funkyShareSummary: Error', err);
        }
        this.funkySummarySharing = false;
    },

    // Открыть стандартный диалог «Поделиться» в Telegram (выбор получателя)
    _funkyOpenTelegramShare(url) {
        const text = '📊 ' + (this.funkySummaryTournamentName || 'Итоги вечера');
        const tg = window.Telegram && window.Telegram.WebApp;

        if (tg && typeof tg.openTelegramLink === 'function') {
            // t.me/share/url — стандартный Telegram share dialog с выбором чата
            const shareLink = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
            tg.openTelegramLink(shareLink);
            console.log('📤 Telegram share dialog opened');
        } else {
            // Fallback — копируем в буфер обмена
            try {
                navigator.clipboard.writeText(url);
                console.log('📋 Ссылка скопирована (не в Telegram):', url);
            } catch (e) {
                prompt('Скопируйте ссылку:', url);
            }
        }
    },

    // Случайная рассадка игроков (перемешивание)
    funkyShufflePlayers() {
        if (!this.funkyAllPlayersFilled()) return;
        console.log('🔀 funkyShufflePlayers: Перемешиваем игроков');

        // Fisher-Yates shuffle
        const players = [...this.funkyPlayers];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        // Обновляем roleKey и num после перемешивания
        for (let i = 0; i < players.length; i++) {
            if (players[i]) {
                players[i] = {
                    ...players[i],
                    num: i + 1,
                    roleKey: `${this.funkyGameNumber}-${this.funkyTableNumber}-${i + 1}`
                };
            }
        }

        this.funkyPlayers = players;
        this.funkyPlayerInputs = players.map(p => p ? p.login : '');
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;
    },

    // Подтверждение состава и переход к раздаче ролей
    funkyConfirmPlayers() {
        if (!this.funkyAllPlayersFilled()) {
            this.showAlert('Необходимо заполнить всех 10 игроков');
            return;
        }

        console.log('🎉 funkyConfirmPlayers: Подтверждаем состав, переходим к раздаче ролей');

        // Формируем массив игроков для совместимости с tableOut
        const players = this.funkyPlayers.map((p, i) => ({
            ...p,
            num: i + 1,
            roleKey: `${this.funkyGameNumber}-${this.funkyTableNumber}-${i + 1}`
        }));

        // Записываем в manualGames (manualPlayers — computed, читает из manualGames)
        this.manualGames = [{
            num: this.funkyGameNumber,
            players: players
        }];
        this.manualGameSelected = this.funkyGameNumber;

        // Включаем manualMode для совместимости с tableOut computed
        this.manualMode = true;
        this.gameSelected = this.funkyGameNumber;
        this.tableSelected = this.funkyTableNumber;

        // Обновляем информационный текст
        this.additionalInfoText = `Игра ${this.funkyGameNumber} | Стол ${this.funkyTableNumber}`;

        // Скрываем экран ввода, переходим к стандартному интерфейсу
        this.showModal = false;
        this.showMainMenu = false;
        this.showGameTableModal = false;
        this.editRoles = true;
        this.newGameStep = 'modes';

        // Сохраняем аватарки на сервер
        const avatars = {};
        this.funkyPlayers.forEach(p => {
            if (p && p.avatar_link) {
                avatars[p.login] = p.avatar_link;
            }
        });
        if (Object.keys(avatars).length > 0) {
            this.avatarsFromServer = { ...(this.avatarsFromServer || {}), ...avatars };
            if (this.saveAvatarsToServer) {
                this.saveAvatarsToServer(this.avatarsFromServer);
            }
        }

        this.$forceUpdate();
        this.saveCurrentSession();

        if (this.sendFullState && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendFullState();
        }
    },

    // Начать следующую игру Фанки (вызывается из турнирной карточки или из UI)
    startNextFunkyGame() {
        console.log('🎉 startNextFunkyGame: Следующая игра Фанки');

        const currentTournamentId = this.tournamentId;
        const currentTournamentName = this._tournamentDisplayName;
        const nextGameNum = this.funkyGameNumber + 1;

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

        // Восстанавливаем турнирные данные
        this.currentSessionId = window.sessionManager ? window.sessionManager.generateSessionId() : ('sess_' + Date.now());
        this.funkyMode = true;
        this.manualMode = false;
        this.inputMode = 'funky';
        this.tournamentId = currentTournamentId;
        this._tournamentDisplayName = currentTournamentName;
        this.mainInfoText = currentTournamentName;
        this.funkyGameNumber = nextGameNum;
        this.funkyTableNumber = 1;
        this.gameSelected = nextGameNum;
        this.tableSelected = 1;

        // Инициализируем 10 пустых слотов
        this.funkyPlayers = [];
        this.funkyPlayerInputs = [];
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;

        for (let i = 0; i < 10; i++) {
            this.funkyPlayers.push(null);
            this.funkyPlayerInputs.push('');
        }

        // Показываем экран ввода игроков
        this.showModal = true;
        this.showMainMenu = false;
        this.showRoomModal = false;
        this.showGameTableModal = false;
        this.newGameStep = 'funky';

        this.saveCurrentSession();
    },

    // Debounce для поиска
    funkyOnInput(index) {
        // Если пользователь переключился на другой инпут — сбрасываем результаты
        if (this.funkyActiveInput !== index) {
            this.funkySearchResults = [];
            this.funkySearchLoading = false;
        }
        this.funkyActiveInput = index;
        console.log('🔍 funkyOnInput: index=', index, 'value=', this.funkyPlayerInputs[index]);

        clearTimeout(this._funkySearchTimeout);

        const query = this.funkyPlayerInputs[index];
        if (!query || query.trim().length < 1) {
            this.funkySearchResults = [];
            this.funkySearchLoading = false;
            return;
        }

        // НЕ ставим funkySearchLoading = true здесь!
        // Это скрывало бы текущие результаты поиска при каждом нажатии клавиши.
        // Loading будет установлен внутри funkySearchPlayer перед fetch.

        this._funkySearchTimeout = setTimeout(() => {
            this.funkySearchPlayer(index);
        }, 300);
    },

    // Закрытие выпадающего списка (вызывается только при явных действиях)
    funkyCloseSearch() {
        this.funkySearchResults = [];
        this.funkyActiveInput = -1;
        this.funkySearchLoading = false;
        clearTimeout(this._funkySearchTimeout);
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
    },

    // Получить роль-класс для тега
    getSummaryRoleClass(role) {
        if (role === 'don') return 'don';
        if (role === 'black') return 'mafia';
        if (role === 'sheriff') return 'sheriff';
        return 'peace';
    },

    // Построить хронологию ночей для одной игры
    buildGameNightTimeline(game) {
        if (!game) return [];
        const timeline = [];
        const nch = game.nightCheckHistory || [];
        const players = game.players || [];

        // Определяем максимальную ночь
        let maxNight = game.nightNumber || 1;
        nch.forEach(h => { if (h.night > maxNight) maxNight = h.night; });

        for (let night = 1; night <= maxNight; night++) {
            const events = [];

            // Убийство в эту ночь
            const killedInNight = players.filter(p => {
                // Если у нас нет точной информации о ночи убийства, восстанавливаем из контекста
                // Первый убитый (isFirstKilled) — ночь 1
                if (p.action === 'killed') {
                    if (p.isFirstKilled && night === 1) return true;
                }
                return false;
            });
            // Более общий подход: ночные проверки показывают какая ночь была,
            // а убийства привязаны к action — покажем убийство по ПУ для ночи 1
            if (night === 1) {
                const fk = players.find(p => p.isFirstKilled);
                if (fk) {
                    events.push({ type: 'kill', icon: '💀', text: '№' + fk.num + ' ' + fk.login + ' убит' + (fk.isSelfKill ? ' (самострел)' : '') });
                }
            }

            // Промах
            if (game.nightMisses && game.nightMisses[night]) {
                events.push({ type: 'miss', icon: '❌', text: 'Промах' });
            }

            // Проверки Дона
            nch.filter(h => h.night === night && h.checkerRole === 'don').forEach(h => {
                events.push({ type: 'don-check', icon: '🎩', text: 'Дон проверил №' + h.target + ' ' + (h.targetLogin || '') + ' — ' + h.result });
            });

            // Проверки Шерифа
            nch.filter(h => h.night === night && h.checkerRole === 'sheriff').forEach(h => {
                events.push({ type: 'sheriff-check', icon: '⭐', text: 'Шериф проверил №' + h.target + ' ' + (h.targetLogin || '') + ' — ' + h.result });
            });

            if (events.length > 0) {
                timeline.push({ night: night, events: events });
            }
        }

        return timeline;
    }
});

console.log('✅ app-game-logic.js загружен, методы добавлены в window.app.methods');
