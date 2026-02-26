import React, { useRef, useState, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';

export function InertiaSlider({ label, baseColor, glowColor, onComplete, icon, compact = false }) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const lastX = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const requestRef = useRef(null);
  const positionRef = useRef(0);
  const isDraggingRef = useRef(false);

  const KNOB_SIZE = compact ? 44 : 54;
  const HEIGHT = compact ? 'h-[52px]' : 'h-[64px]';

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  const getLimits = useCallback(() => {
    if (!containerRef.current) return { min: 0, max: 0 };
    return { min: 0, max: containerRef.current.offsetWidth - KNOB_SIZE - 8 };
  }, [KNOB_SIZE]);

  const snapTo = useCallback((target, fromPos) => {
    const startPos = fromPos;
    const startTime = performance.now();
    const duration = 200;
    const max = getLimits().max;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress);
      const currentPos = startPos + (target - startPos) * ease;
      setPosition(currentPos);
      positionRef.current = currentPos;
      if (progress < 1) {
        requestRef.current = requestAnimationFrame(step);
      } else if (target === max) {
        triggerHaptic('success');
        onComplete();
        setTimeout(() => {
          setPosition(0);
          positionRef.current = 0;
        }, 300);
      }
    };
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(step);
  }, [getLimits, onComplete]);

  const animate = useCallback(() => {
    if (isDraggingRef.current) return;
    const { max } = getLimits();
    const pos = positionRef.current;

    if (Math.abs(velocity.current) > 0.1) {
      let next = pos + velocity.current;
      velocity.current *= 0.85;
      if (next <= 0 || next >= max) velocity.current = 0;
      next = Math.max(0, Math.min(max, next));
      setPosition(next);
      positionRef.current = next;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      const target = pos > max * 0.7 ? max : 0;
      snapTo(target, pos);
    }
  }, [getLimits, snapTo]);

  const handleStart = useCallback((clientX) => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsDragging(true);
    isDraggingRef.current = true;
    lastX.current = clientX;
    lastTime.current = performance.now();
    triggerHaptic('selection');
  }, []);

  const handleMove = useCallback((clientX) => {
    if (!isDraggingRef.current) return;
    const now = performance.now();
    const dx = clientX - lastX.current;
    if (now - lastTime.current > 0) velocity.current = dx;
    const { max } = getLimits();
    setPosition(prev => {
      const next = Math.max(0, Math.min(max, prev + dx));
      positionRef.current = next;
      return next;
    });
    lastX.current = clientX;
    lastTime.current = now;
  }, [getLimits]);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;
    requestRef.current = requestAnimationFrame(animate);
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${HEIGHT} bg-black/40 rounded-2xl p-1 flex items-center overflow-hidden border border-white/5 shadow-inner`}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={() => isDraggingRef.current && handleEnd()}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 select-none">
        <span className={`font-black uppercase tracking-[0.25em] ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
          {label}
        </span>
      </div>

      <div
        className={`absolute left-0 top-0 h-full ${baseColor} opacity-5 transition-opacity`}
        style={{ width: `${position + KNOB_SIZE}px` }}
      />

      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        style={{
          transform: `translateX(${position}px)`,
          width: KNOB_SIZE,
          height: KNOB_SIZE,
        }}
        className={`relative z-10 rounded-[14px] flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform shadow-xl ${
          isDragging ? 'scale-95' : 'scale-100'
        } ${baseColor} ${glowColor} shadow-lg shadow-black/40`}
      >
        <div className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
          {icon}
        </div>
      </div>
    </div>
  );
}
