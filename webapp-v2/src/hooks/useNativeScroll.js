import { useEffect, useRef, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';

const EDGE_THRESHOLD = 2;
const HAPTIC_COOLDOWN = 400;

export function useNativeScroll(ref) {
  const lastHapticTime = useRef(0);
  const wasAtTop = useRef(true);
  const wasAtBottom = useRef(false);

  const fireEdgeHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTime.current < HAPTIC_COOLDOWN) return;
    lastHapticTime.current = now;
    triggerHaptic('light');
  }, []);

  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= EDGE_THRESHOLD;
      const atBottom = scrollTop + clientHeight >= scrollHeight - EDGE_THRESHOLD;

      if (atTop && !wasAtTop.current) fireEdgeHaptic();
      if (atBottom && !wasAtBottom.current) fireEdgeHaptic();

      wasAtTop.current = atTop;
      wasAtBottom.current = atBottom;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref, fireEdgeHaptic]);
}
