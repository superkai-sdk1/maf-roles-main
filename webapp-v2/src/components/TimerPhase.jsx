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

  const timerClass = isLow ? 'warning' : running ? 'running' : isFinished ? 'finished' : '';
  const statusText = running ? 'Идёт' : isFinished ? 'Время вышло' : 'Готов';
  const statusClass = running ? 'status-running' : isFinished ? 'status-finished' : '';

  return (
    <div className="phase-timer-section animate-fadeIn">
      <div style={{
        fontSize: '0.7rem', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)', marginBottom: 8,
      }}>
        {title}
      </div>

      <div className={`timer-status-pill ${statusClass}`}>{statusText}</div>

      <div className={`timer-display ${timerClass}`}>{display}</div>

      <div className="timer-controls">
        {!running ? (
          <button className="timer-btn" onClick={() => { start(); triggerHaptic('light'); }}
            style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,210,255,0.2))', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}>
            ▶ Старт
          </button>
        ) : (
          <button className="timer-btn" onClick={() => { stop(); triggerHaptic('light'); }}
            style={{ color: '#ff9f0a' }}>
            ⏸ Пауза
          </button>
        )}
        <button className="timer-btn" onClick={() => { advance(); triggerHaptic('light'); }}
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          ⏭ Пропустить
        </button>
      </div>
    </div>
  );
}
