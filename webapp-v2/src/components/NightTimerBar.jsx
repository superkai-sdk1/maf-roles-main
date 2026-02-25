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
    <div className={`night-timer-bar ${expired ? 'night-timer-bar--expired' : ''}`}>
      <div ref={fillRef} className="night-timer-bar__fill" />
    </div>
  );
}
