import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTimer } from '../hooks/useTimer';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { ChevronRight, Users, RotateCcw, GripVertical, Plus, X, Pencil } from 'lucide-react';
import { CityNumpad } from './CityNumpad';

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
    updateVotingOrder,
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

  // === Controllable last speech timer (60s, +30s foul up to 2x) ===
  const lastSpeechTimer = useTimer(60, null);
  const lastSpeechHoldRef = useRef(null);
  const lastSpeechHoldActiveRef = useRef(false);
  const lastSpeechLastTouchRef = useRef(0);
  const [lastSpeechFoulCount, setLastSpeechFoulCount] = useState(0);
  const prevLastSpeechActive = useRef(false);

  const [showEditOrder, setShowEditOrder] = useState(false);
  const [editOrder, setEditOrder] = useState([]);
  const [editDragIdx, setEditDragIdx] = useState(null);
  const [editDragOverIdx, setEditDragOverIdx] = useState(null);
  const editListRef = useRef(null);
  const editDragStateRef = useRef({ active: false, sourceIdx: null, overIdx: null });

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

  const timerIsLow = (timer) => timer.timeLeft <= 10 && timer.isRunning && !timer.isPaused;

  /* ── Edit voting order handlers ── */
  const editAvailablePlayers = alivePlayers.filter(p => !editOrder.includes(p.num));

  const openEditOrder = useCallback(() => {
    setEditOrder([...votingOrder]);
    setShowEditOrder(true);
    triggerHaptic('light');
  }, [votingOrder]);

  const applyEditOrder = useCallback(() => {
    if (editOrder.length === 0) { setShowEditOrder(false); return; }
    const orderChanged = editOrder.length !== votingOrder.length ||
      editOrder.some((num, idx) => votingOrder[idx] !== num);
    if (orderChanged) updateVotingOrder(editOrder);
    setShowEditOrder(false);
    triggerHaptic('medium');
  }, [editOrder, votingOrder, updateVotingOrder]);

  const cancelEditOrder = useCallback(() => {
    setShowEditOrder(false);
    triggerHaptic('light');
  }, []);

  const addToOrder = useCallback((num) => {
    setEditOrder(prev => prev.includes(num) ? prev : [...prev, num]);
    triggerHaptic('selection');
  }, []);

  const removeFromOrder = useCallback((num) => {
    setEditOrder(prev => prev.filter(n => n !== num));
    triggerHaptic('selection');
  }, []);

  const handleEditDragStart = useCallback((idx, e) => {
    setEditDragIdx(idx);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'reorder:' + idx);
    }
    triggerHaptic('light');
  }, []);

  const handleEditDragOver = useCallback((idx) => {
    setEditDragOverIdx(idx);
  }, []);

  const handleEditDragEnd = useCallback(() => {
    setEditDragIdx(null);
    setEditDragOverIdx(null);
  }, []);

  const handleCandidateDrop = useCallback((targetIdx, e) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData('text/plain') || '';
    if (data.startsWith('reorder:')) {
      const sourceIdx = parseInt(data.split(':')[1]);
      if (sourceIdx !== targetIdx) {
        setEditOrder(prev => {
          const arr = [...prev];
          const [moved] = arr.splice(sourceIdx, 1);
          arr.splice(targetIdx, 0, moved);
          return arr;
        });
      }
    } else if (data.startsWith('add:')) {
      const num = parseInt(data.split(':')[1]);
      setEditOrder(prev => {
        if (prev.includes(num)) return prev;
        const arr = [...prev];
        arr.splice(targetIdx, 0, num);
        return arr;
      });
    }
    setEditDragIdx(null);
    setEditDragOverIdx(null);
    triggerHaptic('medium');
  }, []);

  const handleAvailableDragStart = useCallback((num, e) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', 'add:' + num);
    }
    triggerHaptic('light');
  }, []);

  const handleEndzoneDrop = useCallback((e) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData('text/plain') || '';
    if (data.startsWith('add:')) {
      const num = parseInt(data.split(':')[1]);
      setEditOrder(prev => prev.includes(num) ? prev : [...prev, num]);
      triggerHaptic('selection');
    } else if (data.startsWith('reorder:')) {
      const sourceIdx = parseInt(data.split(':')[1]);
      setEditOrder(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(sourceIdx, 1);
        arr.push(moved);
        return arr;
      });
      triggerHaptic('medium');
    }
    setEditDragIdx(null);
    setEditDragOverIdx(null);
  }, []);

  const startTouchReorder = useCallback((idx, e) => {
    e.preventDefault();
    editDragStateRef.current = { active: true, sourceIdx: idx, overIdx: null };
    setEditDragIdx(idx);
    setEditDragOverIdx(null);
    triggerHaptic('light');

    const moveHandler = (me) => {
      me.preventDefault();
      const touch = me.touches[0];
      const container = editListRef.current;
      if (!container) return;
      const items = container.querySelectorAll('[data-edit-idx]');
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          editDragStateRef.current.overIdx = i;
          setEditDragOverIdx(i);
          return;
        }
      }
    };

    const endHandler = () => {
      const { sourceIdx, overIdx } = editDragStateRef.current;
      if (sourceIdx !== null && overIdx !== null && sourceIdx !== overIdx) {
        setEditOrder(prev => {
          const arr = [...prev];
          const [moved] = arr.splice(sourceIdx, 1);
          arr.splice(overIdx, 0, moved);
          return arr;
        });
        triggerHaptic('medium');
      }
      editDragStateRef.current = { active: false, sourceIdx: null, overIdx: null };
      setEditDragIdx(null);
      setEditDragOverIdx(null);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', endHandler);
      window.removeEventListener('touchcancel', endHandler);
    };

    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', endHandler);
    window.addEventListener('touchcancel', endHandler);
  }, []);

  /* ── Voting grid button renderer ── */
  const renderVotingGrid = ({ players, isSelected, isDisabled, isPrefilled, onToggle }) => {
    const renderBtn = (p) => {
      const selected = isSelected(p);
      const disabled = isDisabled(p);
      const prefilled = isPrefilled ? isPrefilled(p) : false;
      return (
        <button
          key={p.num}
          disabled={disabled}
          onClick={() => { if (!disabled) { onToggle(p.num); triggerHaptic('selection'); } }}
          className={`h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-black transition-all duration-200 ${
            disabled
              ? 'bg-black/20 text-white/10 border border-transparent opacity-30 cursor-not-allowed'
              : selected
                ? 'bg-accent text-white shadow-[0_0_35px_rgba(var(--accent-rgb),0.5)] border border-accent scale-105 ring-2 ring-[rgba(var(--accent-rgb),0.2)]'
                : prefilled
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-white/[0.05] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
          }`}
        >
          {p.num}
        </button>
      );
    };

    return (
      <div className="grid grid-cols-3 gap-3 w-full">
        {players.slice(0, 9).map(renderBtn)}
        {players.length >= 10 && (
          <>
            <div />
            {renderBtn(players[9])}
          </>
        )}
      </div>
    );
  };

  /* ── Shared timer component ── */
  const VotingTimer = ({ timer, holdStart, holdEnd, holdCancel, label, extra }) => {
    const low = timerIsLow(timer);
    return (
      <div className="flex flex-col items-center py-2">
        {label && <div className="text-[0.7rem] font-bold tracking-wider uppercase text-white/40 mb-2">{label}</div>}
        <div
          className={`text-[64px] font-black leading-none tracking-tighter tabular-nums mb-2 select-none cursor-pointer transition-all ${
            low ? 'text-rose-500 animate-pulse'
              : timer.isRunning && !timer.isPaused ? 'text-semantic-primary'
              : timer.isPaused ? 'text-amber-400/70'
              : timer.timeLeft === 0 ? 'text-red-400/60' : 'text-white/60'
          }`}
          onMouseDown={holdStart} onMouseUp={holdEnd} onMouseLeave={holdCancel}
          onTouchStart={holdStart} onTouchEnd={holdEnd}
          onTouchMove={holdCancel} onTouchCancel={holdCancel}
        >
          {timer.timeLeft}
        </div>
        <div className="w-full max-w-[180px] h-1 bg-white/[0.05] rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              low ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                : timer.isRunning && !timer.isPaused ? 'bg-accent shadow-glow-accent'
                : timer.isPaused ? 'bg-amber-400/60' : 'bg-white/[0.10]'
            }`}
            style={{ width: `${Math.min(100, (timer.timeLeft / (timer === lastSpeechTimer ? 60 : 30)) * 100)}%` }}
          />
        </div>
        {extra}
        <div className="text-[0.55rem] text-white/20 text-center mt-2">Клик: Старт/Пауза | Удержание: Сброс</div>
      </div>
    );
  };

  /* ── Card wrapper style ── */
  const cardBase = 'bg-glass-surface backdrop-blur-3xl shadow-glass-md';

  return (
    <div className="animate-fade-in flex flex-col gap-4">

      {/* ══════════ EDIT VOTING ORDER SCREEN ══════════ */}
      {showEditOrder && votingScreenTab === 'voting' && (
        <div className="animate-fade-in flex flex-col gap-4">
          <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-5`}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black uppercase tracking-wide">Изменить порядок</h3>
              <div className="flex gap-2">
                <button onClick={cancelEditOrder}
                  className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                  Отмена
                </button>
                <button onClick={applyEditOrder}
                  disabled={editOrder.length === 0}
                  className="h-10 px-5 rounded-xl bg-accent text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed">
                  Готово
                </button>
              </div>
            </div>
            {(votingCurrentIndex > 0 || Object.keys(votingResults).length > 0) && (
              <p className="text-[0.7rem] text-amber-400/70 mt-2">
                ⚠ Изменения сбросят текущий прогресс голосования
              </p>
            )}
          </div>

          <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Порядок голосования</span>
              <span className="text-[9px] font-black text-white/40 bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                {editOrder.length} {editOrder.length === 1 ? 'игрок' : editOrder.length >= 2 && editOrder.length <= 4 ? 'игрока' : 'игроков'}
              </span>
            </div>
            <div ref={editListRef} className="flex flex-col gap-1.5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleEndzoneDrop}>
              {editOrder.map((num, idx) => {
                const p = tableOut[num - 1];
                return (
                  <div key={num} data-edit-idx={idx}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                      editDragIdx === idx ? 'opacity-30 scale-[0.97]' : 'bg-white/[0.04]'
                    } ${editDragOverIdx === idx && editDragIdx !== idx ? 'border-t-2 border-t-accent bg-accent/5' : 'border-white/[0.08]'}`}
                    onDragOver={(e) => { e.preventDefault(); handleEditDragOver(idx); }}
                    onDrop={(e) => handleCandidateDrop(idx, e)}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg cursor-grab touch-none shrink-0 active:cursor-grabbing active:bg-white/[0.08] transition-colors"
                      draggable
                      onDragStart={(e) => handleEditDragStart(idx, e)}
                      onDragEnd={handleEditDragEnd}
                      onTouchStart={(e) => startTouchReorder(idx, e)}>
                      <GripVertical size={16} className="text-white/25" />
                    </div>
                    <span className="text-sm font-black text-yellow-400 min-w-[28px]">#{num}</span>
                    <span className="text-sm font-bold text-white/60 flex-1 truncate">{p?.login || ''}</span>
                    <button onClick={() => removeFromOrder(num)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] active:scale-90 transition-all hover:bg-red-500/10 hover:border-red-500/20">
                      <X size={12} className="text-white/30" />
                    </button>
                  </div>
                );
              })}
              {editOrder.length === 0 && (
                <div className="py-6 text-center text-white/20 text-[0.8em]">
                  Добавьте игроков из списка ниже
                </div>
              )}
            </div>
          </div>

          {editAvailablePlayers.length > 0 && (
            <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-5`}>
              <span className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3 block">Добавить игрока</span>
              <div className="flex flex-col gap-1.5">
                {editAvailablePlayers.map(p => (
                  <div key={p.num}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.05]"
                    draggable
                    onDragStart={(e) => handleAvailableDragStart(p.num, e)}
                    onClick={() => addToOrder(p.num)}>
                    <span className="text-sm font-black text-white/30 min-w-[28px]">#{p.num}</span>
                    <span className="text-sm font-bold text-white/40 flex-1 truncate">{p.login || ''}</span>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                      <Plus size={12} className="text-accent" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ HEADER — candidate ribbon ══════════ */}
      {!showEditOrder && votingScreenTab === 'voting' && candidates.length > 0 && (
        <div className={`w-full bg-white/[0.05] border border-white/[0.08] p-3 rounded-2xl shadow-glass-sm`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Users size={12} className="text-white/30" />
              <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">Выставлены:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {votingOrder.map((num, idx) => (
                <div
                  key={num}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all duration-300 border ${
                    idx === votingCurrentIndex && !votingFinished
                      ? 'bg-yellow-400 border-yellow-300 text-black shadow-[0_0_12px_rgba(250,204,21,0.5)] scale-110 z-10'
                      : idx < votingCurrentIndex
                        ? 'bg-[rgba(var(--accent-rgb),0.15)] border-[rgba(var(--accent-rgb),0.2)] text-accent opacity-60'
                        : 'bg-white/[0.05] border-white/[0.06] text-white/30'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showEditOrder && votingScreenTab === 'voting' && (
        <>
          {/* No candidates */}
          {!showVotingModal && candidates.length === 0 && (
            <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-8 text-center animate-fade-in`}>
              <div className="text-[2.5em] mb-3 opacity-30">⚖️</div>
              <h3 className="text-base font-bold mb-1.5">Нет выставленных игроков</h3>
              <p className="text-[0.85em] text-white/35">
                Выставите кандидатов в карточках игроков, чтобы начать голосование
              </p>
            </div>
          )}

          {showVotingModal && (
            <div className="flex flex-col gap-4">

              {/* Day 0: single candidate */}
              {votingDay0SingleCandidate && (
                <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-8 text-center animate-fade-in`}>
                  <div className="text-[2.5em] mb-3 opacity-40">☝️</div>
                  <h3 className="text-base font-bold mb-2">
                    Выставлен 1 кандидат — #{votingDay0SingleCandidate}
                  </h3>
                  <p className="text-[0.85em] text-white/40 mb-5">
                    На нулевом голосовании выставлен только один игрок. Голосование не проводится.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="bg-accent text-white h-14 px-10 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl">
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* Day 0: triple tie */}
              {votingDay0TripleTie && (
                <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-8 text-center animate-fade-in`}>
                  <div className="text-[2.5em] mb-3 opacity-40">⚖️</div>
                  <h3 className="text-base font-bold mb-2">
                    Ничья {votingDay0TripleTiePlayers.length} игроков
                  </h3>
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
                    {votingDay0TripleTiePlayers.map(num => (
                      <span key={num} className="py-1.5 px-3.5 rounded-xl bg-yellow-400/15 text-[0.9em] font-black text-yellow-400 border border-yellow-400/25">
                        #{num}
                      </span>
                    ))}
                  </div>
                  <p className="text-[0.85em] text-white/40 mb-5">
                    На нулевом голосовании невозможно деление {votingDay0TripleTiePlayers.length} игроков.
                  </p>
                  <button onClick={() => { dismissDay0VotingAndGoToNight(); triggerHaptic('medium'); }}
                    className="bg-accent text-white h-14 px-10 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl">
                    Перейти в ночь
                  </button>
                </div>
              )}

              {/* ── Tie split timer ── */}
              {votingTieTimerActive && (
                <div className={`${cardBase} border border-yellow-400/20 rounded-[2.5rem] p-6 text-center animate-fade-in`}>
                  <h3 className="text-base font-black text-yellow-400 mb-4">Деление игроков</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-5 justify-center">
                    {votingTiePlayers.map((num, i) => {
                      const isCurrent = !votingTieAllDone && i === votingTieSpeakerIdx;
                      const isDone = i < votingTieSpeakerIdx || votingTieAllDone;
                      return (
                        <div key={num} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all duration-300 border ${
                          isCurrent
                            ? 'bg-yellow-400 border-yellow-300 text-black shadow-[0_0_12px_rgba(250,204,21,0.5)] scale-110'
                            : isDone
                              ? 'bg-white/[0.05] border-white/[0.06] text-white/20'
                              : 'bg-white/[0.05] border-white/[0.08] text-white/60'
                        }`}>{num}</div>
                      );
                    })}
                  </div>

                  {!votingTieAllDone && (
                    <VotingTimer
                      timer={tieTimer}
                      holdStart={handleTieHoldStart}
                      holdEnd={handleTieHoldEnd}
                      holdCancel={handleTieHoldCancel}
                      label={`Речь игрока #${votingTiePlayers[votingTieSpeakerIdx]} (${votingTieSpeakerIdx + 1}/${votingTiePlayers.length})`}
                      extra={
                        <div className="flex gap-3">
                          {tieTimer.timeLeft === 0 && !tieTimer.isRunning ? (
                            <button className="px-7 py-3 bg-yellow-400 text-black rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                              onClick={() => { advanceTieSpeaker(); triggerHaptic('light'); }}>
                              {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? 'Завершить' : 'Дальше'}
                            </button>
                          ) : (
                            <button className="px-7 py-3 bg-white/[0.05] rounded-2xl border border-white/[0.08] text-white/50 font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
                              onClick={() => { tieTimer.stop(); advanceTieSpeaker(); triggerHaptic('light'); }}>
                              {votingTieSpeakerIdx >= votingTiePlayers.length - 1 ? 'Завершить' : 'Пропустить'}
                            </button>
                          )}
                        </div>
                      }
                    />
                  )}

                  {votingTieAllDone && (
                    <div className="mt-4 pt-4 border-t border-yellow-400/15">
                      <p className="text-[0.85em] text-white/40 mb-4">Все кандидаты высказались</p>
                      {votingStage === 'tie' ? (
                        <button onClick={() => { startLiftVoting(); triggerHaptic('medium'); }}
                          className="w-full bg-accent text-white h-14 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl">
                          Голосование за подъём
                        </button>
                      ) : (
                        <button onClick={() => { startTieVoting(); triggerHaptic('medium'); }}
                          className="w-full bg-accent text-white h-14 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl">
                          Повторное голосование
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Last speech ── */}
              {votingLastSpeechActive && votingWinners.length > 0 && (
                <div className={`${cardBase} border border-red-500/20 rounded-[2.5rem] p-6 text-center animate-fade-in`}>
                  <h3 className="text-base font-black text-red-400 mb-3">Крайняя речь</h3>
                  {votingWinners.map(num => {
                    const p = tableOut[num - 1];
                    return <div key={num} className="text-3xl font-black mb-2"><span className="text-yellow-400">#{num}</span> {p?.login}</div>;
                  })}

                  <VotingTimer
                    timer={lastSpeechTimer}
                    holdStart={handleLastSpeechHoldStart}
                    holdEnd={handleLastSpeechHoldEnd}
                    holdCancel={handleLastSpeechHoldCancel}
                    extra={
                      <div className="flex gap-3">
                        {lastSpeechTimer.timeLeft > 0 && lastSpeechFoulCount < 2 && (
                          <button className="px-7 py-3 bg-accent text-white rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                            onClick={() => { lastSpeechTimer.addTime(30); setLastSpeechFoulCount(c => c + 1); triggerHaptic('warning'); }}>
                            +30 сек (+Ф)
                          </button>
                        )}
                        <button className="p-3 bg-white/[0.05] rounded-2xl border border-white/[0.08] active:scale-95 transition-all"
                          onClick={() => { lastSpeechTimer.stop(); setLastSpeechFoulCount(0); triggerHaptic('light'); }}>
                          <RotateCcw size={18} className="text-white/50" />
                        </button>
                      </div>
                    }
                  />

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

              {/* ── Lift voting ── */}
              {votingStage === 'lift' && !votingFinished && (
                <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-6 animate-fade-in`}>
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
                      Голосование за подъём
                    </span>
                    <span className="text-[10px] font-black text-white/40 bg-white/[0.05] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                      {votingLiftResults.length} / {Math.ceil(alivePlayers.length / 2 + 0.1)} нужно
                    </span>
                  </div>

                  <div className="text-center mb-6">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400/80 mb-3 font-black">Поднять игроков:</p>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {votingTiePlayers.map(num => (
                        <span key={num} className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 flex items-center justify-center text-sm font-black">{num}</span>
                      ))}
                    </div>
                  </div>

                  {renderVotingGrid({
                    players: tableOut,
                    isSelected: (p) => votingLiftResults.includes(p.num),
                    isDisabled: (p) => !isPlayerActive(p.roleKey),
                    onToggle: (num) => toggleLiftVote(num),
                  })}

                  <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Голосов ЗА:</span>
                      <span className="text-4xl font-black leading-none tracking-tighter">{votingLiftResults.length}</span>
                    </div>
                    <button onClick={() => { finishLiftVoting(); triggerHaptic('medium'); }}
                      className="bg-accent text-white h-14 px-10 rounded-[1.5rem] font-black flex items-center gap-3 active:scale-95 transition-all shadow-xl text-[10px] uppercase tracking-[0.2em]">
                      Завершить
                      <ChevronRight size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )}

              {/* ══════════ MAIN / TIE VOTING ══════════ */}
              {(votingStage === 'main' || votingStage === 'tie') && !votingFinished && !votingTieTimerActive && (
                <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-6 shadow-2xl flex flex-col animate-fade-in`}>

                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
                      {votingStage === 'tie' ? 'Повторное' : 'Активная фаза'}
                    </span>
                    <span className="text-[10px] font-black text-white/40 bg-white/[0.05] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                      ЭТАП {votingCurrentIndex + 1} / {votingOrder.length}
                    </span>
                  </div>

                  <div className="text-center mb-8">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-accent opacity-80 mb-3 font-black">Голосуем за игрока:</p>
                    <h2 className="text-4xl font-black tracking-tight">
                      <span className="text-yellow-400">#{currentCandidate}</span> {tableOut[currentCandidate - 1]?.login || ''}
                    </h2>
                  </div>

                  {/* City mode: numpad */}
                  {cityMode ? (() => {
                    const totalVoters = alivePlayers.length;
                    const usedVotes = votingOrder.reduce((sum, c) => sum + (cityVoteCounts[c] || 0), 0);
                    const cityRemaining = totalVoters - usedVotes;
                    const currentVal = cityVoteCounts[currentCandidate] || 0;
                    const cityMax = cityRemaining + currentVal;
                    return (
                      <CityNumpad
                        value={currentVal}
                        onChange={(val) => setCityVoteCounts(prev => ({ ...prev, [currentCandidate]: val }))}
                        maxValue={cityMax}
                        remainingVotes={cityRemaining}
                      />
                    );
                  })() : (
                    <div className="mb-8">
                      {renderVotingGrid({
                        players: tableOut,
                        isSelected: (p) => currentVotes.includes(p.num),
                        isDisabled: (p) => !isPlayerActive(p.roleKey) || alreadyVotedElsewhere.has(p.num),
                        isPrefilled: (p) => isPlayerActive(p.roleKey) && isLastCandidate && !currentVotes.includes(p.num) && !alreadyVotedElsewhere.has(p.num),
                        onToggle: (num) => toggleVotingSelection(num),
                      })}
                    </div>
                  )}

                  {/* Bottom confirmation */}
                  <div className="mt-auto pt-6 border-t border-white/[0.06] space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">Голосов ЗА:</span>
                        <span className="text-5xl font-black leading-none tracking-tighter">
                          {cityMode ? (cityVoteCounts[currentCandidate] || 0) : (currentVotes.length + (isLastCandidate ? remainingVoters.length : 0))}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {votingCurrentIndex > 0 && (
                          <button onClick={() => { setVotingCurrentIndex(i => i - 1); triggerHaptic('light'); }}
                            className="h-14 px-5 rounded-[1.5rem] bg-white/[0.05] border border-white/[0.08] text-white/50 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                            Назад
                          </button>
                        )}
                        <button onClick={() => { acceptCurrentCandidateVotes(); triggerHaptic('light'); }}
                          className="bg-accent text-white h-14 px-10 rounded-[1.5rem] font-black flex items-center gap-3 active:scale-95 transition-all shadow-xl text-[10px] uppercase tracking-[0.2em]">
                          {votingCurrentIndex >= votingOrder.length - 1 ? 'Завершить' : 'Принять'}
                          <ChevronRight size={18} strokeWidth={3} />
                        </button>
                      </div>
                    </div>

                    {/* Results so far */}
                    {Object.keys(votingResults).length > 0 && (
                      <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06]">
                        <span className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-2 block">Текущий результат</span>
                        <div className="flex flex-col gap-1.5">
                          {votingOrder.slice(0, votingCurrentIndex + 1).map(c => (
                            <div key={c} className="flex justify-between items-center">
                              <span className="text-xs font-bold text-white/40">#{c} {tableOut[c - 1]?.login || ''}</span>
                              <span className="text-xs font-black text-accent bg-accent-soft px-2.5 py-1 rounded-lg border border-accent-soft">
                                {(votingResults[String(c)] || []).length} голосов
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit voting order button */}
              {(votingStage === 'main' || votingStage === 'tie') && !votingFinished && !votingTieTimerActive && !votingLastSpeechActive && (
                <button onClick={openEditOrder}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/50 font-bold text-[11px] uppercase tracking-[0.15em] active:scale-[0.98] transition-all hover:bg-white/[0.06]">
                  <Pencil size={14} className="text-white/40" />
                  Изменить порядок
                </button>
              )}

              {/* No winners / finished */}
              {votingFinished && votingWinners.length === 0 && !votingTieTimerActive && (
                <div className={`${cardBase} border border-glass-border rounded-[2.5rem] p-8 text-center animate-fade-in`}>
                  {votingStage === 'lift' ? (
                    <>
                      <h3 className="text-base font-bold mb-2">Голосов за подъём недостаточно</h3>
                      <p className="text-[0.85em] text-white/40 mb-5">Никто не выбывает</p>
                      <SlideConfirm
                        label="Перейти в ночь"
                        onConfirm={() => { closeVotingAndApply(); handleGoToNight(true); triggerHaptic('medium'); }}
                        color="night"
                        compact
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-bold mb-2">Голосование завершено</h3>
                      <p className="text-[0.85em] text-white/40 mb-5">Никто не выбыл</p>
                      <button onClick={() => { closeVotingAndApply(); triggerHaptic('light'); }}
                        className="bg-accent text-white h-14 px-10 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl">
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

      {/* ══════════ HISTORY ══════════ */}
      {!showEditOrder && votingScreenTab === 'history' && (
        <div className="animate-fade-in flex flex-col gap-3">
          {votingHistory.length === 0 ? (
            <div className="py-10 text-center text-white/25">
              <div className="text-[2em] mb-2 opacity-30">📋</div>
              <p className="text-[0.9em]">История голосований пуста</p>
            </div>
          ) : (
            [...votingHistory].reverse().map((v, i) => (
              <div key={i} className="bg-glass-surface backdrop-blur-xl border border-glass-border rounded-2xl p-4 shadow-glass-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.7em] font-black text-white/40 uppercase tracking-wider">
                    {v.skipped ? `День ${v.dayNumber}` : `Голосование #${v.votingNumber} (День ${v.dayNumber})`}
                  </span>
                  {v.skipped && (
                    <span className="text-[0.6em] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                      Без голосования
                    </span>
                  )}
                </div>

                {v.skipped ? (
                  <div className="text-[0.85em] text-white/50 mb-1">
                    {v.nominees?.length > 0 ? (
                      <>Выставлен: {v.nominees.map(num => `#${num} ${tableOut[num - 1]?.login || ''}`).join(', ')}. Голосование не проводилось.</>
                    ) : (
                      <>Кандидатуры не выдвинуты.</>
                    )}
                  </div>
                ) : v.finalWinners?.length > 0 ? (
                  <div className="text-[0.85em] font-bold mb-2.5 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    Заголосован: {v.finalWinners.map(num => `#${num} ${tableOut[num - 1]?.login || ''}`).join(', ')}
                  </div>
                ) : (
                  <div className="text-[0.85em] text-white/40 mb-2.5">Никто не выбыл</div>
                )}

                {v.stages?.map((s, si) => (
                  <div key={si} className={si > 0 ? 'mt-2.5 pt-2.5 border-t border-white/[0.06]' : ''}>
                    <div className="text-[0.7em] font-black text-white/30 uppercase tracking-wider mb-1.5">
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
                            <div key={cNum} className="bg-white/[0.03] rounded-xl py-2 px-2.5">
                              <div className={`flex items-center justify-between ${voters.length > 0 ? 'mb-1' : ''}`}>
                                <span className="text-[0.85em] font-black text-yellow-400">
                                  #{cNum} {tableOut[Number(cNum) - 1]?.login || ''}
                                </span>
                                <span className="text-[0.8em] font-black text-accent">
                                  {voteCount} {voteCount === 1 ? 'голос' : voteCount >= 2 && voteCount <= 4 ? 'голоса' : 'голосов'}
                                </span>
                              </div>
                              {voters.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {voters.map(voterNum => (
                                    <span key={voterNum} className="text-[0.7em] font-bold text-white/50 bg-white/[0.06] py-0.5 px-1.5 rounded-md">
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
