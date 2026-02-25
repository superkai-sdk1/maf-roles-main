import React, { useEffect, useRef, useState } from 'react';

export function NightTimerBar({ duration }) {
  const fillRef = useRef(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const durationMs = duration * 1000;
    let raf;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, (1 - elapsed / durationMs) * 100);

      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }

      if (pct <= 0) {
        setExpired(true);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return (
    <div className={`relative w-full h-1.5 rounded-full overflow-hidden
      ${expired
        ? 'bg-red-500/20 animate-nt-blink'
        : 'bg-white/[0.06]'}`}
    >
      <div
        ref={fillRef}
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--accent-color)] to-indigo-500/80
          transition-none"
        style={{ width: '100%' }}
      />
      {!expired && (
        <div className="absolute inset-0 rounded-full bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-nt-wave" />
      )}
    </div>
  );
}
