import React, { useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import { Delete } from 'lucide-react';

export function CityNumpad({ value, onChange, maxValue, remainingVotes }) {
  const strValue = String(value || 0);

  const handleDigit = useCallback((digit) => {
    const newStr = value === 0 ? String(digit) : strValue + String(digit);
    const newVal = parseInt(newStr, 10);
    if (newVal > maxValue) return;
    onChange(newVal);
    triggerHaptic('selection');
  }, [value, strValue, maxValue, onChange]);

  const handleBackspace = useCallback(() => {
    if (strValue.length <= 1) {
      onChange(0);
    } else {
      onChange(parseInt(strValue.slice(0, -1), 10));
    }
    triggerHaptic('light');
  }, [strValue, onChange]);

  const isDigitDisabled = (digit) => {
    const newStr = value === 0 ? String(digit) : strValue + String(digit);
    const newVal = parseInt(newStr, 10);
    return newVal > maxValue;
  };

  const btnBase = 'h-14 rounded-[1.25rem] flex items-center justify-center text-xl font-black transition-all duration-150 active:scale-95';
  const btnEnabled = 'bg-white/[0.06] border border-white/[0.10] text-white/80 hover:bg-white/[0.10]';
  const btnDisabled = 'bg-white/[0.02] border border-white/[0.04] text-white/15 cursor-not-allowed';

  return (
    <div className="flex flex-col items-center gap-4 mb-6">
      <div className="flex items-center justify-between w-full px-2">
        <span className="text-5xl font-black text-accent tabular-nums min-w-[64px] text-center">
          {value || 0}
        </span>
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase font-black text-white/30 tracking-widest">Осталось голосов</span>
          <span className={`text-2xl font-black tabular-nums ${remainingVotes <= 0 ? 'text-red-400' : 'text-white/60'}`}>
            {remainingVotes}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <button
            key={d}
            disabled={isDigitDisabled(d)}
            onClick={() => handleDigit(d)}
            className={`${btnBase} ${isDigitDisabled(d) ? btnDisabled : btnEnabled}`}
          >
            {d}
          </button>
        ))}
        <button
          disabled={isDigitDisabled(0)}
          onClick={() => handleDigit(0)}
          className={`${btnBase} ${isDigitDisabled(0) ? btnDisabled : btnEnabled}`}
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={value === 0}
          className={`${btnBase} ${value === 0 ? btnDisabled : btnEnabled} col-span-2`}
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}
