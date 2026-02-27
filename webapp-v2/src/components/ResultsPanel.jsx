import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { getRoleLabel, isBlackRole } from '../constants/roles';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { useModal } from './Modal';

const getRoleTagClasses = (role) => {
  const base = 'px-1.5 py-0.5 rounded-md text-[0.65em] font-bold';
  const variants = {
    peace: 'bg-sky-400/15 text-sky-300 border border-sky-400/25',
    sheriff: 'bg-amber-400/15 text-amber-300 border border-amber-400/25',
    mafia: 'bg-purple-400/15 text-purple-300 border border-purple-400/25',
    black: 'bg-purple-400/15 text-purple-300 border border-purple-400/25',
    don: 'bg-purple-300/15 text-purple-300 border border-purple-300/25',
    doctor: 'bg-green-400/15 text-green-400 border border-green-400/25',
  };
  return `${base} ${variants[role] || 'bg-white/10 text-white/60 border border-white/20'}`;
};

export const ResultsPanel = () => {
  const {
    tableOut, winnerTeam, setWinnerTeam,
    playerScores, setPlayerScores, adjustScore, calculatePlayerScore, toggleReveal,
    computeAutoScores,
    roles, nightCheckHistory, votingHistory,
    bestMove, bestMoveAccepted, firstKilledPlayer,
    protocolData, opinionData, checkProtocol, checkOpinion,
    saveCurrentSession, returnToMainMenu, endSession,
    startNextTournamentGame, saveSummaryToServer,
    startNextGameInSession, saveGameToHistory,
    highlightedPlayer, setHighlightedPlayer, loadHistoryGame,
    tournamentId, gameMode, getGames, gameSelected,
    nightMisses, doctorHealHistory, cityMode,
    killedOnNight, dayNumber, nightNumber, dayVoteOuts,
    gamesHistory, currentGameNumber,
    viewOnly,
  } = useGame();
  const { showModal } = useModal();

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
            else if (roles[t.roleKey] === 'sheriff') items.push({ type: 'bonus', label: `Шериф угадан (${t.num})`, value: 0.4 });
            else items.push({ type: 'bonus', label: `Верная версия (${t.num} — мирный)`, value: 0.4 });
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
          else if (roles[t.roleKey] === 'sheriff') items.push({ type: 'bonus', label: `Версия: шериф угадан (${t.num})`, value: 0.4 });
          else items.push({ type: 'bonus', label: `Верная версия (${t.num} — мирный)`, value: 0.4 });
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
    <div className="animate-fade-in flex flex-col gap-3.5">
      {/* Winner selection */}
      {!winnerTeam ? (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-center text-[1.1em] font-extrabold mb-1">Выберите победителя</h2>
          <div
            className="glass-card flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] !border-red-500/20 hover:!border-red-500/35 hover:shadow-glass-md"
            onClick={() => selectWinner('civilians')}
          >
            <div className="text-2xl relative z-[1]">👥</div>
            <div className="relative z-[1]">
              <div className="font-bold">Победа мирных</div>
              <div className="text-[0.8em]" style={{ color: 'var(--text-secondary)' }}>Красная команда</div>
            </div>
          </div>
          <div
            className="glass-card flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] !border-blue-400/20 hover:!border-blue-400/35 hover:shadow-glass-md"
            onClick={() => selectWinner('mafia')}
          >
            <div className="text-2xl relative z-[1]">💀</div>
            <div className="relative z-[1]">
              <div className="font-bold">Победа мафии</div>
              <div className="text-[0.8em]" style={{ color: 'var(--text-secondary)' }}>Черная команда</div>
            </div>
          </div>
          <div
            className="glass-card flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] hover:!border-white/[0.18] hover:shadow-glass-md"
            onClick={() => selectWinner('draw')}
          >
            <div className="text-2xl relative z-[1]">🤝</div>
            <div className="relative z-[1]">
              <div className="font-bold">Ничья</div>
              <div className="text-[0.8em]" style={{ color: 'var(--text-secondary)' }}>Равный результат</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Game number + Winner header */}
          {currentGameNumber > 1 && (
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg bg-accent-soft border border-accent-soft text-accent">
                Игра {currentGameNumber}
              </span>
            </div>
          )}
          <div className="text-center font-extrabold text-[1.1em]"
            style={{ textShadow: '0 0 15px rgba(255,255,255,0.3)' }}>
            Победили: <span style={{
              color: winnerTeam === 'civilians' ? '#ff5252' : winnerTeam === 'mafia' ? '#4fc3f7' : '#fff'
            }}>
              {winnerTeam === 'civilians' ? 'Мирные' : winnerTeam === 'mafia' ? 'Мафия' : 'Ничья'}
            </span>
          </div>

          {/* Summary tabs */}
          <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
            <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-smooth"
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
                    className={`glass-card rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.985] hover:border-white/[0.18] hover:shadow-glass-md ${expanded ? '!border-white/[0.16] shadow-glass-md' : ''}`}
                    onClick={() => { setHighlightedPlayer(expanded ? null : rk); triggerHaptic('selection'); }}>

                    {/* Header row */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="relative shrink-0">
                        <div
                          className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 text-sm font-bold overflow-hidden"
                          style={p.avatar_link ? { backgroundImage: `url(${p.avatar_link})`, color: 'transparent' } : {}}
                        >
                          {!p.avatar_link && (p.login?.[0]?.toUpperCase() || p.num)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] rounded-md bg-[rgba(168,85,247,0.85)] border-[1.5px] border-[rgba(10,8,20,0.7)] shadow-[0_1px_6px_rgba(0,0,0,0.4),0_0_8px_rgba(168,85,247,0.25)] flex items-center justify-center text-[0.6rem] font-bold text-white px-0.5">{p.num}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{p.login || `Игрок ${p.num}`}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {role && <span className={getRoleTagClasses(role)}>{getRoleLabel(role)}</span>}
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
                            <div className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.06] mb-3">
                              <div className="text-[0.65rem] font-bold text-white/35 uppercase tracking-wider mb-2">Расчёт баллов</div>
                              {breakdown.map((item, i) => (
                                <div key={i} className={`flex items-center justify-between py-1 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                                  <span className="text-xs text-white/50">{item.label}</span>
                                  <span className={`text-xs font-bold tabular-nums ${item.type === 'bonus' ? 'text-green-400' : item.type === 'penalty' ? 'text-red-400' : 'text-white/30'}`}>
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
                          <div className="rounded-xl p-3 mb-3 bg-white/[0.02] border border-white/[0.06]">
                            <div className="text-[0.65rem] font-bold text-white/35 uppercase tracking-wider mb-2">Протокол</div>
                            <ProtocolOpinionGrid data={protocolData} rk={rk} tableOut={tableOut} results={checkProtocol(rk)} />
                          </div>
                        )}

                        {/* Opinion */}
                        {hasOpinion && (
                          <div className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]">
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
            <div className="flex flex-col gap-3.5">

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
                  <div key={round} className="relative z-[1] rounded-2xl glass-card-md overflow-hidden">
                    {/* Night block */}
                    <div className="px-3.5 py-3.5 pb-2.5 bg-indigo-500/[0.04] border-b border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.9em] font-extrabold bg-indigo-400/15 border border-indigo-400/30 text-indigo-300">
                          {round}
                        </div>
                        <span className="text-[0.9em] font-extrabold text-indigo-300">Ночь</span>
                      </div>

                      <div className="flex flex-col gap-2 pl-1">
                        {/* Kill */}
                        {nightKillPlayer ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[1.1em]">💀</span>
                            <div>
                              <div className="text-[0.9em] font-bold">#{nightKillPlayer.num} {nightKillPlayer.login || ''}</div>
                              {nightKillPlayer.role && <span className={`${getRoleTagClasses(nightKillPlayer.role)} text-[0.65em]`}>{getRoleLabel(nightKillPlayer.role)}</span>}
                            </div>
                          </div>
                        ) : isMiss ? (
                          <div className="flex items-center gap-2 text-white/35">
                            <span className="text-[1.1em]">💨</span>
                            <span className="text-[0.9em] font-semibold">Промах</span>
                          </div>
                        ) : (
                          <div className="text-[0.85em] text-white/25">Нет данных</div>
                        )}

                        {/* Doctor */}
                        {cityMode && doctorHealForRound && (
                          <div className="flex items-center gap-2 text-green-400">
                            <span className="text-[1.1em]">💊</span>
                            <span className="text-[0.85em] font-semibold">Лечение → #{doctorHealForRound.target} {tableOut[doctorHealForRound.target - 1]?.login || ''}</span>
                          </div>
                        )}

                        {/* Checks */}
                        {nightChecksForRound.map((h, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <span className={`w-[22px] h-[22px] rounded-md flex items-center justify-center text-[0.75em] font-extrabold ${
                              h.checkerRole === 'sheriff' ? 'bg-amber-400/12 border border-amber-400/30 text-amber-300' : 'bg-purple-300/12 border border-purple-300/30 text-purple-300'
                            }`}>
                              {h.checkerRole === 'sheriff' ? '★' : '◆'}
                            </span>
                            <span className={`flex-1 text-[0.85em] font-semibold ${h.checkerRole === 'sheriff' ? 'text-amber-300' : 'text-purple-300'}`}>
                              → #{h.target} {h.targetLogin}
                            </span>
                            <span className={`text-[0.75em] font-extrabold py-0.5 px-2 rounded-md ${
                              h.found ? 'bg-green-500/12 text-green-400' : 'bg-white/[0.04] text-white/30'
                            }`}>
                              {h.found ? '✓ Чёрный' : '✗ Красный'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Day block */}
                    {round <= dayNumber && (
                      <div className="px-3.5 py-2.5 pb-3.5 bg-amber-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.9em] font-extrabold bg-amber-500/15 border border-amber-500/30 text-amber-500">
                            {round}
                          </div>
                          <span className="text-[0.9em] font-extrabold text-amber-500">День</span>
                        </div>

                        {votingForDay ? (
                          <div className="flex flex-col gap-2.5 pl-1">
                            {/* Result */}
                            {votingForDay.finalWinners?.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {votingForDay.finalWinners.map(num => {
                                  const vp = tableOut[num - 1];
                                  return (
                                    <div key={num} className="flex items-center gap-2">
                                      <span className="text-[1.1em]">🗳</span>
                                      <div>
                                        <div className="text-[0.9em] font-bold">#{num} {vp?.login || ''}</div>
                                        {vp?.role && <span className={`${getRoleTagClasses(vp.role)} text-[0.65em]`}>{getRoleLabel(vp.role)}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-white/30">
                                <span className="text-[1.1em]">🗳</span>
                                <span className="text-[0.9em] font-semibold">Никто не выбыл</span>
                              </div>
                            )}

                            {/* Detailed voting stages */}
                            {votingForDay.stages?.map((s, si) => (
                              <div key={si} className="p-2.5 pt-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <div className="text-[0.7em] font-bold text-white/35 uppercase tracking-wider mb-1.5">
                                  {STAGE_LABELS[s.type] || s.type || `Раунд ${si + 1}`}
                                </div>
                                <div className="flex flex-col gap-1">
                                  {(s.candidates || Object.keys(s.results || {})).map(c => {
                                    const cNum = Number(c);
                                    const voters = s.results?.[String(c)] || [];
                                    const voterList = Array.isArray(voters) ? voters : [];
                                    const cp = tableOut[cNum - 1];
                                    return (
                                      <div key={c} className="flex items-center gap-1.5">
                                        <span className="min-w-6 h-6 rounded-md inline-flex items-center justify-center text-[0.75em] font-extrabold bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                          {cNum}
                                        </span>
                                        <span className="text-[0.8em] font-semibold min-w-[50px]">{cp?.login || ''}</span>
                                        <span className="text-[0.8em] font-extrabold text-amber-500 min-w-[14px] text-center">
                                          {voterList.length}
                                        </span>
                                        <div className="flex-1 flex flex-wrap gap-0.5">
                                          {voterList.map(v => (
                                            <span key={v} className="text-[0.65em] font-bold py-0.5 px-1 rounded bg-white/[0.06] text-white/45">
                                              {v}
                                            </span>
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
                          <div className="pl-1 text-[0.85em] text-white/25">Без голосования</div>
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
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-white/[0.03] border border-white/[0.08]"
                onClick={() => { setShowGamesHistory(!showGamesHistory); triggerHaptic('light'); }}
              >
                <span className="text-white/50">Предыдущие игры</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-accent-soft text-accent">
                    {gamesHistory.length}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${showGamesHistory ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {showGamesHistory && (
                <div className="flex flex-col gap-1.5 mt-2 animate-fade-in">
                  {gamesHistory.map((g, idx) => {
                    const winLabel = g.winnerTeam === 'civilians' ? 'Мирные' : g.winnerTeam === 'mafia' ? 'Мафия' : 'Ничья';
                    const winColor = g.winnerTeam === 'civilians' ? '#ff5252' : g.winnerTeam === 'mafia' ? '#4fc3f7' : 'rgba(255,255,255,0.5)';
                    const totalRounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
                    return (
                      <div key={idx}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer active:bg-white/[0.06] transition-colors"
                        onClick={() => loadHistoryGame(idx)}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shrink-0 bg-accent/10 border border-accent/20 text-accent">
                          {g.gameNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">Игра {g.gameNumber}</div>
                          <div className="text-xs text-white/30">{totalRounds} {totalRounds === 1 ? 'раунд' : totalRounds < 5 ? 'раунда' : 'раундов'}</div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="text-sm font-bold" style={{ color: winColor }}>{winLabel}</div>
                            {g.completedAt && (
                              <div className="text-[0.6rem] text-white/20">
                                {new Date(g.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
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
              <button
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring opacity-50"
                onClick={() => { setWinnerTeam(null); triggerHaptic('light'); }}
              >
                ← Изменить победителя
              </button>

              {winnerTeam && (
                <button
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm active:scale-[0.97] transition-all duration-150 bg-accent/15 border border-accent/25 text-accent"
                  onClick={async () => {
                    triggerHaptic('success');
                    try { await saveSummaryToServer(); } catch {}
                    if (gameMode === 'gomafia') startNextTournamentGame();
                    else startNextGameInSession();
                  }}
                >
                  Следующая игра →
                </button>
              )}

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

              {winnerTeam && (
                <button
                  className="w-full py-3 px-4 rounded-2xl font-bold text-[0.85em] border border-status-error/15 bg-status-error/5 text-status-error/70 active:scale-[0.98] transition-all duration-150 active:bg-status-error/10"
                  onClick={() => {
                    showModal({
                      icon: '⚠️',
                      title: 'Завершить сессию?',
                      message: 'После завершения серия будет перенесена в Историю, и её игры станут недоступны для редактирования. Оверлей будет отключен.',
                      buttons: [
                        { label: 'Отмена' },
                        { label: 'Да, завершить', primary: true, danger: true, action: async () => {
                          triggerHaptic('success');
                          try { await saveSummaryToServer(); } catch {}
                          endSession();
                        }},
                      ],
                    });
                    triggerHaptic('warning');
                  }}
                >
                  Завершить сессию
                </button>
              )}
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
    <div className="flex gap-1">
      {players.map(t => {
        const pred = data?.[rk]?.[t.num] || '';
        const rc = ROLE_COLORS[pred] || ROLE_COLORS[''];
        const res = results?.[t.num];
        return (
          <div
            key={t.num}
            className="flex-1 flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-lg"
            style={{ background: rc.bg, border: `1px solid ${rc.border}` }}
          >
            <span className="text-[0.75em] font-bold" style={{ color: pred ? rc.color : 'rgba(255,255,255,0.35)' }}>{t.num}</span>
            <span className="text-[0.55em] font-extrabold leading-none" style={{ color: rc.color }}>
              {pred ? ROLE_LABELS[pred] : '—'}
            </span>
            {res && (
              <span className="text-[0.5em]" style={{ color: res.correct ? '#30d158' : '#ff453a' }}>
                {res.correct ? '✓' : '✗'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      {renderRow(tableOut.filter(t => t.num <= 5))}
      {renderRow(tableOut.filter(t => t.num > 5))}
    </div>
  );
}
