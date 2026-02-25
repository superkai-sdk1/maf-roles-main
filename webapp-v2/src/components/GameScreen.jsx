import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { PlayerCard } from './PlayerCard';
import { VotingPanel } from './VotingPanel';
import { ResultsPanel } from './ResultsPanel';
import { SettingsPanel } from './SettingsPanel';
import { RolesPhase } from './RolesPhase';
import { NightPanel } from './NightPanel';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';

export function GameScreen() {
  const {
    gamePhase, setGamePhase, getPhaseLabel, getDaySubtitle,
    dayNumber, nightNumber,
    returnToMainMenu, setRolesDistributed, setEditRoles,
    tableOut, rolesDistributed,
    dayButtonBlink,
    handleGoToNight, setMode, advanceFromDiscussion, advanceFromFreeSeating,
    confirmRolesDistribution,
    discussionTimeLeft, discussionRunning, startDiscussionTimer, stopDiscussionTimer,
    freeSeatingTimeLeft, freeSeatingRunning, startFreeSeatingTimer, stopFreeSeatingTimer,
    nightPhase,
    showNoVotingAlert, setShowNoVotingAlert,
    showGoToNightPrompt, setShowGoToNightPrompt,
    winnerTeam,
    currentSpeaker, currentDaySpeakerIndex, startDaySpeakerFlow, nextDaySpeaker,
    activePlayers, isPlayerActive,
    killedPlayerBlink,
    gameFinished, setGameFinished, viewOnly, setViewOnly, cityMode,
    nominations, getNominatedCandidates,
    votingScreenTab, setVotingScreenTab,
    startVoting,
    currentGameNumber, gamesHistory,
  } = useGame();

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showVotingScreen, setShowVotingScreen] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [showResultsScreen, setShowResultsScreen] = useState(false);
  const [showRolesAlert, setShowRolesAlert] = useState(false);

  const handleSwipeBack = useCallback(() => {
    if (viewOnly) { returnToMainMenu(); return; }
    if (showVotingScreen) { setShowVotingScreen(false); setVotingScreenTab('voting'); }
    else if (showSettingsScreen) setShowSettingsScreen(false);
    else if (showResultsScreen) setShowResultsScreen(false);
    else if (showRolesAlert) setShowRolesAlert(false);
    else if (gameFinished) returnToMainMenu();
    else setShowExitConfirm(true);
  }, [viewOnly, showVotingScreen, showSettingsScreen, showResultsScreen, showRolesAlert, gameFinished, returnToMainMenu, setVotingScreenTab]);

  useSwipeBack(handleSwipeBack);

  useEffect(() => {
    if (gamePhase !== 'day' && showVotingScreen) {
      setShowVotingScreen(false);
    }
  }, [gamePhase, showVotingScreen]);

  useEffect(() => {
    if (viewOnly && gameFinished) {
      setShowResultsScreen(true);
    }
  }, [viewOnly, gameFinished]);

  const effectiveMode = gamePhase === 'night' ? 'night' : 'day';
  const phaseTitle = gamePhase === 'discussion'
    ? (cityMode ? 'Знакомство' : 'Договорка')
    : gamePhase === 'freeSeating'
    ? 'Свободная посадка'
    : null;

  const formatTimer = (t) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isTimerPhase = gamePhase === 'discussion' || gamePhase === 'freeSeating';
  const isGamePhase = gamePhase === 'day' || gamePhase === 'night';
  const timerTimeLeft = gamePhase === 'discussion' ? discussionTimeLeft : freeSeatingTimeLeft;
  const timerRunning = gamePhase === 'discussion' ? discussionRunning : freeSeatingRunning;
  const timerMax = gamePhase === 'discussion' ? 60 : (cityMode ? 20 : 40);
  const timerProgress = timerMax > 0 ? Math.max(0, Math.min(1, timerTimeLeft / timerMax)) : 0;

  return (
    <div className="h-[100dvh] bg-maf-bg max-w-[480px] mx-auto native-scroll" style={{ paddingTop: 'var(--safe-top, 0px)' }}>
      {/* === VOTING FULLSCREEN === */}
      {showVotingScreen && (
        <div className="fixed inset-0 z-40 bg-maf-bg native-scroll animate-fade-in">
          <div className="min-h-full" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
            <VotingPanel />
          </div>
          {createPortal(
            <nav className="fixed z-50 left-4 right-4 flex items-center justify-around rounded-3xl glass-surface shadow-nav-bar py-2 animate-nav-slide-in" style={{ bottom: 'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))' }}>
              <button className={`flex flex-col items-center gap-0.5 py-2 px-1 min-w-[60px] text-white/40 transition-all duration-300 ease-spring ${votingScreenTab === 'voting' ? 'text-white' : ''}`}
                onClick={() => { setVotingScreenTab('voting'); triggerHaptic('selection'); }}>
                <span className="text-2xl transition-all duration-300 ease-spring flex items-center justify-center">⚖</span>
                <span className="text-[0.55em] font-bold tracking-wider uppercase">Голосование</span>
              </button>
              <button className={`flex flex-col items-center gap-0.5 py-2 px-1 min-w-[60px] text-white/40 transition-all duration-300 ease-spring ${votingScreenTab === 'history' ? 'text-white' : ''}`}
                onClick={() => { setVotingScreenTab('history'); triggerHaptic('selection'); }}>
                <span className="text-2xl transition-all duration-300 ease-spring flex items-center justify-center">📋</span>
                <span className="text-[0.55em] font-bold tracking-wider uppercase">История</span>
              </button>
              <button className="flex flex-col items-center gap-0.5 py-2 px-1 min-w-[60px] text-white/40 transition-all duration-300 ease-spring"
                onClick={() => { setShowVotingScreen(false); setVotingScreenTab('voting'); triggerHaptic('light'); }}>
                <span className="text-2xl transition-all duration-300 ease-spring flex items-center justify-center">✕</span>
                <span className="text-[0.55em] font-bold tracking-wider uppercase">Закрыть</span>
              </button>
            </nav>,
            document.body
          )}
        </div>
      )}

      {/* === SETTINGS FULLSCREEN === */}
      {showSettingsScreen && (
        <div className="fixed inset-0 z-40 bg-maf-bg native-scroll animate-fade-in">
          <div className="min-h-full" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
            <div className="flex items-center gap-3 mb-4">
              <button className="text-accent text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring"
                onClick={() => { setShowSettingsScreen(false); triggerHaptic('light'); }}>
                ← Назад
              </button>
              <span className="text-accent text-xs font-bold tracking-[0.15em] uppercase">Настройки трансляции</span>
            </div>
            <SettingsPanel />
          </div>
        </div>
      )}

      {/* === RESULTS FULLSCREEN === */}
      {showResultsScreen && (
        <div className="fixed inset-0 z-40 bg-maf-bg native-scroll animate-fade-in">
          <div className="min-h-full" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
            <div className="flex items-center gap-3 mb-4">
              <button className="text-accent text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring"
                onClick={() => {
                  if (viewOnly) { returnToMainMenu(); }
                  else { setShowResultsScreen(false); }
                  triggerHaptic('light');
                }}>
                ← {viewOnly ? 'В меню' : 'Назад'}
              </button>
              <span className="text-accent text-xs font-bold tracking-[0.15em] uppercase">Итоги</span>
              {viewOnly && (
                <button className="text-accent text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring" style={{ marginLeft: 'auto' }}
                  onClick={() => { setViewOnly(false); setShowResultsScreen(false); triggerHaptic('medium'); }}>
                  Редактировать
                </button>
              )}
            </div>
            <ResultsPanel />
          </div>
        </div>
      )}

      {/* === MAIN GAME VIEW === */}
      {!showVotingScreen && !showSettingsScreen && !showResultsScreen && (
        <>
          {/* Roles validation alert */}
          {showRolesAlert && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setShowRolesAlert(false); }}>
              <div className="w-full max-w-[320px] glass-card-md rounded-3xl p-6 !shadow-glass-lg flex flex-col items-center text-center gap-3 animate-scale-in">
                <div className="text-4xl relative z-[1]">🎭</div>
                <div className="text-sm text-white/60 font-medium leading-relaxed">Невозможно начать договорку — проверьте роли</div>
                <div className="flex gap-3 w-full mt-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setShowRolesAlert(false); triggerHaptic('light'); }}>Понятно</button>
                </div>
              </div>
            </div>
          )}

          {/* Exit confirmation overlay */}
          {showExitConfirm && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setShowExitConfirm(false); }}>
              <div className="w-full max-w-[320px] glass-card-md rounded-3xl p-6 !shadow-glass-lg flex flex-col items-center text-center gap-3 animate-scale-in">
                <div className="text-4xl relative z-[1]">⚠️</div>
                <div className="text-sm text-white/60 font-medium leading-relaxed relative z-[1]">Выйти из игры? Прогресс будет сохранён.</div>
                <div className="flex gap-3 w-full mt-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => setShowExitConfirm(false)}>Остаться</button>
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { returnToMainMenu(); triggerHaptic('heavy'); }}>Выйти</button>
                </div>
              </div>
            </div>
          )}

          {/* No-voting alert overlay */}
          {showNoVotingAlert && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setShowNoVotingAlert(false); }}>
              <div className="w-full max-w-[320px] glass-card-md rounded-3xl p-6 !shadow-glass-lg flex flex-col items-center text-center gap-3 animate-scale-in">
                <div className="text-4xl relative z-[1]">⚠️</div>
                <div className="text-sm text-white/60 font-medium leading-relaxed relative z-[1]">В этом дне не было голосования. Вы уверены что хотите начать ночь?</div>
                <div className="flex gap-3 w-full mt-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setShowNoVotingAlert(false); triggerHaptic('light'); }}>Нет</button>
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setShowNoVotingAlert(false); setMode('night'); triggerHaptic('medium'); }}>Да</button>
                </div>
              </div>
            </div>
          )}

          {/* Go to night after all speeches */}
          {showGoToNightPrompt && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setShowGoToNightPrompt(false); }}>
              <div className="w-full max-w-[320px] glass-card-md rounded-3xl p-6 !shadow-glass-lg flex flex-col items-center text-center gap-3 animate-scale-in">
                <div className="text-4xl relative z-[1]">🌙</div>
                <div className="text-sm text-white/60 font-medium leading-relaxed">Все игроки высказались. Перейти в ночь?</div>
                <div className="flex gap-3 w-full mt-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setShowGoToNightPrompt(false); triggerHaptic('light'); }}>Нет</button>
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setShowGoToNightPrompt(false); handleGoToNight(); triggerHaptic('medium'); }}>Да</button>
                </div>
              </div>
            </div>
          )}

          {/* Game number indicator */}
          {currentGameNumber > 1 && (
            <div className="text-center mb-2 animate-fade-in">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg bg-accent-soft border border-accent-soft text-accent">Игра {currentGameNumber}</span>
            </div>
          )}

          {/* Phase label above table */}
          {phaseTitle && (
            <div className="text-center text-xs font-bold tracking-[0.15em] uppercase text-accent mb-3 animate-fade-in">{phaseTitle}</div>
          )}

          {/* Players list */}
          <div className="flex flex-col gap-3" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, env(safe-area-inset-bottom, 0px))) 16px' }}>
            {/* Roles phase */}
            {gamePhase === 'roles' && <RolesPhase />}

            {/* Roles slider — inline under table */}
            {gamePhase === 'roles' && !rolesDistributed && (
              <div className="mt-3 animate-fade-in">
                <SlideConfirm label="Начать договорку" onConfirm={() => {
                  const r = confirmRolesDistribution();
                  if (!r.valid) { setShowRolesAlert(true); triggerHaptic('warning'); }
                  else triggerHaptic('success');
                }} color="violet" compact />
              </div>
            )}

            {/* Inline timer card (discussion / free seating) */}
            {rolesDistributed && isTimerPhase && !winnerTeam && (
              <div className={`relative rounded-2xl overflow-hidden glass-card-md mb-3 ${timerTimeLeft <= 10 && timerRunning ? '!border-red-500/20 !shadow-[0_0_20px_rgba(255,69,58,0.08)]' : ''}`}>
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-color)] to-indigo-500/80 transition-[width] duration-500 ease-linear opacity-30" style={{ width: `${timerProgress * 100}%` }} />
                <div className="relative z-[1] flex items-center justify-between px-4 py-3">
                  <div className={`text-2xl font-extrabold tabular-nums text-white/70 ${timerTimeLeft <= 10 && timerRunning ? 'text-red-400 animate-timer-pulse' : ''}`}>
                    {formatTimer(timerTimeLeft)}
                  </div>
                  <div>
                    {!timerRunning ? (
                      <button className="px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-gradient-to-r from-[rgba(168,85,247,0.5)] to-[rgba(99,102,241,0.5)] text-white border border-[rgba(168,85,247,0.3)] shadow-[0_0_12px_rgba(168,85,247,0.25)]" onClick={() => {
                        if (gamePhase === 'discussion') startDiscussionTimer();
                        else startFreeSeatingTimer();
                        triggerHaptic('light');
                      }}>Старт</button>
                    ) : (
                      <button className="px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-amber-500/15 text-amber-400 border border-amber-500/25" onClick={() => {
                        if (gamePhase === 'discussion') stopDiscussionTimer();
                        else stopFreeSeatingTimer();
                        triggerHaptic('light');
                      }}>Пауза</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Day speaker indicator */}
            {gamePhase === 'day' && currentSpeaker && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl glass-card mb-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">#{currentSpeaker.num} {currentSpeaker.login || `Игрок ${currentSpeaker.num}`}</span>
                  <span className="text-xs text-white/40 font-medium">{currentDaySpeakerIndex + 1}/{activePlayers?.length}</span>
                </div>
                <button className="px-4 py-2.5 rounded-xl bg-accent text-white border border-white/[0.08] text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring" onClick={nextDaySpeaker}>Далее</button>
              </div>
            )}

            {/* Night phase indicator */}
            {gamePhase === 'night' && (
              <div className="text-center text-sm font-bold text-indigo-400 tracking-wider py-3 mb-1">
                {nightPhase === 'kill' || nightPhase === null ? 'Мафия стреляет' :
                 nightPhase === 'don' ? 'Дон проверяет' :
                 nightPhase === 'sheriff' ? 'Шериф проверяет' :
                 nightPhase === 'doctor' ? 'Доктор лечит' :
                 nightPhase === 'done' ? 'Ночь завершена' : `Ночь ${nightNumber}`}
              </div>
            )}

            {gamePhase === 'night' && <NightPanel />}

            {/* Player cards (day, discussion, freeSeating — not night) */}
            {(gamePhase === 'day' || gamePhase === 'discussion' || gamePhase === 'freeSeating') && (
              <div className="animate-stagger flex flex-col gap-2.5">
                {tableOut.map(p => (
                  <PlayerCard key={p.roleKey} player={p} mode={effectiveMode}
                    isSpeaking={currentSpeaker?.roleKey === p.roleKey}
                    isBlinking={killedPlayerBlink?.[p.roleKey]}
                  />
                ))}
              </div>
            )}

            {/* Discussion/FreeSeating — inline skip slider + back button */}
            {rolesDistributed && isTimerPhase && !winnerTeam && (
              <div className="flex flex-col gap-3 mt-3 animate-fade-in">
                <div className="mt-3">
                  <SlideConfirm
                    label={
                      gamePhase === 'discussion'
                        ? (discussionTimeLeft <= 0
                            ? (cityMode ? 'Завершить знакомство' : 'Завершить договорку')
                            : (cityMode ? 'Пропустить знакомство' : 'Пропустить договорку'))
                        : (freeSeatingTimeLeft <= 0 ? 'Утро' : 'Пропустить свободную посадку')
                    }
                    onConfirm={() => {
                      if (gamePhase === 'discussion') advanceFromDiscussion();
                      else advanceFromFreeSeating();
                      triggerHaptic('light');
                    }}
                    color="amber"
                    compact
                  />
                </div>
                <button className="text-center text-white/40 text-xs font-bold py-2 active:scale-95 transition-transform duration-150 ease-spring" onClick={() => {
                  if (gamePhase === 'freeSeating') {
                    stopFreeSeatingTimer();
                    setGamePhase('discussion');
                    triggerHaptic('light');
                  } else if (gamePhase === 'discussion') {
                    stopDiscussionTimer();
                    setRolesDistributed(false);
                    setEditRoles(true);
                    setGamePhase('roles');
                    triggerHaptic('light');
                  }
                }}>
                  ← {gamePhase === 'freeSeating' ? 'Назад к договорке' : 'Назад к раздаче'}
                </button>
              </div>
            )}

            {/* Voting button (day only) */}
            {gamePhase === 'day' && rolesDistributed && !winnerTeam && (
              <div className="mt-3">
                <button className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-base font-bold active:scale-[0.97] transition-transform duration-150 ease-spring w-full" onClick={() => {
                  const cands = getNominatedCandidates();
                  if (cands.length > 0) { startVoting(); setVotingScreenTab('voting'); }
                  else { setVotingScreenTab('history'); }
                  setShowVotingScreen(true); triggerHaptic('medium');
                }}>
                  ⚖ Голосование
                </button>
              </div>
            )}

            {/* Inline slider: Day → Night */}
            {gamePhase === 'day' && rolesDistributed && !winnerTeam && (
              <div className="mt-3 animate-fade-in">
                <SlideConfirm
                  label={`Перейти в ночь ${(nightNumber || 0) + 1}`}
                  onConfirm={() => { handleGoToNight(); triggerHaptic('medium'); }}
                  color={dayButtonBlink ? 'amber' : 'night'}
                  compact
                />
              </div>
            )}

            {/* Game action buttons */}
            {rolesDistributed && (gamePhase === 'day' || gamePhase === 'night') && !viewOnly && (
              <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-white/[0.06]">
                {!gameFinished && (
                  <SlideConfirm
                    label="Закончить игру"
                    onConfirm={() => { setGameFinished(true); setShowResultsScreen(true); triggerHaptic('heavy'); }}
                    color="red"
                    compact
                  />
                )}
                <button className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring w-full" onClick={() => { setShowSettingsScreen(true); triggerHaptic('light'); }}>
                  ⚙ Настройки трансляции
                </button>
                {(winnerTeam || gameFinished) && (
                  <button className="px-4 py-2.5 rounded-xl bg-[rgba(255,214,10,0.08)] border border-[rgba(255,214,10,0.2)] text-[#ffd60a] text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring w-full" onClick={() => { setShowResultsScreen(true); triggerHaptic('light'); }}>
                    🏆 Итоги
                  </button>
                )}
                <button className="px-4 py-2.5 rounded-xl bg-[rgba(255,69,58,0.08)] border border-[rgba(255,69,58,0.2)] text-[#ff453a] text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring w-full" onClick={() => {
                  if (gameFinished) returnToMainMenu();
                  else { setShowExitConfirm(true); triggerHaptic('warning'); }
                }}>
                  ← {gameFinished ? 'В меню' : 'Выход'}
                </button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
