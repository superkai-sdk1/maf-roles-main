// ОБНОВЛЕНО v2: полностью исправлена работа с playersActions (объект вместо Map)
window.votingMixin = {    data() {
        return {
            showVotingScreen: false,
            votingScreenTab: 'voting', // 'voting' | 'history'
            votingHistoryDayFilter: 0, // 0 = все дни
            showVotingModal: false,
            showVotingHistory: false,
            votingOrder: [],
            votingCurrentIndex: 0,
            votingResults: {},
            votingVotedPlayers: [],
            votingFinished: false,
            votingWinners: [],
            votingStage: 'main', // 'main', 'tie', 'lift'
            votingTiePlayers: [],
            votingLiftResults: [],            votingHistory: [], // теперь массив основных голосований, каждый с вложенными этапами
            votingMainIndex: 0, // индекс текущего основного голосования
            currentVotingSession: null, // Объект для накопления текущего голосования перед записью в историю
            nominations: {},
            nominationsLocked: false,
            votingNominationsAll: [], // Новый массив для хранения всех выставленных кандидатов
            firstKilledPlayer: null, // Новый параметр для хранения информации о первом убитом игроке
            acceptDisabled: false, // блокировка кнопки принять
            votingNotification: '', // уведомление о непроголосовавших
            votingNotificationTimeout: null,
                liftWinners: [],
            // Таймер ничьей (дополнительное время для кандидатов при ничьей)
            votingTieTimerActive: false,
            votingTieTimerPlayerIndex: 0,
            votingTieTimerTimeLeft: 30,
            votingTieTimerRunning: false,
            votingTieTimerPaused: false,
            votingTieTimerIntervalId: null,
            votingTieTimerDefaultTime: 30,
            // Таймер крайней речи (после завершения голосования)
            votingLastSpeechTimerActive: false,
            votingLastSpeechTimerTimeLeft: 60,
            votingLastSpeechTimerRunning: false,
            votingLastSpeechTimerPaused: false,
            votingLastSpeechTimerIntervalId: null,
            votingLastSpeechTimerDefaultTime: 60,
            votingLastSpeechPlayerIndex: 0,
        };
    },
    methods: {
        // Определяет, является ли игрок активным (живым и не удаленным)
        isPlayerActive(roleKey) {
            const action = this.playersActions[roleKey];
            // Игрок неактивен если он убит, заголосован, удален или удален по нарушениям
            return !action || !['killed', 'voted', 'removed', 'tech_fall_removed', 'fall_removed'].includes(action);
        },        // Открыть экран голосования
        openVotingScreen() {
            this.showVotingScreen = true;
            this.votingScreenTab = 'voting';
            // Автостарт голосования если есть выставленные кандидатуры
            if (this.hasNominatedCandidates() && !this.showVotingModal) {
                this.$nextTick(() => { this.startVoting(); });
            }
        },

        // Закрыть экран голосования
        closeVotingScreen() {
            // Если идет активное голосование, не закрываем экран
            if (this.showVotingModal) {
                return;
            }
            this.showVotingScreen = false;
        },

        // Получить уникальные дни из истории голосований
        getVotingHistoryDays() {
            if (!this.votingHistory || !this.votingHistory.length) return [];
            const days = [...new Set(this.votingHistory.map(v => v.dayNumber))];
            return days.sort((a, b) => a - b);
        },

        // Получить отфильтрованную историю по дню
        getFilteredVotingHistory() {
            if (!this.votingHistory || !this.votingHistory.length) return [];
            if (this.votingHistoryDayFilter === 0) return this.votingHistory;
            return this.votingHistory.filter(v => v.dayNumber === this.votingHistoryDayFilter);
        },

        // Проверить, есть ли выставленные кандидатуры
        hasNominatedCandidates() {
            const nominatedCandidates = Object.entries(this.nominations || {})
                .filter(([_, nums]) => nums && nums.length)
                .map(([roleKey, nums]) => nums[0])
                .filter((num, idx, arr) => arr.indexOf(num) === idx);
            return nominatedCandidates.length > 0;
        },

        // Получить количество голосов за кандидата
        getVotesForCandidate(candidate) {
            if (!this.votingResults || !this.votingResults[candidate]) return 0;
            return this.votingResults[candidate].length;
        },

        // Проверить, были ли непроголосовавшие автоматически добавлены к последнему кандидату
        hasAutoVotedPlayers() {
            if (this.votingStage !== 'main' && this.votingStage !== 'tie') return false;
            if (this.votingCurrentIndex !== this.votingOrder.length - 1) return false;
            const alivePlayers = this.tableOut
                .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                .filter(p => this.isPlayerActive(p.roleKey))
                .map(p => p.num);
            const allVoted = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
            const notVoted = alivePlayers.filter(num => !allVoted.includes(num));
            return notVoted.length > 0;
        },

        // Перейти в ночь из экрана голосования
        goToNightFromVoting() {
            this.showVotingScreen = false;
            this.showVotingModal = false;
            this.setMode('night');
        },

        // Завершить голосование, применить результаты и перейти в ночь
        finishVotingAndGoToNight() {
            this.closeVotingModalAndApplyResults();
            this.$nextTick(() => {
                this.showVotingScreen = false;
                this.setMode('night');
            });
        },

        // Завершить голосование без заголосованных и перейти в ночь
        finishVotingNoWinnersAndGoToNight() {
            this.closeVotingModalAndApplyResults();
            this.$nextTick(() => {
                this.showVotingScreen = false;
                this.setMode('night');
            });
        },

        startVoting() {
            // Проверяем, есть ли выставленные кандидатуры
            const nominatedCandidates = Object.entries(this.nominations)
                .filter(([_, nums]) => nums && nums.length)
                .map(([roleKey, nums]) => nums[0])
                .filter((num, idx, arr) => arr.indexOf(num) === idx);
            
            if (nominatedCandidates.length === 0) {
                // Показываем уведомление и не открываем модальное окно
                if (window.showPanelNotification) {
                    window.showPanelNotification('Нельзя начать голосование без выставленных кандидатур!', 3000);
                } else {
                    alert('Нельзя начать голосование без выставленных кандидатур!');
                }
                return;
            }
              // Сохраняем всех выставленных кандидатов и их порядок (по выставлению, не сортируя)
            this.votingNominationsAll = nominatedCandidates;
            this.votingOrder = [...this.votingNominationsAll];
            this.votingCurrentIndex = 0;
            this.votingResults = {};
            this.votingVotedPlayers = [];
            this.votingFinished = false;
            this.votingWinners = [];
            this.votingStage = 'main';
            this.votingTiePlayers = [];
            this.votingLiftResults = [];
            // Сброс таймеров от предыдущих голосований
            this.stopVotingTieTimer();
            this.votingTieTimerActive = false;
            this.stopVotingLastSpeechTimer();
            this.votingLastSpeechTimerActive = false;

            this.showVotingModal = true;
            this.nominationsLocked = true;
            
            // Инициализируем новую сессию голосования
            this.currentVotingSession = {
                mainResults: {},
                tieResults: {},
                liftResults: [],
                mainWinners: [],
                tieWinners: [],
                liftWinners: [],
                finalWinners: [],
                nominationsAll: [...this.votingNominationsAll]
            };
            
            this.sendToRoom({ type: "votingStart", votingOrder: this.votingOrder });
            this.sendFullState();
            // При запуске нового основного голосования увеличиваем индекс
            this.votingMainIndex = (this.votingHistory?.length || 0);
        },toggleNomination(roleKey, number) {
            // if (this.nominationsLocked) return; // Удалено ограничение на выставление номинантов
            if (!this.isPlayerActive(roleKey)) return;
            const targetRoleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(targetRoleKey)) return;
            // Разрешаем выставлять самого себя
            if (!this.nominations[roleKey]) {
                this.$set(this.nominations, roleKey, [number]);
            } else if (this.nominations[roleKey].includes(number)) {
                this.$delete(this.nominations, roleKey);
            } else {
                this.$set(this.nominations, roleKey, [number]);
            }
            this.nominations = { ...this.nominations };
            this.sendToRoom({ type: "nominationChange", roleKey, nomination: this.nominations[roleKey] || null });
            this.sendFullState();
        },
        isPlayerNominated(roleKey, number) {
            return this.nominations[roleKey] && this.nominations[roleKey].includes(number);
        },        isCandidateButtonDisabled(roleKey, number) {
            const playerIdx = this.tableOut.findIndex(p => p.roleKey === roleKey);
            const targetRoleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(roleKey) || !this.isPlayerActive(targetRoleKey)) return true;            // Уже выставлен (по номерам)
            const alreadyNominated = Object.values(this.nominations).flat().includes(number);
            if (alreadyNominated && !(this.nominations[roleKey] && this.nominations[roleKey][0] === number)) return true;
            return false;
        },
        candidateButtonClass(roleKey, number) {
            const playerIdx = this.tableOut.findIndex(p => p.roleKey === roleKey);
            const targetRoleKey = this.tableOut[number - 1]?.roleKey;
            let cls = [];
            
            // Добавляем класс для неактивных игроков (цель кандидатуры)
            if (!this.isPlayerActive(targetRoleKey)) {
                cls.push('candidate-inactive');
            }
            
            // Нельзя выставить неактивного игрока
            if (!this.isPlayerActive(this.tableOut[number - 1]?.roleKey) ||
                !this.isPlayerActive(roleKey)) {
                cls.push('candidate-dead');
            }
            const alreadyNominated = Object.values(this.nominations).flat().includes(number);
            if (alreadyNominated && !(this.nominations[roleKey] && this.nominations[roleKey][0] === number)) {
                cls.push('candidate-already-nominated');
            }
            if (this.nominations[roleKey] && this.nominations[roleKey][0] === number) {
                cls.push('selected');
            }
            return cls.join(' ');
        },toggleVotingSelection(number) {
            // Запретить голосовать если игрок неактивен
            const roleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(roleKey)) return;
            
            const candidate = this.votingOrder[this.votingCurrentIndex];
            if (!this.votingResults[candidate]) {
                this.$set(this.votingResults, candidate, []);
            }
            
            // Если уже проголосовал за этого кандидата — снять голос
            if (this.votingResults[candidate].includes(number)) {
                this.votingResults[candidate] = this.votingResults[candidate].filter(n => n !== number);
                this.votingVotedPlayers = this.votingVotedPlayers.filter(n => n !== number);
            } else {
                // Проверяем, голосовал ли игрок за другого кандидата в текущем этапе
                let alreadyVotedForOther = false;
                Object.entries(this.votingResults).forEach(([cand, voters]) => {
                    if (cand !== candidate && voters.includes(number)) {
                        alreadyVotedForOther = true;
                    }
                });
                
                // Если уже голосовал за другого кандидата, не разрешаем голосовать
                if (alreadyVotedForOther) {
                    this.showVotingNotification(`Игрок ${number} уже проголосовал за другого кандидата. Снимите предыдущий голос.`);
                    return;
                }
                
                // Добавляем голос
                this.votingResults[candidate].push(number);
                if (!this.votingVotedPlayers.includes(number)) {
                    this.votingVotedPlayers.push(number);
                }
            }
            
            this.votingResults = { ...this.votingResults };
            this.sendToRoom({
                type: "votingSelection",
                candidate,
                voted: this.votingResults[candidate],
                votedPlayers: this.votingVotedPlayers
            });
            this.sendFullState();
            
            // Автоматическое завершение этапа если все проголосовали или решение уже не изменится
            this.tryAutoFinishVotingStage();
        },toggleLiftVotingSelection(number) {
            // Запретить голосовать если игрок неактивен
            const roleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(roleKey)) return;
            
            // Если убит первым ночью, не может голосовать
            if (this.playersActions[roleKey] === 'killed' && this.firstKilledPlayer === roleKey) return;

            // В lift можно снимать и ставить голос повторным нажатием
            if (this.votingLiftResults.includes(number)) {
                this.votingLiftResults = this.votingLiftResults.filter(n => n !== number);
            } else {
                this.votingLiftResults.push(number);
            }
            this.sendToRoom({ type: "liftVotingSelection", voted: this.votingLiftResults });
            this.sendFullState();
            // Автоматическое завершение ОТКЛЮЧЕНО по просьбе пользователя
            // this.tryAutoFinishVotingStage();
        },        autoAcceptNotVoted() {
            // Автоматически добавить голоса непроголосовавших к последнему кандидату
            const alivePlayers = this.tableOut
                .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                .filter(p => this.isPlayerActive(p.roleKey))
                .map(p => p.num);
            const allVoted = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
            const notVoted = alivePlayers.filter(num => !allVoted.includes(num));
            if (notVoted.length > 0 && this.votingOrder.length > 0) {
                const lastCandidate = this.votingOrder[this.votingOrder.length - 1];
                const voted = this.votingResults[lastCandidate] || [];
                this.votingResults[lastCandidate] = [...voted, ...notVoted];
                // Удалить из других кандидатов эти номера
                this.votingOrder.slice(0, -1).forEach(otherCand => {
                    if (this.votingResults[otherCand]) {
                        this.votingResults[otherCand] = this.votingResults[otherCand].filter(n => !notVoted.includes(n));
                    }
                });
                this.votingResults = { ...this.votingResults };
                this.sendToRoom({
                    type: "votingSelection",
                    candidate: lastCandidate,
                    voted: this.votingResults[lastCandidate],
                    votedPlayers: [].concat(...Object.values(this.votingResults))
                });
                this.sendFullState();
            }
        },        tryAutoFinishVotingStage() {
            // Для main/tie: если все живые проголосовали, или решение не изменится
            if (this.votingStage === 'main' || this.votingStage === 'tie') {
                const alivePlayers = this.tableOut
                    .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                    .filter(p => this.isPlayerActive(p.roleKey))
                    .map(p => p.num);
                const allVoted = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                const notVoted = alivePlayers.filter(num => !allVoted.includes(num));
                // Если все проголосовали
                // НЕ завершаем этап автоматически, только по кнопке
                // Если даже если все оставшиеся проголосуют за одного кандидата, исход не изменится
                const votes = Object.values(this.votingResults).map(arr => arr.length);
                const maxVotes = Math.max(0, ...votes);
                const total = alivePlayers.length;
                // Если maxVotes > (total/2), исход уже определён
                // НЕ завершаем этап автоматически
            }            // Для lift: автоматическое завершение отключено
        },        isVotingButtonEnabled(number) {
            const roleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(roleKey)) {
                return false;
            }
            
            // Если убит первым ночью, не может голосовать
            if (this.playersActions[roleKey] === 'killed' && this.firstKilledPlayer === roleKey) {
                return false;
            }
            
            const candidate = this.votingOrder[this.votingCurrentIndex];
            
            // Если уже проголосовал за текущего кандидата — разрешить снять голос
            if (this.votingResults[candidate] && this.votingResults[candidate].includes(number)) {
                return true;
            }
            
            // Игрок может проголосовать только за одного кандидата за этап
            if (this.votingStage === 'main' || this.votingStage === 'tie') {
                const alreadyVotedElsewhere = Object.entries(this.votingResults).some(([cand, voters]) => 
                    cand !== candidate && voters.includes(number)
                );
                return !alreadyVotedElsewhere;
            }
            
            return true;
        },        // Обновленный метод для определения стиля кнопки
        getVotingButtonClass(number) {
            const roleKey = this.tableOut[number - 1]?.roleKey;
            let classes = ['modal-btn'];
            
            // Если игрок неактивен
            if (!this.isPlayerActive(roleKey)) {
                classes.push('disabled', 'voting-inactive');
                return classes.join(' ');
            }
            
            // Если убит первым ночью, не может голосовать
            if (this.playersActions[roleKey] === 'killed' && this.firstKilledPlayer === roleKey) {
                classes.push('disabled', 'voting-inactive');
                return classes.join(' ');
            }

            const candidate = this.votingOrder[this.votingCurrentIndex];
            
            // Если уже проголосовал за текущего кандидата
            if (this.votingResults[candidate] && this.votingResults[candidate].includes(number)) {
                classes.push('selected');
                return classes.join(' ');
            }
            
            // Если уже голосовал за другого кандидата в этом этапе - полупрозрачный и неактивный
            if (this.votingStage === 'main' || this.votingStage === 'tie') {
                const alreadyVotedElsewhere = Object.entries(this.votingResults).some(([cand, voters]) => 
                    cand !== candidate && voters.includes(number)
                );
                if (alreadyVotedElsewhere) {
                    classes.push('voted-elsewhere', 'disabled');
                    return classes.join(' ');
                }
            }
            
            // Подсветка непроголосовавших при последнем кандидате
            if ((this.votingStage === 'main' || this.votingStage === 'tie') &&
                this.votingCurrentIndex === this.votingOrder.length - 1) {
                const allVoted = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                if (!allVoted.includes(number)) {
                    classes.push('not-voted-highlight');
                }
            }

            return classes.join(' ');
        },
        getLiftVotingButtonClass(number) {
            const roleKey = this.tableOut[number - 1]?.roleKey;
            let classes = ['modal-btn'];
            
            // Если игрок неактивен
            if (!this.isPlayerActive(roleKey)) {
                classes.push('disabled', 'voting-inactive');
                return classes.join(' ');
            }
            
            // Если убит первым ночью, не может голосовать
            if (this.playersActions[roleKey] === 'killed' && this.firstKilledPlayer === roleKey) {
                classes.push('disabled', 'voting-inactive');
                return classes.join(' ');
            }

            // Если уже проголосовал за подъем
            if (this.votingLiftResults.includes(number)) {
                classes.push('selected');
            }
            
            return classes.join(' ');
        },
        isLiftVotingButtonEnabled(number) {
            // В lift можно всегда снимать/ставить свой голос, если активен
            const roleKey = this.tableOut[number - 1]?.roleKey;
            if (!this.isPlayerActive(roleKey)) return false;
            // Если убит первым ночью, не может голосовать
            if (this.playersActions[roleKey] === 'killed' && this.firstKilledPlayer === roleKey) return false;
            return true;
        },
        prevVoting() {
            if (this.votingStage === 'lift') {
                // Возврат из lift к результатам tie
                this.votingStage = 'tie';
                this.votingFinished = true;
                this.votingWinners = []; // В tie при переходе в lift победителей не было
                this.votingOrder = [...this.votingTiePlayers];
                this.votingCurrentIndex = this.votingOrder.length - 1;
                // Восстанавливаем результаты tie из сессии
                if (this.currentVotingSession.tieResults) {
                    this.votingResults = JSON.parse(JSON.stringify(this.currentVotingSession.tieResults));
                }
                this.sendToRoom({ type: "votingNav", direction: "prev", index: this.votingCurrentIndex, stage: 'tie' });
                this.sendFullState();
                return;
            }

            if (this.votingCurrentIndex > 0) {
                this.votingCurrentIndex--;
                this.sendToRoom({ type: "votingNav", direction: "prev", index: this.votingCurrentIndex });
                this.sendFullState();
            }
        },
        nextVoting() {
            if (this.votingCurrentIndex < this.votingOrder.length - 1) {
                this.votingCurrentIndex++;
                this.sendToRoom({ type: "votingNav", direction: "next", index: this.votingCurrentIndex });
                this.sendFullState();
            }
        },
        showVotingNotification(msg) {
            this.votingNotification = msg;
            if (this.votingNotificationTimeout) clearTimeout(this.votingNotificationTimeout);
            this.votingNotificationTimeout = setTimeout(() => {
                this.votingNotification = '';
            }, 1000);
        },        acceptCurrentCandidateVotes() {
            if (this.acceptDisabled) return;
            this.acceptDisabled = true;
            setTimeout(() => { this.acceptDisabled = false; }, 500); // антидребезг
            
            // Если это этап "lift", сразу завершаем этап
            if (this.votingStage === 'lift') {
                this.finishVotingStage();
                return;
            }

            // Если это последний кандидат в main/tie голосовании - автоматически добавляем непроголосовавших
            if ((this.votingStage === 'main' || this.votingStage === 'tie') && 
                this.votingCurrentIndex === this.votingOrder.length - 1) {
                
                const alivePlayers = this.tableOut
                    .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                    .filter(p => this.isPlayerActive(p.roleKey))
                    .map(p => p.num);
                
                const votedNumbers = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                const notVoted = alivePlayers.filter(num => !votedNumbers.includes(num));
                
                // Автоматически добавляем непроголосовавших к текущему (последнему) кандидату
                if (notVoted.length > 0) {
                    const currentCandidate = this.votingOrder[this.votingCurrentIndex];
                    if (!this.votingResults[currentCandidate]) {
                        this.$set(this.votingResults, currentCandidate, []);
                    }
                    this.votingResults[currentCandidate].push(...notVoted);
                    this.votingVotedPlayers.push(...notVoted);
                    this.votingResults = { ...this.votingResults };
                    
                    this.sendToRoom({
                        type: "votingSelection",
                        candidate: currentCandidate,
                        voted: this.votingResults[currentCandidate],
                        votedPlayers: this.votingVotedPlayers
                    });
                    this.sendFullState();
                }
            }

            // После проверки — можно переходить к следующему кандидату или завершать этап
            if (this.votingCurrentIndex === this.votingOrder.length - 1) {
                this.finishVotingStage();
            } else if (this.votingCurrentIndex < this.votingOrder.length - 1) {
                // Просто переходим к следующему кандидату, не записывая в историю
                this.votingCurrentIndex++;
                this.sendToRoom({ type: "votingNav", direction: "next", index: this.votingCurrentIndex });
                this.sendFullState();
            }
        },
        finishVotingStage() {
            if (this.votingStage === 'main' || this.votingStage === 'tie') {
                // Гарантируем что у каждого кандидата есть массив голосов
                this.votingOrder.forEach(candidate => {
                    if (!this.votingResults[candidate]) {
                        this.$set(this.votingResults, candidate, []);
                    }
                });                // Список живых игроков
                const alivePlayers = this.tableOut
                    .map((p, idx) => ({ num: idx + 1, roleKey: p.roleKey }))
                    .filter(p => this.isPlayerActive(p.roleKey))
                    .map(p => p.num);
                // Проверяем, что каждый живой игрок проголосовал хотя бы за одного кандидата (по всем кандидатам)
                const votedNumbers = [].concat(...Object.values(this.votingResults)).filter((v, i, arr) => arr.indexOf(v) === i);
                const notVoted = alivePlayers.filter(num => !votedNumbers.includes(num));
                if (notVoted.length > 0) {
                    this.showVotingNotification('Не проголосовал(и): ' + notVoted.join(', '));
                    return;
                }
                // Определяем максимальное количество голосов
                const votesArr = Object.values(this.votingResults).map(arr => arr.length);
                const maxVotes = Math.max(...votesArr);
                const candidatesWithMaxVotes = Object.entries(this.votingResults)
                    .filter(([_, votes]) => votes.length === maxVotes)
                    .map(([cand]) => Number(cand));                if (candidatesWithMaxVotes.length === 1 && maxVotes > 0) {
                    // Есть единственный победитель
                    this.votingFinished = true;
                    this.votingWinners = [candidatesWithMaxVotes[0]];
                    
                    // Сохраняем результаты в текущую сессию
                    if (this.votingStage === 'main') {
                        this.currentVotingSession.mainResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.mainWinners = [...this.votingWinners];
                        this.currentVotingSession.finalWinners = [...this.votingWinners];
                    } else if (this.votingStage === 'tie') {
                        this.currentVotingSession.tieResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.tieWinners = [...this.votingWinners];
                        this.currentVotingSession.finalWinners = [...this.votingWinners];
                    }
                    
                    // Активируем таймер крайней речи
                    this.startVotingLastSpeechTimer();

                    // НЕ устанавливаем статус 'voted' и НЕ записываем в историю сразу
                    this.sendToRoom({
                        type: "votingFinish",
                        winners: this.votingWinners,
                        results: this.votingResults
                    });
                    this.sendFullState();
                    return;                } else if (candidatesWithMaxVotes.length > 1 && maxVotes > 0) {
                    // Есть равное количество голосов у нескольких кандидатов
                    // Сохраняем порядок выставления при ничьей
                    this.votingTiePlayers = this.votingOrder
                        .filter(cand => candidatesWithMaxVotes.includes(Number(cand)))
                        .map(Number);
                    
                    // Сохраняем результаты в текущую сессию
                    if (this.votingStage === 'main') {
                        this.currentVotingSession.mainResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.mainWinners = []; // Нет победителей в main
                        // Активируем таймер ничьей для дополнительного времени кандидатов
                        this.startVotingTieTimer();
                    } else if (this.votingStage === 'tie') {
                        this.currentVotingSession.tieResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.tieWinners = []; // Нет победителей в tie
                        // Автоматически запускаем голосование за подъем
                        setTimeout(() => {
                            this.startLiftVoting();
                        }, 500);
                    }
                    return;                } else {
                    // Никто не получил голосов или все получили 0 голосов
                    this.votingFinished = true;
                    this.votingWinners = [];
                    
                    // Сохраняем результаты в текущую сессию
                    if (this.votingStage === 'main') {
                        this.currentVotingSession.mainResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.mainWinners = [];
                        this.currentVotingSession.finalWinners = [];
                    } else if (this.votingStage === 'tie') {
                        this.currentVotingSession.tieResults = JSON.parse(JSON.stringify(this.votingResults));
                        this.currentVotingSession.tieWinners = [];
                        this.currentVotingSession.finalWinners = [];
                    }
                    
                    this.sendToRoom({
                        type: "votingFinish",
                        winners: [],
                        results: this.votingResults
                    });
                    this.sendFullState();
                    return;
                }
            }            if (this.votingStage === 'lift') {
                this.votingFinished = true;
                // Только уникальные и живые голоса, строгое большинство
                const alivePlayers = this.tableOut.filter(
                    (p) => this.isPlayerActive(p.roleKey)
                );
                const totalAlive = alivePlayers.length;
                const uniqueAliveVotes = Array.from(new Set(
                    this.votingLiftResults.filter(num => {
                        const player = this.tableOut[num - 1];
                        return player && this.isPlayerActive(player.roleKey);
                    })
                ));
                const liftVotes = uniqueAliveVotes.length;
                // Сохраняем только валидные голоса для истории и UI
                this.votingLiftResults = uniqueAliveVotes;                // Только если голосов больше половины живых — кандидаты заголосованы
                if (liftVotes > totalAlive / 2) {
                    this.votingWinners = [...this.votingOrder];
                    this.currentVotingSession.liftWinners = [...this.votingWinners];
                    this.currentVotingSession.finalWinners = [...this.votingWinners];
                    // Активируем таймер крайней речи
                    this.startVotingLastSpeechTimer();
                } else {
                    this.votingWinners = [];
                    this.currentVotingSession.liftWinners = [];
                    this.currentVotingSession.finalWinners = [];
                    // Сбросить выставленные кандидатуры, если никто не заголосован
                    this.nominations = {};
                    this.nominationsLocked = false;
                }
                
                // Сохраняем результаты lift голосования
                this.currentVotingSession.liftResults = [...this.votingLiftResults];
                // НЕ записываем в историю сразу
                this.sendToRoom({
                    type: "votingFinish",
                    winners: this.votingWinners,
                    liftResults: this.votingLiftResults
                });
                this.sendFullState();
            }
        },        addToVotingHistory(stage) {
            // stage: 'main' | 'tie' | 'lift'
            
            if (stage === 'main') {
                // Создаем новую запись основного голосования
                const newVoting = {
                    votingNumber: this.votingHistory.length + 1,
                    stages: [
                        {
                            type: 'main',
                            stageName: 'Основное голосование',
                            nominationsAll: [...this.votingNominationsAll],
                            order: [...this.votingOrder],
                            results: JSON.parse(JSON.stringify(this.votingResults)),
                            winners: [...this.votingWinners],
                        }
                    ],
                    finalWinners: [...this.votingWinners],
                };
                this.votingHistory.push(newVoting);
            } else if (stage === 'tie') {
                // Добавляем этап повторного голосования к последнему голосованию
                if (this.votingHistory.length > 0) {
                    this.votingHistory[this.votingHistory.length - 1].stages.push({
                        type: 'tie',
                        stageName: 'Повторное голосование',
                        order: [...this.votingOrder],
                        results: JSON.parse(JSON.stringify(this.votingResults)),
                        winners: [...this.votingWinners],
                    });
                    // Обновляем финальных победителей
                    this.votingHistory[this.votingHistory.length - 1].finalWinners = [...this.votingWinners];
                }
            } else if (stage === 'lift') {
                // Добавляем этап голосования за подъем к последнему голосованию
                if (this.votingHistory.length > 0) {
                    this.votingHistory[this.votingHistory.length - 1].stages.push({
                        type: 'lift',
                        stageName: 'Голосование за подъем',
                        order: [...this.votingOrder],
                        liftResults: [...this.votingLiftResults],
                        winners: [...this.votingWinners],
                    });
                    // Обновляем финальных победителей
                    this.votingHistory[this.votingHistory.length - 1].finalWinners = [...this.votingWinners];
                }
            }
            
            // Делаем глубокую копию истории для Vue
            this.votingHistory = JSON.parse(JSON.stringify(this.votingHistory));
            this.sendToRoom({ type: "votingHistoryAdd", history: this.votingHistory });
            this.sendFullState();        },
          // Новая функция для записи всей сессии голосования в историю
        finishVotingAndSaveToHistory() {
            if (!this.currentVotingSession) return;
            
            // Создаем объект голосования для истории
            const newVoting = {
                votingNumber: this.votingHistory.length + 1,
                dayNumber: this.dayNumber,
                nominees: [...this.currentVotingSession.nominationsAll], // Список кандидатов
                stages: [],
                finalWinners: [...this.currentVotingSession.finalWinners],
            };
            
            // Добавляем main этап если есть результаты
            if (this.currentVotingSession.mainResults && Object.keys(this.currentVotingSession.mainResults).length > 0) {
                newVoting.stages.push({
                    type: 'main',
                    stageName: 'Основное голосование',
                    nominationsAll: [...this.currentVotingSession.nominationsAll],
                    order: [...this.currentVotingSession.nominationsAll],
                    results: JSON.parse(JSON.stringify(this.currentVotingSession.mainResults)),
                    winners: [...this.currentVotingSession.mainWinners],
                });
            }
            
            // Добавляем tie этап если есть результаты
            if (this.currentVotingSession.tieResults && Object.keys(this.currentVotingSession.tieResults).length > 0) {
                newVoting.stages.push({
                    type: 'tie',
                    stageName: 'Повторное голосование',
                    order: [...this.votingTiePlayers],
                    results: JSON.parse(JSON.stringify(this.currentVotingSession.tieResults)),
                    winners: [...this.currentVotingSession.tieWinners],
                });
            }
            
            // Добавляем lift этап если есть результаты
            if (this.currentVotingSession.liftResults && this.currentVotingSession.liftResults.length > 0) {
                newVoting.stages.push({
                    type: 'lift',
                    stageName: 'Голосование за подъем',
                    order: [...this.votingTiePlayers],
                    liftResults: [...this.currentVotingSession.liftResults],
                    winners: [...this.currentVotingSession.liftWinners],
                });
            }
            
            // Проверяем, есть ли уже запись с таким номером голосования (перезапись)
            const existingIndex = this.votingHistory.findIndex(v => v.votingNumber === newVoting.votingNumber);
            if (existingIndex !== -1) {
                // Перезаписываем существующую запись
                this.votingHistory[existingIndex] = newVoting;
            } else {
                // Добавляем новую запись
                this.votingHistory.push(newVoting);
            }
              // Делаем глубокую копию истории для Vue
            this.votingHistory = JSON.parse(JSON.stringify(this.votingHistory));
            
            // Устанавливаем активную вкладку на новое/обновленное голосование
            this.activeVotingTab = Math.max(0, this.votingHistory.length - 1);
            
            this.sendToRoom({ type: "votingHistoryAdd", history: this.votingHistory });
            this.sendFullState();
        },
        
        closeVotingModal() {
            this.stopVotingTieTimer();
            this.votingTieTimerActive = false;
            this.stopVotingLastSpeechTimer();
            this.votingLastSpeechTimerActive = false;
            this.showVotingModal = false;
            this.nominationsLocked = false;
            this.sendToRoom({ type: "votingClose" });
            this.sendFullState();
        },        closeVotingModalAndApplyResults() {
            // Останавливаем все таймеры голосования
            this.stopVotingTieTimer();
            this.stopVotingLastSpeechTimer();

            // Записываем всю сессию голосования в историю
            this.finishVotingAndSaveToHistory();
            
            // Применяем статус 'voted' к финальным победителям
            if (this.currentVotingSession && this.currentVotingSession.finalWinners && this.currentVotingSession.finalWinners.length) {
                this.currentVotingSession.finalWinners.forEach(winner => {
                    const roleKey = this.tableOut[winner - 1]?.roleKey;
                    if (roleKey) {
                        this.setStatus(roleKey, 'voted');
                    }
                });
                // Track that a player was voted out on this day (for BM eligibility)
                if (!this.dayVoteOuts) this.dayVoteOuts = {};
                this.$set(this.dayVoteOuts, this.dayNumber, true);
                this.saveRoomStateIncremental({ dayVoteOuts: this.dayVoteOuts });
            }
            
            // Сбросить выставленные кандидатуры и разблокировать выставления
            this.nominations = {};
            this.nominationsLocked = false;
            // Сбросить все переменные голосования
            this.votingOrder = [];
            this.votingCurrentIndex = 0;
            this.votingResults = {};
            this.votingVotedPlayers = [];
            this.votingFinished = false;
            this.votingWinners = [];
            this.votingStage = 'main';
            this.votingTiePlayers = [];
            this.votingLiftResults = [];
            this.currentVotingSession = null; // Очищаем текущую сессию
            this.votingTieTimerActive = false;
            this.votingLastSpeechTimerActive = false;
            this.showVotingModal = false;
            // Переключаемся на вкладку истории после завершения
            this.votingScreenTab = 'history';
            this.activeVotingTab = Math.max(0, this.votingHistory.length - 1);
            this.sendToRoom({ type: "votingClose" });
            this.sendFullState();
        },toggleHistoryWinner(roundIdx, number, substage) {
            // substage: undefined | 'tie' | 'lift'
            let voting = this.votingHistory[roundIdx];
            if (!voting || !voting.stages) return;
            
            let stage;
            if (substage === 'tie') {
                stage = voting.stages.find(s => s.type === 'tie');
            } else if (substage === 'lift') {
                stage = voting.stages.find(s => s.type === 'lift');
            } else {
                stage = voting.stages.find(s => s.type === 'main');
            }
            
            if (!stage) return;
            
            if (stage.winners.includes(number)) {
                stage.winners = stage.winners.filter(n => n !== number);
            } else {
                stage.winners.push(number);
                stage.winners.sort((a, b) => a - b);
            }
            
            // Обновляем финальных победителей на основе последнего этапа с победителями
            let finalWinners = [];
            for (let i = voting.stages.length - 1; i >= 0; i--) {
                if (voting.stages[i].winners && voting.stages[i].winners.length > 0) {
                    finalWinners = [...voting.stages[i].winners];
                    break;
                }
            }
            voting.finalWinners = finalWinners;
            
            this.votingHistory = [...this.votingHistory];
            this.sendToRoom({ type: "votingHistoryEdit", roundIdx, winners: stage.winners, substage });
            this.sendFullState();
        },        applyHistoryEdits() {
            this.votingHistory.forEach((voting, idx) => {
                // Применяем статус 'voted' к финальным победителям каждого голосования
                if (voting.finalWinners && voting.finalWinners.length) {
                    voting.finalWinners.forEach(winner => {
                        const roleKey = this.tableOut[winner - 1]?.roleKey;
                        if (roleKey) {
                            this.setStatus(roleKey, 'voted');
                        }
                    });
                }
            });
            this.showVotingHistory = false;
            this.votingScreenTab = 'voting';
            this.sendToRoom({ type: "votingHistoryApply", history: this.votingHistory });
            this.sendFullState();        },

        // === ТАЙМЕР НИЧЬЕЙ (дополнительное время для кандидатов при ничьей) ===
        startVotingTieTimer() {
            this.votingTieTimerActive = true;
            this.votingTieTimerPlayerIndex = 0;
            this.votingTieTimerTimeLeft = this.votingTieTimerDefaultTime;
            this.votingTieTimerRunning = false;
            this.votingTieTimerPaused = false;
        },

        playVotingTieTimer() {
            if (this.votingTieTimerRunning && !this.votingTieTimerPaused) return;
            if (this.votingTieTimerPaused) {
                this.votingTieTimerPaused = false;
                this.votingTieTimerRunning = true;
            } else {
                this.votingTieTimerRunning = true;
                this.votingTieTimerPaused = false;
            }
            if (this.votingTieTimerIntervalId) clearInterval(this.votingTieTimerIntervalId);
            this.votingTieTimerIntervalId = setInterval(() => {
                if (!this.votingTieTimerRunning || this.votingTieTimerPaused) return;
                if (this.votingTieTimerTimeLeft > 0) {
                    this.votingTieTimerTimeLeft--;
                } else {
                    this.stopVotingTieTimer();
                }
            }, 1000);
        },

        pauseVotingTieTimer() {
            if (!this.votingTieTimerRunning) return;
            this.votingTieTimerPaused = true;
            if (this.votingTieTimerIntervalId) {
                clearInterval(this.votingTieTimerIntervalId);
                this.votingTieTimerIntervalId = null;
            }
        },

        stopVotingTieTimer() {
            this.votingTieTimerRunning = false;
            this.votingTieTimerPaused = false;
            if (this.votingTieTimerIntervalId) {
                clearInterval(this.votingTieTimerIntervalId);
                this.votingTieTimerIntervalId = null;
            }
            this.votingTieTimerTimeLeft = this.votingTieTimerDefaultTime;
        },

        nextVotingTieTimerPlayer() {
            this.stopVotingTieTimer();
            if (this.votingTieTimerPlayerIndex < this.votingTiePlayers.length - 1) {
                this.votingTieTimerPlayerIndex++;
                this.votingTieTimerTimeLeft = this.votingTieTimerDefaultTime;
            }
        },

        prevVotingTieTimerPlayer() {
            this.stopVotingTieTimer();
            if (this.votingTieTimerPlayerIndex > 0) {
                this.votingTieTimerPlayerIndex--;
                this.votingTieTimerTimeLeft = this.votingTieTimerDefaultTime;
            }
        },

        skipVotingTieTimer() {
            this.stopVotingTieTimer();
            this.votingTieTimerActive = false;
        },

        // === ТАЙМЕР КРАЙНЕЙ РЕЧИ ===
        startVotingLastSpeechTimer() {
            this.votingLastSpeechTimerActive = true;
            this.votingLastSpeechPlayerIndex = 0;
            this.votingLastSpeechTimerTimeLeft = this.votingLastSpeechTimerDefaultTime;
            this.votingLastSpeechTimerRunning = false;
            this.votingLastSpeechTimerPaused = false;
        },

        playVotingLastSpeechTimer() {
            if (this.votingLastSpeechTimerRunning && !this.votingLastSpeechTimerPaused) return;
            if (this.votingLastSpeechTimerPaused) {
                this.votingLastSpeechTimerPaused = false;
                this.votingLastSpeechTimerRunning = true;
            } else {
                this.votingLastSpeechTimerRunning = true;
                this.votingLastSpeechTimerPaused = false;
            }
            if (this.votingLastSpeechTimerIntervalId) clearInterval(this.votingLastSpeechTimerIntervalId);
            this.votingLastSpeechTimerIntervalId = setInterval(() => {
                if (!this.votingLastSpeechTimerRunning || this.votingLastSpeechTimerPaused) return;
                if (this.votingLastSpeechTimerTimeLeft > 0) {
                    this.votingLastSpeechTimerTimeLeft--;
                } else {
                    this.stopVotingLastSpeechTimer();
                }
            }, 1000);
        },

        pauseVotingLastSpeechTimer() {
            if (!this.votingLastSpeechTimerRunning) return;
            this.votingLastSpeechTimerPaused = true;
            if (this.votingLastSpeechTimerIntervalId) {
                clearInterval(this.votingLastSpeechTimerIntervalId);
                this.votingLastSpeechTimerIntervalId = null;
            }
        },

        stopVotingLastSpeechTimer() {
            this.votingLastSpeechTimerRunning = false;
            this.votingLastSpeechTimerPaused = false;
            if (this.votingLastSpeechTimerIntervalId) {
                clearInterval(this.votingLastSpeechTimerIntervalId);
                this.votingLastSpeechTimerIntervalId = null;
            }
            this.votingLastSpeechTimerTimeLeft = this.votingLastSpeechTimerDefaultTime;
        },

        nextVotingLastSpeechPlayer() {
            this.stopVotingLastSpeechTimer();
            if (this.votingLastSpeechPlayerIndex < this.votingWinners.length - 1) {
                this.votingLastSpeechPlayerIndex++;
                this.votingLastSpeechTimerTimeLeft = this.votingLastSpeechTimerDefaultTime;
            }
        },

        prevVotingLastSpeechPlayer() {
            this.stopVotingLastSpeechTimer();
            if (this.votingLastSpeechPlayerIndex > 0) {
                this.votingLastSpeechPlayerIndex--;
                this.votingLastSpeechTimerTimeLeft = this.votingLastSpeechTimerDefaultTime;
            }
        },

        formatVotingTimerTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return (mins > 0 ? mins.toString() + ':' : '') + secs.toString().padStart(2, '0');
        },

        startTieVoting() {
            // Используем уже определенных кандидатов из votingTiePlayers
            if (!this.votingTiePlayers || this.votingTiePlayers.length <= 1) {
                return; // Нет смысла в повторном голосовании
            }
            
            // Настраиваем повторное голосование
            this.votingOrder = [...this.votingTiePlayers];
            this.votingCurrentIndex = 0;
            this.votingResults = {};
            this.votingVotedPlayers = [];
            this.votingFinished = false;
            this.votingWinners = [];
            this.votingStage = 'tie';
            this.votingLiftResults = [];
            
            this.sendToRoom({ 
                type: "votingTieStart", 
                votingOrder: this.votingOrder,
                stage: 'tie'
            });
            this.sendFullState();
        },
        
        startLiftVoting() {
            // Используем кандидатов из votingTiePlayers для голосования за подъем
            if (!this.votingTiePlayers || this.votingTiePlayers.length <= 1) {
                return;
            }
            
            this.votingOrder = [...this.votingTiePlayers];
            this.votingCurrentIndex = 0;
            this.votingResults = {};
            this.votingVotedPlayers = [];
            this.votingFinished = false;
            this.votingWinners = [];
            this.votingStage = 'lift';
            this.votingLiftResults = [];
            
            this.sendToRoom({ 
                type: "votingLiftStart", 
                votingOrder: this.votingOrder,
                stage: 'lift'
            });
            this.sendFullState();
        },
    },
    mounted() {
        window.addEventListener('keydown', this.handleVotingKeydown);
    },    beforeDestroy() {
        window.removeEventListener('keydown', this.handleVotingKeydown);
    }
};
