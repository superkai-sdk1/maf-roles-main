 // TimerModule — timestamp-based timer system ported from webapp/timer.js
// Uses endTime for background-tab recovery via visibilitychange

function triggerLongVibration() {
  if (window.navigator.vibrate) {
    window.navigator.vibrate(1500);
  }
  if (window.Telegram?.WebApp?.HapticFeedback) {
    const hf = window.Telegram.WebApp.HapticFeedback;
    hf.notificationOccurred('warning');
    setTimeout(() => hf.impactOccurred('heavy'), 300);
    setTimeout(() => hf.notificationOccurred('warning'), 600);
    setTimeout(() => hf.impactOccurred('heavy'), 900);
  }
}

class TimerModule {
  constructor() {
    this.playerTimers = new Map();
    this.defaultTime = 60;
    this._listeners = new Set();

    this._onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this._recalcAllTimers();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify(playerKey) {
    const timer = this.playerTimers.get(playerKey);
    if (timer) {
      this._listeners.forEach(fn => fn(playerKey, { ...timer }));
    }
  }

  _recalcAllTimers() {
    const now = Date.now();
    this.playerTimers.forEach((timer, playerKey) => {
      if (timer.isRunning && !timer.isPaused && timer.endTime) {
        const remaining = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
        timer.timeLeft = remaining;
        if (remaining <= 0) {
          const finishCb = timer._onFinishCb;
          this.stopTimer(playerKey);
          if (finishCb) finishCb(playerKey);
        }
        this._notify(playerKey);
      }
    });
  }

  initializePlayerTimer(playerKey, fouls = 0) {
    const existing = this.playerTimers.get(playerKey);
    if (existing && existing.isRunning) {
      existing.fouls = fouls;
      return existing;
    }

    const timerData = {
      playerKey,
      timeLeft: this.defaultTime,
      isRunning: false,
      isPaused: false,
      intervalId: null,
      fouls,
      initialTime: this.defaultTime,
      endTime: null,
      _onUpdateCb: null,
      _onFinishCb: null,
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

  _createInterval(timer, playerKey, onUpdate, onFinish) {
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer._onUpdateCb = onUpdate;
    timer._onFinishCb = onFinish;

    timer.intervalId = setInterval(() => {
      const currentTimer = this.playerTimers.get(playerKey);
      if (!currentTimer || !currentTimer.isRunning || currentTimer.isPaused) {
        if (currentTimer?.intervalId) {
          clearInterval(currentTimer.intervalId);
          currentTimer.intervalId = null;
        }
        return;
      }
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((currentTimer.endTime - now) / 1000));
      if (remaining !== currentTimer.timeLeft) {
        currentTimer.timeLeft = remaining;
        if (remaining === 10) triggerLongVibration();
        if (remaining > 0) {
          if (onUpdate) onUpdate(remaining, playerKey);
        } else {
          this.stopTimer(playerKey);
          if (onFinish) onFinish(playerKey);
        }
        this._notify(playerKey);
      }
    }, 1000);
  }

  startTimer(playerKey, onUpdate, onFinish) {
    const timer = this.getPlayerTimer(playerKey);
    if (timer.isRunning && !timer.isPaused) {
      timer._onUpdateCb = onUpdate;
      timer._onFinishCb = onFinish;
      return false;
    }
    if (timer.isPaused) {
      timer.isPaused = false;
      timer.isRunning = true;
      timer.endTime = Date.now() + timer.timeLeft * 1000;
      this._createInterval(timer, playerKey, onUpdate, onFinish);
      this._notify(playerKey);
      return true;
    }
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer.isRunning = true;
    timer.isPaused = false;
    timer.endTime = Date.now() + timer.timeLeft * 1000;
    this._createInterval(timer, playerKey, onUpdate, onFinish);
    this._notify(playerKey);
    return true;
  }

  pauseTimer(playerKey) {
    const timer = this.getPlayerTimer(playerKey);
    if (!timer.isRunning || timer.isPaused) return false;
    const now = Date.now();
    timer.timeLeft = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
    timer.isPaused = true;
    timer.endTime = null;
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    this._notify(playerKey);
    return true;
  }

  resumeTimer(playerKey, onUpdate, onFinish) {
    const timer = this.getPlayerTimer(playerKey);
    if (!timer.isRunning || !timer.isPaused) return false;
    timer.isPaused = false;
    timer.endTime = Date.now() + timer.timeLeft * 1000;
    this._createInterval(timer, playerKey, onUpdate, onFinish);
    this._notify(playerKey);
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
    this._notify(playerKey);
    return true;
  }

  addThirtySeconds(playerKey) {
    const timer = this.getPlayerTimer(playerKey);
    if (timer.fouls >= 2) return false;
    timer.timeLeft += 30;
    if (timer.isRunning && !timer.isPaused && timer.endTime) {
      timer.endTime += 30 * 1000;
    }
    this._notify(playerKey);
    return true;
  }


  isAddTimeAvailable(playerKey) {
    const timer = this.getPlayerTimer(playerKey);
    return (timer.fouls || 0) <= 1;
  }

  clearAllTimers() {
    this.playerTimers.forEach((timer) => {
      if (timer.intervalId) clearInterval(timer.intervalId);
    });
    this.playerTimers.clear();
  }

  destroy() {
    this.clearAllTimers();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._listeners.clear();
  }
}

// Singleton
export const timerModule = new TimerModule();
export default timerModule;

