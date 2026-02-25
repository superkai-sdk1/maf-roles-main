import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { getRoleLabel, isBlackRole } from '../constants/roles';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';

export const ResultsPanel = () => {
  const {
    tableOut, winnerTeam, setWinnerTeam,
    playerScores, setPlayerScores, adjustScore, calculatePlayerScore, toggleReveal,
    computeAutoScores,
    roles, nightCheckHistory, votingHistory,
    bestMove, bestMoveAccepted, firstKilledPlayer,
    protocolData, opinionData, checkProtocol, checkOpinion,
    saveCurrentSession, returnToMainMenu,
    startNextTournamentGame, saveSummaryToServer,
    startNextGameInSession, saveGameToHistory,
    highlightedPlayer, setHighlightedPlayer,
    tournamentId, gameMode, getGames, gameSelected,
    nightMisses, doctorHealHistory, cityMode,
    killedOnNight, dayNumber, nightNumber, dayVoteOuts,
    gamesHistory, currentGameNumber,
    viewOnly,
  } = useGame();

  const [summaryTab, setSummaryTab] = useState('scores');
  const [showGamesHistory, setShowGamesHistory] = useState(false);

  const games = getGames?.() || [];
  const hasNextTournamentGame = gameMode === 'gomafia' && games.length > 0 &&
    games.some(g => g.gameNum === (gameSelected || 0) + 1);

  const selectWinner = (team) => {
    setWinnerTeam(team);
    const auto = computeAutoScores();
    if (auto) setPlayerScores(auto);
    triggerHaptic('success');
  };

  const getScoreBreakdown = (rk) => {
    if (gameMode !== 'gomafia' && gameMode !== 'funky') return [];
    const items = [];
    const isBlack = (r) => r === 'don' || r === 'black';
    const isFK = rk === firstKilledPlayer;

    if (isFK && bestMoveAccepted && bestMove.length > 0) {
      let blacks = 0;
      for (const num of bestMove) {
        const t = tableOut.find(x => x.num === num);
        if (t && isBlack(roles[t.roleKey])) blacks++;
      }
      const bmTable = { 1: 0.1, 2: 0.3, 3: 0.6 };
      const val = bmTable[blacks] || 0;
      if (val > 0) items.push({ type: 'bonus', label: `ЛХ: ${blacks} чёрн.`, value: val });
      else if (blacks === 0 && bestMove.length > 0) items.push({ type: 'neutral', label: 'ЛХ: 0 чёрных', value: 0 });
    }

    if (isFK) {
      const proto = protocolData[rk];
      if (proto) {
        let correctBlacks = 0, wrongBlacks = 0, correctReds = 0, wrongReds = 0;
        for (const [numStr, pred] of Object.entries(proto)) {
          if (!pred) continue;
          const t = tableOut.find(x => x.num === parseInt(numStr));
          if (!t) continue;
          const black = isBlack(roles[t.roleKey]);
          if (pred === 'sheriff') {
            if (black) items.push({ type: 'penalty', label: `Шериф → чёрный (${t.num})`, value: 0.4 });
            else items.push({ type: 'bonus', label: `Шериф верно (${t.num})`, value: 0.4 });
          } else if (pred === 'mafia' || pred === 'don') {
            if (black) correctBlacks++; else wrongBlacks++;
          } else if (pred === 'peace') {
            if (!black) correctReds++; else wrongReds++;
          }
        }
        const bkB = { 1: 0.2, 2: 0.5, 3: 0.8 };
        const bkP = { 1: 0.2, 2: 0.5, 3: 0.8 };
        if (correctBlacks > 0) items.push({ type: 'bonus', label: `Чёрные верно: ${correctBlacks}`, value: bkB[Math.min(correctBlacks, 3)] || 0 });
        if (wrongBlacks > 0) items.push({ type: 'penalty', label: `Чёрные ошибка: ${wrongBlacks}`, value: bkP[Math.min(wrongBlacks, 3)] || 0 });
        if (wrongReds === 0 && correctReds > 0) {
          const rdB = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7 };
          items.push({ type: 'bonus', label: `Красные верно: ${correctReds}`, value: rdB[Math.min(correctReds, 4)] || 0 });
        }
        if (wrongReds > 0) {
          const rdP = { 1: 0.2, 2: 0.4 };
          items.push({ type: 'penalty', label: `Красные ошибка: ${wrongReds}`, value: rdP[Math.min(wrongReds, 2)] || 0 });
          if (correctReds > 0) items.push({ type: 'neutral', label: `Красные верно: ${correctReds} (сброс)`, value: 0 });
        }
      }
    } else {
      const opinion = opinionData[rk];
      if (opinion) {
        for (const [numStr, pred] of Object.entries(opinion)) {
          if (pred !== 'sheriff') continue;
          const t = tableOut.find(x => x.num === parseInt(numStr));
          if (!t) continue;
          if (isBlack(roles[t.roleKey])) items.push({ type: 'penalty', label: `Версия: шериф → чёрный (${t.num})`, value: 0.4 });
          else items.push({ type: 'bonus', label: `Версия: шериф верно (${t.num})`, value: 0.4 });
        }
      }
    }

    const p = tableOut.find(x => x.roleKey === rk);
    if (p) {
      if (p.removed || p.fouls >= 4) items.push({ type: 'penalty', label: 'Удаление / 4-й фол', value: 1.0 });
      const tf = p.techFouls || 0;
      if (tf >= 2) items.push({ type: 'penalty', label: `${tf} тех. фола`, value: 0.6 });
      else if (tf === 1) items.push({ type: 'penalty', label: '1 тех. фол', value: 0.3 });
    }
    return items;
  };

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Winner selection */}
      {!winnerTeam ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ textAlign: 'center', fontSize: '1.1em', fontWeight: 800, marginBottom: 4 }}>Выберите победителя</h2>
          <div className="winner-card civilians" onClick={() => selectWinner('civilians')}>
            <div style={{ fontSize: 24 }}>👥</div>
            <div>
              <div style={{ fontWeight: 700 }}>Победа мирных</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Красная команда</div>
            </div>
          </div>
          <div className="winner-card mafia" onClick={() => selectWinner('mafia')}>
            <div style={{ fontSize: 24 }}>💀</div>
            <div>
              <div style={{ fontWeight: 700 }}>Победа мафии</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Черная команда</div>
            </div>
          </div>
          <div className="winner-card draw" onClick={() => selectWinner('draw')}>
            <div style={{ fontSize: 24 }}>🤝</div>
            <div>
              <div style={{ fontWeight: 700 }}>Ничья</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Равный результат</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Game number + Winner header */}
          {currentGameNumber > 1 && (
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg"
                style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: 'var(--accent-color, #a855f7)' }}>
                Игра {currentGameNumber}
              </span>
            </div>
          )}
          <div style={{
            textAlign: 'center', fontWeight: 800, fontSize: '1.1em',
            textShadow: '0 0 15px rgba(255,255,255,0.3)',
          }}>
            Победили: <span style={{
              color: winnerTeam === 'civilians' ? '#ff5252' : winnerTeam === 'mafia' ? '#4fc3f7' : '#fff'
            }}>
              {winnerTeam === 'civilians' ? 'Мирные' : winnerTeam === 'mafia' ? 'Мафия' : 'Ничья'}
            </span>
          </div>

          {/* Summary tabs */}
          <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
            <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                width: 'calc(50% - 4px)',
                left: summaryTab === 'scores' ? 4 : 'calc(50% + 0px)',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(99,102,241,0.12) 100%)',
                border: '1px solid rgba(168,85,247,0.2)',
                boxShadow: '0 4px 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
              }} />
            {[
              { id: 'scores', label: 'Баллы', icon: '◈' },
              { id: 'summary', label: 'Сводка', icon: '◉' },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => { setSummaryTab(tab.id); triggerHaptic('light'); }}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${
                  summaryTab === tab.id ? 'text-white' : 'text-white/35'
                }`}>
                <span className={`text-xs transition-opacity duration-200 ${summaryTab === tab.id ? 'opacity-100' : 'opacity-40'}`}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scores tab */}
          {summaryTab === 'scores' && (
            <div className="animate-stagger flex flex-col gap-2.5">
              {tableOut.map(p => {
                const rk = p.roleKey;
                const role = p.role;
                const score = calculatePlayerScore(rk);
                const ps = playerScores[rk] || { bonus: 0, penalty: 0, reveal: false };
                const expanded = highlightedPlayer === rk;
                const isBlack = isBlackRole(role);
                const won = (winnerTeam === 'civilians' && !isBlack) || (winnerTeam === 'mafia' && isBlack);
                const isFK = rk === firstKilledPlayer;
                const hasProto = protocolData[rk] && Object.values(protocolData[rk]).some(v => v);
                const hasOpinion = opinionData[rk] && Object.values(opinionData[rk]).some(v => v);
                const hasBM = isFK && bestMoveAccepted && bestMove.length > 0;

                return (
                  <div key={rk}
                    className={`score-card transition-all duration-200 ${expanded ? 'ring-1 ring-white/10' : ''}`}
                    onClick={() => { setHighlightedPlayer(expanded ? null : rk); triggerHaptic('selection'); }}>

                    {/* Header row */}
                    <div className="player-row-content">
                      <div className="player-avatar-wrap">
                        <div className="player-avatar"
                          style={p.avatar_link ? { backgroundImage: `url(${p.avatar_link})`, color: 'transparent' } : {}}>
                          {!p.avatar_link && (p.login?.[0]?.toUpperCase() || p.num)}
                        </div>
                        <span className="player-num-badge">{p.num}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="player-name">{p.login || `Игрок ${p.num}`}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {role && <span className={`role-tag ${role}`}>{getRoleLabel(role)}</span>}
                          {p.action && <span className="text-[0.6em] text-white/30">
                            {p.action === 'killed' ? '💀' : p.action === 'voted' ? '🗳' : p.action === 'removed' ? '❌' : p.action === 'fall_removed' ? '4Ф' : p.action === 'tech_fall_removed' ? '2ТФ' : ''}
                          </span>}
                          {won && <span className="text-[0.6em] text-green-400">✓ WIN</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-extrabold tabular-nums ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-white'}`}>
                          {score.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {expanded && (
                      <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>

                        {/* Score total bar */}
                        <div className="relative rounded-xl overflow-hidden mb-3 p-3"
                          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.08) 100%)', border: '1px solid rgba(168,85,247,0.15)' }}>
                          <div className="text-center">
                            <div className="text-[0.6rem] font-bold uppercase tracking-wider text-purple-300/60 mb-1">Итого баллов</div>
                            <div className={`text-3xl font-black tabular-nums ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-white'}`}
                              style={{ textShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
                              {score.toFixed(1)}
                            </div>
                          </div>
                        </div>

                        {/* Bonus / Penalty controls */}
                        {!viewOnly && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="rounded-xl p-2.5" style={{ background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.15)' }}>
                              <div className="text-[0.65rem] font-bold text-green-400/70 text-center mb-2 uppercase tracking-wide">＋ Доп</div>
                              <div className="flex items-center justify-center gap-2">
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                  style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.2)', color: '#4caf50' }}
                                  onClick={() => { adjustScore(rk, 'bonus', -0.1); triggerHaptic('light'); }}>−</button>
                                <span className="text-lg font-extrabold text-green-400 tabular-nums min-w-[36px] text-center">{(ps.bonus || 0).toFixed(1)}</span>
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                  style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.2)', color: '#4caf50' }}
                                  onClick={() => { adjustScore(rk, 'bonus', 0.1); triggerHaptic('light'); }}>＋</button>
                              </div>
                            </div>
                            <div className="rounded-xl p-2.5" style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.15)' }}>
                              <div className="text-[0.65rem] font-bold text-red-400/70 text-center mb-2 uppercase tracking-wide">− Штраф</div>
                              <div className="flex items-center justify-center gap-2">
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                  style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.2)', color: '#f44336' }}
                                  onClick={() => { adjustScore(rk, 'penalty', -0.1); triggerHaptic('light'); }}>−</button>
                                <span className="text-lg font-extrabold text-red-400 tabular-nums min-w-[36px] text-center">{(ps.penalty || 0).toFixed(1)}</span>
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                  style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.2)', color: '#f44336' }}
                                  onClick={() => { adjustScore(rk, 'penalty', 0.1); triggerHaptic('light'); }}>＋</button>
                              </div>
                            </div>
                          </div>
                        )}
                        {viewOnly && (ps.bonus > 0 || ps.penalty > 0) && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {ps.bonus > 0 && (
                              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.15)' }}>
                                <div className="text-[0.65rem] font-bold text-green-400/70 uppercase tracking-wide mb-1">Доп</div>
                                <span className="text-lg font-extrabold text-green-400 tabular-nums">+{(ps.bonus || 0).toFixed(1)}</span>
                              </div>
                            )}
                            {ps.penalty > 0 && (
                              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.15)' }}>
                                <div className="text-[0.65rem] font-bold text-red-400/70 uppercase tracking-wide mb-1">Штраф</div>
                                <span className="text-lg font-extrabold text-red-400 tabular-nums">-{(ps.penalty || 0).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Score breakdown */}
                        {(() => {
                          const breakdown = getScoreBreakdown(rk);
                          return breakdown.length > 0 ? (
                            <div className="score-breakdown mb-3">
                              <div className="score-breakdown-title">Расчёт баллов</div>
                              {breakdown.map((item, i) => (
                                <div key={i} className="score-breakdown-row">
                                  <span className="score-breakdown-label">{item.label}</span>
                                  <span className={`score-breakdown-value ${item.type === 'bonus' ? 'score-breakdown-value--bonus' : item.type === 'penalty' ? 'score-breakdown-value--penalty' : 'score-breakdown-value--neutral'}`}>
                                    {item.type === 'bonus' ? `+${item.value.toFixed(1)}` : item.type === 'penalty' ? `-${item.value.toFixed(1)}` : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}

                        {/* Reveal toggle */}
                        {!viewOnly && (
                          <button onClick={() => { toggleReveal(rk); triggerHaptic('light'); }}
                            className={`w-full rounded-xl py-2.5 px-4 text-xs font-bold tracking-wide transition-all active:scale-[0.98] mb-3 ${
                              ps.reveal
                                ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                                : 'bg-white/[0.03] border border-white/10 text-white/40'
                            }`}>
                            {ps.reveal ? '◉ Вскрытие: Да' : '○ Вскрытие: Нет'}
                          </button>
                        )}
                        {viewOnly && ps.reveal && (
                          <div className="w-full rounded-xl py-2.5 px-4 text-xs font-bold tracking-wide mb-3 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-center">
                            Вскрытие: Да
                          </div>
                        )}

                        {/* Best Move */}
                        {hasBM && (
                          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,214,10,0.05)', border: '1px solid rgba(255,214,10,0.15)' }}>
                            <div className="text-[0.65rem] font-bold text-yellow-400/70 uppercase tracking-wider mb-2">⭐ Лучший ход</div>
                            <div className="flex gap-1.5">
                              {bestMove.map(n => (
                                <div key={n} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-extrabold"
                                  style={{ background: 'rgba(255,214,10,0.12)', border: '1px solid rgba(255,214,10,0.25)', color: '#ffd60a' }}>
                                  {n}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Protocol */}
                        {hasProto && (
                          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="text-[0.65rem] font-bold text-white/35 uppercase tracking-wider mb-2">Протокол</div>
                            <ProtocolOpinionGrid data={protocolData} rk={rk} tableOut={tableOut} results={checkProtocol(rk)} />
                          </div>
                        )}

                        {/* Opinion */}
                        {hasOpinion && (
                          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="text-[0.65rem] font-bold text-white/35 uppercase tracking-wider mb-2">Мнение</div>
                            <ProtocolOpinionGrid data={opinionData} rk={rk} tableOut={tableOut} results={checkOpinion(rk)} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary tab */}
          {summaryTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Timeline */}
              {Array.from({ length: Math.max(nightNumber, dayNumber) }, (_, i) => i + 1).map(round => {
                const nightKillRK = Object.entries(killedOnNight || {}).find(([, n]) => n === round)?.[0];
                const nightKillPlayer = nightKillRK ? tableOut.find(p => p.roleKey === nightKillRK) : null;
                const isMiss = nightMisses?.[round];
                const nightChecksForRound = nightCheckHistory.filter(h => h.night === round);
                const doctorHealForRound = doctorHealHistory.find(h => h.night === round);
                const votingForDay = votingHistory.find(v => v.dayNumber === round);
                const STAGE_LABELS = { main: 'Основное', tie: 'Повторное', lift: 'За подъём' };

                return (
                  <div key={round} className="glass-card" style={{ padding: 0, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
                    {/* Night block */}
                    <div style={{ padding: '14px 14px 10px', background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.9em', fontWeight: 800, color: '#818cf8',
                        }}>{round}</div>
                        <span style={{ fontSize: '0.9em', fontWeight: 800, color: '#818cf8' }}>Ночь</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                        {/* Kill */}
                        {nightKillPlayer ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.1em' }}>💀</span>
                            <div>
                              <div style={{ fontSize: '0.9em', fontWeight: 700 }}>#{nightKillPlayer.num} {nightKillPlayer.login || ''}</div>
                              {nightKillPlayer.role && <span className={`role-tag ${nightKillPlayer.role}`} style={{ fontSize: '0.65em' }}>{getRoleLabel(nightKillPlayer.role)}</span>}
                            </div>
                          </div>
                        ) : isMiss ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)' }}>
                            <span style={{ fontSize: '1.1em' }}>💨</span>
                            <span style={{ fontSize: '0.9em', fontWeight: 600 }}>Промах</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.25)' }}>Нет данных</div>
                        )}

                        {/* Doctor */}
                        {cityMode && doctorHealForRound && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#81c784' }}>
                            <span style={{ fontSize: '1.1em' }}>💊</span>
                            <span style={{ fontSize: '0.85em', fontWeight: 600 }}>Лечение → #{doctorHealForRound.target} {tableOut[doctorHealForRound.target - 1]?.login || ''}</span>
                          </div>
                        )}

                        {/* Checks */}
                        {nightChecksForRound.map((h, ci) => (
                          <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75em', fontWeight: 800,
                              background: h.checkerRole === 'sheriff' ? 'rgba(255,213,79,0.12)' : 'rgba(206,147,216,0.12)',
                              border: `1px solid ${h.checkerRole === 'sheriff' ? 'rgba(255,213,79,0.3)' : 'rgba(206,147,216,0.3)'}`,
                              color: h.checkerRole === 'sheriff' ? '#ffd54f' : '#ce93d8',
                            }}>{h.checkerRole === 'sheriff' ? '★' : '◆'}</span>
                            <span style={{ flex: 1, fontSize: '0.85em', fontWeight: 600, color: h.checkerRole === 'sheriff' ? '#ffd54f' : '#ce93d8' }}>
                              → #{h.target} {h.targetLogin}
                            </span>
                            <span style={{
                              fontSize: '0.75em', fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                              background: h.found ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.04)',
                              color: h.found ? '#30d158' : 'rgba(255,255,255,0.3)',
                            }}>{h.found ? '✓ Чёрный' : '✗ Красный'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Day block */}
                    {round <= dayNumber && (
                      <div style={{ padding: '10px 14px 14px', background: 'rgba(245,158,11,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.9em', fontWeight: 800, color: '#f59e0b',
                          }}>{round}</div>
                          <span style={{ fontSize: '0.9em', fontWeight: 800, color: '#f59e0b' }}>День</span>
                        </div>

                        {votingForDay ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
                            {/* Result */}
                            {votingForDay.finalWinners?.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {votingForDay.finalWinners.map(num => {
                                  const vp = tableOut[num - 1];
                                  return (
                                    <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: '1.1em' }}>🗳</span>
                                      <div>
                                        <div style={{ fontSize: '0.9em', fontWeight: 700 }}>#{num} {vp?.login || ''}</div>
                                        {vp?.role && <span className={`role-tag ${vp.role}`} style={{ fontSize: '0.65em' }}>{getRoleLabel(vp.role)}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)' }}>
                                <span style={{ fontSize: '1.1em' }}>🗳</span>
                                <span style={{ fontSize: '0.9em', fontWeight: 600 }}>Никто не выбыл</span>
                              </div>
                            )}

                            {/* Detailed voting stages */}
                            {votingForDay.stages?.map((s, si) => (
                              <div key={si} style={{
                                padding: '8px 10px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                              }}>
                                <div style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                  {STAGE_LABELS[s.type] || s.type || `Раунд ${si + 1}`}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {(s.candidates || Object.keys(s.results || {})).map(c => {
                                    const cNum = Number(c);
                                    const voters = s.results?.[String(c)] || [];
                                    const voterList = Array.isArray(voters) ? voters : [];
                                    const cp = tableOut[cNum - 1];
                                    return (
                                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                          minWidth: 24, height: 24, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: '0.75em', fontWeight: 800, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b',
                                        }}>{cNum}</span>
                                        <span style={{ fontSize: '0.8em', fontWeight: 600, minWidth: 50 }}>{cp?.login || ''}</span>
                                        <span style={{
                                          fontSize: '0.8em', fontWeight: 800, color: '#f59e0b', minWidth: 14, textAlign: 'center',
                                        }}>{voterList.length}</span>
                                        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                          {voterList.map(v => (
                                            <span key={v} style={{
                                              fontSize: '0.65em', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                                              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
                                            }}>{v}</span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ paddingLeft: 4, fontSize: '0.85em', color: 'rgba(255,255,255,0.25)' }}>Без голосования</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}


          {/* Games History */}
          {gamesHistory.length > 0 && (
            <div className="mt-1">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => { setShowGamesHistory(!showGamesHistory); triggerHaptic('light'); }}
              >
                <span className="text-white/50">Предыдущие игры</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-md" style={{ background: 'rgba(168,85,247,0.15)', color: 'var(--accent-color, #a855f7)' }}>
                    {gamesHistory.length}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="transition-transform duration-200" style={{ transform: showGamesHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {showGamesHistory && (
                <div className="flex flex-col gap-1.5 mt-2 animate-fadeIn">
                  {gamesHistory.map((g, idx) => {
                    const winLabel = g.winnerTeam === 'civilians' ? 'Мирные' : g.winnerTeam === 'mafia' ? 'Мафия' : 'Ничья';
                    const winColor = g.winnerTeam === 'civilians' ? '#ff5252' : g.winnerTeam === 'mafia' ? '#4fc3f7' : 'rgba(255,255,255,0.5)';
                    const totalRounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
                    return (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shrink-0"
                          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: 'var(--accent-color, #a855f7)' }}>
                          {g.gameNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">Игра {g.gameNumber}</div>
                          <div className="text-xs text-white/30">{totalRounds} {totalRounds === 1 ? 'раунд' : totalRounds < 5 ? 'раунда' : 'раундов'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: winColor }}>{winLabel}</div>
                          {g.completedAt && (
                            <div className="text-[0.6rem] text-white/20">
                              {new Date(g.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!viewOnly && (
            <div className="flex flex-col gap-2.5 mt-3">
              <button className="glass-btn w-full opacity-50" onClick={() => { setWinnerTeam(null); triggerHaptic('light'); }}>
                ← Изменить победителя
              </button>

              <SlideConfirm
                label="Сохранить и выйти"
                color="emerald"
                onConfirm={async () => {
                  saveGameToHistory();
                  saveCurrentSession();
                  triggerHaptic('success');
                  try {
                    await saveSummaryToServer();
                  } catch {}
                  returnToMainMenu();
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ROLE_COLORS = {
  '': { color: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
  'peace': { color: '#4fc3f7', bg: 'rgba(79,195,247,0.1)', border: 'rgba(79,195,247,0.25)' },
  'sheriff': { color: '#ffd54f', bg: 'rgba(255,213,79,0.1)', border: 'rgba(255,213,79,0.25)' },
  'mafia': { color: '#ef5350', bg: 'rgba(239,83,80,0.1)', border: 'rgba(239,83,80,0.25)' },
  'don': { color: '#ce93d8', bg: 'rgba(206,147,216,0.1)', border: 'rgba(206,147,216,0.25)' },
};
const ROLE_LABELS = { '': '-', 'peace': 'М', 'sheriff': 'Ш', 'mafia': 'Ч', 'don': 'Д' };

function ProtocolOpinionGrid({ data, rk, tableOut, results }) {
  const renderRow = (players) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {players.map(t => {
        const pred = data?.[rk]?.[t.num] || '';
        const rc = ROLE_COLORS[pred] || ROLE_COLORS[''];
        const res = results?.[t.num];
        return (
          <div key={t.num} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            padding: '4px 2px', borderRadius: 8,
            background: rc.bg, border: `1px solid ${rc.border}`,
          }}>
            <span style={{ fontSize: '0.75em', fontWeight: 700, color: pred ? rc.color : 'rgba(255,255,255,0.35)' }}>{t.num}</span>
            <span style={{ fontSize: '0.55em', fontWeight: 800, color: rc.color, lineHeight: 1 }}>
              {pred ? ROLE_LABELS[pred] : '—'}
            </span>
            {res && (
              <span style={{ fontSize: '0.5em', color: res.correct ? '#30d158' : '#ff453a' }}>
                {res.correct ? '✓' : '✗'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {renderRow(tableOut.filter(t => t.num <= 5))}
      {renderRow(tableOut.filter(t => t.num > 5))}
    </div>
  );
}
