import React, { useRef, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { getRoleLabel, getCityBestMoveMax } from '../constants/roles';
import { triggerHaptic } from '../utils/haptics';

export const PlayerCard = ({ player, isSpeaking = false, isBlinking = false, mode = 'day' }) => {
  const {
    addFoul, removeFoul, addTechFoul, removeTechFoul,
    gamePhase, isPlayerActive, roleSet, editRoles, rolesDistributed,
    nominations, toggleNomination, nominationsLocked,
    highlightedPlayer, setHighlightedPlayer,
    autoExpandPlayer, setAutoExpandPlayer,
    expandedCardRK, setExpandedCardRK,
    playersActions, roles, tableOut,
    killedCardPhase, setKilledCardPhase, firstKilledPlayer,
    cityMode, actionSet,
    nightPhase, nightChecks, performNightCheck,
    doctorHeal, performDoctorHeal, canDoctorHealTarget,
    protocolData, toggleProtocolRole, checkProtocol,
    protocolAccepted, setProtocolAccepted,
    advanceNightPhase,
    bestMove, toggleBestMove, acceptBestMove, bestMoveAccepted, canShowBestMove,
  } = useGame();

  const rk = player.roleKey;
  const action = player.action;
  const isKilledForTimer = action === 'killed';
  
  const handleTimerComplete = useCallback(() => {
    if (isKilledForTimer && cityMode && killedCardPhase?.[rk] === 'timer') {
      setKilledCardPhase(prev => ({ ...prev, [rk]: 'done' }));
      setProtocolAccepted(prev => ({ ...prev, [rk]: true }));
    }
  }, [isKilledForTimer, cityMode, killedCardPhase, rk, setKilledCardPhase, setProtocolAccepted]);

  const { timeLeft, isRunning, isPaused, start: rawStart, pause, resume, stop: rawStop, addTime: rawAddTime } = useTimer(60, handleTimerComplete);
  const timerMaxRef = useRef(60);
  const start = useCallback((s) => { timerMaxRef.current = s ?? 60; rawStart(s); }, [rawStart]);
  const stop = useCallback(() => { timerMaxRef.current = 60; rawStop(); }, [rawStop]);
  const addTime = useCallback((s) => { timerMaxRef.current += s; rawAddTime(s); }, [rawAddTime]);
  const timerProgress = timerMaxRef.current > 0 ? timeLeft / timerMaxRef.current : 0;
  const expanded = expandedCardRK === rk;
  const holdTimerRef = useRef(null);
  const holdActiveRef = useRef(false);
  const lastTouchRef = useRef(0);

  useEffect(() => {
    if (autoExpandPlayer === rk) {
      setExpandedCardRK(rk);
      setAutoExpandPlayer(null);
    }
  }, [autoExpandPlayer, rk, setAutoExpandPlayer, setExpandedCardRK]);

  useEffect(() => {
    if (isKilledForTimer && killedCardPhase?.[rk] === 'done' && expanded) {
      setExpandedCardRK(null);
    }
  }, [killedCardPhase, rk, isKilledForTimer, expanded, setExpandedCardRK]);

  const active = isPlayerActive(rk);
  const role = player.role;
  const foulCount = player.fouls || 0;
  const techFoulCount = player.techFouls || 0;
  const isHighlighted = highlightedPlayer === rk;
  const isKilled = action === 'killed';
  const isVoted = action === 'voted';
  const isRemoved = ['removed', 'fall_removed', 'tech_fall_removed'].includes(action);
  const isDead = isKilled || isVoted || isRemoved;
  const isFirstKilled = firstKilledPlayer === rk;
  const cardPhase = killedCardPhase?.[rk];

  const nominatedBy = Object.entries(nominations || {}).filter(([, targets]) => targets?.includes(player.num)).map(([fromRK]) => {
    const p = tableOut.find(x => x.roleKey === fromRK);
    return p ? p.num : '?';
  });
  const isNominated = nominatedBy.length > 0;

  const handleToggle = useCallback(() => {
    if (gamePhase === 'discussion' || gamePhase === 'freeSeating') return;
    setExpandedCardRK(prev => prev === rk ? null : rk);
    triggerHaptic('selection');
  }, [gamePhase, rk, setExpandedCardRK]);

  const canAddTime = foulCount < 2;

  const handleTimerClick = useCallback(() => {
    if (!isRunning) { start(); triggerHaptic('light'); }
    else if (isPaused) { resume(); triggerHaptic('light'); }
    else { pause(); triggerHaptic('light'); }
  }, [isRunning, isPaused, start, pause, resume]);

  const handleTimerHoldStart = useCallback((e) => {
    if (e.type === 'mousedown' && Date.now() - lastTouchRef.current < 500) return;
    if (e.type === 'touchstart') lastTouchRef.current = Date.now();
    holdActiveRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      stop();
      triggerHaptic('heavy');
    }, 800);
  }, [stop]);

  const handleTimerHoldEnd = useCallback((e) => {
    if (e.type === 'mouseup' && Date.now() - lastTouchRef.current < 500) return;
    clearTimeout(holdTimerRef.current);
    if (!holdActiveRef.current) handleTimerClick();
  }, [handleTimerClick]);

  const handleTimerHoldCancel = useCallback(() => {
    clearTimeout(holdTimerRef.current);
  }, []);

  const foulHoldRef = useRef(null);
  const foulHoldActiveRef = useRef(false);
  const foulLastTouchRef = useRef(0);

  const handleFoulStart = useCallback((type, e) => {
    if (e?.type === 'mousedown' && Date.now() - foulLastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') foulLastTouchRef.current = Date.now();
    foulHoldActiveRef.current = false;
    foulHoldRef.current = setTimeout(() => {
      foulHoldActiveRef.current = true;
      if (type === 'foul') { removeFoul(rk); triggerHaptic('light'); }
      else { removeTechFoul(rk); triggerHaptic('light'); }
    }, 500);
  }, [rk, removeFoul, removeTechFoul]);

  const handleFoulEnd = useCallback((type, e) => {
    if (e?.type === 'mouseup' && Date.now() - foulLastTouchRef.current < 500) return;
    clearTimeout(foulHoldRef.current);
    if (!foulHoldActiveRef.current) {
      if (type === 'foul') { addFoul(rk); triggerHaptic('warning'); }
      else { addTechFoul(rk); triggerHaptic('warning'); }
    }
  }, [rk, addFoul, addTechFoul]);

  const removeHoldRef = useRef(null);
  const removeLastTouchRef = useRef(0);
  const handleRemoveStart = useCallback((e) => {
    if (e?.type === 'mousedown' && Date.now() - removeLastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') removeLastTouchRef.current = Date.now();
    removeHoldRef.current = setTimeout(() => {
      actionSet(rk, 'removed');
      triggerHaptic('heavy');
    }, 800);
  }, [rk, actionSet]);
  const handleRemoveEnd = useCallback((e) => {
    if (e?.type === 'mouseup' && Date.now() - removeLastTouchRef.current < 500) return;
    clearTimeout(removeHoldRef.current);
  }, []);
  const handleReturnStart = useCallback((e) => {
    if (e?.type === 'mousedown' && Date.now() - removeLastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') removeLastTouchRef.current = Date.now();
    removeHoldRef.current = setTimeout(() => {
      actionSet(rk, null);
      triggerHaptic('success');
    }, 800);
  }, [rk, actionSet]);

  // Best move hold-to-accept
  const bmHoldRef = useRef(null);
  const handleBmAcceptStart = useCallback(() => {
    bmHoldRef.current = setTimeout(() => {
      acceptBestMove(rk);
      triggerHaptic('success');
    }, 800);
  }, [rk, acceptBestMove]);
  const handleBmAcceptEnd = useCallback(() => { clearTimeout(bmHoldRef.current); }, []);

  // Advance killed card phase
  const advanceKilledPhase = useCallback(() => {
    if (cardPhase === 'timer') {
      if (cityMode) {
        setKilledCardPhase(prev => ({ ...prev, [rk]: 'done' }));
        setProtocolAccepted(prev => ({ ...prev, [rk]: true }));
      } else {
        setKilledCardPhase(prev => ({ ...prev, [rk]: 'protocol' }));
      }
    } else if (cardPhase === 'protocol') {
      setKilledCardPhase(prev => ({ ...prev, [rk]: 'done' }));
      setProtocolAccepted(prev => ({ ...prev, [rk]: true }));
    }
    triggerHaptic('selection');
  }, [rk, cardPhase, cityMode, setKilledCardPhase, setProtocolAccepted]);

  const statusLabel = isKilled ? 'Убит' : isVoted ? 'Голосование' : action === 'fall_removed' ? '4 фола' : action === 'tech_fall_removed' ? '2 ТФ' : isRemoved ? 'Удалён' : null;

  const rowClasses = [
    'player-row',
    isHighlighted && !isDead && 'highlighted',
    isSpeaking && !isDead && 'speaking',
    isKilled && 'killed',
    isVoted && 'killed',
    isRemoved && 'removed',
    isBlinking && 'killed-blink',
    mode === 'night' && nightPhase === 'don' && roles[rk] === 'don' && 'night-don-pulse',
    mode === 'night' && nightPhase === 'sheriff' && roles[rk] === 'sheriff' && 'night-sheriff-pulse',
    mode === 'night' && nightPhase === 'doctor' && roles[rk] === 'doctor' && 'night-doctor-pulse',
  ].filter(Boolean).join(' ');

  const timerStatusText = isRunning && !isPaused ? 'Речь идет' : isPaused ? 'Пауза' : timeLeft === 0 ? 'Время вышло' : 'Готов';
  const timerStatusClass = isRunning && !isPaused ? 'status-running' : isPaused ? 'status-paused' : timeLeft === 0 ? 'status-finished' : '';
  const timerDisplayClass = timeLeft <= 10 && isRunning && !isPaused ? 'warning' : isRunning && !isPaused ? 'running' : isPaused ? 'paused' : timeLeft === 0 ? 'finished' : '';

  const formatTime = (t) => String(t).padStart(2, '0');

  return (
    <div className={rowClasses} style={{ '--i': player.num - 1 }}>
      <div className="player-row-content" onClick={handleToggle}>
        <div className="player-avatar-wrap">
          <div className="player-avatar"
            style={player.avatar_link ? { backgroundImage: `url(${player.avatar_link})`, color: 'transparent' } : {}}>
            {!player.avatar_link && (player.login?.[0]?.toUpperCase() || player.num)}
          </div>
          <span className="player-num-badge">{player.num}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="player-name">{player.login || `Игрок ${player.num}`}</div>
          <div className="player-meta-row">
            {role && gamePhase !== 'discussion' && gamePhase !== 'freeSeating' && gamePhase !== 'day' && <span className={`role-tag ${role}`}>{getRoleLabel(role)}</span>}
            {isFirstKilled && <span className="player-badge player-badge--danger">ПУ</span>}
          </div>
        </div>

        <div className="role-badges">
          {isDead ? (
            <>
              <span className="day-status-label">{statusLabel}</span>
              <button className="day-return-btn"
                onTouchStart={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onMouseDown={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onClick={(e) => e.stopPropagation()}>
                ❤
              </button>
            </>
          ) : mode === 'day' && gamePhase === 'day' ? (
            <>
              <button className={`foul-pill ${foulCount >= 3 ? 'foul-warn' : foulCount >= 2 ? 'foul-hot' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleFoulStart('foul', e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleFoulEnd('foul', e); }}
                onTouchCancel={() => clearTimeout(foulHoldRef.current)}
                onMouseDown={(e) => { e.stopPropagation(); handleFoulStart('foul', e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleFoulEnd('foul', e); }}
                onMouseLeave={() => clearTimeout(foulHoldRef.current)}>
                <span className="pill-label">Ф</span>
                <span className="pill-count">{foulCount}</span>
              </button>
              <button className={`foul-pill ${techFoulCount >= 1 ? 'tf-warn' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => { e.stopPropagation(); handleFoulStart('tf', e); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handleFoulEnd('tf', e); }}
                  onTouchCancel={() => clearTimeout(foulHoldRef.current)}
                  onMouseDown={(e) => { e.stopPropagation(); handleFoulStart('tf', e); }}
                  onMouseUp={(e) => { e.stopPropagation(); handleFoulEnd('tf', e); }}
                  onMouseLeave={() => clearTimeout(foulHoldRef.current)}>
                  <span className="pill-label">ТФ</span>
                  <span className="pill-count">{techFoulCount}</span>
                </button>
              <button className="day-remove-btn"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onTouchCancel={handleRemoveEnd}
                onMouseDown={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onMouseLeave={handleRemoveEnd}>
                ✕
              </button>
            </>
          ) : mode === 'night' ? (
            <button
              className={`night-kill-btn ${action === 'killed' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); actionSet(rk, 'killed', { nightKill: true }); triggerHaptic('heavy'); }}>
              Убить
            </button>
          ) : null}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="candidate-menu">
          {/* Role assignment (before game starts) */}
          {editRoles && !rolesDistributed && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, width: '100%' }}>Роль:</span>
              {(cityMode ? ['don', 'black', 'sheriff', 'doctor'] : ['don', 'black', 'sheriff']).map(r => (
                <button key={r} onClick={() => { roleSet(rk, r); triggerHaptic('selection'); }}
                  className={`role-tag ${r}`}
                  style={{
                    cursor: 'pointer',
                    opacity: role === r ? 1 : 0.5,
                    transform: role === r ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.15s',
                    boxShadow: role === r ? `0 0 12px rgba(168,85,247,0.3)` : 'none',
                  }}>
                  {getRoleLabel(r)}
                </button>
              ))}
            </div>
          )}

          {/* ===== KILLED PLAYER: Best Move phase ===== */}
          {isKilled && cardPhase === 'bm' && isFirstKilled && canShowBestMove() && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#ff453a', marginBottom: 8 }}>
                Лучший ход (ЛХ) — выберите до {cityMode ? (getCityBestMoveMax(tableOut.length) || 3) : 3} игроков
              </div>
              <div className="candidate-grid">
                {tableOut.filter(t => isPlayerActive(t.roleKey) && t.roleKey !== rk).map(t => (
                  <button key={t.num}
                    className={`candidate-btn ${bestMove.includes(t.num) ? 'selected' : ''}`}
                    onClick={() => { toggleBestMove(t.num); triggerHaptic('selection'); }}>
                    {t.num}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="glass-btn btn-primary" style={{ flex: 1, padding: '10px 14px', fontSize: '0.85em' }}
                  disabled={bestMove.length === 0}
                  onTouchStart={(e) => { e.stopPropagation(); handleBmAcceptStart(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handleBmAcceptEnd(); }}
                  onMouseDown={handleBmAcceptStart}
                  onMouseUp={handleBmAcceptEnd}
                  onMouseLeave={handleBmAcceptEnd}>
                  Принять ЛХ (удержать)
                </button>
                <button className="glass-btn" style={{ padding: '10px 14px', fontSize: '0.85em', opacity: 0.6 }}
                  onClick={() => {
                    setKilledCardPhase(prev => ({ ...prev, [rk]: 'timer' }));
                    triggerHaptic('light');
                  }}>
                  Пропустить
                </button>
              </div>
              {bestMove.length > 0 && (
                <div style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  Выбраны: {bestMove.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* ===== KILLED PLAYER: Timer phase ===== */}
          {isKilled && (cardPhase === 'timer' || (!cardPhase && !isFirstKilled)) && (
            <div className="timer-section" style={{ '--timer-progress': timerProgress }}>
              <div className={`timer-progress-bar ${timerDisplayClass}`} />
              {isFirstKilled && bestMoveAccepted && (
                <button className="glass-btn" style={{ marginBottom: 8, fontSize: '0.75em', padding: '6px 12px', opacity: 0.6 }}
                  onClick={() => {
                    setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' }));
                    triggerHaptic('light');
                  }}>
                  Изменить ЛХ ({bestMove.join(', ')})
                </button>
              )}
              <div className={`timer-status-pill ${timerStatusClass}`}>{timerStatusText}</div>
              <div className={`timer-display ${timerDisplayClass}`}
                onMouseDown={handleTimerHoldStart}
                onMouseUp={handleTimerHoldEnd}
                onMouseLeave={handleTimerHoldCancel}
                onTouchStart={handleTimerHoldStart}
                onTouchEnd={handleTimerHoldEnd}
                onTouchCancel={handleTimerHoldCancel}>
                {formatTime(timeLeft)}
              </div>
              <div className="timer-controls">
                {canAddTime && (
                  <button className="timer-btn timer-add" onClick={() => {
                    addTime(30); addFoul(rk); addFoul(rk);
                    triggerHaptic('warning');
                  }}>
                    +30с (+2Ф)
                  </button>
                )}
                <button className="timer-btn" onClick={advanceKilledPhase}
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {cityMode ? 'Готово ➜' : 'Протокол / Мнение ➜'}
                </button>
              </div>
              <div className="timer-hint">Клик: Старт/Пауза | Удержание: Сброс</div>
            </div>
          )}

          {/* ===== KILLED PLAYER: Protocol + Opinion phase (not in city mode) ===== */}
          {isKilled && cardPhase === 'protocol' && !cityMode && (
            <>
              <ProtocolSection rk={rk} tableOut={tableOut} />
              <OpinionSection rk={rk} tableOut={tableOut} />
              <button className="glass-btn btn-primary" style={{ width: '100%', marginTop: 10, padding: '10px 16px', fontSize: '0.85em' }}
                onClick={advanceKilledPhase}>
                Принять протокол ✓
              </button>
            </>
          )}

          {/* ===== KILLED PLAYER: Done phase ===== */}
          {isKilled && cardPhase === 'done' && (
            <div style={{ padding: 8, textAlign: 'center', fontSize: '0.8em', color: 'rgba(255,255,255,0.3)' }}>
              Протокол принят ✓
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                {isFirstKilled && bestMoveAccepted && (
                  <button className="glass-btn" style={{ fontSize: '0.75em', padding: '6px 12px', opacity: 0.5 }}
                    onClick={() => {
                      setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' }));
                      triggerHaptic('light');
                    }}>
                    Изменить ЛХ
                  </button>
                )}
                {!cityMode && (
                  <button className="glass-btn" style={{ fontSize: '0.75em', padding: '6px 12px', opacity: 0.5 }}
                    onClick={() => {
                      setKilledCardPhase(prev => ({ ...prev, [rk]: 'protocol' }));
                      setProtocolAccepted(prev => ({ ...prev, [rk]: false }));
                      triggerHaptic('light');
                    }}>
                    Редактировать протокол
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ===== ALIVE PLAYER: Timer (Day mode) ===== */}
          {gamePhase === 'day' && active && !isDead && (
            <div className="timer-section" style={{ '--timer-progress': timerProgress }}>
              <div className={`timer-progress-bar ${timerDisplayClass}`} />
              <div className={`timer-status-pill ${timerStatusClass}`}>{timerStatusText}</div>
              <div className={`timer-display ${timerDisplayClass}`}
                onMouseDown={handleTimerHoldStart}
                onMouseUp={handleTimerHoldEnd}
                onMouseLeave={handleTimerHoldCancel}
                onTouchStart={handleTimerHoldStart}
                onTouchEnd={handleTimerHoldEnd}
                onTouchCancel={handleTimerHoldCancel}>
                {formatTime(timeLeft)}
              </div>
              <div className="timer-controls">
                {canAddTime && (
                  <button className="timer-btn timer-add" onClick={() => {
                    addTime(30); addFoul(rk); addFoul(rk);
                    triggerHaptic('warning');
                  }}>
                    +30с (+2Ф)
                  </button>
                )}
              </div>
              <div className="timer-hint">Клик: Старт/Пауза | Удержание: Сброс</div>
            </div>
          )}

          {/* ===== ALIVE PLAYER: Nominations (Day, not locked) ===== */}
          {gamePhase === 'day' && !nominationsLocked && active && !isDead && !cityMode && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Выставить:</div>
              <div className="candidate-grid">
                {tableOut.map(t => {
                  const tActive = isPlayerActive(t.roleKey);
                  const isMyNomination = nominations?.[rk]?.includes(t.num);
                  const nominatedByOther = !isMyNomination && Object.entries(nominations || {}).some(([fromRK, targets]) => fromRK !== rk && targets?.includes(t.num));
                  const isDisabled = !tActive || nominatedByOther;
                  return (
                    <button key={t.num}
                      disabled={isDisabled}
                      className={`candidate-btn ${isMyNomination ? 'selected' : ''} ${isDisabled ? 'voted-elsewhere' : ''}`}
                      onClick={() => { if (!isDisabled) { toggleNomination(rk, t.num); triggerHaptic('selection'); } }}>
                      {t.num}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Night: Don/Sheriff checks ===== */}
          {mode === 'night' && (roles[rk] === 'don' || roles[rk] === 'sheriff') && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85em', fontWeight: 700, marginBottom: 8 }}>
                {roles[rk] === 'don' ? 'Проверка Дона' : 'Проверка Шерифа'}
              </div>
              {!nightChecks?.[rk] ? (
                <>
                  <div className="night-check-grid">
                    {tableOut.map(t => (
                      <button key={t.num} className="night-check-btn"
                        onClick={() => { performNightCheck(rk, t.num); triggerHaptic('medium'); }}>
                        {t.num}
                      </button>
                    ))}
                  </div>
                  {isDead && (
                    <button className="glass-btn" style={{ marginTop: 10, width: '100%', opacity: 0.7 }}
                      onClick={() => { advanceNightPhase(); triggerHaptic('medium'); }}>
                      Продолжить ➜
                    </button>
                  )}
                </>
              ) : (
                <div className={`night-check-result ${nightChecks[rk].result?.includes('✅') ? 'positive' : ''}`}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Игрок {nightChecks[rk].target}</div>
                  <div>{nightChecks[rk].result}</div>
                </div>
              )}
            </div>
          )}

          {/* ===== Night: Doctor heal (city mode) ===== */}
          {mode === 'night' && cityMode && roles[rk] === 'doctor' && nightPhase === 'doctor' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85em', fontWeight: 700, marginBottom: 8 }}>Лечение Доктора</div>
              {!doctorHeal ? (
                <div className="night-check-grid">
                  {tableOut.map(t => (
                    <button key={t.num}
                      className={`night-check-btn ${!canDoctorHealTarget?.(t.num) ? 'disabled' : ''}`}
                      disabled={!canDoctorHealTarget?.(t.num)}
                      onClick={() => { performDoctorHeal?.(t.num); triggerHaptic('medium'); }}>
                      {t.num}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="night-check-result positive">
                  <div style={{ fontWeight: 700 }}>Лечит игрока {doctorHeal.target}</div>
                  <div>Вылечен</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ROLE_STYLES = {
  '':       { label: '-',       color: 'rgba(255,255,255,0.25)', bg: 'transparent',              border: 'rgba(255,255,255,0.08)' },
  'peace':  { label: 'Мирный',  color: '#4fc3f7',               bg: 'rgba(79,195,247,0.15)',     border: 'rgba(79,195,247,0.3)' },
  'sheriff': { label: 'Шериф', color: '#ffd54f',               bg: 'rgba(255,213,79,0.15)',     border: 'rgba(255,213,79,0.3)' },
  'mafia':  { label: 'Мафия',   color: '#ef5350',               bg: 'rgba(239,83,80,0.15)',      border: 'rgba(239,83,80,0.3)' },
  'don':    { label: 'Дон',     color: '#ce93d8',               bg: 'rgba(206,147,216,0.15)',    border: 'rgba(206,147,216,0.3)' },
};

function RolePredictionGrid({ data, rk, tableOut, onToggle }) {
  const firstRow = tableOut.filter(t => t.num <= 5);
  const secondRow = tableOut.filter(t => t.num > 5);

  const renderBtn = (t) => {
    const pred = data?.[rk]?.[t.num] || '';
    const rs = ROLE_STYLES[pred] || ROLE_STYLES[''];
    return (
      <button key={t.num}
        onClick={() => { onToggle(rk, t.num); triggerHaptic('selection'); }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '6px 4px', borderRadius: 12, cursor: 'pointer',
          background: rs.bg, border: `1px solid ${rs.border}`,
          transition: 'all 0.2s ease', minWidth: 0,
        }}>
        <span style={{ fontSize: '0.85em', fontWeight: 700, color: pred ? rs.color : 'rgba(255,255,255,0.5)' }}>
          {t.num}
        </span>
        <span style={{
          fontSize: '0.6em', fontWeight: 800, color: rs.color,
          whiteSpace: 'nowrap', lineHeight: 1,
        }}>
          {pred ? rs.label : '—'}
        </span>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>{firstRow.map(renderBtn)}</div>
      <div style={{ display: 'flex', gap: 6 }}>{secondRow.map(renderBtn)}</div>
    </div>
  );
}

function ProtocolSection({ rk, tableOut }) {
  const { protocolData, toggleProtocolRole } = useGame();

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Протокол</div>
      <RolePredictionGrid data={protocolData} rk={rk} tableOut={tableOut} onToggle={toggleProtocolRole} />
    </div>
  );
}

function OpinionSection({ rk, tableOut }) {
  const { opinionData, toggleOpinionRole, opinionText, setOpinionText } = useGame();

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Мнение</div>
      <RolePredictionGrid data={opinionData} rk={rk} tableOut={tableOut} onToggle={toggleOpinionRole} />
      <input
        type="text"
        placeholder="Комментарий мнения..."
        value={opinionText?.[rk] || ''}
        onChange={(e) => setOpinionText(prev => ({ ...prev, [rk]: e.target.value }))}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', marginTop: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: '0.8em', outline: 'none',
        }}
      />
    </div>
  );
}
