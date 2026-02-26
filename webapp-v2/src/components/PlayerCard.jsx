import React, { useRef, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { getRoleLabel, getCityBestMoveMax } from '../constants/roles';
import { triggerHaptic } from '../utils/haptics';
import { NightTimerBar } from './NightTimerBar';
import { DialerPad, RowPad, dialerBtn } from './DialerPad';

export const PlayerCard = ({ player, isSpeaking = false, isBlinking = false, isNextSpeaker = false, mode = 'day' }) => {
  const {
    addFoul, removeFoul, addTechFoul, removeTechFoul,
    gamePhase, isPlayerActive, roleSet, editRoles, rolesDistributed,
    nominations, toggleNomination, nominationsLocked,
    highlightedPlayer, setHighlightedPlayer,
    autoExpandPlayer, setAutoExpandPlayer,
    expandedCardRK, setExpandedCardRK,
    playersActions, roles, tableOut,
    killedCardPhase, setKilledCardPhase, firstKilledPlayer,
    cityMode, gameMode, actionSet,
    nightPhase, nightChecks, performNightCheck,
    doctorHeal, performDoctorHeal, canDoctorHealTarget,
    protocolData, toggleProtocolRole, checkProtocol,
    protocolAccepted, setProtocolAccepted,
    advanceNightPhase,
    bestMove, toggleBestMove, acceptBestMove, bestMoveAccepted, canShowBestMove,
    startDaySpeakerFlow,
  } = useGame();

  const cardRef = useRef(null);
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
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [autoExpandPlayer, rk, setAutoExpandPlayer, setExpandedCardRK]);

  useEffect(() => {
    if (isKilledForTimer && killedCardPhase?.[rk] === 'done' && expanded) {
      setExpandedCardRK(null);
    }
  }, [killedCardPhase, rk, isKilledForTimer, expanded, setExpandedCardRK]);

  useEffect(() => {
    if (!isNextSpeaker || expandedCardRK === rk) return;
    if (expandedCardRK) return;
    const timer = setTimeout(() => {
      setExpandedCardRK(rk);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }, 400);
    return () => clearTimeout(timer);
  }, [isNextSpeaker, rk, expandedCardRK, setExpandedCardRK]);

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
    if (isNextSpeaker && !isRunning) {
      startDaySpeakerFlow();
    }
    if (!isRunning) { start(); triggerHaptic('light'); }
    else if (isPaused) { resume(); triggerHaptic('light'); }
    else { pause(); triggerHaptic('light'); }
  }, [isRunning, isPaused, start, pause, resume, isNextSpeaker, startDaySpeakerFlow]);

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
    if (e.type === 'touchend') lastTouchRef.current = Date.now();
    if (e.type === 'mouseup' && Date.now() - lastTouchRef.current < 500) return;
    clearTimeout(holdTimerRef.current);
    if (!holdActiveRef.current) handleTimerClick();
  }, [handleTimerClick]);

  const handleTimerHoldCancel = useCallback(() => {
    clearTimeout(holdTimerRef.current);
    holdActiveRef.current = true;
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
    if (e?.type === 'touchend') foulLastTouchRef.current = Date.now();
    if (e?.type === 'mouseup' && Date.now() - foulLastTouchRef.current < 500) return;
    clearTimeout(foulHoldRef.current);
    if (!foulHoldActiveRef.current) {
      if (type === 'foul') { addFoul(rk); triggerHaptic('warning'); }
      else { addTechFoul(rk); triggerHaptic('warning'); }
    }
  }, [rk, addFoul, addTechFoul]);

  const handleFoulMoveCancel = useCallback(() => {
    clearTimeout(foulHoldRef.current);
    foulHoldActiveRef.current = true;
  }, []);

  const removeHoldRef = useRef(null);
  const removeLastTouchRef = useRef(0);
  const removeHoldActiveRef = useRef(false);
  const handleRemoveStart = useCallback((e) => {
    if (e?.type === 'mousedown' && Date.now() - removeLastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') removeLastTouchRef.current = Date.now();
    removeHoldActiveRef.current = false;
    removeHoldRef.current = setTimeout(() => {
      removeHoldActiveRef.current = true;
      actionSet(rk, 'removed');
      triggerHaptic('heavy');
    }, 800);
  }, [rk, actionSet]);
  const handleRemoveEnd = useCallback((e) => {
    if (e?.type === 'touchend') removeLastTouchRef.current = Date.now();
    if (e?.type === 'mouseup' && Date.now() - removeLastTouchRef.current < 500) return;
    clearTimeout(removeHoldRef.current);
  }, []);
  const handleRemoveMoveCancel = useCallback(() => {
    clearTimeout(removeHoldRef.current);
    removeHoldActiveRef.current = true;
  }, []);
  const handleReturnStart = useCallback((e) => {
    if (e?.type === 'mousedown' && Date.now() - removeLastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') removeLastTouchRef.current = Date.now();
    removeHoldRef.current = setTimeout(() => {
      actionSet(rk, null);
      triggerHaptic('success');
    }, 800);
  }, [rk, actionSet]);

  const bmHoldRef = useRef(null);
  const handleBmAcceptStart = useCallback(() => {
    bmHoldRef.current = setTimeout(() => {
      acceptBestMove(rk);
      triggerHaptic('success');
    }, 800);
  }, [rk, acceptBestMove]);
  const handleBmAcceptEnd = useCallback(() => { clearTimeout(bmHoldRef.current); }, []);

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

  const isNightDon = mode === 'night' && nightPhase === 'don' && roles[rk] === 'don';
  const isNightSheriff = mode === 'night' && nightPhase === 'sheriff' && roles[rk] === 'sheriff';
  const isNightDoctor = mode === 'night' && nightPhase === 'doctor' && roles[rk] === 'doctor';

  const timerStatusText = isRunning && !isPaused ? 'Речь идет' : isPaused ? 'Пауза' : timeLeft === 0 ? 'Время вышло' : 'Готов';
  const isLow = timeLeft <= 10 && isRunning && !isPaused;
  const showTimerWave = expanded && (isRunning || isPaused || timeLeft > 0) && (
    (isKilled && (cardPhase === 'timer' || (!cardPhase && !isFirstKilled))) ||
    (gamePhase === 'day' && active && !isDead)
  );

  const formatTime = (t) => String(t).padStart(2, '0');

  const roleTagColors = {
    don: 'bg-purple-300/15 text-purple-300 border-purple-300/25',
    black: 'bg-purple-400/15 text-purple-400 border-purple-400/25',
    sheriff: 'bg-yellow-300/15 text-yellow-300 border-yellow-300/25',
    doctor: 'bg-green-400/15 text-green-400 border-green-400/25',
    peace: 'bg-blue-300/15 text-blue-300 border-blue-300/25',
  };

  return (
    <div
      ref={cardRef}
      className={`glass-card rounded-2xl relative overflow-hidden transition-all duration-300 ease-spring
        ${isHighlighted && !isDead ? 'border-accent-soft !bg-accent-soft shadow-[0_0_20px_rgba(var(--accent-rgb),0.18),inset_0_1px_0_rgba(255,255,255,0.1)] scale-[1.01]' : ''}
        ${isSpeaking && !isDead ? 'border-accent-soft !bg-accent-soft shadow-[0_0_24px_rgba(var(--accent-rgb),0.22),inset_0_1px_0_rgba(255,255,255,0.1)] scale-[1.01]' : ''}
        ${(isKilled && cardPhase === 'done') || isVoted ? 'opacity-[0.18] saturate-[0.25] brightness-[0.7] !border-red-500/20 !bg-red-500/[0.03]' : ''}
        ${isKilled && cardPhase !== 'done' ? '!border-red-500/25' : ''}
        ${isRemoved ? 'opacity-[0.15] saturate-[0.2] brightness-[0.65] !border-white/[0.06] !bg-white/[0.02]' : ''}
        ${isBlinking ? 'animate-killed-blink' : ''}
        ${isNightDon ? 'animate-don-pulse' : ''}
        ${isNightSheriff ? 'animate-sheriff-pulse' : ''}
        ${isNightDoctor ? 'animate-doctor-pulse' : ''}
        ${isNextSpeaker && !isDead ? 'animate-next-speaker border-accent-soft !bg-accent-soft/50' : ''}
        ${!isDead && !isHighlighted && !isSpeaking && !isNextSpeaker ? 'hover:border-white/[0.18] hover:shadow-glass-md' : ''}
        ${expanded ? 'shadow-glass-md !border-white/[0.16]' : ''}`}
      style={{
        '--i': player.num - 1,
        ...(showTimerWave ? { '--wave-progress': `${timerProgress * 100}%` } : {}),
      }}
    >
      {showTimerWave && (
        <div className={`card-timer-wave ${isLow ? 'wave-low' : ''} ${isPaused ? 'wave-paused' : ''}`} />
      )}
      {/* Main row */}
      <div className="relative z-[1] flex items-center gap-3 px-3.5 py-2.5 cursor-pointer min-h-[64px]" onClick={handleToggle}>
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/[0.08]
            flex items-center justify-center text-white/60 text-sm font-bold overflow-hidden"
            style={player.avatar_link ? { backgroundImage: `url(${player.avatar_link})`, backgroundSize: 'cover', color: 'transparent' } : {}}>
            {!player.avatar_link && (player.login?.[0]?.toUpperCase() || player.num)}
          </div>
          <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] rounded-md
            bg-[rgba(168,85,247,0.85)] border-[1.5px] border-[rgba(10,8,20,0.7)] shadow-[0_1px_6px_rgba(0,0,0,0.4),0_0_8px_rgba(168,85,247,0.25)] flex items-center justify-center
            text-[0.6rem] font-bold text-white px-0.5">{player.num}</span>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate tracking-[0.2px]">{player.login || `Игрок ${player.num}`}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {role && gamePhase !== 'discussion' && gamePhase !== 'freeSeating' && gamePhase !== 'day' && (
              <span className={`px-1.5 py-0.5 rounded-md text-[0.6rem] font-bold border ${roleTagColors[role] || 'bg-white/5 text-white/40 border-white/10'}`}>
                {getRoleLabel(role)}
              </span>
            )}
            {isFirstKilled && (
              <span className="px-1.5 py-0.5 rounded-md text-[0.6rem] font-bold bg-red-500/15 text-red-400 border border-red-500/25">ПУ</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDead ? (
            <>
              <span className="text-[0.6em] font-bold text-white/30 uppercase tracking-[1px] mr-1.5">{statusLabel}</span>
              <button className="w-8 h-8 rounded-lg bg-[rgba(48,209,88,0.08)] border border-[rgba(48,209,88,0.20)] text-[#30d158]
                flex items-center justify-center active:scale-90 transition-transform duration-150 ease-spring"
                onTouchStart={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onTouchMove={handleRemoveMoveCancel}
                onTouchCancel={handleRemoveMoveCancel}
                onMouseDown={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onMouseLeave={handleRemoveMoveCancel}
                onClick={(e) => e.stopPropagation()}>
                ❤
              </button>
            </>
          ) : mode === 'day' && gamePhase === 'day' ? (
            <>
              <button className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg border text-xs font-bold
                active:scale-90 transition-all duration-150 ease-spring touch-manipulation
                ${foulCount >= 3 ? 'border-red-500/30 bg-red-500/10 text-red-400 animate-foul-warn' :
                  foulCount >= 2 ? 'border-amber-500/25 bg-amber-500/10 text-amber-400' :
                  'border-white/[0.08] bg-white/[0.04] text-white/50'}`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleFoulStart('foul', e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleFoulEnd('foul', e); }}
                onTouchMove={handleFoulMoveCancel}
                onTouchCancel={handleFoulMoveCancel}
                onMouseDown={(e) => { e.stopPropagation(); handleFoulStart('foul', e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleFoulEnd('foul', e); }}
                onMouseLeave={handleFoulMoveCancel}>
                <span className="opacity-60">Ф</span>
                <span>{foulCount}</span>
              </button>
              <button className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg border text-xs font-bold
                active:scale-90 transition-all duration-150 ease-spring touch-manipulation
                ${techFoulCount >= 1 ? 'border-amber-500/25 bg-amber-500/10 text-amber-400' :
                  'border-white/[0.08] bg-white/[0.04] text-white/50'}`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleFoulStart('tf', e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleFoulEnd('tf', e); }}
                onTouchMove={handleFoulMoveCancel}
                onTouchCancel={handleFoulMoveCancel}
                onMouseDown={(e) => { e.stopPropagation(); handleFoulStart('tf', e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleFoulEnd('tf', e); }}
                onMouseLeave={handleFoulMoveCancel}>
                <span className="opacity-60">ТФ</span>
                <span>{techFoulCount}</span>
              </button>
              <button className="w-8 h-8 rounded-lg bg-[rgba(255,69,58,0.05)] border border-[rgba(255,69,58,0.12)] text-[rgba(255,69,58,0.45)]
                flex items-center justify-center text-sm font-bold
                active:scale-90 transition-all duration-150 ease-spring touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onTouchMove={handleRemoveMoveCancel}
                onTouchCancel={handleRemoveMoveCancel}
                onMouseDown={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onMouseLeave={handleRemoveMoveCancel}>
                ✕
              </button>
            </>
          ) : mode === 'night' ? (
            <button
              className={`px-3 py-1.5 rounded-xl text-xs font-bold
                active:scale-90 transition-all duration-150 ease-spring
                ${action === 'killed'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-red-500/10 hover:text-red-400'}`}
              onClick={(e) => { e.stopPropagation(); actionSet(rk, 'killed', { nightKill: true }); triggerHaptic('heavy'); }}>
              Убить
            </button>
          ) : null}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="relative z-[1] px-3 pb-3 pt-1 border-t border-white/[0.06] animate-expand">
          {/* Role assignment */}
          {editRoles && !rolesDistributed && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              <span className="text-[0.7em] text-white/40 font-bold w-full">Роль:</span>
              {(cityMode ? ['don', 'black', 'sheriff', 'doctor'] : ['don', 'black', 'sheriff']).map(r => (
                <button key={r} onClick={() => { roleSet(rk, r); triggerHaptic('selection'); }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all duration-150
                    ${roleTagColors[r] || ''} ${role === r ? 'opacity-100 scale-110 shadow-[0_0_12px_rgba(168,85,247,0.3)]' : 'opacity-50'}`}>
                  {getRoleLabel(r)}
                </button>
              ))}
            </div>
          )}

          {/* KILLED: Best Move */}
          {isKilled && cardPhase === 'bm' && isFirstKilled && canShowBestMove() && (
            <div className="mt-3">
              <div className="text-[0.8em] font-bold text-red-400 mb-2">
                Лучший ход (ЛХ) — выберите до {cityMode ? (getCityBestMoveMax(tableOut.length) || 3) : 3} игроков
              </div>
              <DialerPad items={tableOut.filter(t => isPlayerActive(t.roleKey) && t.roleKey !== rk)} renderButton={(t) => (
                <button
                  className={`${dialerBtn.compact} ${bestMove.includes(t.num) ? dialerBtn.selected : dialerBtn.normal}`}
                  onClick={() => { toggleBestMove(t.num); triggerHaptic('selection'); }}>
                  {t.num}
                </button>
              )} />
              <div className="flex gap-2 mt-2.5">
                <button className="flex-1 px-3.5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold
                  disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-spring"
                  disabled={bestMove.length === 0}
                  onTouchStart={(e) => { e.stopPropagation(); handleBmAcceptStart(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handleBmAcceptEnd(); }}
                  onMouseDown={handleBmAcceptStart} onMouseUp={handleBmAcceptEnd} onMouseLeave={handleBmAcceptEnd}>
                  Принять ЛХ (удержать)
                </button>
                <button className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-white/40 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
                  onClick={() => { setKilledCardPhase(prev => ({ ...prev, [rk]: 'timer' })); triggerHaptic('light'); }}>
                  Пропустить
                </button>
              </div>
              {bestMove.length > 0 && (
                <div className="text-xs text-white/50 mt-1.5">Выбраны: {bestMove.join(', ')}</div>
              )}
            </div>
          )}

          {/* KILLED: Timer */}
          {isKilled && (cardPhase === 'timer' || (!cardPhase && !isFirstKilled)) && (
            <div className="mt-3">
              {isFirstKilled && bestMoveAccepted && (
                <button className="mb-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-white/40 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring"
                  onClick={() => { setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' })); triggerHaptic('light'); }}>
                  Изменить ЛХ ({bestMove.join(', ')})
                </button>
              )}
              <div className={`px-3 py-1 rounded-full text-[0.65rem] font-bold tracking-wider uppercase w-fit mx-auto mb-1
                ${isRunning && !isPaused ? 'bg-emerald-500/15 text-emerald-400' :
                  isPaused ? 'bg-amber-500/15 text-amber-400' :
                  timeLeft === 0 ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-white/40'}`}>
                {timerStatusText}
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-[width] duration-500 linear
                  ${isLow ? 'bg-red-500' : isRunning && !isPaused ? 'bg-accent' : isPaused ? 'bg-amber-400/60' : 'bg-white/20'}`}
                  style={{ width: `${timerProgress * 100}%` }} />
              </div>
              <div className={`text-center text-5xl font-extrabold tracking-tight tabular-nums cursor-pointer select-none my-2
                ${isLow ? 'text-red-400 animate-timer-pulse' :
                  isRunning && !isPaused ? 'text-white' :
                  isPaused ? 'text-amber-400/70' :
                  timeLeft === 0 ? 'text-red-400/60 animate-timer-blink' : 'text-white/70'}`}
                onMouseDown={handleTimerHoldStart} onMouseUp={handleTimerHoldEnd} onMouseLeave={handleTimerHoldCancel}
                onTouchStart={handleTimerHoldStart} onTouchEnd={handleTimerHoldEnd}
                onTouchMove={handleTimerHoldCancel} onTouchCancel={handleTimerHoldCancel}>
                {formatTime(timeLeft)}
              </div>
              <div className="flex items-center justify-center gap-2">
                {canAddTime && (
                  <button className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20
                    text-amber-400 text-xs font-bold active:scale-90 transition-transform duration-150 ease-spring"
                    onClick={() => { addTime(30); addFoul(rk); addFoul(rk); triggerHaptic('warning'); }}>
                    +30с (+2Ф)
                  </button>
                )}
                <button className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-white/50 text-xs font-bold active:scale-90 transition-transform duration-150 ease-spring"
                  onClick={advanceKilledPhase}>
                  {cityMode ? 'Готово ➜' : 'Протокол / Мнение ➜'}
                </button>
              </div>
              <div className="text-[0.65rem] text-white/25 text-center mt-2">Клик: Старт/Пауза | Удержание: Сброс</div>
            </div>
          )}

          {/* KILLED: Protocol (not city mode) */}
          {isKilled && cardPhase === 'protocol' && !cityMode && (
            <div className="mt-3 relative">
              {(gameMode === 'gomafia' || gameMode === 'funky') && <NightTimerBar duration={20} />}
              <div className="relative z-[1]">
                <ProtocolSection rk={rk} tableOut={tableOut} />
                <OpinionSection rk={rk} tableOut={tableOut} />
                <button className="w-full mt-2.5 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold
                  active:scale-[0.97] transition-transform duration-150 ease-spring"
                  onClick={advanceKilledPhase}>
                  Принять протокол ✓
                </button>
              </div>
            </div>
          )}

          {/* KILLED: Done */}
          {isKilled && cardPhase === 'done' && (
            <div className="p-2 text-center text-[0.8em] text-white/30">
              Протокол принят ✓
              <div className="flex gap-2 justify-center mt-2">
                {isFirstKilled && bestMoveAccepted && (
                  <button className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                    text-white/30 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring"
                    onClick={() => { setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' })); triggerHaptic('light'); }}>
                    Изменить ЛХ
                  </button>
                )}
                {!cityMode && (
                  <button className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                    text-white/30 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring"
                    onClick={() => { setKilledCardPhase(prev => ({ ...prev, [rk]: 'protocol' })); setProtocolAccepted(prev => ({ ...prev, [rk]: false })); triggerHaptic('light'); }}>
                    Редактировать протокол
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ALIVE: Timer (Day mode) */}
          {gamePhase === 'day' && active && !isDead && (
            <div className="mt-3">
              <div className={`px-3 py-1 rounded-full text-[0.65rem] font-bold tracking-wider uppercase w-fit mx-auto mb-1
                ${isRunning && !isPaused ? 'bg-emerald-500/15 text-emerald-400' :
                  isPaused ? 'bg-amber-500/15 text-amber-400' :
                  timeLeft === 0 ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.06] text-white/40'}`}>
                {timerStatusText}
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-[width] duration-500 linear
                  ${isLow ? 'bg-red-500' : isRunning && !isPaused ? 'bg-accent' : isPaused ? 'bg-amber-400/60' : 'bg-white/20'}`}
                  style={{ width: `${timerProgress * 100}%` }} />
              </div>
              <div className={`text-center text-5xl font-extrabold tracking-tight tabular-nums cursor-pointer select-none my-2
                ${isLow ? 'text-red-400 animate-timer-pulse' :
                  isRunning && !isPaused ? 'text-white' :
                  isPaused ? 'text-amber-400/70' :
                  timeLeft === 0 ? 'text-red-400/60 animate-timer-blink' : 'text-white/70'}`}
                onMouseDown={handleTimerHoldStart} onMouseUp={handleTimerHoldEnd} onMouseLeave={handleTimerHoldCancel}
                onTouchStart={handleTimerHoldStart} onTouchEnd={handleTimerHoldEnd}
                onTouchMove={handleTimerHoldCancel} onTouchCancel={handleTimerHoldCancel}>
                {formatTime(timeLeft)}
              </div>
              <div className="flex items-center justify-center gap-2">
                {canAddTime && (
                  <button className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20
                    text-amber-400 text-xs font-bold active:scale-90 transition-transform duration-150 ease-spring"
                    onClick={() => { addTime(30); addFoul(rk); addFoul(rk); triggerHaptic('warning'); }}>
                    +30с (+2Ф)
                  </button>
                )}
              </div>
              <div className="text-[0.65rem] text-white/25 text-center mt-2">Клик: Старт/Пауза | Удержание: Сброс</div>
            </div>
          )}

          {/* ALIVE: Nominations (Day, not locked, classic only) */}
          {gamePhase === 'day' && !nominationsLocked && active && !isDead && !cityMode && (
            <div className="mt-3">
              <div className="text-[0.7em] font-bold text-white/40 mb-2">Выставить:</div>
              <RowPad items={tableOut} renderButton={(t) => {
                const tActive = isPlayerActive(t.roleKey);
                const isMyNomination = nominations?.[rk]?.includes(t.num);
                const nominatedByOther = !isMyNomination && Object.entries(nominations || {}).some(([fromRK, targets]) => fromRK !== rk && targets?.includes(t.num));
                const isDisabled = !tActive || nominatedByOther;
                return (
                  <button
                    disabled={isDisabled}
                    className={`${dialerBtn.compact} ${isMyNomination ? dialerBtn.selected : isDisabled ? dialerBtn.disabled : dialerBtn.normal}`}
                    onClick={() => { if (!isDisabled) { toggleNomination(rk, t.num); triggerHaptic('selection'); } }}>
                    {t.num}
                  </button>
                );
              }} />
            </div>
          )}

          {/* Night: Don/Sheriff checks */}
          {mode === 'night' && (roles[rk] === 'don' || roles[rk] === 'sheriff') && (
            <div className="mt-3">
              <div className="text-sm font-bold mb-2">
                {roles[rk] === 'don' ? 'Проверка Дона' : 'Проверка Шерифа'}
              </div>
              {!nightChecks?.[rk] ? (
                <>
                  <DialerPad items={tableOut} renderButton={(t) => (
                    <button
                      className={`${dialerBtn.compact} ${dialerBtn.normal}`}
                      onClick={() => { performNightCheck(rk, t.num); triggerHaptic('medium'); }}>
                      {t.num}
                    </button>
                  )} />
                  {isDead && (
                    <button className="w-full mt-2.5 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                      text-white/50 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
                      onClick={() => { advanceNightPhase(); triggerHaptic('medium'); }}>
                      Продолжить ➜
                    </button>
                  )}
                </>
              ) : (
                <div className={`text-center py-4 rounded-xl border
                  ${nightChecks[rk].result?.includes('✅') ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.08]'}`}>
                  <div className="font-bold mb-1">Игрок {nightChecks[rk].target}</div>
                  <div>{nightChecks[rk].result}</div>
                </div>
              )}
            </div>
          )}

          {/* Night: Doctor heal (city mode) */}
          {mode === 'night' && cityMode && roles[rk] === 'doctor' && nightPhase === 'doctor' && (
            <div className="mt-3">
              <div className="text-sm font-bold mb-2">Лечение Доктора</div>
              {!doctorHeal ? (
                <RowPad items={tableOut} renderButton={(t) => (
                  <button
                    className={`${dialerBtn.compact} ${!canDoctorHealTarget?.(t.num) ? dialerBtn.disabled : dialerBtn.normal}`}
                    disabled={!canDoctorHealTarget?.(t.num)}
                    onClick={() => { performDoctorHeal?.(t.num); triggerHaptic('medium'); }}>
                    {t.num}
                  </button>
                )} />
              ) : (
                <div className="text-center py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-bold">Лечит игрока {doctorHeal.target}</div>
                  <div className="text-emerald-400">Вылечен</div>
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
        className="flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl cursor-pointer
          transition-all duration-200 min-w-0"
        style={{ background: rs.bg, border: `1px solid ${rs.border}` }}>
        <span className="text-sm font-bold" style={{ color: pred ? rs.color : 'rgba(255,255,255,0.5)' }}>
          {t.num}
        </span>
        <span className="text-[0.6em] font-extrabold leading-none whitespace-nowrap" style={{ color: rs.color }}>
          {pred ? rs.label : '—'}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">{firstRow.map(renderBtn)}</div>
      <div className="flex gap-1.5">{secondRow.map(renderBtn)}</div>
    </div>
  );
}

function ProtocolSection({ rk, tableOut }) {
  const { protocolData, toggleProtocolRole } = useGame();

  return (
    <div className="mt-3">
      <div className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider mb-2">Протокол</div>
      <RolePredictionGrid data={protocolData} rk={rk} tableOut={tableOut} onToggle={toggleProtocolRole} />
    </div>
  );
}

function OpinionSection({ rk, tableOut }) {
  const { opinionData, toggleOpinionRole, opinionText, setOpinionText } = useGame();

  return (
    <div className="mt-3.5">
      <div className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider mb-2">Мнение</div>
      <RolePredictionGrid data={opinionData} rk={rk} tableOut={tableOut} onToggle={toggleOpinionRole} />
      <input
        type="text"
        placeholder="Комментарий мнения..."
        value={opinionText?.[rk] || ''}
        onChange={(e) => setOpinionText(prev => ({ ...prev, [rk]: e.target.value }))}
        onClick={(e) => e.stopPropagation()}
        className="w-full mt-2 input-field text-[0.8em]"
      />
    </div>
  );
}
