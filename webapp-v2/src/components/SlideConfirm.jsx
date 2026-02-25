import React, { useRef, useState, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';
import { IconChevronRight } from '../utils/icons';

const colorMap = {
  violet: {
    track: 'rgba(168,85,247,0.08)',
    trackBorder: 'rgba(168,85,247,0.18)',
    fill: ['#7c3aed', '#6366f1'],
    thumb: '#a855f7',
    thumbGlow: 'rgba(168,85,247,0.5)',
    shimmer: 'rgba(168,85,247,0.12)',
  },
  red: {
    track: 'rgba(239,68,68,0.08)',
    trackBorder: 'rgba(239,68,68,0.18)',
    fill: ['#dc2626', '#e11d48'],
    thumb: '#ef4444',
    thumbGlow: 'rgba(239,68,68,0.5)',
    shimmer: 'rgba(239,68,68,0.12)',
  },
  green: {
    track: 'rgba(16,185,129,0.08)',
    trackBorder: 'rgba(16,185,129,0.18)',
    fill: ['#059669', '#22c55e'],
    thumb: '#10b981',
    thumbGlow: 'rgba(16,185,129,0.5)',
    shimmer: 'rgba(16,185,129,0.12)',
  },
  emerald: {
    track: 'rgba(16,185,129,0.08)',
    trackBorder: 'rgba(16,185,129,0.18)',
    fill: ['#059669', '#22c55e'],
    thumb: '#10b981',
    thumbGlow: 'rgba(16,185,129,0.5)',
    shimmer: 'rgba(16,185,129,0.12)',
  },
  orange: {
    track: 'rgba(245,158,11,0.08)',
    trackBorder: 'rgba(245,158,11,0.18)',
    fill: ['#d97706', '#f97316'],
    thumb: '#f59e0b',
    thumbGlow: 'rgba(245,158,11,0.5)',
    shimmer: 'rgba(245,158,11,0.12)',
  },
};

const SPRING_STIFFNESS = 180;
const SPRING_DAMPING = 22;
const SPRING_MASS = 1;
const VELOCITY_THRESHOLD = 0.6;
const CONFIRM_THRESHOLD = 0.75;

export function SlideConfirm({ label, onConfirm, color = 'violet', compact = false, disabled = false }) {
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const confirmedRef = useRef(false);
  const animFrameRef = useRef(null);
  const springRef = useRef({ pos: 0, vel: 0 });

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    const thumbSize = compact ? 44 : 56;
    return trackRef.current.offsetWidth - thumbSize - 8;
  }, [compact]);

  const animateSpringTo = useCallback((target) => {
    const spring = springRef.current;
    spring.pos = offset;
    const startVel = velocityRef.current * 0.3;
    spring.vel = startVel;
    const step = () => {
      const dt = 1 / 60;
      const displacement = spring.pos - target;
      const springForce = -SPRING_STIFFNESS * displacement;
      const dampingForce = -SPRING_DAMPING * spring.vel;
      const acceleration = (springForce + dampingForce) / SPRING_MASS;
      spring.vel += acceleration * dt;
      spring.pos += spring.vel * dt;

      if (Math.abs(spring.pos - target) < 0.5 && Math.abs(spring.vel) < 0.5) {
        setOffset(target);
        animFrameRef.current = null;
        return;
      }
      setOffset(spring.pos);
      animFrameRef.current = requestAnimationFrame(step);
    };
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  }, [offset]);

  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleStart = useCallback((clientX) => {
    if (disabled || confirmed) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    startXRef.current = clientX;
    lastXRef.current = clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    confirmedRef.current = false;
    setDragging(true);
    triggerHaptic('selection');
  }, [disabled, confirmed]);

  const handleMove = useCallback((clientX) => {
    if (!dragging || disabled || confirmed) return;
    const now = performance.now();
    const dtMs = now - lastTimeRef.current;
    if (dtMs > 0) {
      const dx = clientX - lastXRef.current;
      velocityRef.current = (dx / dtMs) * 1000;
    }
    lastXRef.current = clientX;
    lastTimeRef.current = now;

    const raw = clientX - startXRef.current;
    const max = getMaxOffset();
    const clamped = Math.max(0, Math.min(raw, max));
    setOffset(clamped);
  }, [dragging, getMaxOffset, disabled, confirmed]);

  const handleEnd = useCallback(() => {
    if (!dragging || confirmed) return;
    setDragging(false);
    const max = getMaxOffset();
    const progress = offset / max;
    const vel = velocityRef.current;
    const projectedProgress = progress + (vel * 0.15) / max;

    if ((projectedProgress > CONFIRM_THRESHOLD || (progress > 0.6 && vel > VELOCITY_THRESHOLD * 1000)) && !confirmedRef.current && !disabled) {
      confirmedRef.current = true;
      setConfirmed(true);
      triggerHaptic('success');
      setOffset(max);
      setTimeout(() => {
        onConfirm?.();
        setTimeout(() => { setConfirmed(false); setOffset(0); }, 300);
      }, 200);
    } else {
      animateSpringTo(0);
    }
  }, [dragging, offset, getMaxOffset, onConfirm, disabled, confirmed, animateSpringTo]);

  const max = getMaxOffset();
  const progress = max > 0 ? Math.min(offset / max, 1) : 0;
  const c = colorMap[color] || colorMap.violet;
  const thumbSize = compact ? 44 : 56;
  const trackH = compact ? 52 : 64;

  return (
    <div
      ref={trackRef}
      className={`relative overflow-hidden select-none touch-pan-y
        ${disabled ? 'opacity-30 pointer-events-none' : ''}
        ${dragging ? 'scale-[0.99]' : ''}
        transition-transform duration-200 ease-spring`}
      style={{
        height: trackH,
        borderRadius: trackH / 2,
        background: c.track,
        border: `1px solid ${c.trackBorder}`,
      }}
      onTouchStart={e => { e.stopPropagation(); handleStart(e.touches[0].clientX); }}
      onTouchMove={e => { e.stopPropagation(); handleMove(e.touches[0].clientX); }}
      onTouchEnd={e => { e.stopPropagation(); handleEnd(); }}
      onMouseDown={e => handleStart(e.clientX)}
      onMouseMove={e => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          opacity: progress,
          background: `linear-gradient(90deg, ${c.fill[0]}, ${c.fill[1]})`,
          borderRadius: 'inherit',
        }}
      />

      {/* Shimmer on idle */}
      {!dragging && !confirmed && (
        <div
          className="absolute inset-0 pointer-events-none animate-slide-shimmer"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${c.shimmer} 50%, transparent 100%)`,
            backgroundSize: '200% 100%',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Label + animated arrows */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200"
        style={{ opacity: 1 - progress * 1.5, paddingLeft: thumbSize + 8, paddingRight: 16 }}
      >
        <span className={`${compact ? 'text-[0.75em]' : 'text-[0.82em]'} font-bold tracking-wide text-white/50 whitespace-nowrap truncate`}>
          {label}
        </span>
        <div className="ml-2 flex items-center gap-px shrink-0">
          <IconChevronRight size={12} color="rgba(255,255,255,0.18)" className="animate-pulse" />
          <IconChevronRight size={12} color="rgba(255,255,255,0.10)" className="animate-pulse [animation-delay:300ms]" />
        </div>
      </div>

      {/* Thumb */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: 4,
          left: 4,
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          background: `linear-gradient(135deg, ${c.thumb}, ${c.fill[1]})`,
          boxShadow: dragging || confirmed
            ? `0 0 24px ${c.thumbGlow}, 0 4px 16px rgba(0,0,0,0.4)`
            : `0 0 12px ${c.thumbGlow}, 0 2px 8px rgba(0,0,0,0.3)`,
          transform: `translateX(${offset}px) scale(${dragging ? 1.06 : 1})`,
          transition: dragging ? 'box-shadow 0.15s, scale 0.15s' : (animFrameRef.current ? 'box-shadow 0.15s' : 'transform 0.35s var(--ease-spring), box-shadow 0.15s, scale 0.15s'),
          zIndex: 2,
        }}
      >
        {confirmed ? (
          <svg width={compact ? 18 : 22} height={compact ? 18 : 22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-scale-in">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <div className="flex items-center -ml-0.5">
            <IconChevronRight size={compact ? 18 : 22} color="rgba(255,255,255,0.95)" />
          </div>
        )}
      </div>
    </div>
  );
}
