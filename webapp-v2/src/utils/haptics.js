export function triggerHaptic(type = 'light') {
  try {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      const hf = window.Telegram.WebApp.HapticFeedback;
      if (type === 'light') hf.impactOccurred('light');
      else if (type === 'medium') hf.impactOccurred('medium');
      else if (type === 'heavy') hf.impactOccurred('heavy');
      else if (type === 'success') hf.notificationOccurred('success');
      else if (type === 'warning') hf.notificationOccurred('warning');
      else if (type === 'error') hf.notificationOccurred('error');
      else if (type === 'selection') hf.selectionChanged();
      return;
    }
    if (window.navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [30],
        heavy: [50],
        success: [10, 30, 10],
        warning: [30, 20, 30],
        error: [50, 30, 50, 30, 50],
        selection: [5],
      };
      window.navigator.vibrate(patterns[type] || [10]);
    }
  } catch (e) { /* ignore */ }
}

export function triggerLongVibration() {
  try {
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
  } catch (e) { /* ignore */ }
}
