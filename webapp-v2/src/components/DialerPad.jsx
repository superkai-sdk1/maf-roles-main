import React from 'react';

/**
 * Phone-style 3-column dialer layout:
 *   1  2  3
 *   4  5  6
 *   7  8  9
 *      10
 */
export function DialerPad({ items, renderButton, className = '' }) {
  return (
    <div className={`grid grid-cols-3 gap-3 justify-items-center ${className}`}>
      {items.map((item, i) => {
        const isCenter = items.length === 10 && i === 9;
        return (
          <div key={item.num ?? i} className={isCenter ? 'col-start-2' : ''}>
            {renderButton(item, i)}
          </div>
        );
      })}
    </div>
  );
}

const SIZE = 'w-[56px] h-[56px]';
const SIZE_COMPACT = 'w-[48px] h-[48px]';
const BASE = 'rounded-full text-[1.1em] font-extrabold tabular-nums flex items-center justify-center active:scale-[0.88] transition-all duration-150 ease-spring select-none';

export const dialerBtn = {
  base: `${SIZE} ${BASE}`,
  compact: `${SIZE_COMPACT} ${BASE} text-[1em]`,

  normal: 'bg-white/[0.05] border border-white/[0.10] text-white/70 hover:bg-white/[0.09] hover:border-white/[0.16] shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
  selected: 'bg-accent text-white border border-transparent shadow-glow-accent',
  disabled: 'bg-white/[0.02] border border-white/[0.04] text-white/15 opacity-30 grayscale pointer-events-none',
  prefilled: 'bg-white/[0.06] border border-white/[0.12] text-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
  colored: (borderColor) => `bg-white/[0.05] border text-white/70 hover:bg-white/[0.09] shadow-[0_2px_8px_rgba(0,0,0,0.2)]`,
};
