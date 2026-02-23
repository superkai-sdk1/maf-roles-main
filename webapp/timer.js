// Утилита: длинная вибрация (1.5 сек) через повторные хаптик-вызовы для Telegram
function triggerLongVibration() {
    // Web Vibration API (Android)
    if (window.navigator.vibrate) {
        window.navigator.vibrate(1500);
    }
    // Telegram HapticFeedback — повторяем несколько раз, т.к. один вызов слишком короткий
    if (window.haptic) {
        window.haptic.notification('warning');
        setTimeout(function() { if (window.haptic) window.haptic.impact('heavy'); }, 300);
        setTimeout(function() { if (window.haptic) window.haptic.notification('warning'); }, 600);
        setTimeout(function() { if (window.haptic) window.haptic.impact('heavy'); }, 900);
        setTimeout(function() { if (window.haptic) window.haptic.notification('warning'); }, 1200);
    }
}

// Timer Module для панели мафии
// Использует timestamp-based подход: хранит endTime и вычисляет timeLeft из реального времени.
// Это решает проблемы: (1) ускорение при повторных интервалах, (2) заморозку в фоне.
class TimerModule {
    constructor() {
        this.playerTimers = new Map();
        this.defaultTime = 60;

        // Обработка возврата из фона — пересчитываем все таймеры
        this._onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                this._recalcAllTimers();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    // Пересчёт всех активных таймеров после возврата из фона
    _recalcAllTimers() {
        const now = Date.now();
        this.playerTimers.forEach((timer, playerKey) => {
            if (timer.isRunning && !timer.isPaused && timer.endTime) {
                const remaining = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
                timer.timeLeft = remaining;
                if (remaining <= 0) {
                    // Таймер истёк пока страница была в фоне
                    const finishCb = timer._onFinishCb;
                    this.stopTimer(playerKey);
                    if (finishCb) finishCb(playerKey);
                } else if (timer._onUpdateCb) {
                    timer._onUpdateCb(remaining, playerKey);
                }
            }
        });
    }

    initializePlayerTimer(playerKey, fouls = 0) {
        // Если уже есть работающий таймер — не перезаписываем
        const existing = this.playerTimers.get(playerKey);
        if (existing && existing.isRunning) {
            existing.fouls = fouls;
            return existing;
        }

        const timerData = {
            playerKey: playerKey,
            timeLeft: this.defaultTime,
            isRunning: false,
            isPaused: false,
            intervalId: null,
            fouls: fouls,
            initialTime: this.defaultTime,
            endTime: null,       // timestamp когда таймер должен закончиться
            _onUpdateCb: null,   // callback для обновления UI
            _onFinishCb: null,   // callback при окончании
        };
        
        this.playerTimers.set(playerKey, timerData);
        return timerData;
    }

    getPlayerTimer(playerKey) {
        if (!this.playerTimers.has(playerKey)) {
            return this.initializePlayerTimer(playerKey);
        }
        return this.playerTimers.get(playerKey);
    }

    updatePlayerFouls(playerKey, fouls) {
        const timer = this.getPlayerTimer(playerKey);
        timer.fouls = fouls;
    }

    // Создаёт интервал, вычисляющий timeLeft из endTime
    _createInterval(timer, playerKey, onUpdate, onFinish) {
        // Всегда очищаем старый интервал
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }

        // Сохраняем callbacks для использования при visibilitychange
        timer._onUpdateCb = onUpdate;
        timer._onFinishCb = onFinish;

        timer.intervalId = setInterval(() => {
            const currentTimer = this.playerTimers.get(playerKey);
            if (!currentTimer || !currentTimer.isRunning || currentTimer.isPaused) {
                if (currentTimer && currentTimer.intervalId) {
                    clearInterval(currentTimer.intervalId);
                    currentTimer.intervalId = null;
                }
                return;
            }
            
            // Вычисляем оставшееся время из endTime
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((currentTimer.endTime - now) / 1000));

            if (remaining !== currentTimer.timeLeft) {
                currentTimer.timeLeft = remaining;

                if (remaining === 10) {
                    triggerLongVibration();
                }

                if (remaining > 0) {
                    if (onUpdate) onUpdate(remaining, playerKey);
                } else {
                    this.stopTimer(playerKey);
                    if (onFinish) onFinish(playerKey);
                }
            }
        }, 250); // Проверяем чаще (250мс) для точности после возврата из фона
    }

    startTimer(playerKey, onUpdate, onFinish) {
        const timer = this.getPlayerTimer(playerKey);

        if (timer.isRunning && !timer.isPaused) {
            // Уже работает — просто обновляем callbacks (чтобы Vue реактивность не потерялась)
            timer._onUpdateCb = onUpdate;
            timer._onFinishCb = onFinish;
            return false;
        }

        if (timer.isPaused) {
            // Возобновляем из паузы
            timer.isPaused = false;
            timer.isRunning = true;
            timer.endTime = Date.now() + timer.timeLeft * 1000;
            this._createInterval(timer, playerKey, onUpdate, onFinish);
            return true;
        }

        // Убеждаемся, что предыдущий интервал очищен
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }

        timer.isRunning = true;
        timer.isPaused = false;
        timer.endTime = Date.now() + timer.timeLeft * 1000;

        this._createInterval(timer, playerKey, onUpdate, onFinish);
        return true;
    }

    pauseTimer(playerKey) {
        const timer = this.getPlayerTimer(playerKey);
        
        if (!timer.isRunning || timer.isPaused) {
            return false;
        }
        
        // Фиксируем оставшееся время из endTime
        const now = Date.now();
        timer.timeLeft = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
        timer.isPaused = true;
        timer.endTime = null;

        if (timer.intervalId) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }
        
        return true;
    }

    resumeTimer(playerKey, onUpdate, onFinish) {
        const timer = this.getPlayerTimer(playerKey);
        
        if (!timer.isRunning || !timer.isPaused) {
            return false;
        }
        
        timer.isPaused = false;
        timer.endTime = Date.now() + timer.timeLeft * 1000;

        this._createInterval(timer, playerKey, onUpdate, onFinish);
        return true;
    }

    stopTimer(playerKey) {
        const timer = this.getPlayerTimer(playerKey);
        
        timer.isRunning = false;
        timer.isPaused = false;
        timer.endTime = null;
        timer._onUpdateCb = null;
        timer._onFinishCb = null;

        if (timer.intervalId) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }
        
        timer.timeLeft = this.defaultTime;
        timer.initialTime = this.defaultTime;

        return true;
    }

    addThirtySeconds(playerKey) {
        const timer = this.getPlayerTimer(playerKey);
        
        if (timer.fouls >= 2) {
            return false;
        }
        
        timer.timeLeft += 30;
        // Если таймер работает — сдвигаем endTime
        if (timer.isRunning && !timer.isPaused && timer.endTime) {
            timer.endTime += 30 * 1000;
        }
        return true;
    }

    isAddTimeAvailable(playerKey) {
        const timer = this.getPlayerTimer(playerKey);
        return timer.fouls <= 1;
    }

    formatTime(seconds) {
        return seconds.toString().padStart(2, '0');
    }

    clearAllTimers() {
        this.playerTimers.forEach((timer) => {
            if (timer.intervalId) {
                clearInterval(timer.intervalId);
            }
        });
        this.playerTimers.clear();
    }

    getAllTimersState() {
        const state = {};
        this.playerTimers.forEach((timer, playerKey) => {
            state[playerKey] = {
                timeLeft: timer.timeLeft,
                isRunning: timer.isRunning,
                isPaused: timer.isPaused,
                hasInterval: timer.intervalId !== null,
                endTime: timer.endTime,
                fouls: timer.fouls
            };
        });
        return state;
    }

    forceCleanAllIntervals() {
        this.playerTimers.forEach((timer) => {
            if (timer.intervalId) {
                clearInterval(timer.intervalId);
                timer.intervalId = null;
                timer.isRunning = false;
                timer.isPaused = false;
                timer.endTime = null;
            }
        });
    }
}

// Создание экземпляра модуля
const timerModule = new TimerModule();

// Vue Mixin для интеграции с приложением
window.timerMixin = {    data() {
        return {
            timerModule: timerModule,
            playerTimers: {} // Используем обычный объект вместо Map для реактивности
        };
    },
    
    created() {
        // Принудительно очищаем все интервалы при создании компонента
        this.timerModule.forceCleanAllIntervals();
        // Не-реактивные объекты для long-press логики (вне data чтобы Vue не оборачивал)
        this._timerHoldTimers = {};
        this._timerHoldFlags = {};

        // Синхронизируем Vue реактивное состояние при возврате из фона
        this._timerVisibilityCb = () => {
            if (document.visibilityState === 'visible') {
                this.timerModule.playerTimers.forEach((timer, playerKey) => {
                    if (this.playerTimers[playerKey]) {
                        this.$set(this.playerTimers, playerKey, {
                            ...this.playerTimers[playerKey],
                            timeLeft: timer.timeLeft,
                            isRunning: timer.isRunning,
                            isPaused: timer.isPaused
                        });
                    }
                });
            }
        };
        document.addEventListener('visibilitychange', this._timerVisibilityCb);
    },
    
    methods: {        // Инициализация таймера игрока
        initTimer(playerKey, fouls = 0) {
            console.log('Vue: initTimer called for player:', playerKey, 'with fouls:', fouls);
            const timer = this.timerModule.initializePlayerTimer(playerKey, fouls);
            this.$set(this.playerTimers, playerKey, {
                timeLeft: timer.timeLeft,
                isRunning: timer.isRunning,
                isPaused: timer.isPaused,
                fouls: timer.fouls
            });
            console.log('Vue: Timer initialized for player:', playerKey, this.playerTimers[playerKey]);
        },        // Старт таймера игрока
        startPlayerTimer(playerKey) {
            // Проверяем, что таймер для этого игрока инициализирован
            if (!this.playerTimers[playerKey]) {
                this.initTimer(playerKey, this.fouls ? this.fouls[playerKey] || 0 : 0);
            }

            // Если таймер уже работает — просто обновим callbacks (не сбрасываем)
            const existingTimer = this.timerModule.getPlayerTimer(playerKey);
            if (existingTimer.isRunning && !existingTimer.isPaused) {
                // Обновляем callbacks для Vue реактивности
                existingTimer._onUpdateCb = (timeLeft, pKey) => {
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            timeLeft: timeLeft
                        });
                    }
                };
                existingTimer._onFinishCb = (pKey) => {
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            isRunning: false,
                            isPaused: false
                        });
                    }
                };
                return true;
            }

            const success = this.timerModule.startTimer(
                playerKey,
                (timeLeft, pKey) => {
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            timeLeft: timeLeft
                        });
                    }
                },
                (pKey) => {
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            isRunning: false,
                            isPaused: false
                        });
                    }
                }
            );
            
            if (success && this.playerTimers[playerKey]) {
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    isRunning: true,
                    isPaused: false
                });
            }

            return success;
        },// Пауза таймера игрока
        pausePlayerTimer(playerKey) {
            const success = this.timerModule.pauseTimer(playerKey);
            if (success && this.playerTimers[playerKey]) {
                const timer = this.timerModule.getPlayerTimer(playerKey);
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    isPaused: true,
                    timeLeft: timer.timeLeft  // синхронизируем из timestamp
                });
            }
            return success;
        },        // Возобновление таймера игрока
        resumePlayerTimer(playerKey) {
            if (this.playerTimers[playerKey] && this.playerTimers[playerKey].isPaused) {
                const success = this.timerModule.resumeTimer(playerKey, 
                    (timeLeft, pKey) => {
                        if (this.playerTimers[pKey]) {
                            this.$set(this.playerTimers, pKey, {
                                ...this.playerTimers[pKey],
                                timeLeft: timeLeft
                            });
                        }
                    },
                    (pKey) => {
                        if (this.playerTimers[pKey]) {
                            this.$set(this.playerTimers, pKey, {
                                ...this.playerTimers[pKey],
                                isRunning: false,
                                isPaused: false
                            });
                        }
                    }
                );
                
                if (success) {
                    this.$set(this.playerTimers, playerKey, {
                        ...this.playerTimers[playerKey],
                        isRunning: true,
                        isPaused: false
                    });
                }
                return success;
            }
            
            return false;
        },// Остановка таймера игрока
        stopPlayerTimer(playerKey) {
            this.timerModule.stopTimer(playerKey);
            if (this.playerTimers[playerKey]) {
                const timer = this.timerModule.getPlayerTimer(playerKey);
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    isRunning: false,
                    isPaused: false,
                    timeLeft: timer.timeLeft
                });
                console.log('Vue: Timer stopped for player:', playerKey);
            }
            // City mode: авто-принятие при остановке таймера (нет протокола/мнения)
            if (this.cityMode && this.killedCardPhase && this.killedCardPhase[playerKey] === 'timer') {
                this.$set(this.killedCardPhase, playerKey, 'done');
                this.$set(this.protocolAccepted, playerKey, true);
                this.saveRoomStateIncremental({ killedCardPhase: this.killedCardPhase, protocolAccepted: this.protocolAccepted });
                this.sendFullState();
            }
        },        // Добавление 30 секунд (+ 2 фола игроку)
        addThirtySecondsToTimer(playerKey) {
            console.log('Vue: addThirtySecondsToTimer called for player:', playerKey);
            const success = this.timerModule.addThirtySeconds(playerKey);
            if (success && this.playerTimers[playerKey]) {
                const timer = this.timerModule.getPlayerTimer(playerKey);
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    timeLeft: timer.timeLeft
                });
                console.log('Vue: Added 30 seconds to timer for player:', playerKey);

                // Добавляем 2 фола игроку
                const currentFouls = (this.fouls && this.fouls[playerKey]) ? this.fouls[playerKey] : 0;
                const newFouls = Math.min(currentFouls + 2, 4); // максимум 4 фола
                if (this.fouls) {
                    this.$set(this.fouls, playerKey, newFouls);
                    this.saveRoomStateIncremental({ fouls: this.fouls });
                    this.sendToRoom({ type: "foulChange", roleKey: playerKey, value: newFouls });
                    this.sendFullState();
                }
                // Синхронизируем фолы в таймере
                this.timerModule.updatePlayerFouls(playerKey, newFouls);
                if (this.playerTimers[playerKey]) {
                    this.$set(this.playerTimers, playerKey, {
                        ...this.playerTimers[playerKey],
                        fouls: newFouls
                    });
                }
                console.log(`Vue: Added 2 fouls to player ${playerKey}, new fouls: ${newFouls}`);
            }
            return success;
        },

        // Проверка доступности кнопки +30
        isAddTimeButtonAvailable(playerKey) {
            return this.timerModule.isAddTimeAvailable(playerKey);
        },

        // Форматирование времени
        formatTimerTime(seconds) {
            return this.timerModule.formatTime(seconds);
        },

        // --- Long-press / click interaction for timer display ---

        // Начало удержания
        timerHoldStart(playerKey) {
            this._timerHoldFlags[playerKey] = false;
            this._timerHoldTimers[playerKey] = setTimeout(() => {
                this._timerHoldFlags[playerKey] = true;
                // Визуальная обратная связь
                if (window.navigator.vibrate) window.navigator.vibrate(50);
                if (window.haptic) window.haptic.impact('heavy');
                this.stopPlayerTimer(playerKey);
                // Для живых игроков — авто-переход к следующему
                if (this.isPlayerActive && this.isPlayerActive(playerKey)) {
                    if (this._autoAdvanceToNextPlayer) {
                        this.$nextTick(() => {
                            this._autoAdvanceToNextPlayer();
                        });
                    }
                } else {
                    // Для убитых игроков — просто закрываем карточку
                    if (this.highlightedPlayer === playerKey) {
                        this.highlightedPlayer = null;
                        if (this.setHighlightedPlayer) this.setHighlightedPlayer(null);
                    }
                }
            }, 800);
        },

        // Конец удержания — если не было long-press, это клик = toggle pause
        timerHoldEnd(playerKey, e) {
            if (this._timerHoldTimers && this._timerHoldTimers[playerKey]) {
                clearTimeout(this._timerHoldTimers[playerKey]);
            }
            if (!this._timerHoldFlags || !this._timerHoldFlags[playerKey]) {
                if (e && e.type !== 'mouseleave') {
                    this.timerTogglePause(playerKey);
                }
            }
            if (this._timerHoldFlags) this._timerHoldFlags[playerKey] = false;
        },

        // Отмена удержания (mouseleave)
        timerHoldCancel(playerKey) {
            if (this._timerHoldTimers && this._timerHoldTimers[playerKey]) {
                clearTimeout(this._timerHoldTimers[playerKey]);
            }
            if (this._timerHoldFlags) this._timerHoldFlags[playerKey] = false;
        },

        // Переключение паузы по клику (или старт если не запущен)
        timerTogglePause(playerKey) {
            const timerData = this.getTimerDisplay(playerKey);

            if (timerData.isPaused) {
                // Возобновляем
                this.resumePlayerTimer(playerKey);
                if (window.haptic) window.haptic.impact('light');
            } else if (timerData.isRunning) {
                // Ставим на паузу
                this.pausePlayerTimer(playerKey);
                if (window.haptic) window.haptic.impact('light');
            } else {
                // Не запущен — стартуем
                this.startPlayerTimer(playerKey);
                if (window.haptic) window.haptic.impact('medium');
            }
        },

        // Обновление фолов игрока
        updateTimerFouls(playerKey, fouls) {
            this.timerModule.updatePlayerFouls(playerKey, fouls);
            if (this.playerTimers[playerKey]) {
                this.playerTimers[playerKey].fouls = fouls;
                const timer = this.timerModule.getPlayerTimer(playerKey);
                this.playerTimers[playerKey].timeLeft = timer.timeLeft;
            }
        },        // Получение данных таймера для отображения
        getTimerDisplay(playerKey) {
            if (!this.playerTimers[playerKey]) {
                const fouls = this.fouls ? this.fouls[playerKey] || 0 : 0;
                this.initTimer(playerKey, fouls);
            }
            return this.playerTimers[playerKey] || {
                timeLeft: 60,
                isRunning: false,
                isPaused: false,
                fouls: 0
            };
        },

        // Отладочный метод для проверки состояния всех таймеров
        debugAllTimers() {
            console.log('=== DEBUG: All Vue Timer States ===');
            console.log('Vue playerTimers:', this.playerTimers);
            console.log('TimerModule state:', this.timerModule.getAllTimersState());
            console.log('===================================');
        }
    },

    // Очистка при уничтожении компонента
    beforeDestroy() {
        if (this._timerVisibilityCb) {
            document.removeEventListener('visibilitychange', this._timerVisibilityCb);
        }
        if (this.timerModule) {
            this.timerModule.clearAllTimers();
        }
    }
};
