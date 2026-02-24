import React, { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import { IconChevronRight } from '../utils/icons';

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

  return (
    <div
      ref={trackRef}
      className={`sc-track sc-track--${color} ${compact ? 'sc-track--compact' : ''} ${disabled ? 'sc-track--disabled' : ''} ${dragging ? 'sc-track--dragging' : ''}`}
      onTouchStart={e => { e.stopPropagation(); handleStart(e.touches[0].clientX); }}
      onTouchMove={e => { e.stopPropagation(); handleMove(e.touches[0].clientX); }}
      onTouchEnd={e => { e.stopPropagation(); handleEnd(); }}
      onMouseDown={e => handleStart(e.clientX)}
      onMouseMove={e => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      <div className="sc-fill" style={{ opacity: progress }} />
      <div className="sc-label" style={{ opacity: 1 - progress * 0.8 }}>
        {label}
      </div>
      <div
        className={`sc-thumb ${compact ? 'sc-thumb--compact' : ''}`}
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
