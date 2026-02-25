import React, { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import { IconChevronRight } from '../utils/icons';

const colorMap = {
  violet: { bg: 'bg-purple-500/10', fill: 'bg-gradient-to-r from-purple-600 to-indigo-500', border: 'border-purple-500/20', thumb: 'bg-purple-500' },
  red: { bg: 'bg-red-500/10', fill: 'bg-gradient-to-r from-red-600 to-rose-500', border: 'border-red-500/20', thumb: 'bg-red-500' },
  green: { bg: 'bg-emerald-500/10', fill: 'bg-gradient-to-r from-emerald-600 to-green-500', border: 'border-emerald-500/20', thumb: 'bg-emerald-500' },
  orange: { bg: 'bg-amber-500/10', fill: 'bg-gradient-to-r from-amber-500 to-orange-500', border: 'border-amber-500/20', thumb: 'bg-amber-500' },
};

export function SlideConfirm({ label, onConfirm, color = 'violet', compact = false, disabled = false }) {
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const confirmedRef = useRef(false);

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - 48;
  }, [compact]);

  const handleStart = useCallback((clientX) => {
    if (disabled) return;
    startXRef.current = clientX;
    confirmedRef.current = false;
    setDragging(true);
    triggerHaptic('selection');
  }, [disabled]);

  const handleMove = useCallback((clientX) => {
    if (!dragging || disabled) return;
    const dx = Math.max(0, Math.min(clientX - startXRef.current, getMaxOffset()));
    setOffset(dx);
  }, [dragging, getMaxOffset, disabled]);

  const handleEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const max = getMaxOffset();
    if (offset > max * 0.85 && !confirmedRef.current && !disabled) {
      confirmedRef.current = true;
      triggerHaptic('success');
      onConfirm?.();
    }
    setOffset(0);
  }, [dragging, offset, getMaxOffset, onConfirm, disabled]);

  const progress = getMaxOffset() > 0 ? offset / getMaxOffset() : 0;
  const c = colorMap[color] || colorMap.violet;

  return (
    <div
      ref={trackRef}
      className={`relative overflow-hidden select-none touch-pan-y
        ${compact ? 'h-10 rounded-xl' : 'h-12 rounded-2xl'}
        ${c.bg} border ${c.border}
        ${disabled ? 'opacity-30 pointer-events-none' : ''}
        ${dragging ? 'scale-[0.98]' : ''}
        transition-transform duration-150 ease-spring`}
      onTouchStart={e => { e.stopPropagation(); handleStart(e.touches[0].clientX); }}
      onTouchMove={e => { e.stopPropagation(); handleMove(e.touches[0].clientX); }}
      onTouchEnd={e => { e.stopPropagation(); handleEnd(); }}
      onMouseDown={e => handleStart(e.clientX)}
      onMouseMove={e => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      <div className={`absolute inset-0 ${c.fill} transition-opacity duration-200`} style={{ opacity: progress }} />
      <div
        className="absolute inset-0 flex items-center justify-center text-white/60 text-xs font-bold tracking-[0.5px] uppercase pointer-events-none whitespace-nowrap overflow-hidden px-12 transition-opacity duration-200"
        style={{ opacity: 1 - progress * 0.8 }}
      >
        {label}
      </div>
      <div
        className={`absolute top-1 left-1 flex items-center justify-center rounded-xl
          ${compact ? 'w-8 h-8' : 'w-10 h-10'}
          ${c.thumb} shadow-lg`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.3s var(--ease-spring)',
        }}
      >
        <IconChevronRight size={compact ? 16 : 18} color="#fff" />
      </div>
    </div>
  );
}
