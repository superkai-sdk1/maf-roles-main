// Timer Module для панели мафии
class TimerModule {
    constructor() {
        this.playerTimers = new Map(); // Map для хранения независимых таймеров
        this.defaultTime = 60; // Стандартное время в секундах
        this.threeFoulTime = 30; // Время для игроков с 3 фолами
    }

    // Инициализация данных таймера для игрока
    initializePlayerTimer(playerKey, fouls = 0, hasUsedThreeFoulTimer = false) {
        console.log(`TimerModule: Initializing timer for player ${playerKey} with fouls: ${fouls}`);
        
        const initialTime = (fouls >= 3 && !hasUsedThreeFoulTimer) ? this.threeFoulTime : this.defaultTime;
        
        const timerData = {
            playerKey: playerKey,
            timeLeft: initialTime,
            isRunning: false,
            isPaused: false,
            intervalId: null,
            fouls: fouls,
            hasUsedThreeFoulTimer: hasUsedThreeFoulTimer,
            initialTime: initialTime,
            lastTick: null
        };
        
        this.playerTimers.set(playerKey, timerData);
        console.log(`TimerModule: Timer initialized for player ${playerKey}:`, timerData);
        
        return timerData;
    }

    // Получение данных таймера игрока
    getPlayerTimer(playerKey) {
        if (!this.playerTimers.has(playerKey)) {
            console.log(`TimerModule: Timer not found for player ${playerKey}, creating new one`);
            return this.initializePlayerTimer(playerKey);
        }
        return this.playerTimers.get(playerKey);
    }    // Обновление количества фолов игрока
    updatePlayerFouls(playerKey, fouls) {
        const timer = this.getPlayerTimer(playerKey);
        timer.fouls = fouls;
        
        // Если таймер не запущен и игрок имеет 3 фола
        if (!timer.isRunning) {
            if (fouls >= 3 && !timer.hasUsedThreeFoulTimer) {
                // Первый раз с 3 фолами - 30 секунд
                timer.timeLeft = this.threeFoulTime;
                timer.initialTime = this.threeFoulTime;
            } else if (fouls >= 3 && timer.hasUsedThreeFoulTimer) {
                // Уже использовал 30-секундный таймер - возвращаем к 60 секундам
                timer.timeLeft = this.defaultTime;
                timer.initialTime = this.defaultTime;
            } else if (fouls < 3) {
                // Меньше 3 фолов - стандартное время
                timer.timeLeft = this.defaultTime;
                timer.initialTime = this.defaultTime;
                timer.hasUsedThreeFoulTimer = false; // Сбрасываем флаг если фолов стало меньше
            }
        }
    }    // Старт таймера
    startTimer(playerKey, onUpdate, onFinish) {
        console.log(`TimerModule: Starting timer for player ${playerKey}`);
        
        const timer = this.getPlayerTimer(playerKey);
        console.log(`TimerModule: Timer state before start for ${playerKey}:`, timer);
        
        if (timer.isRunning && !timer.isPaused) {
            console.log(`TimerModule: Timer already running for player ${playerKey}`);
            return false;
        }
        
        // Если таймер был на паузе, просто возобновляем его (не создаем новый интервал)
        if (timer.isPaused && timer.intervalId) {
            timer.isPaused = false;
            timer.isRunning = true;
            console.log(`TimerModule: Resuming paused timer for player ${playerKey}`);
            return true;
        }
        
        // Убеждаемся, что предыдущий интервал очищен полностью
        if (timer.intervalId) {
            console.log(`TimerModule: Clearing existing interval for player ${playerKey}`);
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }
        
        timer.isRunning = true;
        timer.isPaused = false;
        timer.lastTick = Date.now();

        // Если игрок с 3 фолами запускает таймер впервые, отмечаем использование
        if (timer.fouls >= 3 && !timer.hasUsedThreeFoulTimer) {
            timer.hasUsedThreeFoulTimer = true;
        }

        // Создаем уникальный интервал для этого игрока только если его нет
        timer.intervalId = setInterval(() => {
            const currentTimer = this.playerTimers.get(playerKey);
            if (!currentTimer || !currentTimer.isRunning || currentTimer.isPaused) {
                console.log(`TimerModule: Clearing interval for player ${playerKey} - timer not running`);
                if (currentTimer && currentTimer.intervalId) {
                    clearInterval(currentTimer.intervalId);
                    currentTimer.intervalId = null;
                }
                return;
            }
            
            if (currentTimer.timeLeft > 0) {
                currentTimer.timeLeft--;
                console.log(`TimerModule: Tick for player ${playerKey}, time left: ${currentTimer.timeLeft}`);
                if (onUpdate) onUpdate(currentTimer.timeLeft, playerKey);
            } else {
                console.log(`TimerModule: Timer finished for player ${playerKey}`);
                this.stopTimer(playerKey);
                if (onFinish) onFinish(playerKey);
            }
        }, 1000);

        console.log(`TimerModule: Timer started for player ${playerKey}, interval ID: ${timer.intervalId}`);
        return true;
    }// Пауза таймера
    pauseTimer(playerKey) {
        console.log(`TimerModule: Pausing timer for player ${playerKey}`);
        
        const timer = this.getPlayerTimer(playerKey);
        
        if (!timer.isRunning || timer.isPaused) {
            console.log(`TimerModule: Timer for player ${playerKey} is not running or already paused`);
            return false;
        }
        
        timer.isPaused = true;
        
        if (timer.intervalId) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
            console.log(`TimerModule: Interval cleared for player ${playerKey}`);
        }
        
        console.log(`TimerModule: Timer paused for player ${playerKey}`);
        return true;
    }    // Возобновление таймера
    resumeTimer(playerKey, onUpdate, onFinish) {
        console.log(`TimerModule: Resume timer called for player ${playerKey}`);
        
        const timer = this.getPlayerTimer(playerKey);
        
        if (!timer.isRunning || !timer.isPaused) {
            console.log(`TimerModule: Timer for player ${playerKey} is not paused`);
            return false;
        }
        
        // Возобновляем таймер через startTimer с правильными callback'ами
        timer.isPaused = false;
        return this.startTimer(playerKey, onUpdate, onFinish);
    }// Остановка таймера
    stopTimer(playerKey) {
        console.log(`TimerModule: Stopping timer for player ${playerKey}`);
        
        const timer = this.getPlayerTimer(playerKey);
        
        timer.isRunning = false;
        timer.isPaused = false;
        
        if (timer.intervalId) {
            console.log(`TimerModule: Clearing interval ${timer.intervalId} for player ${playerKey}`);
            clearInterval(timer.intervalId);
            timer.intervalId = null;
        }
        
        // Если игрок с 3 фолами и уже использовал 30-секундный таймер, 
        // при следующем запуске должно быть 60 секунд
        if (timer.fouls >= 3 && timer.hasUsedThreeFoulTimer) {
            timer.timeLeft = this.defaultTime;
            timer.initialTime = this.defaultTime;
            console.log(`TimerModule: Player ${playerKey} with 3 fouls reset to default time after using 30s timer`);
        } else {
            // Сброс времени к начальному значению
            timer.timeLeft = timer.initialTime;
        }
        
        timer.lastTick = null;
        
        console.log(`TimerModule: Timer stopped for player ${playerKey}, reset to: ${timer.timeLeft}s`);
        return true;
    }

    // Добавление 30 секунд
    addThirtySeconds(playerKey) {
        console.log(`TimerModule: Adding 30 seconds to timer for player ${playerKey}`);
        
        const timer = this.getPlayerTimer(playerKey);
        
        // Проверяем, можно ли добавить время (не больше 2 фолов)
        if (timer.fouls >= 2) {
            console.log(`TimerModule: Cannot add time for player ${playerKey} - too many fouls (${timer.fouls})`);
            return false;
        }
        
        timer.timeLeft += 30;
        console.log(`TimerModule: Added 30 seconds to player ${playerKey}, new time: ${timer.timeLeft}s`);
        return true;
    }

    // Проверка доступности кнопки +30
    isAddTimeAvailable(playerKey) {
        const timer = this.getPlayerTimer(playerKey);
        return timer.fouls < 2;
    }

    // Форматирование времени для отображения (двузначное)
    formatTime(seconds) {
        return seconds.toString().padStart(2, '0');
    }    // Очистка всех таймеров (при переходе к новой игре)
    clearAllTimers() {
        console.log('TimerModule: Clearing all timers');
        this.playerTimers.forEach((timer, playerKey) => {
            if (timer.intervalId) {
                console.log(`TimerModule: Clearing interval for player ${playerKey}`);
                clearInterval(timer.intervalId);
            }
        });
        this.playerTimers.clear();
        console.log('TimerModule: All timers cleared');
    }

    // Сброс данных о использовании 30-секундного таймера (новый раунд)
    resetThreeFoulTimerUsage() {
        console.log('TimerModule: Resetting three foul timer usage');
        this.playerTimers.forEach((timer, playerKey) => {
            if (timer.hasUsedThreeFoulTimer) {
                timer.hasUsedThreeFoulTimer = false;
                timer.timeLeft = this.defaultTime;
                timer.initialTime = this.defaultTime;
                console.log(`TimerModule: Reset three foul timer for player ${playerKey}`);
            }
        });
    }    // Получение состояния всех таймеров для отладки
    getAllTimersState() {
        const state = {};
        this.playerTimers.forEach((timer, playerKey) => {
            state[playerKey] = {
                timeLeft: timer.timeLeft,
                isRunning: timer.isRunning,
                isPaused: timer.isPaused,
                hasInterval: timer.intervalId !== null,
                intervalId: timer.intervalId,
                fouls: timer.fouls
            };
        });
        console.log('TimerModule: All timers state:', state);
        return state;
    }

    // Принудительная очистка всех интервалов
    forceCleanAllIntervals() {
        console.log('TimerModule: Force cleaning all intervals');
        this.playerTimers.forEach((timer, playerKey) => {
            if (timer.intervalId) {
                console.log(`TimerModule: Force clearing interval ${timer.intervalId} for player ${playerKey}`);
                clearInterval(timer.intervalId);
                timer.intervalId = null;
                timer.isRunning = false;
                timer.isPaused = false;
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
        console.log('Vue: Timer mixin created, cleaning intervals');
        this.timerModule.forceCleanAllIntervals();
    },
    
    methods: {        // Инициализация таймера игрока
        initTimer(playerKey, fouls = 0) {
            console.log('Vue: initTimer called for player:', playerKey, 'with fouls:', fouls);
            const timer = this.timerModule.initializePlayerTimer(playerKey, fouls);
            this.$set(this.playerTimers, playerKey, {
                timeLeft: timer.timeLeft,
                isRunning: timer.isRunning,
                isPaused: timer.isPaused,
                fouls: timer.fouls,
                hasUsedThreeFoulTimer: timer.hasUsedThreeFoulTimer
            });
            console.log('Vue: Timer initialized for player:', playerKey, this.playerTimers[playerKey]);
        },        // Старт таймера игрока
        startPlayerTimer(playerKey) {
            console.log(`Vue: startPlayerTimer called for player: ${playerKey}`);
            
            // Принудительно очищаем все интервалы для этого игрока перед запуском
            const timer = this.timerModule.getPlayerTimer(playerKey);
            if (timer.intervalId) {
                console.log(`Vue: Force clearing interval for player ${playerKey} before start`);
                clearInterval(timer.intervalId);
                timer.intervalId = null;
                timer.isRunning = false;
                timer.isPaused = false;
            }
            
            // Проверяем, что таймер для этого игрока инициализирован
            if (!this.playerTimers[playerKey]) {
                console.log(`Vue: Initializing timer for player: ${playerKey}`);
                this.initTimer(playerKey, this.fouls ? this.fouls[playerKey] || 0 : 0);
            }
            
            const success = this.timerModule.startTimer(
                playerKey,
                (timeLeft, pKey) => {
                    // Обновление реактивных данных только для конкретного игрока
                    console.log(`Vue: Timer update callback for player: ${pKey}, timeLeft: ${timeLeft}`);
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            timeLeft: timeLeft
                        });
                    }
                },
                (pKey) => {
                    // Таймер закончился для конкретного игрока
                    console.log(`Vue: Время вышло для игрока ${pKey}`);
                    if (this.playerTimers[pKey]) {
                        this.$set(this.playerTimers, pKey, {
                            ...this.playerTimers[pKey],
                            isRunning: false,
                            isPaused: false
                        });
                    }
                }
            );
            
            console.log(`Vue: Timer start success for player: ${playerKey} = ${success}`);
            if (success && this.playerTimers[playerKey]) {
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    isRunning: true,
                    isPaused: false
                });
                console.log(`Vue: Updated playerTimers state for: ${playerKey}`, this.playerTimers[playerKey]);
            }
            
            // Отладка состояния всех таймеров
            this.debugAllTimers();
            
            return success;
        },// Пауза таймера игрока
        pausePlayerTimer(playerKey) {
            console.log('Vue: pausePlayerTimer called for player:', playerKey);
            const success = this.timerModule.pauseTimer(playerKey);
            if (success && this.playerTimers[playerKey]) {
                this.$set(this.playerTimers, playerKey, {
                    ...this.playerTimers[playerKey],
                    isPaused: true
                });
                console.log('Vue: Timer paused for player:', playerKey);
            }
            return success;
        },        // Возобновление таймера игрока
        resumePlayerTimer(playerKey) {
            console.log(`Vue: resumePlayerTimer called for player: ${playerKey}`);
            
            // Проверяем, что таймер действительно на паузе
            if (this.playerTimers[playerKey] && this.playerTimers[playerKey].isPaused) {
                const success = this.timerModule.resumeTimer(playerKey, 
                    (timeLeft, pKey) => {
                        // Обновление реактивных данных только для конкретного игрока
                        console.log(`Vue: Timer update callback for player: ${pKey}, timeLeft: ${timeLeft}`);
                        if (this.playerTimers[pKey]) {
                            this.$set(this.playerTimers, pKey, {
                                ...this.playerTimers[pKey],
                                timeLeft: timeLeft
                            });
                        }
                    },
                    (pKey) => {
                        // Таймер закончился для конкретного игрока
                        console.log(`Vue: Время вышло для игрока ${pKey}`);
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
            console.log('Vue: stopPlayerTimer called for player:', playerKey);
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
        },        // Добавление 30 секунд
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
                fouls: 0,
                hasUsedThreeFoulTimer: false
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
        if (this.timerModule) {
            this.timerModule.clearAllTimers();
        }
    }
};
