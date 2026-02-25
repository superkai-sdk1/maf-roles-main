import React from 'react';
import { useGame } from '../context/GameContext';
import { triggerHaptic } from '../utils/haptics';

export function TimerPhase({ type }) {
  const {
    cityMode,
    discussionTimeLeft, discussionRunning, startDiscussionTimer, stopDiscussionTimer, advanceFromDiscussion,
    freeSeatingTimeLeft, freeSeatingRunning, startFreeSeatingTimer, stopFreeSeatingTimer, advanceFromFreeSeating,
  } = useGame();

  const isDiscussion = type === 'discussion';
  const timeLeft = isDiscussion ? discussionTimeLeft : freeSeatingTimeLeft;
  const running = isDiscussion ? discussionRunning : freeSeatingRunning;
  const start = isDiscussion ? startDiscussionTimer : startFreeSeatingTimer;
  const stop = isDiscussion ? stopDiscussionTimer : stopFreeSeatingTimer;
  const advance = isDiscussion ? advanceFromDiscussion : advanceFromFreeSeating;

  const title = isDiscussion
    ? (cityMode ? 'Знакомство' : 'Договорка')
    : 'Свободная посадка';

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = `${mins}:${String(secs).padStart(2, '0')}`;
  const isLow = timeLeft <= 10 && running;
  const isFinished = timeLeft === 0;

  return (
    <div className="flex flex-col items-center gap-3 py-6 animate-fade-in">
      <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-white/40">
        {title}
      </div>

      <div className={`px-3 py-1 rounded-full text-[0.65rem] font-bold tracking-wider uppercase
        ${running ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.2)]' :
          isFinished ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-white/40'}`}>
        {running ? 'Идёт' : isFinished ? 'Время вышло' : 'Готов'}
      </div>

      <div className={`text-5xl font-extrabold tracking-tight tabular-nums
        ${isLow ? 'text-red-400 animate-timer-pulse' :
          running ? 'text-white' :
          isFinished ? 'text-red-400/60 animate-timer-blink' : 'text-white/70'}`}>
        {display}
      </div>

      <div className="flex items-center gap-2 mt-1">
        {!running ? (
          <button
            onClick={() => { start(); triggerHaptic('light'); }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl
              bg-gradient-to-r from-emerald-500/20 to-cyan-500/20
              border border-emerald-500/30 text-emerald-400
              text-sm font-bold tracking-wide
              active:scale-95 transition-transform duration-150 ease-spring"
          >
            ▶ Старт
          </button>
        ) : (
          <button
            onClick={() => { stop(); triggerHaptic('light'); }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl
              bg-white/[0.04] border border-white/[0.08]
              text-amber-400 text-sm font-bold tracking-wide
              active:scale-95 transition-transform duration-150 ease-spring"
          >
            ⏸ Пауза
          </button>
        )}
        <button
          onClick={() => { advance(); triggerHaptic('light'); }}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-white/50 text-sm font-bold tracking-wide
            active:scale-95 transition-transform duration-150 ease-spring"
        >
          ⏭ Пропустить
        </button>
      </div>
    </div>
  );
}
