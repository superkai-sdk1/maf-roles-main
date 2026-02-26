import React, { useRef, useState, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';

export function InertiaSlider({ label, baseColor, glowColor, onComplete, icon, compact = false }) {
  const containerRef = useRef(null);
  const knobRef = useRef(null);
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const posRef = useRef(0);
  const draggingRef = useRef(false);
  const startTouchX = useRef(0);
  const startPos = useRef(0);
  const velocitySamples = useRef([]);
  const rafRef = useRef(null);

  const KNOB_SIZE = compact ? 44 : 54;
  const PAD = 4;
  const HEIGHT = compact ? 'h-[52px]' : 'h-[64px]';
  const FRICTION = 0.92;
  const FLING_THRESHOLD = 0.4;
  const SNAP_THRESHOLD = 0.55;

  const getMax = useCallback(() => {
    if (!containerRef.current) return 200;
    return containerRef.current.offsetWidth - KNOB_SIZE - PAD * 2;
  }, [KNOB_SIZE]);

  const setPos = useCallback((v) => {
    posRef.current = v;
    setPosition(v);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const snapTo = useCallback((target) => {
    const from = posRef.current;
    const startTime = performance.now();
    const dur = 250;
    const max = getMax();

    const step = (now) => {
      const t = Math.min((now - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const cur = from + (target - from) * ease;
      setPos(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else if (target >= max - 1) {
        triggerHaptic('success');
        onComplete();
        setTimeout(() => setPos(0), 300);
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }, [getMax, onComplete, setPos]);

  const coast = useCallback(() => {
    const max = getMax();
    const samples = velocitySamples.current;

    let vel = 0;
    if (samples.length >= 2) {
      const recent = samples.slice(-6);
      let totalDx = 0, totalDt = 0;
      for (let i = 1; i < recent.length; i++) {
        totalDx += recent[i].x - recent[i - 1].x;
        totalDt += recent[i].t - recent[i - 1].t;
      }
      if (totalDt > 0) vel = (totalDx / totalDt) * 16;
    }

    if (Math.abs(vel) > FLING_THRESHOLD) {
      const step = () => {
        if (draggingRef.current) return;
        let p = posRef.current + vel;
        vel *= FRICTION;
        if (p <= 0) { p = 0; vel = 0; }
        if (p >= max) { p = max; vel = 0; }
        setPos(p);

        if (Math.abs(vel) > 0.3 && p > 0 && p < max) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          snapTo(p > max * SNAP_THRESHOLD ? max : 0);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    } else {
      snapTo(posRef.current > max * SNAP_THRESHOLD ? max : 0);
    }
  }, [getMax, setPos, snapTo]);

  const handleMove = useCallback((clientX) => {
    if (!draggingRef.current) return;
    const max = getMax();
    const dx = clientX - startTouchX.current;
    const next = Math.max(0, Math.min(max, startPos.current + dx));
    setPos(next);
    velocitySamples.current.push({ x: clientX, t: performance.now() });
    if (velocitySamples.current.length > 10) velocitySamples.current.shift();
  }, [getMax, setPos]);

  const removeDocListeners = useRef(() => {});

  const handleEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    removeDocListeners.current();
    coast();
  }, [coast]);

  const attachDocListeners = useCallback(() => {
    const onMove = (e) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    const onEnd = () => {
      handleEnd();
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    removeDocListeners.current = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      removeDocListeners.current = () => {};
    };
  }, [handleMove, handleEnd]);

  const handleStart = useCallback((clientX) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    draggingRef.current = true;
    setIsDragging(true);
    startTouchX.current = clientX;
    startPos.current = posRef.current;
    velocitySamples.current = [{ x: clientX, t: performance.now() }];
    triggerHaptic('selection');
  }, []);

  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    handleStart(e.touches[0].clientX);
    attachDocListeners();
  }, [handleStart, attachDocListeners]);

  useEffect(() => {
    return () => removeDocListeners.current();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${HEIGHT} bg-black/40 rounded-2xl flex items-center overflow-hidden border border-white/5 shadow-inner`}
      style={{ padding: PAD, touchAction: 'pan-y' }}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={() => draggingRef.current && handleEnd()}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 select-none">
        <span className={`font-black uppercase tracking-[0.25em] ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
          {label}
        </span>
      </div>

      <div
        className={`absolute left-0 top-0 h-full ${baseColor} opacity-5 transition-opacity`}
        style={{ width: `${position + KNOB_SIZE + PAD}px` }}
      />

      <div
        ref={knobRef}
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={handleTouchStart}
        style={{
          transform: `translateX(${position}px)`,
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          touchAction: 'none',
        }}
        className={`relative z-10 rounded-[14px] flex items-center justify-center cursor-grab active:cursor-grabbing shadow-xl shrink-0 ${
          isDragging ? 'scale-95' : 'scale-100'
        } ${baseColor} ${glowColor} shadow-lg shadow-black/40 transition-[transform,box-shadow] duration-150`}
      >
        <div className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
          {icon}
        </div>
      </div>
    </div>
  );
}
