import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';

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

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <h2 className="voting-title">Голосование</h2>
        {candidates.length > 0 && votingScreenTab === 'voting' && (
          <div className="voting-nominated-row">
            <span className="voting-nominated-label">Выставлены:</span>
            {candidates.map(num => (
              <span key={num} className="voting-nominated-num">{num}</span>
            ))}
          </div>
        )}
      </div>

      {votingScreenTab === 'voting' && (
        <>
          {/* No candidates nominated */}
          {!showVotingModal && candidates.length === 0 && (
            <div className="glass-card animate-fadeIn" style={{ padding: 32, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '2.5em', marginBottom: 12, opacity: 0.3 }}>⚖️</div>
              <h3 style={{ fontSize: '1em', fontWeight: 700, marginBottom: 6 }}>Нет выставленных игроков</h3>
              <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.35)' }}>
                Выставите кандидатов в карточках игроков, чтобы начать голосование
              </p>
            </div>
          )}

          {/* Active voting modal */}
          {showVotingModal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Day 0: single candidate — no voting */}
              {votingDay0SingleCandidate && (
                <div className="glass-card animate-fadeIn" style={{ padding: 24, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '2.5em', marginBottom: 12, opacity: 0.4 }}>☝️</div>
                  <h3 style={{ fontSize: '1em', fontWeight: 700, marginBottom: 8 }}>
                    Выставлен 1 кандидат — #{votingDay0SingleCandidate}
                  </h3>
                  <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
                    На нулевом голосовании выставлен только один игрок. Голосование не проводится.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="glass-btn btn-primary" style={{ padding: '12px 24px', fontSize: '0.9em' }}>
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* Day 0: triple tie — no re-vote possible */}
              {votingDay0TripleTie && (
                <div className="glass-card animate-fadeIn" style={{ padding: 24, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '2.5em', marginBottom: 12, opacity: 0.4 }}>⚖️</div>
                  <h3 style={{ fontSize: '1em', fontWeight: 700, marginBottom: 8 }}>
                    Ничья {votingDay0TripleTiePlayers.length} игроков
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                    {votingDay0TripleTiePlayers.map(num => (
                      <span key={num} style={{
                        padding: '6px 14px', background: 'rgba(255,214,10,0.15)', borderRadius: 10,
                        fontSize: '0.9em', fontWeight: 700, color: '#ffd60a',
                      }}>#{num}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
                    На нулевом голосовании невозможно деление {votingDay0TripleTiePlayers.length} игроков.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="glass-btn btn-primary" style={{ padding: '12px 24px', fontSize: '0.9em' }}>
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* Tie — split players with controllable timer */}
              {votingTieTimerActive && (
                <div className="glass-card animate-fadeIn" style={{
                  padding: 16, textAlign: 'center', position: 'relative', zIndex: 1,
                  borderColor: 'rgba(255,214,10,0.3)', background: 'rgba(255,214,10,0.05)',
                }}>
                  <h3 style={{ fontSize: '1em', fontWeight: 800, color: '#ffd60a', marginBottom: 10 }}>Деление игроков</h3>
                  <div className="voting-nominated-row" style={{ marginBottom: 14, justifyContent: 'center' }}>
                    {votingTiePlayers.map((num, i) => {
                      const isCurrent = !votingTieAllDone && i === votingTieSpeakerIdx;
                      const isDone = i < votingTieSpeakerIdx || votingTieAllDone;
                      return (
                        <span key={num} className="voting-nominated-num" style={{
                          ...(isCurrent ? { boxShadow: '0 0 12px rgba(255,214,10,0.5)', border: '2px solid #ffd60a', transform: 'scale(1.15)' } : {}),
                          ...(isDone ? { opacity: 0.4 } : {}),
                          transition: 'all 0.3s ease',
                        }}>{num}</span>
                      );
                    })}
                  </div>

                  {!votingTieAllDone && (
                    <div className="timer-section" style={{ margin: '0 auto 14px', maxWidth: 260 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                        Речь игрока #{votingTiePlayers[votingTieSpeakerIdx]}
                        <span style={{ marginLeft: 6, opacity: 0.5 }}>({votingTieSpeakerIdx + 1}/{votingTiePlayers.length})</span>
                      </div>
                      <div className={`timer-status-pill ${tieTimerStatusClass}`}>{tieTimerStatusText}</div>
                      <div className={`timer-display ${tieTimerDisplayClass}`}
                        onMouseDown={handleTieHoldStart}
                        onMouseUp={handleTieHoldEnd}
                        onMouseLeave={handleTieHoldCancel}
                        onTouchStart={handleTieHoldStart}
                        onTouchEnd={handleTieHoldEnd}
                        onTouchMove={handleTieHoldCancel}
                        onTouchCancel={handleTieHoldCancel}>
                        {formatTime(tieTimer.timeLeft)}
                      </div>
                      <div className="timer-controls">
                        {tieTimer.timeLeft === 0 && !tieTimer.isRunning ? (
                          <button className="timer-btn" onClick={() => { advanceTieSpeaker(); triggerHaptic('light'); }}
                            style={{ background: 'linear-gradient(135deg, rgba(255,214,10,0.2), rgba(255,160,10,0.2))', border: '1px solid rgba(255,214,10,0.3)', color: '#ffd60a' }}>
                            {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? '✓ Завершить' : '▶ Дальше'}
                          </button>
                        ) : (
                          <button className="timer-btn" onClick={() => { tieTimer.stop(); advanceTieSpeaker(); triggerHaptic('light'); }}
                            style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? '⏭ Завершить' : '⏭ Пропустить'}
                          </button>
                        )}
                      </div>
                      <div className="timer-hint">Клик: Старт/Пауза | Удержание: Сброс</div>
                    </div>
                  )}

                  {votingTieAllDone && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,214,10,0.15)' }}>
                      <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Все кандидаты высказались</p>
                      {votingStage === 'tie' ? (
                        <button onClick={() => { startLiftVoting(); triggerHaptic('medium'); }}
                          className="glass-btn btn-primary" style={{ width: '100%', padding: '14px 24px', fontSize: '0.9em' }}>
                          Голосование за подъём
                        </button>
                      ) : (
                        <button onClick={() => { startTieVoting(); triggerHaptic('medium'); }}
                          className="glass-btn btn-primary" style={{ width: '100%', padding: '14px 24px', fontSize: '0.9em' }}>
                          Повторное голосование
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Last speech with controllable timer + slide to night */}
              {votingLastSpeechActive && votingWinners.length > 0 && (
                <div className="glass-card animate-fadeIn" style={{
                  padding: 16, textAlign: 'center', position: 'relative', zIndex: 1,
                  borderColor: 'rgba(255,69,58,0.3)', background: 'rgba(255,69,58,0.05)',
                }}>
                  <h3 style={{ fontSize: '1em', fontWeight: 800, color: '#ff453a', marginBottom: 10 }}>Крайняя речь</h3>
                  {votingWinners.map(num => {
                    const p = tableOut[num - 1];
                    return <div key={num} style={{ fontSize: '1.4em', fontWeight: 800 }}>#{num} {p?.login}</div>;
                  })}

                  <div className="timer-section" style={{ margin: '14px auto 0', maxWidth: 260 }}>
                    <div className={`timer-status-pill ${lastSpeechStatusClass}`}>{lastSpeechStatusText}</div>
                    <div className={`timer-display ${lastSpeechDisplayClass}`}
                      onMouseDown={handleLastSpeechHoldStart}
                      onMouseUp={handleLastSpeechHoldEnd}
                      onMouseLeave={handleLastSpeechHoldCancel}
                      onTouchStart={handleLastSpeechHoldStart}
                      onTouchEnd={handleLastSpeechHoldEnd}
                      onTouchMove={handleLastSpeechHoldCancel}
                      onTouchCancel={handleLastSpeechHoldCancel}>
                      {formatTime(lastSpeechTimer.timeLeft)}
                    </div>
                    <div className="timer-controls">
                      {lastSpeechTimer.timeLeft > 0 && lastSpeechFoulCount < 2 && (
                        <button className="timer-btn" onClick={() => { lastSpeechTimer.addTime(30); setLastSpeechFoulCount(c => c + 1); triggerHaptic('warning'); }}
                          style={{ color: '#ff9f0a' }}>
                          +30с (+Ф)
                        </button>
                      )}
                    </div>
                    <div className="timer-hint">Клик: Старт/Пауза | Удержание: Сброс</div>
                  </div>

                  <div style={{ marginTop: 16 }}>
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
                <div className="glass-card animate-glassReveal" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontSize: '0.9em', fontWeight: 700 }}>Голосование за подъём</h3>
                    <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      {votingLiftResults.length} / {Math.ceil(alivePlayers.length / 2 + 0.1)} нужно
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Поднять:</span>
                    <div className="voting-nominated-row" style={{ marginTop: 6, justifyContent: 'center' }}>
                      {votingTiePlayers.map(num => (
                        <span key={num} className="voting-nominated-num">{num}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>
                    Кто за подъём?
                  </div>

                  <div className="dialer-grid" style={{ marginBottom: 12 }}>
                    {tableOut.map(p => {
                      const alive = isPlayerActive(p.roleKey);
                      const voted = votingLiftResults.includes(p.num);
                      return (
                        <button key={p.num}
                          onClick={() => { if (alive) { toggleLiftVote(p.num); triggerHaptic('selection'); } }}
                          className={`dialer-btn ${voted ? 'selected' : ''} ${!alive ? 'voted-elsewhere' : ''}`}
                          disabled={!alive}>
                          {p.num}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)' }}>
                      Голосов: {votingLiftResults.length}
                    </span>
                    <button onClick={() => { finishLiftVoting(); triggerHaptic('medium'); }}
                      className="glass-btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.85em' }}>
                      Завершить ›
                    </button>
                  </div>
                </div>
              )}

              {/* Main/Tie voting */}
              {(votingStage === 'main' || votingStage === 'tie') && !votingFinished && !votingTieTimerActive && (
                <div className="glass-card animate-glassReveal" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontSize: '0.9em', fontWeight: 700 }}>
                      {votingStage === 'tie' ? 'Повторное голосование' : 'Голосование'}
                    </h3>
                    <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      {votingCurrentIndex + 1} / {votingOrder.length}
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Голосуем за:</span>
                    <div style={{ fontSize: '1.5em', fontWeight: 800, color: '#ffd60a', marginTop: 4 }}>
                      #{currentCandidate} {tableOut[currentCandidate - 1]?.login || ''}
                    </div>
                  </div>

                  {/* City mode: counter instead of per-voter */}
                  {cityMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
                      <button onClick={() => setCityVoteCounts(prev => ({ ...prev, [currentCandidate]: Math.max(0, (prev[currentCandidate] || 0) - 1) }))}
                        className="glass-btn" style={{ width: 52, height: 52, fontSize: '1.5em', padding: 0 }}>−</button>
                      <span style={{ fontSize: '2.5em', fontWeight: 800, color: 'var(--accent-color)', minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {cityVoteCounts[currentCandidate] || 0}
                      </span>
                      <button onClick={() => setCityVoteCounts(prev => ({ ...prev, [currentCandidate]: (prev[currentCandidate] || 0) + 1 }))}
                        className="glass-btn" style={{ width: 52, height: 52, fontSize: '1.5em', padding: 0 }}>+</button>
                    </div>
                  ) : (
                    <div className="dialer-grid" style={{ marginBottom: 12 }}>
                      {tableOut.map(p => {
                        const alive = isPlayerActive(p.roleKey);
                        const voted = currentVotes.includes(p.num);
                        const votedElsewhere = alreadyVotedElsewhere.has(p.num);
                        const prefilled = alive && isLastCandidate && !voted && !votedElsewhere;
                        const isDisabled = !alive || votedElsewhere;
                        return (
                          <button key={p.num}
                            onClick={() => { if (!isDisabled) { toggleVotingSelection(p.num); triggerHaptic('selection'); } }}
                            className={`dialer-btn ${voted ? 'selected' : ''} ${prefilled ? 'prefilled' : ''} ${isDisabled ? 'voted-elsewhere' : ''}`}
                            disabled={isDisabled}>
                            {p.num}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {votingCurrentIndex > 0 && (
                        <button onClick={() => { setVotingCurrentIndex(i => i - 1); triggerHaptic('light'); }}
                          className="glass-btn" style={{ padding: '8px 14px', fontSize: '0.85em' }}>
                          ‹ Назад
                        </button>
                      )}
                      <span style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)' }}>
                        Голосов: {cityMode ? (cityVoteCounts[currentCandidate] || 0) : (currentVotes.length + (isLastCandidate ? remainingVoters.length : 0))}
                      </span>
                    </div>
                    <button onClick={() => { acceptCurrentCandidateVotes(); triggerHaptic('light'); }}
                      className="glass-btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.85em' }}>
                      {votingCurrentIndex >= votingOrder.length - 1 ? 'Завершить' : 'Принять'} ›
                    </button>
                  </div>

                  {/* Results so far */}
                  {Object.keys(votingResults).length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {votingOrder.slice(0, votingCurrentIndex + 1).map(c => (
                          <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>#{c} {tableOut[c - 1]?.login || ''}</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{(votingResults[String(c)] || []).length} голосов</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No winners */}
              {votingFinished && votingWinners.length === 0 && !votingTieTimerActive && (
                <div className="glass-card animate-fadeIn" style={{ padding: 16, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  {votingStage === 'lift' ? (
                    <>
                      <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 8 }}>Голосов за подъём недостаточно</h3>
                      <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Никто не выбывает</p>
                      <div style={{ marginBottom: 10 }}>
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
                      <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 8 }}>Голосование завершено</h3>
                      <p style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Никто не выбыл</p>
                      <button onClick={() => { closeVotingAndApply(); triggerHaptic('light'); }}
                        className="glass-btn" style={{ padding: '10px 24px', fontSize: '0.85em' }}>
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
        <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {votingHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '2em', marginBottom: 8, opacity: 0.3 }}>📋</div>
              <p style={{ fontSize: '0.9em' }}>История голосований пуста</p>
            </div>
          ) : (
            [...votingHistory].reverse().map((v, i) => (
              <div key={i} className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Голосование #{v.votingNumber} (День {v.dayNumber})
                  </span>
                </div>

                {/* Result */}
                {v.finalWinners?.length > 0 ? (
                  <div style={{ fontSize: '0.85em', fontWeight: 600, marginBottom: 10, padding: '6px 10px', background: 'rgba(255,69,58,0.1)', borderRadius: 10, border: '1px solid rgba(255,69,58,0.2)' }}>
                    Заголосован: {v.finalWinners.map(num => `#${num} ${tableOut[num - 1]?.login || ''}`).join(', ')}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Никто не выбыл</div>
                )}

                {/* Stages */}
                {v.stages?.map((s, si) => (
                  <div key={si} style={{
                    marginTop: si > 0 ? 10 : 0, paddingTop: si > 0 ? 10 : 0,
                    borderTop: si > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}>
                    <div style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      {s.type === 'main' ? 'Основное' : s.type === 'tie' ? 'Повторное' : 'За подъём'}
                    </div>

                    {s.type === 'lift' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.35)' }}>За подъём:</span>
                          {(s.liftVoters || []).length > 0 ? (
                            (s.liftVoters || []).map(num => (
                              <span key={num} style={{ fontSize: '0.75em', fontWeight: 700, color: '#00ff88', background: 'rgba(0,255,136,0.1)', padding: '2px 8px', borderRadius: 8 }}>
                                #{num}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.25)' }}>никто</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(s.candidates || Object.keys(s.results || {})).map(c => {
                          const cNum = String(c);
                          const voters = Array.isArray(s.results?.[cNum]) ? s.results[cNum] : [];
                          const voteCount = voters.length;
                          return (
                            <div key={cNum} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: voters.length > 0 ? 4 : 0 }}>
                                <span style={{ fontSize: '0.85em', fontWeight: 700, color: '#ffd60a' }}>
                                  #{cNum} {tableOut[Number(cNum) - 1]?.login || ''}
                                </span>
                                <span style={{ fontSize: '0.8em', fontWeight: 700, color: 'var(--accent-color)' }}>
                                  {voteCount} {voteCount === 1 ? 'голос' : voteCount >= 2 && voteCount <= 4 ? 'голоса' : 'голосов'}
                                </span>
                              </div>
                              {voters.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {voters.map(voterNum => (
                                    <span key={voterNum} style={{
                                      fontSize: '0.7em', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                                      background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 6,
                                    }}>
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
