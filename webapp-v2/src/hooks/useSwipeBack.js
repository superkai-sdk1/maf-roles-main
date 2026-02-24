import { useEffect, useRef, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';

const EDGE_ZONE = 24;
const TRIGGER_THRESHOLD = 0.28;
const INDICATOR_MAX = 80;

export function useSwipeBack(onBack, enabled = true) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const tracking = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const locked = useRef(false);
  const hapticFired = useRef(false);
  const indicatorEl = useRef(null);
  const overlayEl = useRef(null);

  const getOrCreateIndicator = useCallback(() => {
    if (indicatorEl.current) return indicatorEl.current;

    const overlay = document.createElement('div');
    overlay.className = 'swipe-back-overlay';
    document.body.appendChild(overlay);
    overlayEl.current = overlay;

    const el = document.createElement('div');
    el.className = 'swipe-back-indicator';
    el.innerHTML = '<div class="swipe-back-chevron"></div>';
    document.body.appendChild(el);
    indicatorEl.current = el;
    return el;
  }, []);

  const removeIndicator = useCallback(() => {
    if (indicatorEl.current) {
      indicatorEl.current.remove();
      indicatorEl.current = null;
    }
    if (overlayEl.current) {
      overlayEl.current.remove();
      overlayEl.current = null;
    }
  }, []);

  const updateVisual = useCallback((dx) => {
    const el = getOrCreateIndicator();
    const progress = Math.min(dx / (window.innerWidth * TRIGGER_THRESHOLD), 1);
    const indicatorX = Math.min(dx * 0.5, INDICATOR_MAX);

    el.style.transform = `translateX(${indicatorX - 40}px) scale(${0.6 + progress * 0.4})`;
    el.style.opacity = `${progress * 0.9}`;

    if (overlayEl.current) {
      overlayEl.current.style.opacity = `${progress * 0.15}`;
    }
  }, [getOrCreateIndicator]);

  const resetVisual = useCallback(() => {
    if (indicatorEl.current) {
      indicatorEl.current.style.transition = 'opacity 0.2s, transform 0.2s';
      indicatorEl.current.style.opacity = '0';
      indicatorEl.current.style.transform = 'translateX(-40px) scale(0.5)';
    }
    if (overlayEl.current) {
      overlayEl.current.style.transition = 'opacity 0.2s';
      overlayEl.current.style.opacity = '0';
    }
    setTimeout(removeIndicator, 250);
  }, [removeIndicator]);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e) => {
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE) return;
      tracking.current = true;
      locked.current = false;
      hapticFired.current = false;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      currentX.current = touch.clientX;
    };

    const onTouchMove = (e) => {
      if (!tracking.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      if (!locked.current) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
          tracking.current = false;
          return;
        }
        if (Math.abs(dx) > 10) locked.current = true;
        else return;
      }

      if (dx < 0) return;

      currentX.current = touch.clientX;
      updateVisual(dx);

      const progress = dx / (window.innerWidth * TRIGGER_THRESHOLD);
      if (progress >= 1 && !hapticFired.current) {
        hapticFired.current = true;
        triggerHaptic('medium');
      } else if (progress < 1 && hapticFired.current) {
        hapticFired.current = false;
      }
    };

    const onTouchEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      const dx = currentX.current - startX.current;
      const progress = dx / (window.innerWidth * TRIGGER_THRESHOLD);

      if (progress >= 1) {
        triggerHaptic('light');
        resetVisual();
        setTimeout(() => onBackRef.current?.(), 100);
      } else {
        resetVisual();
      }
      locked.current = false;
    };

    const onTouchCancel = () => {
      if (tracking.current) {
        tracking.current = false;
        locked.current = false;
        resetVisual();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      removeIndicator();
    };
  }, [enabled, updateVisual, resetVisual, removeIndicator]);
}
