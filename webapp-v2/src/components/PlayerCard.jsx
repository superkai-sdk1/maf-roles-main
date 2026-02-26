import React, { useRef, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { getRoleLabel, getCityBestMoveMax } from '../constants/roles';
import { triggerHaptic } from '../utils/haptics';
import { NightTimerBar } from './NightTimerBar';
import { DialerPad, RowPad, dialerBtn } from './DialerPad';
import { Mic2, RotateCcw } from 'lucide-react';

const PLAYER_COLORS = [
  'from-indigo-500 to-blue-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-gray-500 to-slate-600',
  'from-red-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
];

function FoulSegmentControl({ label, count, max, onAdd, onRemove }) {
  const holdRef = useRef(null);
  const holdActiveRef = useRef(false);
  const lastTouchRef = useRef(0);

  const handleStart = useCallback((e) => {
    if (e?.type === 'mousedown' && Date.now() - lastTouchRef.current < 500) return;
    if (e?.type === 'touchstart') lastTouchRef.current = Date.now();
    e.stopPropagation();
    holdActiveRef.current = false;
    holdRef.current = setTimeout(() => {
      holdActiveRef.current = true;
      onRemove();
      triggerHaptic('light');
    }, 500);
  }, [onRemove]);

  const handleEnd = useCallback((e) => {
    if (e?.type === 'touchend') lastTouchRef.current = Date.now();
    if (e?.type === 'mouseup' && Date.now() - lastTouchRef.current < 500) return;
    e.stopPropagation();
    clearTimeout(holdRef.current);
    if (!holdActiveRef.current) {
      onAdd();
      triggerHaptic('warning');
    }
  }, [onAdd]);

  const handleCancel = useCallback(() => {
    clearTimeout(holdRef.current);
    holdActiveRef.current = true;
  }, []);

  return (
    <div className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
      <button
        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border transition-all active:scale-90 backdrop-blur-md ${
          count >= max
            ? 'bg-red-500/30 border-red-500/50 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]'
            : count > 0
              ? 'bg-white/10 border-white/15 text-white/70'
              : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
        }`}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchMove={handleCancel}
        onTouchCancel={handleCancel}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleCancel}
      >
        <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-0.5 opacity-60">{label}</span>
        <span className="text-xs font-black leading-none">{count}</span>
      </button>
      <div className="flex gap-0.5 w-full justify-center">
        {[...Array(max)].map((_, i) => (
          <div key={i} className={`h-0.5 rounded-full transition-all duration-300 ${
            i < count
              ? max === 2
                ? 'w-3 bg-cyan-400 shadow-[0_0_5px_#22d3ee]'
                : i >= 3
                  ? 'w-1.5 bg-rose-500 shadow-[0_0_5px_#f43f5e]'
                  : 'w-1.5 bg-indigo-400 shadow-[0_0_5px_#818cf8]'
              : 'w-1 bg-white/10'
          }`} />
        ))}
      </div>
    </div>
  );
}

export const PlayerCard = ({ player, isSpeaking = false, isBlinking = false, isNextSpeaker = false, mode = 'day' }) => {
  const {
    addFoul, removeFoul, addTechFoul, removeTechFoul,
    gamePhase, isPlayerActive, roleSet, editRoles, rolesDistributed,
    nominations, toggleNomination, nominationsLocked,
    highlightedPlayer, setHighlightedPlayer,
    autoExpandPlayer, setAutoExpandPlayer,
    autoStartTimerRK, setAutoStartTimerRK,
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
    startDaySpeakerFlow, nextDaySpeaker,
    activePlayers, currentDaySpeakerIndex, setCurrentDaySpeakerIndex,
  } = useGame();

  const cardRef = useRef(null);
  const rk = player.roleKey;
  const action = player.action;
  const isKilledForTimer = action === 'killed';
  const playerColor = PLAYER_COLORS[(player.num - 1) % PLAYER_COLORS.length];

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

  useEffect(() => {
    if (autoStartTimerRK === rk) {
      setAutoStartTimerRK(null);
      setTimeout(() => { start(); }, 350);
    }
  }, [autoStartTimerRK, rk, setAutoStartTimerRK, start]);

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

  const isLow = timeLeft <= 10 && isRunning && !isPaused;

  const roleTagColors = {
    don: 'bg-purple-300/15 text-purple-300 border-purple-300/25',
    black: 'bg-purple-400/15 text-purple-400 border-purple-400/25',
    sheriff: 'bg-yellow-300/15 text-yellow-300 border-yellow-300/25',
    doctor: 'bg-green-400/15 text-green-400 border-green-400/25',
    peace: 'bg-blue-300/15 text-blue-300 border-blue-300/25',
  };

  const isDayAlive = mode === 'day' && gamePhase === 'day' && !isDead && active;

  const stateClasses = `
    ${isHighlighted && !isDead ? 'border-accent-soft !bg-accent-soft shadow-[0_0_20px_rgba(var(--accent-rgb),0.18)]' : ''}
    ${isSpeaking && !isDead ? '!border-indigo-500/40 !bg-indigo-500/[0.08] shadow-[0_0_24px_rgba(99,102,241,0.2)]' : ''}
    ${(isKilled && cardPhase === 'done') || isVoted ? 'opacity-[0.18] saturate-[0.25] brightness-[0.7] !border-red-500/20' : ''}
    ${isKilled && cardPhase !== 'done' ? '!border-red-500/25' : ''}
    ${isRemoved ? 'opacity-[0.15] saturate-[0.2] brightness-[0.65] !border-white/[0.06]' : ''}
    ${isBlinking ? 'animate-killed-blink' : ''}
    ${isNightDon ? 'animate-don-pulse' : ''}
    ${isNightSheriff ? 'animate-sheriff-pulse' : ''}
    ${isNightDoctor ? 'animate-doctor-pulse' : ''}
    ${isNextSpeaker && !isDead ? 'animate-next-speaker !border-indigo-500/30 !bg-indigo-500/[0.06]' : ''}
  `;

  const handleAdvanceNext = useCallback(() => {
    stop();
    if (currentDaySpeakerIndex >= 0) {
      nextDaySpeaker();
    } else {
      const myIdx = activePlayers.findIndex(p => p.roleKey === rk);
      const nextIdx = myIdx >= 0 ? (myIdx + 1) % activePlayers.length : 0;
      const nextPlayer = activePlayers[nextIdx];
      if (nextPlayer) {
        setCurrentDaySpeakerIndex(nextIdx);
        setAutoExpandPlayer(nextPlayer.roleKey);
        setAutoStartTimerRK(nextPlayer.roleKey);
      }
    }
    triggerHaptic('light');
  }, [stop, currentDaySpeakerIndex, nextDaySpeaker, activePlayers, rk, setCurrentDaySpeakerIndex, setAutoExpandPlayer, setAutoStartTimerRK]);

  /* ============================== RENDER ============================== */

  if (expanded) {
    return (
      <div
        ref={cardRef}
        className={`relative bg-white/[0.08] rounded-[28px] p-5 shadow-2xl border border-white/20 backdrop-blur-3xl ring-1 ring-white/10
          transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${stateClasses}`}
        style={{ '--i': player.num - 1 }}
      >
        <div className="space-y-5">
          {/* ── Header: Player info + Fouls ── */}
          <div className="flex justify-between items-start cursor-pointer" onClick={handleToggle}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${playerColor} flex items-center justify-center text-xl font-black text-white/90 border border-white/20 shadow-lg overflow-hidden`}
                  style={player.avatar_link ? { backgroundImage: `url(${player.avatar_link})`, backgroundSize: 'cover', color: 'transparent' } : {}}
                >
                  {!player.avatar_link && (player.login?.[0]?.toUpperCase() || player.num)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-lg border border-white/10 flex items-center justify-center text-[8px] font-bold text-white/60">
                  {player.num}
                </div>
              </div>
              <div className="min-w-0">
                <h2 className={`text-xl font-black tracking-tight truncate ${isDead ? 'text-white/30' : ''}`}>
                  {player.login || `Игрок ${player.num}`}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {role && gamePhase !== 'discussion' && gamePhase !== 'freeSeating' && gamePhase !== 'day' && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[0.6rem] font-bold border ${roleTagColors[role] || 'bg-white/5 text-white/40 border-white/10'}`}>
                      {getRoleLabel(role)}
                    </span>
                  )}
                  {isSpeaking && !isDead && (
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <Mic2 size={12} />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Говорит</span>
                    </div>
                  )}
                  {statusLabel && (
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-wider">{statusLabel}</span>
                  )}
                  {isFirstKilled && (
                    <span className="px-1.5 py-0.5 rounded-md text-[0.55rem] font-bold bg-red-500/15 text-red-400 border border-red-500/25">ПУ</span>
                  )}
                </div>
              </div>
            </div>

            {/* Foul controls (day alive) */}
            {isDayAlive && (
              <div className="flex items-center gap-3 bg-black/40 rounded-2xl p-2.5 border border-white/5 shadow-inner shrink-0" onClick={e => e.stopPropagation()}>
                <FoulSegmentControl label="Ф" count={foulCount} max={4} onAdd={() => addFoul(rk)} onRemove={() => removeFoul(rk)} />
                <div className="w-[1px] h-6 bg-white/10" />
                <FoulSegmentControl label="Т" count={techFoulCount} max={2} onAdd={() => addTechFoul(rk)} onRemove={() => removeTechFoul(rk)} />
              </div>
            )}

            {/* Dead: return button */}
            {isDead && (
              <div className="shrink-0" onClick={e => e.stopPropagation()}>
                <button className="w-10 h-10 rounded-xl bg-[rgba(48,209,88,0.1)] border border-[rgba(48,209,88,0.25)] text-[#30d158]
                  flex items-center justify-center active:scale-90 transition-transform text-lg"
                  onTouchStart={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                  onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                  onTouchMove={handleRemoveMoveCancel}
                  onTouchCancel={handleRemoveMoveCancel}
                  onMouseDown={(e) => { e.stopPropagation(); handleReturnStart(e); }}
                  onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                  onMouseLeave={handleRemoveMoveCancel}>
                  ❤
                </button>
              </div>
            )}
          </div>

          {/* ── Content sections ── */}

          {/* Role assignment */}
          {editRoles && !rolesDistributed && (
            <div className="flex gap-1.5 flex-wrap">
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
            <div>
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
            <div>
              {isFirstKilled && bestMoveAccepted && (
                <button className="mb-3 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-white/40 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring"
                  onClick={() => { setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' })); triggerHaptic('light'); }}>
                  Изменить ЛХ ({bestMove.join(', ')})
                </button>
              )}
              <TimerSection
                timeLeft={timeLeft} timerProgress={timerProgress} isLow={isLow}
                isRunning={isRunning} isPaused={isPaused}
                onTimerHoldStart={handleTimerHoldStart} onTimerHoldEnd={handleTimerHoldEnd} onTimerHoldCancel={handleTimerHoldCancel}
                canAddTime={canAddTime}
                onAddTime={() => { addTime(30); addFoul(rk); addFoul(rk); triggerHaptic('warning'); }}
                onReset={() => { stop(); triggerHaptic('light'); }}
              />
              <div className="flex items-center justify-center gap-2 mt-4">
                <button className="px-6 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                  text-white/50 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring"
                  onClick={advanceKilledPhase}>
                  {cityMode ? 'Готово ➜' : 'Протокол / Мнение ➜'}
                </button>
              </div>
            </div>
          )}

          {/* KILLED: Protocol (not city mode) */}
          {isKilled && cardPhase === 'protocol' && !cityMode && (
            <div className="relative">
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
          {isDayAlive && (
            <div>
              <TimerSection
                timeLeft={timeLeft} timerProgress={timerProgress} isLow={isLow}
                isRunning={isRunning} isPaused={isPaused}
                onTimerHoldStart={handleTimerHoldStart} onTimerHoldEnd={handleTimerHoldEnd} onTimerHoldCancel={handleTimerHoldCancel}
                canAddTime={canAddTime}
                onAddTime={() => { addTime(30); addFoul(rk); addFoul(rk); triggerHaptic('warning'); }}
                onReset={() => { stop(); triggerHaptic('light'); }}
              />
              {(isRunning || isPaused) && (
                <button
                  className="w-full mt-4 px-4 py-3.5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                  onClick={handleAdvanceNext}
                >
                  Далее →
                </button>
              )}
            </div>
          )}

          {/* ALIVE: Nominations (Day, not locked, classic only) */}
          {gamePhase === 'day' && !nominationsLocked && active && !isDead && !cityMode && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Выставить на голосование</span>
                {isNominated && <span className="text-[9px] font-black text-indigo-400">ВЫСТАВЛЕН</span>}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {tableOut.map(t => {
                  const tActive = isPlayerActive(t.roleKey);
                  const isMyNomination = nominations?.[rk]?.includes(t.num);
                  const nominatedByOther = !isMyNomination && Object.entries(nominations || {}).some(([fromRK, targets]) => fromRK !== rk && targets?.includes(t.num));
                  const isDisabled = !tActive || nominatedByOther;
                  return (
                    <button
                      key={t.num}
                      disabled={isDisabled}
                      onClick={() => { if (!isDisabled) { toggleNomination(rk, t.num); triggerHaptic('selection'); } }}
                      className={`h-10 rounded-xl font-black text-xs transition-all duration-300 ${
                        isMyNomination
                          ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-indigo-400 scale-105'
                          : isDisabled
                            ? 'bg-white/[0.02] text-white/10 border border-white/[0.03]'
                            : 'bg-white/5 text-white/30 border border-white/5 hover:border-white/10'
                      }`}
                    >
                      {t.num}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remove player button (day alive) */}
          {isDayAlive && (
            <div className="flex justify-center pt-1">
              <button className="px-4 py-2 rounded-xl bg-red-500/[0.04] border border-red-500/10 text-red-500/30
                text-[8px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onTouchEnd={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onTouchMove={handleRemoveMoveCancel}
                onTouchCancel={handleRemoveMoveCancel}
                onMouseDown={(e) => { e.stopPropagation(); handleRemoveStart(e); }}
                onMouseUp={(e) => { e.stopPropagation(); handleRemoveEnd(e); }}
                onMouseLeave={handleRemoveMoveCancel}>
                Удалить (удержать)
              </button>
            </div>
          )}

          {/* Night: Don/Sheriff checks */}
          {mode === 'night' && (roles[rk] === 'don' || roles[rk] === 'sheriff') && (
            <div>
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
            <div>
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
      </div>
    );
  }

  /* ── Collapsed card ── */
  return (
    <div
      ref={cardRef}
      className={`relative bg-white/[0.03] rounded-2xl p-2.5 border border-white/[0.05] backdrop-blur-md cursor-pointer
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white/[0.06] overflow-hidden ${stateClasses}`}
      style={{ '--i': player.num - 1 }}
      onClick={handleToggle}
    >
      <div className="flex items-center justify-between h-12 px-1">
        {/* Left: Avatar + Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${playerColor} flex items-center justify-center font-black text-[10px] text-white/90 border border-white/10 shadow-lg overflow-hidden`}
              style={player.avatar_link ? { backgroundImage: `url(${player.avatar_link})`, backgroundSize: 'cover', color: 'transparent' } : {}}
            >
              {!player.avatar_link && (player.login?.[0]?.toUpperCase() || player.num)}
            </div>
            <div className="absolute -top-1 -left-1 w-4 h-4 bg-black/60 backdrop-blur-md rounded-md flex items-center justify-center text-[7px] font-bold text-white/50 border border-white/5">
              {player.num}
            </div>
          </div>
          <div className="min-w-0 flex flex-col">
            <span className={`font-black text-[12px] uppercase tracking-tight truncate ${
              foulCount >= 3 ? 'text-rose-400' : isDead ? 'text-white/30' : 'text-white/80'
            }`}>
              {player.login || `Игрок ${player.num}`}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {role && gamePhase !== 'discussion' && gamePhase !== 'freeSeating' && gamePhase !== 'day' && (
                <span className={`px-1 py-0.5 rounded text-[0.5rem] font-bold border ${roleTagColors[role] || 'bg-white/5 text-white/40 border-white/10'}`}>
                  {getRoleLabel(role)}
                </span>
              )}
              {isNominated && <span className="text-[6px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">ВЫСТАВЛЕН</span>}
              {isFirstKilled && <span className="text-[6px] font-black text-red-400 uppercase tracking-widest">ПУ</span>}
              {statusLabel && <span className="text-[6px] font-black text-white/25 uppercase tracking-widest">{statusLabel}</span>}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isDead ? (
            <button className="w-9 h-9 rounded-xl bg-[rgba(48,209,88,0.08)] border border-[rgba(48,209,88,0.20)] text-[#30d158]
              flex items-center justify-center active:scale-90 transition-transform text-base"
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
          ) : mode === 'day' && gamePhase === 'day' ? (
            <div className="flex items-center gap-3 bg-black/30 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/5 shadow-inner">
              <FoulSegmentControl label="Ф" count={foulCount} max={4} onAdd={() => addFoul(rk)} onRemove={() => removeFoul(rk)} />
              <div className="w-[1px] h-6 bg-white/10" />
              <FoulSegmentControl label="Т" count={techFoulCount} max={2} onAdd={() => addTechFoul(rk)} onRemove={() => removeTechFoul(rk)} />
            </div>
          ) : mode === 'night' ? (
            <button
              className={`px-3 py-1.5 rounded-xl text-xs font-bold active:scale-90 transition-all duration-150 ease-spring ${
                action === 'killed'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-red-500/10 hover:text-red-400'
              }`}
              onClick={(e) => { e.stopPropagation(); actionSet(rk, 'killed', { nightKill: true }); triggerHaptic('heavy'); }}>
              Убить
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/* ── Shared timer section ── */
function TimerSection({ timeLeft, timerProgress, isLow, isRunning, isPaused, onTimerHoldStart, onTimerHoldEnd, onTimerHoldCancel, canAddTime, onAddTime, onReset }) {
  return (
    <div className="flex flex-col items-center py-2">
      <div
        className={`text-[80px] font-black leading-none tracking-tighter tabular-nums mb-2 transition-all duration-300 select-none cursor-pointer ${
          isLow ? 'text-rose-500 animate-pulse'
            : isRunning && !isPaused ? 'text-white'
            : isPaused ? 'text-amber-400/70'
            : timeLeft === 0 ? 'text-red-400/60 animate-timer-blink' : 'text-white/60'
        }`}
        onMouseDown={onTimerHoldStart} onMouseUp={onTimerHoldEnd} onMouseLeave={onTimerHoldCancel}
        onTouchStart={onTimerHoldStart} onTouchEnd={onTimerHoldEnd}
        onTouchMove={onTimerHoldCancel} onTouchCancel={onTimerHoldCancel}
      >
        {timeLeft}
      </div>

      <div className="w-full max-w-[200px] h-1 bg-white/5 rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isLow ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : isRunning && !isPaused ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : isPaused ? 'bg-amber-400/60' : 'bg-white/10'
          }`}
          style={{ width: `${timerProgress * 100}%` }}
        />
      </div>

      <div className="flex gap-3">
        {canAddTime && (
          <button
            className="px-7 py-3 bg-white text-black rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
            onClick={onAddTime}
          >
            +30 сек
          </button>
        )}
        <button
          className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition active:scale-95"
          onClick={onReset}
        >
          <RotateCcw size={18} className="text-white/50" />
        </button>
      </div>
      <div className="text-[0.6rem] text-white/20 text-center mt-3">Клик: Старт/Пауза | Удержание: Сброс</div>
    </div>
  );
}

/* ── Helper components ── */

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
