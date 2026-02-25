import React from 'react';

/**
 * Phone-style 3-column dialer:
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

/**
 * 2-row × 5-column compact grid:
 *   1  2  3  4  5
 *   6  7  8  9  10
 */
export function RowPad({ items, renderButton, className = '' }) {
  const firstRow = items.filter((_, i) => i < 5);
  const secondRow = items.filter((_, i) => i >= 5);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex gap-1.5 justify-center">
        {firstRow.map((item, i) => (
          <div key={item.num ?? i} className="flex-1 flex justify-center">
            {renderButton(item, i)}
          </div>
        ))}
      </div>
      {secondRow.length > 0 && (
        <div className="flex gap-1.5 justify-center">
          {secondRow.map((item, i) => (
            <div key={item.num ?? (i + 5)} className="flex-1 flex justify-center">
              {renderButton(item, i + 5)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SIZE = 'w-[56px] h-[56px]';
const SIZE_COMPACT = 'w-[42px] h-[42px]';
const BASE = 'rounded-full font-extrabold tabular-nums flex items-center justify-center active:scale-[0.88] transition-all duration-150 ease-spring select-none';

export const dialerBtn = {
  base: `${SIZE} ${BASE} text-[1.1em]`,
  compact: `${SIZE_COMPACT} ${BASE} text-[0.9em]`,

  normal: 'bg-white/[0.05] border border-white/[0.10] text-white/70 hover:bg-white/[0.09] hover:border-white/[0.16] shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
  selected: 'bg-accent text-white border border-transparent shadow-glow-accent',
  disabled: 'bg-white/[0.02] border border-white/[0.04] text-white/15 opacity-30 grayscale pointer-events-none',
  prefilled: 'bg-white/[0.06] border border-white/[0.12] text-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
  colored: (borderColor) => `bg-white/[0.05] border text-white/70 hover:bg-white/[0.09] shadow-[0_2px_8px_rgba(0,0,0,0.2)]`,
};
