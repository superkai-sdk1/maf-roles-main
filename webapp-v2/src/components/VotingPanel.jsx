import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { DialerPad, dialerBtn } from './DialerPad';

export function VotingPanel() {
  const {
    tableOut, isPlayerActive, gamePhase, dayNumber,
    nominations, getNominatedCandidates, nominationsLocked,
    startVoting, showVotingModal, setShowVotingModal,
    votingOrder, votingCurrentIndex, setVotingCurrentIndex, votingResults, votingFinished, votingWinners,
    votingStage, votingTiePlayers,
    toggleVotingSelection, acceptCurrentCandidateVotes,
    startTieVoting, startLiftVoting, closeVotingAndApply,
    votingHistory, votingScreenTab, setVotingScreenTab,
    votingLastSpeechActive, votingTieTimerActive,
    votingTieSpeakerIdx, votingTieAllDone, advanceTieSpeaker,
    toggleLiftVote, votingLiftResults, finishLiftVoting,
    cityMode, cityVoteCounts, setCityVoteCounts,
    votingDay0SingleCandidate, votingDay0TripleTie, votingDay0TripleTiePlayers,
    dismissDay0VotingAndGoToNight,
    handleGoToNight,
  } = useGame();

  // === Controllable tie speech timer ===
  const tieTimer = useTimer(30, null);
  const tieHoldRef = useRef(null);
  const tieHoldActiveRef = useRef(false);
  const tieLastTouchRef = useRef(0);
  const prevTieSpeakerIdx = useRef(-1);

  useEffect(() => {
    if (votingTieTimerActive && !votingTieAllDone) {
      if (prevTieSpeakerIdx.current !== votingTieSpeakerIdx) {
        tieTimer.start(30);
        prevTieSpeakerIdx.current = votingTieSpeakerIdx;
      }
    }
    if (!votingTieTimerActive) {
      prevTieSpeakerIdx.current = -1;
    }
  }, [votingTieTimerActive, votingTieSpeakerIdx, votingTieAllDone]);

  const handleTieTimerClick = useCallback(() => {
    if (!tieTimer.isRunning) { tieTimer.start(); triggerHaptic('light'); }
    else if (tieTimer.isPaused) { tieTimer.resume(); triggerHaptic('light'); }
    else { tieTimer.pause(); triggerHaptic('light'); }
  }, [tieTimer]);

  const handleTieHoldStart = useCallback((e) => {
    if (e.type === 'mousedown' && Date.now() - tieLastTouchRef.current < 500) return;
    if (e.type === 'touchstart') tieLastTouchRef.current = Date.now();
    tieHoldActiveRef.current = false;
    tieHoldRef.current = setTimeout(() => {
      tieHoldActiveRef.current = true;
      tieTimer.stop();
      triggerHaptic('heavy');
    }, 800);
  }, [tieTimer]);

  const handleTieHoldEnd = useCallback((e) => {
    if (e.type === 'touchend') tieLastTouchRef.current = Date.now();
    if (e.type === 'mouseup' && Date.now() - tieLastTouchRef.current < 500) return;
    clearTimeout(tieHoldRef.current);
    if (!tieHoldActiveRef.current) handleTieTimerClick();
  }, [handleTieTimerClick]);

  const handleTieHoldCancel = useCallback(() => {
    clearTimeout(tieHoldRef.current);
    tieHoldActiveRef.current = true;
  }, []);

  const tieTimerStatusText = tieTimer.isRunning
    ? (tieTimer.isPaused ? 'Пауза' : 'Идёт')
    : (tieTimer.timeLeft === 0 ? 'Время вышло' : 'Готов');
  const tieTimerStatusClass = tieTimer.isRunning
    ? (tieTimer.isPaused ? '' : 'status-running')
    : (tieTimer.timeLeft === 0 ? 'status-finished' : '');
  const tieTimerDisplayClass = (tieTimer.timeLeft <= 10 && tieTimer.isRunning && !tieTimer.isPaused) ? 'warning'
    : tieTimer.isRunning ? 'running'
    : tieTimer.timeLeft === 0 ? 'finished' : '';

  // === Controllable last speech timer (60s, +30s foul up to 2x) ===
  const lastSpeechTimer = useTimer(60, null);
  const lastSpeechHoldRef = useRef(null);
  const lastSpeechHoldActiveRef = useRef(false);
  const lastSpeechLastTouchRef = useRef(0);
  const [lastSpeechFoulCount, setLastSpeechFoulCount] = useState(0);
  const prevLastSpeechActive = useRef(false);

  useEffect(() => {
    if (votingLastSpeechActive && !prevLastSpeechActive.current) {
      lastSpeechTimer.start(60);
      setLastSpeechFoulCount(0);
    }
    prevLastSpeechActive.current = votingLastSpeechActive;
  }, [votingLastSpeechActive]);

  const handleLastSpeechTimerClick = useCallback(() => {
    if (!lastSpeechTimer.isRunning) { lastSpeechTimer.start(); triggerHaptic('light'); }
    else if (lastSpeechTimer.isPaused) { lastSpeechTimer.resume(); triggerHaptic('light'); }
    else { lastSpeechTimer.pause(); triggerHaptic('light'); }
  }, [lastSpeechTimer]);

  const handleLastSpeechHoldStart = useCallback((e) => {
    if (e.type === 'mousedown' && Date.now() - lastSpeechLastTouchRef.current < 500) return;
    if (e.type === 'touchstart') lastSpeechLastTouchRef.current = Date.now();
    lastSpeechHoldActiveRef.current = false;
    lastSpeechHoldRef.current = setTimeout(() => {
      lastSpeechHoldActiveRef.current = true;
      lastSpeechTimer.stop();
      setLastSpeechFoulCount(0);
      triggerHaptic('heavy');
    }, 800);
  }, [lastSpeechTimer]);

  const handleLastSpeechHoldEnd = useCallback((e) => {
    if (e.type === 'touchend') lastSpeechLastTouchRef.current = Date.now();
    if (e.type === 'mouseup' && Date.now() - lastSpeechLastTouchRef.current < 500) return;
    clearTimeout(lastSpeechHoldRef.current);
    if (!lastSpeechHoldActiveRef.current) handleLastSpeechTimerClick();
  }, [handleLastSpeechTimerClick]);

  const handleLastSpeechHoldCancel = useCallback(() => {
    clearTimeout(lastSpeechHoldRef.current);
    lastSpeechHoldActiveRef.current = true;
  }, []);

  const lastSpeechStatusText = lastSpeechTimer.isRunning
    ? (lastSpeechTimer.isPaused ? 'Пауза' : 'Идёт')
    : (lastSpeechTimer.timeLeft === 0 ? 'Время вышло' : 'Готов');
  const lastSpeechStatusClass = lastSpeechTimer.isRunning
    ? (lastSpeechTimer.isPaused ? '' : 'status-running')
    : (lastSpeechTimer.timeLeft === 0 ? 'status-finished' : '');
  const lastSpeechDisplayClass = (lastSpeechTimer.timeLeft <= 10 && lastSpeechTimer.isRunning && !lastSpeechTimer.isPaused) ? 'warning'
    : lastSpeechTimer.isRunning && lastSpeechTimer.isPaused ? 'paused'
    : lastSpeechTimer.isRunning ? 'running'
    : lastSpeechTimer.timeLeft === 0 ? 'finished' : '';

  const candidates = getNominatedCandidates();
  const currentCandidate = votingOrder[votingCurrentIndex];
  const currentVotes = votingResults[String(currentCandidate)] || [];
  const alivePlayers = tableOut.filter(p => isPlayerActive(p.roleKey));

  const alreadyVotedElsewhere = new Set(
    Object.entries(votingResults)
      .filter(([c]) => c !== String(currentCandidate))
      .flatMap(([, voters]) => voters)
  );
  const isLastCandidate = votingCurrentIndex >= votingOrder.length - 1;
  const remainingVoters = alivePlayers
    .map(p => p.num)
    .filter(n => !alreadyVotedElsewhere.has(n) && !currentVotes.includes(n));

  const formatTime = (t) => String(t).padStart(2, '0');

  const getTimerStatusPillClasses = (statusClass) => {
    const base = 'px-3 py-1 rounded-full text-[0.65rem] font-bold tracking-wider uppercase w-fit mx-auto mb-1';
    if (statusClass === 'status-running') return `${base} bg-emerald-500/15 text-emerald-400`;
    if (statusClass === 'status-finished') return `${base} bg-red-500/15 text-red-400`;
    return `${base} bg-white/[0.06] text-white/40`;
  };

  const getTimerDisplayClasses = (displayClass) => {
    const base = 'text-center text-5xl font-extrabold tracking-tight tabular-nums cursor-pointer select-none my-2';
    if (displayClass === 'warning') return `${base} text-red-400 animate-timer-pulse`;
    if (displayClass === 'running') return `${base} text-white`;
    if (displayClass === 'paused') return `${base} text-amber-400/70`;
    if (displayClass === 'finished') return `${base} text-red-400/60 animate-timer-blink`;
    return `${base} text-white/70`;
  };

  const getDialerBtnClasses = ({ voted, votedElsewhere, prefilled }) => {
    if (voted) return `${dialerBtn.base} ${dialerBtn.selected}`;
    if (votedElsewhere) return `${dialerBtn.base} ${dialerBtn.disabled}`;
    if (prefilled) return `${dialerBtn.base} ${dialerBtn.prefilled}`;
    return `${dialerBtn.base} ${dialerBtn.normal}`;
  };

  return (
    <div className="animate-fade-in flex flex-col gap-[14px]">
      {/* Header */}
      <div className="text-center pt-2">
        <h2 className="text-white text-[1.4em] font-extrabold tracking-[0.3px]">Голосование</h2>
        {candidates.length > 0 && votingScreenTab === 'voting' && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className="text-xs text-white/40 font-medium">Выставлены:</span>
            {candidates.map(num => (
              <span key={num} className="w-8 h-8 rounded-lg bg-[rgba(255,214,10,0.12)] border border-[rgba(255,214,10,0.30)] text-[#ffd60a] flex items-center justify-center text-sm font-bold">{num}</span>
            ))}
          </div>
        )}
      </div>

      {votingScreenTab === 'voting' && (
        <>
          {/* No candidates nominated */}
          {!showVotingModal && candidates.length === 0 && (
            <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-8 text-center">
              <div className="text-[2.5em] mb-3 opacity-30 relative z-[1]">⚖️</div>
              <h3 className="text-base font-bold mb-1.5 relative z-[1]">Нет выставленных игроков</h3>
              <p className="text-[0.85em] text-white/35">
                Выставите кандидатов в карточках игроков, чтобы начать голосование
              </p>
            </div>
          )}

          {/* Active voting modal */}
          {showVotingModal && (
            <div className="flex flex-col gap-[14px]">
              {/* Day 0: single candidate — no voting */}
              {votingDay0SingleCandidate && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-6 text-center">
                  <div className="text-[2.5em] mb-3 opacity-40 relative z-[1]">☝️</div>
                  <h3 className="text-base font-bold mb-2">
                    Выставлен 1 кандидат — #{votingDay0SingleCandidate}
                  </h3>
                  <p className="text-[0.85em] text-white/40 mb-4">
                    На нулевом голосовании выставлен только один игрок. Голосование не проводится.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-3 px-6 text-[0.9em]">
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* Day 0: triple tie — no re-vote possible */}
              {votingDay0TripleTie && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-6 text-center">
                  <div className="text-[2.5em] mb-3 opacity-40 relative z-[1]">⚖️</div>
                  <h3 className="text-base font-bold mb-2">
                    Ничья {votingDay0TripleTiePlayers.length} игроков
                  </h3>
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
                    {votingDay0TripleTiePlayers.map(num => (
                      <span key={num} className="py-1.5 px-3.5 rounded-[10px] bg-[rgba(255,214,10,0.15)] text-[0.9em] font-bold text-[#ffd60a]">
                        #{num}
                      </span>
                    ))}
                  </div>
                  <p className="text-[0.85em] text-white/40 mb-4">
                    На нулевом голосовании невозможно деление {votingDay0TripleTiePlayers.length} игроков.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-3 px-6 text-[0.9em]">
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* Tie — split players with controllable timer */}
              {votingTieTimerActive && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-4 text-center !border-[rgba(255,214,10,0.3)]">
                  <h3 className="text-base font-extrabold text-[#ffd60a] mb-2.5">Деление игроков</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3.5 justify-center">
                    {votingTiePlayers.map((num, i) => {
                      const isCurrent = !votingTieAllDone && i === votingTieSpeakerIdx;
                      const isDone = i < votingTieSpeakerIdx || votingTieAllDone;
                      return (
                        <span key={num} className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm font-bold transition-all duration-300 ease-out"
                          style={{
                            ...(isCurrent ? { boxShadow: '0 0 12px rgba(255,214,10,0.5)', border: '2px solid #ffd60a', transform: 'scale(1.15)' } : {}),
                            ...(isDone ? { opacity: 0.4 } : {}),
                          }}>{num}</span>
                      );
                    })}
                  </div>

                  {!votingTieAllDone && (
                    <div className="mx-auto mb-3.5 max-w-[260px]">
                      <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-white/40 mb-1.5">
                        Речь игрока #{votingTiePlayers[votingTieSpeakerIdx]}
                        <span className="ml-1.5 opacity-50">({votingTieSpeakerIdx + 1}/{votingTiePlayers.length})</span>
                      </div>
                      <div className={getTimerStatusPillClasses(tieTimerStatusClass)}>{tieTimerStatusText}</div>
                      <div className={getTimerDisplayClasses(tieTimerDisplayClass)}
                        onMouseDown={handleTieHoldStart}
                        onMouseUp={handleTieHoldEnd}
                        onMouseLeave={handleTieHoldCancel}
                        onTouchStart={handleTieHoldStart}
                        onTouchEnd={handleTieHoldEnd}
                        onTouchMove={handleTieHoldCancel}
                        onTouchCancel={handleTieHoldCancel}>
                        {formatTime(tieTimer.timeLeft)}
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        {tieTimer.timeLeft === 0 && !tieTimer.isRunning ? (
                          <button className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-bold active:scale-90 transition-transform duration-150 ease-spring"
                            style={{ background: 'linear-gradient(135deg, rgba(255,214,10,0.2), rgba(255,160,10,0.2))', border: '1px solid rgba(255,214,10,0.3)', color: '#ffd60a' }}
                            onClick={() => { advanceTieSpeaker(); triggerHaptic('light'); }}>
                            {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? '✓ Завершить' : '▶ Дальше'}
                          </button>
                        ) : (
                          <button className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-bold active:scale-90 transition-transform duration-150 ease-spring text-white/50"
                            onClick={() => { tieTimer.stop(); advanceTieSpeaker(); triggerHaptic('light'); }}>
                            {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? '⏭ Завершить' : '⏭ Пропустить'}
                          </button>
                        )}
                      </div>
                      <div className="text-[0.65rem] text-white/25 text-center mt-2">Клик: Старт/Пауза | Удержание: Сброс</div>
                    </div>
                  )}

                  {votingTieAllDone && (
                    <div className="mt-3.5 pt-3.5 border-t border-[rgba(255,214,10,0.15)]">
                      <p className="text-[0.85em] text-white/40 mb-3">Все кандидаты высказались</p>
                      {votingStage === 'tie' ? (
                        <button onClick={() => { startLiftVoting(); triggerHaptic('medium'); }}
                          className="w-full rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-3.5 px-6 text-[0.9em]">
                          Голосование за подъём
                        </button>
                      ) : (
                        <button onClick={() => { startTieVoting(); triggerHaptic('medium'); }}
                          className="w-full rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-3.5 px-6 text-[0.9em]">
                          Повторное голосование
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Last speech with controllable timer + slide to night */}
              {votingLastSpeechActive && votingWinners.length > 0 && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-4 text-center !border-[rgba(255,69,58,0.3)]">
                  <h3 className="text-base font-extrabold text-[#ff453a] mb-2.5">Крайняя речь</h3>
                  {votingWinners.map(num => {
                    const p = tableOut[num - 1];
                    return <div key={num} className="text-[1.4em] font-extrabold">#{num} {p?.login}</div>;
                  })}

                  <div className="mt-3.5 mx-auto max-w-[260px]">
                    <div className={getTimerStatusPillClasses(lastSpeechStatusClass)}>{lastSpeechStatusText}</div>
                    <div className={getTimerDisplayClasses(lastSpeechDisplayClass)}
                      onMouseDown={handleLastSpeechHoldStart}
                      onMouseUp={handleLastSpeechHoldEnd}
                      onMouseLeave={handleLastSpeechHoldCancel}
                      onTouchStart={handleLastSpeechHoldStart}
                      onTouchEnd={handleLastSpeechHoldEnd}
                      onTouchMove={handleLastSpeechHoldCancel}
                      onTouchCancel={handleLastSpeechHoldCancel}>
                      {formatTime(lastSpeechTimer.timeLeft)}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {lastSpeechTimer.timeLeft > 0 && lastSpeechFoulCount < 2 && (
                        <button className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm font-bold active:scale-90 transition-transform duration-150 ease-spring text-[#ff9f0a]"
                          onClick={() => { lastSpeechTimer.addTime(30); setLastSpeechFoulCount(c => c + 1); triggerHaptic('warning'); }}>
                          +30с (+Ф)
                        </button>
                      )}
                    </div>
                    <div className="text-[0.65rem] text-white/25 text-center mt-2">Клик: Старт/Пауза | Удержание: Сброс</div>
                  </div>

                  <div className="mt-4">
                    <SlideConfirm
                      label="Перейти в ночь"
                      onConfirm={() => { lastSpeechTimer.stop(); closeVotingAndApply(); handleGoToNight(true); triggerHaptic('medium'); }}
                      color="night"
                      compact
                    />
                  </div>
                </div>
              )}

              {/* Lift voting */}
              {votingStage === 'lift' && !votingFinished && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-glass-reveal p-4">
                  <div className="flex items-center justify-between mb-3 relative z-[1]">
                    <h3 className="text-[0.9em] font-bold">Голосование за подъём</h3>
                    <span className="text-[0.75em] text-white/40 font-bold">
                      {votingLiftResults.length} / {Math.ceil(alivePlayers.length / 2 + 0.1)} нужно
                    </span>
                  </div>

                  <div className="text-center mb-3">
                    <span className="text-[0.7em] text-white/40 uppercase tracking-wider">Поднять:</span>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5 justify-center">
                      {votingTiePlayers.map(num => (
                        <span key={num} className="w-8 h-8 rounded-lg bg-[rgba(255,214,10,0.12)] border border-[rgba(255,214,10,0.30)] text-[#ffd60a] flex items-center justify-center text-sm font-bold">{num}</span>
                      ))}
                    </div>
                  </div>

                  <div className="text-[0.7em] text-white/30 uppercase tracking-wider mb-2 text-center">
                    Кто за подъём?
                  </div>

                  <DialerPad items={tableOut} className="mb-3" renderButton={(p) => {
                    const alive = isPlayerActive(p.roleKey);
                    const voted = votingLiftResults.includes(p.num);
                    return (
                      <button
                        onClick={() => { if (alive) { toggleLiftVote(p.num); triggerHaptic('selection'); } }}
                        className={getDialerBtnClasses({ voted, votedElsewhere: !alive, prefilled: false })}
                        disabled={!alive}>
                        {p.num}
                      </button>
                    );
                  }} />

                  <div className="flex items-center justify-between">
                    <span className="text-[0.85em] text-white/40">
                      Голосов: {votingLiftResults.length}
                    </span>
                    <button onClick={() => { finishLiftVoting(); triggerHaptic('medium'); }}
                      className="rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-2 px-4 text-[0.85em]">
                      Завершить ›
                    </button>
                  </div>
                </div>
              )}

              {/* Main/Tie voting */}
              {(votingStage === 'main' || votingStage === 'tie') && !votingFinished && !votingTieTimerActive && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-glass-reveal p-4">
                  <div className="flex items-center justify-between mb-3 relative z-[1]">
                    <h3 className="text-[0.9em] font-bold">
                      {votingStage === 'tie' ? 'Повторное голосование' : 'Голосование'}
                    </h3>
                    <span className="text-[0.75em] text-white/40 font-bold">
                      {votingCurrentIndex + 1} / {votingOrder.length}
                    </span>
                  </div>

                  <div className="text-center mb-3">
                    <span className="text-[0.7em] text-white/40 uppercase tracking-wider">Голосуем за:</span>
                    <div className="text-[1.5em] font-extrabold text-[#ffd60a] mt-1">
                      #{currentCandidate} {tableOut[currentCandidate - 1]?.login || ''}
                    </div>
                  </div>

                  {/* City mode: counter instead of per-voter */}
                  {cityMode ? (
                    <div className="flex items-center justify-center gap-6 mb-3">
                      <button onClick={() => setCityVoteCounts(prev => ({ ...prev, [currentCandidate]: Math.max(0, (prev[currentCandidate] || 0) - 1) }))}
                        className="w-[52px] h-[52px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring text-[1.5em] p-0 flex items-center justify-center">−</button>
                      <span style={{ fontSize: '2.5em', fontWeight: 800, color: 'var(--accent-color)', minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {cityVoteCounts[currentCandidate] || 0}
                      </span>
                      <button onClick={() => setCityVoteCounts(prev => ({ ...prev, [currentCandidate]: (prev[currentCandidate] || 0) + 1 }))}
                        className="w-[52px] h-[52px] rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring text-[1.5em] p-0 flex items-center justify-center">+</button>
                    </div>
                  ) : (
                    <DialerPad items={tableOut} className="mb-3" renderButton={(p) => {
                      const alive = isPlayerActive(p.roleKey);
                      const voted = currentVotes.includes(p.num);
                      const votedElsewhere = alreadyVotedElsewhere.has(p.num);
                      const prefilled = alive && isLastCandidate && !voted && !votedElsewhere;
                      const isDisabled = !alive || votedElsewhere;
                      return (
                        <button
                          onClick={() => { if (!isDisabled) { toggleVotingSelection(p.num); triggerHaptic('selection'); } }}
                          className={getDialerBtnClasses({ voted, votedElsewhere: isDisabled, prefilled })}
                          disabled={isDisabled}>
                          {p.num}
                        </button>
                      );
                    }} />
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {votingCurrentIndex > 0 && (
                        <button onClick={() => { setVotingCurrentIndex(i => i - 1); triggerHaptic('light'); }}
                          className="rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-2 px-3.5 text-[0.85em]">
                          ‹ Назад
                        </button>
                      )}
                      <span className="text-[0.85em] text-white/40">
                        Голосов: {cityMode ? (cityVoteCounts[currentCandidate] || 0) : (currentVotes.length + (isLastCandidate ? remainingVoters.length : 0))}
                      </span>
                    </div>
                    <button onClick={() => { acceptCurrentCandidateVotes(); triggerHaptic('light'); }}
                      className="rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-2 px-4 text-[0.85em]">
                      {votingCurrentIndex >= votingOrder.length - 1 ? 'Завершить' : 'Принять'} ›
                    </button>
                  </div>

                  {/* Results so far */}
                  {Object.keys(votingResults).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <div className="flex flex-col gap-1">
                        {votingOrder.slice(0, votingCurrentIndex + 1).map(c => (
                          <div key={c} className="flex justify-between text-[0.8em]">
                            <span className="text-white/40">#{c} {tableOut[c - 1]?.login || ''}</span>
                            <span className="font-bold" style={{ color: 'var(--accent-color)' }}>{(votingResults[String(c)] || []).length} голосов</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No winners */}
              {votingFinished && votingWinners.length === 0 && !votingTieTimerActive && (
                <div className="relative z-[1] rounded-2xl glass-card-md animate-fade-in p-4 text-center">
                  {votingStage === 'lift' ? (
                    <>
                      <h3 className="text-[0.9em] font-bold mb-2">Голосов за подъём недостаточно</h3>
                      <p className="text-[0.85em] text-white/40 mb-4">Никто не выбывает</p>
                      <div className="mb-2.5">
                        <SlideConfirm
                          label={`Перейти в ночь`}
                          onConfirm={() => { closeVotingAndApply(); handleGoToNight(true); triggerHaptic('medium'); }}
                          color="night"
                          compact
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-[0.9em] font-bold mb-2">Голосование завершено</h3>
                      <p className="text-[0.85em] text-white/40 mb-3">Никто не выбыл</p>
                      <button onClick={() => { closeVotingAndApply(); triggerHaptic('light'); }}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring py-2.5 px-6 text-[0.85em]">
                        Закрыть
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {votingScreenTab === 'history' && (
        <div className="animate-fade-in flex flex-col gap-2.5">
          {votingHistory.length === 0 ? (
            <div className="py-10 text-center text-white/25">
              <div className="text-[2em] mb-2 opacity-30">📋</div>
              <p className="text-[0.9em]">История голосований пуста</p>
            </div>
          ) : (
            [...votingHistory].reverse().map((v, i) => (
              <div key={i} className="relative z-[1] rounded-2xl glass-card-md p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider">
                    Голосование #{v.votingNumber} (День {v.dayNumber})
                  </span>
                </div>

                {/* Result */}
                {v.finalWinners?.length > 0 ? (
                  <div className="text-[0.85em] font-semibold mb-2.5 py-1.5 px-2.5 rounded-[10px] bg-red-500/10 border border-red-500/20">
                    Заголосован: {v.finalWinners.map(num => `#${num} ${tableOut[num - 1]?.login || ''}`).join(', ')}
                  </div>
                ) : (
                  <div className="text-[0.85em] text-white/40 mb-2.5">Никто не выбыл</div>
                )}

                {/* Stages */}
                {v.stages?.map((s, si) => (
                  <div key={si} className={si > 0 ? 'mt-2.5 pt-2.5 border-t border-white/[0.06]' : ''}>
                    <div className="text-[0.7em] font-bold text-white/30 uppercase tracking-wider mb-1.5">
                      {s.type === 'main' ? 'Основное' : s.type === 'tie' ? 'Повторное' : 'За подъём'}
                    </div>

                    {s.type === 'lift' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[0.75em] text-white/35">За подъём:</span>
                          {(s.liftVoters || []).length > 0 ? (
                            (s.liftVoters || []).map(num => (
                              <span key={num} className="text-[0.75em] font-bold text-[#00ff88] bg-[rgba(0,255,136,0.1)] py-0.5 px-2 rounded-lg">
                                #{num}
                              </span>
                            ))
                          ) : (
                            <span className="text-[0.75em] text-white/25">никто</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {(s.candidates || Object.keys(s.results || {})).map(c => {
                          const cNum = String(c);
                          const voters = Array.isArray(s.results?.[cNum]) ? s.results[cNum] : [];
                          const voteCount = voters.length;
                          return (
                            <div key={cNum} className="bg-white/[0.03] rounded-[10px] py-2 px-2.5">
                              <div className={`flex items-center justify-between ${voters.length > 0 ? 'mb-1' : ''}`}>
                                <span className="text-[0.85em] font-bold text-[#ffd60a]">
                                  #{cNum} {tableOut[Number(cNum) - 1]?.login || ''}
                                </span>
                                <span className="text-[0.8em] font-bold" style={{ color: 'var(--accent-color)' }}>
                                  {voteCount} {voteCount === 1 ? 'голос' : voteCount >= 2 && voteCount <= 4 ? 'голоса' : 'голосов'}
                                </span>
                              </div>
                              {voters.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {voters.map(voterNum => (
                                    <span key={voterNum} className="text-[0.7em] font-semibold text-white/50 bg-white/[0.06] py-0.5 px-1.5 rounded-md">
                                      #{voterNum}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
