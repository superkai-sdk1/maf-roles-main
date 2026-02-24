import React, { useState, useEffect } from 'react';
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
    gameFinished, setGameFinished, cityMode,
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

  useEffect(() => {
    if (gamePhase !== 'day' && showVotingScreen) {
      setShowVotingScreen(false);
    }
  }, [gamePhase, showVotingScreen]);

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
    <div className="game-screen-root">
      {/* === VOTING FULLSCREEN === */}
      {showVotingScreen && (
        <div className="fullscreen-page animate-fadeIn">
          <div className="fullscreen-page-container">
            <VotingPanel />
          </div>
          {createPortal(
            <nav className="main-nav-bar">
              <button className={`nav-item ${votingScreenTab === 'voting' ? 'active' : ''}`}
                onClick={() => { setVotingScreenTab('voting'); triggerHaptic('selection'); }}>
                <span className="nav-item-icon">⚖</span>
                <span className="nav-item-label">Голосование</span>
              </button>
              <button className={`nav-item ${votingScreenTab === 'history' ? 'active' : ''}`}
                onClick={() => { setVotingScreenTab('history'); triggerHaptic('selection'); }}>
                <span className="nav-item-icon">📋</span>
                <span className="nav-item-label">История</span>
              </button>
              <button className="nav-item"
                onClick={() => { setShowVotingScreen(false); setVotingScreenTab('voting'); triggerHaptic('light'); }}>
                <span className="nav-item-icon">✕</span>
                <span className="nav-item-label">Закрыть</span>
              </button>
            </nav>,
            document.body
          )}
        </div>
      )}

      {/* === SETTINGS FULLSCREEN === */}
      {showSettingsScreen && (
        <div className="fullscreen-page animate-fadeIn">
          <div className="fullscreen-page-container">
            <div className="fullscreen-page-header">
              <button className="fullscreen-back-btn"
                onClick={() => { setShowSettingsScreen(false); triggerHaptic('light'); }}>
                ← Назад
              </button>
              <span className="fullscreen-page-title">Настройки трансляции</span>
            </div>
            <SettingsPanel />
          </div>
        </div>
      )}

      {/* === RESULTS FULLSCREEN === */}
      {showResultsScreen && (
        <div className="fullscreen-page animate-fadeIn">
          <div className="fullscreen-page-container">
            <div className="fullscreen-page-header">
              <button className="fullscreen-back-btn"
                onClick={() => { setShowResultsScreen(false); triggerHaptic('light'); }}>
                ← Назад
              </button>
              <span className="fullscreen-page-title">Итоги</span>
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
            <div className="no-voting-alert-overlay animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) setShowRolesAlert(false); }}>
              <div className="no-voting-alert-card">
                <div className="no-voting-alert-icon">🎭</div>
                <div className="no-voting-alert-text">Невозможно начать договорку — проверьте роли</div>
                <div className="no-voting-alert-buttons">
                  <button className="no-voting-alert-btn no-voting-alert-btn--yes" onClick={() => { setShowRolesAlert(false); triggerHaptic('light'); }}>Понятно</button>
                </div>
              </div>
            </div>
          )}

          {/* Exit confirmation overlay */}
          {showExitConfirm && (
            <div className="no-voting-alert-overlay animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) setShowExitConfirm(false); }}>
              <div className="no-voting-alert-card">
                <div className="no-voting-alert-icon">⚠️</div>
                <div className="no-voting-alert-text">Выйти из игры? Прогресс будет сохранён.</div>
                <div className="no-voting-alert-buttons">
                  <button className="no-voting-alert-btn no-voting-alert-btn--no" onClick={() => setShowExitConfirm(false)}>Остаться</button>
                  <button className="no-voting-alert-btn no-voting-alert-btn--yes" onClick={() => { returnToMainMenu(); triggerHaptic('heavy'); }}>Выйти</button>
                </div>
              </div>
            </div>
          )}

          {/* No-voting alert overlay */}
          {showNoVotingAlert && (
            <div className="no-voting-alert-overlay animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) setShowNoVotingAlert(false); }}>
              <div className="no-voting-alert-card">
                <div className="no-voting-alert-icon">⚠️</div>
                <div className="no-voting-alert-text">В этом дне не было голосования. Вы уверены что хотите начать ночь?</div>
                <div className="no-voting-alert-buttons">
                  <button className="no-voting-alert-btn no-voting-alert-btn--no" onClick={() => { setShowNoVotingAlert(false); triggerHaptic('light'); }}>Нет</button>
                  <button className="no-voting-alert-btn no-voting-alert-btn--yes" onClick={() => { setShowNoVotingAlert(false); setMode('night'); triggerHaptic('medium'); }}>Да</button>
                </div>
              </div>
            </div>
          )}

          {/* Go to night after all speeches */}
          {showGoToNightPrompt && (
            <div className="no-voting-alert-overlay animate-fadeIn" onClick={(e) => { if (e.target === e.currentTarget) setShowGoToNightPrompt(false); }}>
              <div className="no-voting-alert-card">
                <div className="no-voting-alert-icon">🌙</div>
                <div className="no-voting-alert-text">Все игроки высказались. Перейти в ночь?</div>
                <div className="no-voting-alert-buttons">
                  <button className="no-voting-alert-btn no-voting-alert-btn--no" onClick={() => { setShowGoToNightPrompt(false); triggerHaptic('light'); }}>Нет</button>
                  <button className="no-voting-alert-btn no-voting-alert-btn--yes" onClick={() => { setShowGoToNightPrompt(false); handleGoToNight(); triggerHaptic('medium'); }}>Да</button>
                </div>
              </div>
            </div>
          )}

          {/* Game number indicator */}
          {currentGameNumber > 1 && (
            <div className="game-number-indicator animate-fadeIn">
              Игра {currentGameNumber}
            </div>
          )}

          {/* Phase label above table */}
          {phaseTitle && (
            <div className="phase-label-above-table animate-fadeIn">{phaseTitle}</div>
          )}

          {/* Players list */}
          <div className="players-list">
            {/* Roles phase */}
            {gamePhase === 'roles' && <RolesPhase />}

            {/* Roles slider — inline under table */}
            {gamePhase === 'roles' && !rolesDistributed && (
              <div className="inline-slider-wrap animate-fadeIn">
                <SlideConfirm label="Начать договорку" onConfirm={() => {
                  const r = confirmRolesDistribution();
                  if (!r.valid) { setShowRolesAlert(true); triggerHaptic('warning'); }
                  else triggerHaptic('success');
                }} color="violet" compact />
              </div>
            )}

            {/* Inline timer card (discussion / free seating) */}
            {rolesDistributed && isTimerPhase && !winnerTeam && (
              <div className={`inline-timer-card ${timerTimeLeft <= 10 && timerRunning ? 'inline-timer-card--warning' : ''}`}>
                <div className="inline-timer-fill" style={{ width: `${timerProgress * 100}%` }} />
                <div className="inline-timer-content">
                  <div className={`inline-timer-digits ${timerTimeLeft <= 10 && timerRunning ? 'warning' : ''}`}>
                    {formatTimer(timerTimeLeft)}
                  </div>
                  <div className="inline-timer-controls">
                    {!timerRunning ? (
                      <button className="inline-timer-btn inline-timer-btn--start" onClick={() => {
                        if (gamePhase === 'discussion') startDiscussionTimer();
                        else startFreeSeatingTimer();
                        triggerHaptic('light');
                      }}>Старт</button>
                    ) : (
                      <button className="inline-timer-btn inline-timer-btn--pause" onClick={() => {
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
              <div className="speaker-indicator animate-fadeIn">
                <div className="speaker-info">
                  <span className="speaker-name">#{currentSpeaker.num} {currentSpeaker.login || `Игрок ${currentSpeaker.num}`}</span>
                  <span className="speaker-counter">{currentDaySpeakerIndex + 1}/{activePlayers?.length}</span>
                </div>
                <button className="glass-btn btn-primary speaker-next-btn" onClick={nextDaySpeaker}>Далее</button>
              </div>
            )}

            {/* Night phase indicator */}
            {gamePhase === 'night' && (
              <div className="night-phase-indicator">
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
              <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              <div className="inline-phase-actions animate-fadeIn">
                <div className="inline-slider-wrap">
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
                <button className="inline-back-btn" onClick={() => {
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
              <div className="voting-btn-container">
                <button className="glass-btn game-voting-btn" onClick={() => {
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
              <div className="inline-slider-wrap animate-fadeIn">
                <SlideConfirm
                  label={`Перейти в ночь ${(nightNumber || 0) + 1}`}
                  onConfirm={() => { handleGoToNight(); triggerHaptic('medium'); }}
                  color={dayButtonBlink ? 'amber' : 'night'}
                  compact
                />
              </div>
            )}

            {/* Game action buttons */}
            {rolesDistributed && (gamePhase === 'day' || gamePhase === 'night') && (
              <div className="game-actions-container">
                {!gameFinished && (
                  <SlideConfirm
                    label="Закончить игру"
                    onConfirm={() => { setGameFinished(true); setShowResultsScreen(true); triggerHaptic('heavy'); }}
                    color="red"
                    compact
                  />
                )}
                <button className="glass-btn game-action-btn" onClick={() => { setShowSettingsScreen(true); triggerHaptic('light'); }}>
                  ⚙ Настройки трансляции
                </button>
                {(winnerTeam || gameFinished) && (
                  <button className="glass-btn game-action-btn game-action-btn--results" onClick={() => { setShowResultsScreen(true); triggerHaptic('light'); }}>
                    🏆 Итоги
                  </button>
                )}
                <button className="glass-btn game-action-btn game-action-btn--exit" onClick={() => {
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

