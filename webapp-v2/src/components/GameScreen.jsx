import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { PlayerCard } from './PlayerCard';
import { VotingPanel } from './VotingPanel';
import { ResultsPanel } from './ResultsPanel';
import { SettingsPanel } from './SettingsPanel';
import { RolesPhase } from './RolesPhase';
import { NightPanel } from './NightPanel';
import { InertiaSlider } from './InertiaSlider';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { Gavel, Moon, Sun, X, MonitorPlay, LogOut, Trophy, Play, SkipForward, Share2, Users } from 'lucide-react';
import { useToast } from './Toast';
import { goMafiaApi } from '../services/api';

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
    discussionEndPrompt, setDiscussionEndPrompt, skipVotingAndGoToNight,
    doborActive, doborTimeLeft, doborRunning,
    startDoborTimer, stopDoborTimer, finishDobor,
    commonMinuteActive, commonMinuteTimeLeft, commonMinuteRunning,
    startCommonMinuteTimer, stopCommonMinuteTimer, finishCommonMinute,
    winnerTeam,
    currentSpeaker, currentDaySpeakerIndex, startDaySpeakerFlow, nextDaySpeaker,
    activePlayers, isPlayerActive, daySpeakerStartNum,
    killedPlayerBlink,
    gameFinished, setGameFinished, viewOnly, setViewOnly, isArchived, cityMode, gameMode,
    nominations, getNominatedCandidates,
    votingScreenTab, setVotingScreenTab,
    startVoting,
    currentGameNumber, gamesHistory,
    players, roles, playersActions, fouls, techFouls, removed, avatars,
    nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer,
    playerScores, protocolData, opinionData, opinionText,
    doctorHealHistory, nightMisses, killedOnNight, dayVoteOuts,
    tournamentName, gameSelected, tableSelected,
  } = useGame();

  const { showToast } = useToast();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showVotingScreen, setShowVotingScreen] = useState(false);
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [showResultsScreen, setShowResultsScreen] = useState(false);
  const [showRolesAlert, setShowRolesAlert] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const currentGame = {
        gameNumber: currentGameNumber,
        gameSelected, tableSelected,
        players: [...players],
        roles: { ...roles },
        playersActions: { ...playersActions },
        fouls: { ...fouls },
        techFouls: { ...techFouls },
        removed: { ...removed },
        avatars: { ...avatars },
        dayNumber, nightNumber,
        nightCheckHistory: [...nightCheckHistory],
        votingHistory: [...votingHistory],
        bestMove: [...bestMove],
        bestMoveAccepted,
        firstKilledPlayer,
        winnerTeam,
        playerScores: { ...playerScores },
        protocolData: { ...protocolData },
        opinionData: { ...opinionData },
        opinionText: { ...(opinionText || {}) },
        doctorHealHistory: [...doctorHealHistory],
        nightMisses: { ...nightMisses },
        killedOnNight: { ...killedOnNight },
        dayVoteOuts: { ...dayVoteOuts },
        cityMode,
      };

      const payload = {
        tournamentName: tournamentName || '',
        gameMode: gameMode || 'manual',
        currentGame,
        gamesHistory,
      };

      const result = await goMafiaApi.saveShare(payload);
      if (!result?.id) {
        const errMsg = result?.error || 'Неизвестная ошибка';
        console.error('Share save failed:', errMsg);
        showToast(`Не удалось создать ссылку: ${errMsg}`, { type: 'error' });
        return;
      }

      const shareUrl = `${window.location.origin}/share/${result.id}`;
      const tg = window.Telegram?.WebApp;
      const shareText = `${tournamentName ? tournamentName + ' — ' : ''}Результаты серии MafBoard`;

      if (tg && (tg.openTelegramLink || tg.shareUrl)) {
        if (typeof tg.shareUrl === 'function') {
          tg.shareUrl(shareUrl, shareText);
        } else {
          tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
        }
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast('Ссылка скопирована!', { type: 'success' });
        } catch {
          const input = document.createElement('input');
          input.value = shareUrl;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          showToast('Ссылка скопирована!', { type: 'success' });
        }
      }
      triggerHaptic('success');
    } catch (e) {
      console.error('Share error:', e);
      showToast('Ошибка при создании ссылки', { type: 'error' });
      triggerHaptic('error');
    } finally {
      setSharing(false);
    }
  }, [sharing, currentGameNumber, gameSelected, tableSelected, players, roles, playersActions, fouls, techFouls, removed, avatars, dayNumber, nightNumber, nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer, winnerTeam, playerScores, protocolData, opinionData, opinionText, doctorHealHistory, nightMisses, killedOnNight, dayVoteOuts, cityMode, tournamentName, gameMode, gamesHistory, showToast]);

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
    <div className="h-[100dvh] max-w-[480px] mx-auto native-scroll" style={{ paddingTop: 'var(--safe-top, 0px)' }}>
      {/* === VOTING FULLSCREEN === */}
      {showVotingScreen && (
        <div className="fixed inset-0 z-40 native-scroll animate-fade-in" style={{ background: 'var(--maf-gradient-bg)' }}>
          <div className="min-h-full max-w-[480px] mx-auto" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
            <VotingPanel />
          </div>
          {createPortal(
            <nav className="fixed z-50 left-0 right-0 max-w-[448px] mx-auto flex items-center justify-around rounded-3xl glass-surface shadow-nav-bar py-2 animate-nav-slide-in" style={{ bottom: 'calc(16px + var(--safe-bottom, 0px))' }}>
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
        <div className="fixed inset-0 z-40 native-scroll animate-fade-in" style={{ background: 'var(--maf-gradient-bg)' }}>
          <div className="min-h-full max-w-[480px] mx-auto" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
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
        <div className="fixed inset-0 z-40 native-scroll animate-fade-in" style={{ background: 'var(--maf-gradient-bg)' }}>
          <div className="min-h-full max-w-[480px] mx-auto" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
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
              {viewOnly && !isArchived && (
                <button className="text-accent text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring" style={{ marginLeft: 'auto' }}
                  onClick={() => { setViewOnly(false); setShowResultsScreen(false); triggerHaptic('medium'); }}>
                  Редактировать
                </button>
              )}
              {viewOnly && isArchived && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[0.65em] font-bold text-white/35 tracking-wider uppercase">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  только чтение
                </span>
              )}
              {winnerTeam && (
                <button
                  className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${sharing ? 'bg-white/[0.04] border border-white/[0.06] text-white/30' : 'bg-accent/15 border border-accent/25 text-accent'}`}
                  onClick={handleShare}
                  disabled={sharing}
                >
                  {sharing ? (
                    <div className="w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  {sharing ? 'Создаём...' : 'Поделиться'}
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
                <div className="text-sm text-white/60 font-medium leading-relaxed">Невозможно начать {cityMode ? 'знакомство' : 'договорку'} — проверьте роли</div>
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

          {/* Discussion end prompt */}
          {discussionEndPrompt && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setDiscussionEndPrompt(null); }}>
              <div className="w-full max-w-[340px] glass-card-md rounded-3xl p-6 !shadow-glass-lg flex flex-col items-center text-center gap-3 animate-scale-in">
                {discussionEndPrompt.type === 'vote' && (
                  <>
                    <div className="text-4xl relative z-[1]">⚖️</div>
                    <div className="text-sm text-white/60 font-medium leading-relaxed">
                      Обсуждение окончено. На голосовании: [{discussionEndPrompt.candidates.join(', ')}].
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setDiscussionEndPrompt(null); triggerHaptic('light'); }}>Отмена</button>
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setDiscussionEndPrompt(null); startVoting(discussionEndPrompt.candidates); setVotingScreenTab('voting'); setShowVotingScreen(true); triggerHaptic('medium'); }}>Начать голосование</button>
                    </div>
                  </>
                )}
                {discussionEndPrompt.type === 'city-day1-no-vote' && (
                  <>
                    <div className="text-4xl relative z-[1]">🏛️</div>
                    <div className="text-sm text-white/60 font-medium leading-relaxed">
                      В первый день голосование не проводится. Город засыпает.
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setDiscussionEndPrompt(null); triggerHaptic('light'); }}>Отмена</button>
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setDiscussionEndPrompt(null); skipVotingAndGoToNight([]); triggerHaptic('medium'); }}>Начать ночь</button>
                    </div>
                  </>
                )}
                {discussionEndPrompt.type === 'day1-single' && (
                  <>
                    <div className="text-4xl relative z-[1]">🛡️</div>
                    <div className="text-sm text-white/60 font-medium leading-relaxed">
                      Выставлен только игрок №{discussionEndPrompt.candidates[0]}. Согласно правилам в режиме {gameMode === 'funky' ? 'Фанки' : 'GoMafia'}, в 1-й день голосование за одного не проводится.
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setDiscussionEndPrompt(null); triggerHaptic('light'); }}>Отмена</button>
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setDiscussionEndPrompt(null); skipVotingAndGoToNight(discussionEndPrompt.candidates); triggerHaptic('medium'); }}>Начать ночь</button>
                    </div>
                  </>
                )}
                {discussionEndPrompt.type === 'no-candidates' && (
                  <>
                    <div className="text-4xl relative z-[1]">🌙</div>
                    <div className="text-sm text-white/60 font-medium leading-relaxed">
                      Кандидатуры не выдвинуты. Город засыпает.
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.04] border border-white/[0.08] text-white/60" onClick={() => { setDiscussionEndPrompt(null); triggerHaptic('light'); }}>Отмена</button>
                      <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-accent text-white" onClick={() => { setDiscussionEndPrompt(null); skipVotingAndGoToNight([]); triggerHaptic('medium'); }}>Начать ночь</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Archive badge */}
          {viewOnly && isArchived && (
            <div className="text-center mb-2 animate-fade-in">
              <span className="inline-flex items-center gap-1.5 text-[0.7em] font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/30">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Только чтение — История
              </span>
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

          {/* City day sub-phase labels */}
          {cityMode && doborActive && gamePhase === 'day' && (
            <div className="text-center text-xs font-bold tracking-[0.15em] uppercase text-amber-400 mb-3 animate-fade-in">Добор 1-го игрока</div>
          )}
          {/* commonMinuteActive is rendered as a card inside the player list */}

          {/* Players list */}
          <div className="flex flex-col gap-3" style={{ padding: '16px 16px calc(120px + var(--safe-bottom, 0px)) 16px' }}>
            {/* Roles phase */}
            {gamePhase === 'roles' && <RolesPhase />}

            {/* Roles slider — inline under table */}
            {gamePhase === 'roles' && !rolesDistributed && (
              <div className="mt-3 animate-fade-in">
                <InertiaSlider
                  label={cityMode ? 'Начать знакомство' : 'Начать договорку'}
                  baseColor="bg-gradient-to-br from-violet-500 to-indigo-600"
                  glowColor="shadow-violet-500/50"
                  onComplete={() => {
                    const r = confirmRolesDistribution();
                    if (!r.valid) { setShowRolesAlert(true); triggerHaptic('warning'); }
                    else triggerHaptic('success');
                  }}
                  icon={<Play size={18} fill="white" />}
                  compact
                />
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
                    isNextSpeaker={gamePhase === 'day' && currentDaySpeakerIndex === -1 && p.num === daySpeakerStartNum && !winnerTeam}
                  />
                ))}

                {/* Общая минута — rendered as a card in the player list */}
                {cityMode && commonMinuteActive && gamePhase === 'day' && (
                  <CommonMinuteCard
                    timeLeft={commonMinuteTimeLeft}
                    isRunning={commonMinuteRunning}
                    onStart={() => { startCommonMinuteTimer(); triggerHaptic('light'); }}
                    onPause={() => { stopCommonMinuteTimer(); triggerHaptic('light'); }}
                    onFinish={() => finishCommonMinute()}
                  />
                )}
              </div>
            )}

            {/* Discussion/FreeSeating — inline skip slider + back button */}
            {rolesDistributed && isTimerPhase && !winnerTeam && (
              <div className="flex flex-col gap-3 mt-3 pb-16 animate-fade-in">
                <div className="mt-3">
                  <InertiaSlider
                    label={
                      gamePhase === 'discussion'
                        ? (discussionTimeLeft <= 0
                            ? (cityMode ? 'Завершить знакомство' : 'Завершить договорку')
                            : (cityMode ? 'Пропустить знакомство' : 'Пропустить договорку'))
                        : (freeSeatingTimeLeft <= 0 ? 'Утро' : 'Пропустить свободную')
                    }
                    baseColor="bg-gradient-to-br from-amber-400 to-orange-500"
                    glowColor="shadow-amber-500/50"
                    onComplete={() => {
                      if (gamePhase === 'discussion') advanceFromDiscussion();
                      else advanceFromFreeSeating();
                      triggerHaptic('light');
                    }}
                    icon={<SkipForward size={18} fill="white" />}
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

            {/* Control panel */}
            {rolesDistributed && (gamePhase === 'day' || gamePhase === 'night') && (
              <div className="relative mt-6 group">
                <div className="absolute -inset-1 bg-gradient-to-b from-indigo-500/10 to-transparent rounded-[2.5rem] blur-xl opacity-50" />
                <div className="relative bg-[#16102b]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-6">

                  {/* Voting (day only) */}
                  {gamePhase === 'day' && !winnerTeam && (
                    <button
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 group/btn shadow-lg"
                      onClick={() => {
                        const cands = getNominatedCandidates();
                        if (cands.length > 0) { startVoting(); setVotingScreenTab('voting'); }
                        else { setVotingScreenTab('history'); }
                        setShowVotingScreen(true); triggerHaptic('medium');
                      }}
                    >
                      <div className="text-white/50 group-hover/btn:text-white transition-colors">
                        <Gavel size={20} />
                      </div>
                      <span className="text-sm font-bold tracking-wide text-white/80">Открыть голосование</span>
                    </button>
                  )}

                  {/* Phase transition slider */}
                  {!winnerTeam && (
                    <div className="space-y-2">
                      <div className="flex justify-between px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                        <span>Текущая фаза: {gamePhase === 'day' ? `День ${dayNumber || 1}` : `Ночь ${nightNumber || 1}`}</span>
                      </div>
                      {gamePhase === 'day' && (
                        <InertiaSlider
                          label={`Перейти в ночь ${(nightNumber || 0) + 1}`}
                          baseColor="bg-gradient-to-br from-indigo-500 to-purple-600"
                          glowColor="shadow-indigo-500/50"
                          onComplete={() => { handleGoToNight(); triggerHaptic('medium'); }}
                          icon={<Moon size={22} fill="white" />}
                        />
                      )}
                      {gamePhase === 'night' && dayButtonBlink && (
                        <InertiaSlider
                          label={`Вернуться в день ${(dayNumber || 0) + 1}`}
                          baseColor="bg-gradient-to-br from-amber-400 to-orange-600"
                          glowColor="shadow-orange-500/50"
                          onComplete={() => { setMode('day'); triggerHaptic('medium'); }}
                          icon={<Sun size={22} fill="white" />}
                        />
                      )}
                    </div>
                  )}

                  {/* End game + Stream settings */}
                  {!viewOnly && (
                    <div className="flex items-center gap-3">
                      {!gameFinished && (
                        <div className="flex-1">
                          <InertiaSlider
                            compact
                            label="Завершить игру"
                            baseColor="bg-gradient-to-r from-red-500/80 to-red-800/80"
                            glowColor="shadow-red-500/20"
                            onComplete={() => { setGameFinished(true); setShowResultsScreen(true); triggerHaptic('heavy'); }}
                            icon={<X size={16} strokeWidth={3} />}
                          />
                        </div>
                      )}
                      <button
                        className="flex items-center gap-2 h-[52px] px-5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
                        onClick={() => { setShowSettingsScreen(true); triggerHaptic('light'); }}
                      >
                        <MonitorPlay size={18} />
                        <span className="text-xs font-bold">Стрим</span>
                      </button>
                    </div>
                  )}

                  {/* Results */}
                  {(winnerTeam || gameFinished) && (
                    <button
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 border-[rgba(255,214,10,0.3)] bg-[rgba(255,214,10,0.08)] hover:bg-[rgba(255,214,10,0.15)] group/btn shadow-lg"
                      onClick={() => { setShowResultsScreen(true); triggerHaptic('light'); }}
                    >
                      <div className="text-[#ffd60a]/60 group-hover/btn:text-[#ffd60a] transition-colors">
                        <Trophy size={20} />
                      </div>
                      <span className="text-sm font-bold tracking-wide text-[#ffd60a]/80">Итоги</span>
                    </button>
                  )}

                  {/* Exit */}
                  <button
                    className="w-full flex items-center justify-center gap-2 py-2 mt-2 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/5 transition-all text-[10px] font-black uppercase tracking-[0.3em]"
                    onClick={() => {
                      if (gameFinished) returnToMainMenu();
                      else { setShowExitConfirm(true); triggerHaptic('warning'); }
                    }}
                  >
                    <LogOut size={14} />
                    {gameFinished ? 'В меню' : 'Выйти'}
                  </button>

                </div>
              </div>
            )}

          </div>
        </>
      )}

      {/* Fixed bottom timer bar (Добор — City Day 1) */}
      {doborActive && gamePhase === 'day' && createPortal(
        <div
          className="fixed z-30 left-0 right-0 max-w-[480px] mx-auto px-4 animate-nav-slide-in"
          style={{ bottom: 'calc(12px + var(--safe-bottom, 0px))' }}
        >
          <div className={`relative rounded-2xl overflow-hidden backdrop-blur-2xl border border-white/10 shadow-2xl transition-all duration-300 ${doborTimeLeft <= 10 && doborRunning ? '!border-red-500/25 !shadow-[0_0_24px_rgba(255,69,58,0.15)]' : ''}`}
            style={{ background: 'rgba(22,16,43,0.9)' }}>
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500/80 transition-[width] duration-500 ease-linear opacity-25 rounded-2xl" style={{ width: `${Math.max(0, Math.min(1, doborTimeLeft / 30)) * 100}%` }} />
            <div className="relative z-[1] flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-extrabold tabular-nums ${doborTimeLeft <= 10 && doborRunning ? 'text-red-400 animate-timer-pulse' : 'text-white/80'}`}>
                  {formatTimer(doborTimeLeft)}
                </div>
                <div className="text-[0.6rem] font-bold uppercase tracking-widest text-white/30">
                  Добор 1-го
                </div>
              </div>
              <div className="flex gap-2">
                {!doborRunning ? (
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-gradient-to-r from-[rgba(168,85,247,0.5)] to-[rgba(99,102,241,0.5)] text-white border border-[rgba(168,85,247,0.3)] shadow-[0_0_12px_rgba(168,85,247,0.25)]" onClick={() => {
                    startDoborTimer();
                    triggerHaptic('light');
                  }}>Старт</button>
                ) : (
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-amber-500/15 text-amber-400 border border-amber-500/25" onClick={() => {
                    stopDoborTimer();
                    triggerHaptic('light');
                  }}>Пауза</button>
                )}
                <button className="px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-white/[0.06] border border-white/[0.10] text-white/60" onClick={() => {
                  finishDobor();
                }}>Далее</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Общая минута timer bar removed — now rendered as a card in the player list */}

      {/* Fixed bottom timer bar (discussion / free seating) */}
      {rolesDistributed && isTimerPhase && !winnerTeam && createPortal(
        <div
          className="fixed z-30 left-0 right-0 max-w-[480px] mx-auto px-4 animate-nav-slide-in"
          style={{ bottom: 'calc(12px + var(--safe-bottom, 0px))' }}
        >
          <div className={`relative rounded-2xl overflow-hidden backdrop-blur-2xl border border-white/10 shadow-2xl transition-all duration-300 ${timerTimeLeft <= 10 && timerRunning ? '!border-red-500/25 !shadow-[0_0_24px_rgba(255,69,58,0.15)]' : ''}`}
            style={{ background: 'rgba(22,16,43,0.9)' }}>
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-color)] to-indigo-500/80 transition-[width] duration-500 ease-linear opacity-25 rounded-2xl" style={{ width: `${timerProgress * 100}%` }} />
            <div className="relative z-[1] flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-extrabold tabular-nums ${timerTimeLeft <= 10 && timerRunning ? 'text-red-400 animate-timer-pulse' : 'text-white/80'}`}>
                  {formatTimer(timerTimeLeft)}
                </div>
                <div className="text-[0.6rem] font-bold uppercase tracking-widest text-white/30">
                  {phaseTitle}
                </div>
              </div>
              <div>
                {!timerRunning ? (
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-gradient-to-r from-[rgba(168,85,247,0.5)] to-[rgba(99,102,241,0.5)] text-white border border-[rgba(168,85,247,0.3)] shadow-[0_0_12px_rgba(168,85,247,0.25)]" onClick={() => {
                    if (gamePhase === 'discussion') startDiscussionTimer();
                    else startFreeSeatingTimer();
                    triggerHaptic('light');
                  }}>Старт</button>
                ) : (
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring bg-amber-500/15 text-amber-400 border border-amber-500/25" onClick={() => {
                    if (gamePhase === 'discussion') stopDiscussionTimer();
                    else stopFreeSeatingTimer();
                    triggerHaptic('light');
                  }}>Пауза</button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function CommonMinuteCard({ timeLeft, isRunning, onStart, onPause, onFinish }) {
  const cardRef = useRef(null);
  const isLow = timeLeft <= 10 && isRunning;
  const progress = Math.max(0, Math.min(1, timeLeft / 60));

  useEffect(() => {
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative bg-white/[0.08] rounded-[28px] p-5 shadow-2xl border border-indigo-500/30 backdrop-blur-3xl ring-1 ring-indigo-500/10
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden animate-fade-in
        bg-gradient-to-br from-indigo-500/[0.06] to-violet-500/[0.04]"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center border border-indigo-400/30 shadow-lg shadow-indigo-500/20">
            <Users className="w-6 h-6 text-white/90" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Общая минута</h2>
            <div className="flex items-center gap-1.5 text-indigo-400 mt-0.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Все игроки — 60 секунд</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center py-2">
          <div className={`text-[80px] font-black leading-none tracking-tighter tabular-nums mb-2 select-none ${
            isLow ? 'text-rose-500 animate-pulse'
              : isRunning ? 'text-white'
              : timeLeft === 0 ? 'text-red-400/60 animate-timer-blink' : 'text-white/60'
          }`}>
            {timeLeft}
          </div>

          <div className="w-full max-w-[200px] h-1 bg-white/5 rounded-full overflow-hidden mb-5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isLow ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : isRunning ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-white/10'
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="flex gap-3">
            {!isRunning ? (
              <button
                className="px-7 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-500/25"
                onClick={onStart}
              >Старт</button>
            ) : (
              <button
                className="px-7 py-3 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-2xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
                onClick={onPause}
              >Пауза</button>
            )}
          </div>
        </div>

        <button
          className="w-full px-4 py-3.5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
          onClick={onFinish}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
