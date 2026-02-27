import React, { useState, useEffect } from 'react';
import { goMafiaApi } from '../services/api';
import { getRoleLabel, isBlackRole } from '../constants/roles';

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

function buildTableOut(game) {
  const { players = [], roles = {}, playersActions = {}, fouls = {}, techFouls = {}, removed = {}, avatars = {} } = game;
  return players.map((p, i) => {
    const rk = p.roleKey || `1-1-${i + 1}`;
    return {
      ...p, num: i + 1, roleKey: rk,
      role: roles[rk] || null,
      action: playersActions[rk] || null,
      fouls: fouls[rk] || 0,
      techFouls: techFouls[rk] || 0,
      removed: !!removed[rk],
      avatar_link: avatars[p.login] || p.avatar_link || null,
    };
  });
}

function calcScore(rk, game) {
  const { winnerTeam, roles = {}, playerScores = {} } = game;
  if (!winnerTeam) return 0;
  let s = 0;
  const role = roles[rk];
  if (winnerTeam === 'civilians' && (!role || role === 'sheriff' || role === 'peace')) s += 1;
  if (winnerTeam === 'mafia' && (role === 'don' || role === 'black')) s += 1;
  if (playerScores[rk]) {
    s += parseFloat(playerScores[rk].bonus || 0);
    s -= parseFloat(playerScores[rk].penalty || 0);
  }
  return parseFloat(s.toFixed(2));
}

function GameCard({ game, gameNumber, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [tab, setTab] = useState('scores');

  const tableOut = buildTableOut(game);
  const { winnerTeam, nightCheckHistory = [], votingHistory = [], killedOnNight = {}, nightMisses = {}, doctorHealHistory = [], dayNumber = 0, nightNumber = 0, cityMode, dayVoteOuts = {} } = game;

  const winLabel = winnerTeam === 'civilians' ? 'Мирные' : winnerTeam === 'mafia' ? 'Мафия' : 'Ничья';
  const winColor = winnerTeam === 'civilians' ? '#ff5252' : winnerTeam === 'mafia' ? '#4fc3f7' : 'rgba(255,255,255,0.5)';
  const totalRounds = Math.max(nightNumber || 0, dayNumber || 0);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0 bg-accent/10 border border-accent/20 text-accent">
          {gameNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Игра {gameNumber}</div>
          <div className="text-xs text-white/30">{totalRounds} {totalRounds === 1 ? 'раунд' : totalRounds < 5 ? 'раунда' : 'раундов'}</div>
        </div>
        <div className="text-right flex items-center gap-2">
          <div className="text-sm font-bold" style={{ color: winColor }}>{winLabel}</div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          {/* Tabs */}
          <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl mb-3">
            <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-smooth"
              style={{
                width: 'calc(50% - 4px)',
                left: tab === 'scores' ? 4 : 'calc(50% + 0px)',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(99,102,241,0.12) 100%)',
                border: '1px solid rgba(168,85,247,0.2)',
                boxShadow: '0 4px 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
              }} />
            {[
              { id: 'scores', label: 'Баллы', icon: '◈' },
              { id: 'summary', label: 'Сводка', icon: '◉' },
            ].map(t => (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${tab === t.id ? 'text-white' : 'text-white/35'}`}>
                <span className={`text-xs transition-opacity duration-200 ${tab === t.id ? 'opacity-100' : 'opacity-40'}`}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Scores tab */}
          {tab === 'scores' && (
            <div className="flex flex-col gap-2">
              {tableOut.map(p => {
                const rk = p.roleKey;
                const role = p.role;
                const score = calcScore(rk, game);
                const ps = game.playerScores?.[rk] || {};
                const isExpanded = expandedPlayer === rk;
                const isBlack = isBlackRole(role);
                const won = (winnerTeam === 'civilians' && !isBlack) || (winnerTeam === 'mafia' && isBlack);

                return (
                  <div key={rk}
                    className={`glass-card rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.985] hover:border-white/[0.18] ${isExpanded ? '!border-white/[0.16] shadow-glass-md' : ''}`}
                    onClick={() => setExpandedPlayer(isExpanded ? null : rk)}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 text-sm font-bold overflow-hidden"
                          style={p.avatar_link ? { backgroundImage: `url(${p.avatar_link})`, backgroundSize: 'cover', color: 'transparent' } : {}}>
                          {!p.avatar_link && (p.login?.[0]?.toUpperCase() || p.num)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] rounded-md bg-[rgba(168,85,247,0.85)] border-[1.5px] border-[rgba(10,8,20,0.7)] flex items-center justify-center text-[0.6rem] font-bold text-white px-0.5">{p.num}</span>
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
                      <div className={`text-xl font-extrabold tabular-nums ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-white'}`}>
                        {score.toFixed(1)}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1" onClick={e => e.stopPropagation()}>
                        {(ps.bonus > 0 || ps.penalty > 0) && (
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            {ps.bonus > 0 && (
                              <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.15)' }}>
                                <div className="text-[0.65rem] font-bold text-green-400/70 uppercase tracking-wide mb-1">Доп</div>
                                <span className="text-lg font-extrabold text-green-400 tabular-nums">+{(ps.bonus || 0).toFixed(1)}</span>
                              </div>
                            )}
                            {ps.penalty > 0 && (
                              <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.15)' }}>
                                <div className="text-[0.65rem] font-bold text-red-400/70 uppercase tracking-wide mb-1">Штраф</div>
                                <span className="text-lg font-extrabold text-red-400 tabular-nums">-{(ps.penalty || 0).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {ps.reveal && (
                          <div className="w-full rounded-xl py-2 px-4 text-xs font-bold tracking-wide mb-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-center">
                            Вскрытие: Да
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
          {tab === 'summary' && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: Math.max(nightNumber, dayNumber) }, (_, i) => i + 1).map(round => {
                const nightKillRK = Object.entries(killedOnNight || {}).find(([, n]) => n === round)?.[0];
                const nightKillPlayer = nightKillRK ? tableOut.find(p => p.roleKey === nightKillRK) : null;
                const isMiss = nightMisses?.[round];
                const nightChecksForRound = nightCheckHistory.filter(h => h.night === round);
                const doctorHealForRound = doctorHealHistory.find(h => h.night === round);
                const votingForDay = votingHistory.find(v => v.dayNumber === round);

                return (
                  <div key={round} className="relative z-[1] rounded-2xl glass-card-md overflow-hidden">
                    <div className="px-3.5 py-3 bg-indigo-500/[0.04] border-b border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.9em] font-extrabold bg-indigo-400/15 border border-indigo-400/30 text-indigo-300">{round}</div>
                        <span className="text-[0.9em] font-extrabold text-indigo-300">Ночь</span>
                      </div>
                      <div className="flex flex-col gap-2 pl-1">
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
                        {cityMode && doctorHealForRound && (
                          <div className="flex items-center gap-2 text-green-400">
                            <span className="text-[1.1em]">💊</span>
                            <span className="text-[0.85em] font-semibold">Лечение → #{doctorHealForRound.target}</span>
                          </div>
                        )}
                        {nightChecksForRound.map((h, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <span className={`w-[22px] h-[22px] rounded-md flex items-center justify-center text-[0.75em] font-extrabold ${h.checkerRole === 'sheriff' ? 'bg-amber-400/12 border border-amber-400/30 text-amber-300' : 'bg-purple-300/12 border border-purple-300/30 text-purple-300'}`}>
                              {h.checkerRole === 'sheriff' ? '★' : '◆'}
                            </span>
                            <span className={`flex-1 text-[0.85em] font-semibold ${h.checkerRole === 'sheriff' ? 'text-amber-300' : 'text-purple-300'}`}>
                              → #{h.target} {h.targetLogin}
                            </span>
                            <span className={`text-[0.75em] font-extrabold py-0.5 px-2 rounded-md ${h.found ? 'bg-green-500/12 text-green-400' : 'bg-white/[0.04] text-white/30'}`}>
                              {h.found ? '✓ Чёрный' : '✗ Красный'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {round <= dayNumber && (
                      <div className="px-3.5 py-2.5 bg-amber-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.9em] font-extrabold bg-amber-500/15 border border-amber-500/30 text-amber-500">{round}</div>
                          <span className="text-[0.9em] font-extrabold text-amber-500">День</span>
                        </div>
                        {votingForDay ? (
                          <div className="flex flex-col gap-2 pl-1">
                            {votingForDay.finalWinners?.length > 0 ? (
                              votingForDay.finalWinners.map(num => {
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
                              })
                            ) : (
                              <div className="flex items-center gap-2 text-white/30">
                                <span className="text-[1.1em]">🗳</span>
                                <span className="text-[0.9em] font-semibold">Никто не выбыл</span>
                              </div>
                            )}
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
        </div>
      )}
    </div>
  );
}

function SeriesSummary({ allGames }) {
  const playerTotals = {};

  allGames.forEach(game => {
    const tableOut = buildTableOut(game);
    tableOut.forEach(p => {
      const login = p.login || `Игрок ${p.num}`;
      const score = calcScore(p.roleKey, game);
      if (!playerTotals[login]) {
        playerTotals[login] = { login, avatar: p.avatar_link, totalScore: 0, games: 0, wins: 0 };
      }
      playerTotals[login].totalScore += score;
      playerTotals[login].games += 1;
      if (!p.avatar_link) playerTotals[login].avatar = playerTotals[login].avatar || null;
      else playerTotals[login].avatar = p.avatar_link;

      const isBlack = isBlackRole(p.role);
      const won = (game.winnerTeam === 'civilians' && !isBlack) || (game.winnerTeam === 'mafia' && isBlack);
      if (won) playerTotals[login].wins += 1;
    });
  });

  const sorted = Object.values(playerTotals).sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center mb-1">
        <span className="text-xs font-bold uppercase tracking-widest text-white/30">Общий зачёт — {allGames.length} {allGames.length === 1 ? 'игра' : allGames.length < 5 ? 'игры' : 'игр'}</span>
      </div>
      {sorted.map((p, i) => (
        <div key={p.login} className="glass-card rounded-2xl px-3 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shrink-0"
            style={{
              background: i === 0 ? 'rgba(255,214,10,0.15)' : i === 1 ? 'rgba(192,192,192,0.12)' : i === 2 ? 'rgba(205,127,50,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${i === 0 ? 'rgba(255,214,10,0.3)' : i === 1 ? 'rgba(192,192,192,0.25)' : i === 2 ? 'rgba(205,127,50,0.25)' : 'rgba(255,255,255,0.08)'}`,
              color: i === 0 ? '#ffd60a' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)',
            }}>
            {i + 1}
          </div>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 text-xs font-bold overflow-hidden"
              style={p.avatar ? { backgroundImage: `url(${p.avatar})`, backgroundSize: 'cover', color: 'transparent' } : {}}>
              {!p.avatar && (p.login?.[0]?.toUpperCase() || '?')}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{p.login}</div>
            <div className="text-[0.65rem] text-white/30">{p.wins}/{p.games} побед</div>
          </div>
          <div className={`text-lg font-extrabold tabular-nums ${p.totalScore > 0 ? 'text-green-400' : p.totalScore < 0 ? 'text-red-400' : 'text-white'}`}>
            {p.totalScore.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SharedResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('series');

  const shareId = window.location.pathname.replace('/share/', '').replace(/\//g, '');

  useEffect(() => {
    (async () => {
      try {
        const result = await goMafiaApi.getShare(shareId);
        if (!result || result.error) {
          setError(result?.error || 'Результаты не найдены');
        } else {
          setData(result);
        }
      } catch {
        setError('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--maf-gradient-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <span className="text-sm text-white/40 font-medium">Загрузка результатов...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--maf-gradient-bg)' }}>
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div className="text-4xl">🔍</div>
          <div className="text-lg font-bold text-white/80">{error}</div>
          <div className="text-sm text-white/40">Ссылка недействительна или результаты были удалены</div>
          <a href="/" className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold bg-accent/15 border border-accent/25 text-accent active:scale-95 transition-transform">
            На главную
          </a>
        </div>
      </div>
    );
  }

  const allGames = [...(data.gamesHistory || []), data.currentGame].filter(Boolean);
  const hasMultipleGames = allGames.length > 1;
  const title = data.tournamentName || 'Результаты серии';
  const modeLabel = data.gameMode === 'gomafia' ? 'GoMafia' : data.gameMode === 'funky' ? 'Funky' : data.gameMode === 'city' ? 'Город' : 'Ручной';

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--maf-gradient-bg)' }}>
      <div className="max-w-[480px] mx-auto" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(32px + var(--safe-bottom, 0px))' }}>
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[0.65rem] font-bold text-white/40 uppercase tracking-wider mb-3">
            <span>MafBoard</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>{modeLabel}</span>
          </div>
          <h1 className="text-xl font-extrabold text-white mb-1">{title}</h1>
          <div className="text-xs text-white/30">
            {allGames.length} {allGames.length === 1 ? 'игра' : allGames.length < 5 ? 'игры' : 'игр'}
            {data.createdAt && ` · ${new Date(data.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>
        </div>

        {/* View toggle (only for multi-game sessions) */}
        {hasMultipleGames && (
          <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl mb-4">
            <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-smooth"
              style={{
                width: 'calc(50% - 4px)',
                left: activeView === 'series' ? 4 : 'calc(50% + 0px)',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(99,102,241,0.12) 100%)',
                border: '1px solid rgba(168,85,247,0.2)',
                boxShadow: '0 4px 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
              }} />
            {[
              { id: 'series', label: 'Общий зачёт' },
              { id: 'games', label: 'По играм' },
            ].map(t => (
              <button key={t.id}
                onClick={() => setActiveView(t.id)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${activeView === t.id ? 'text-white' : 'text-white/35'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {hasMultipleGames && activeView === 'series' && (
          <SeriesSummary allGames={allGames} />
        )}

        {(activeView === 'games' || !hasMultipleGames) && (
          <div className="flex flex-col gap-3">
            {allGames.map((game, idx) => (
              <GameCard
                key={idx}
                game={game}
                gameNumber={game.gameNumber || idx + 1}
                defaultExpanded={allGames.length === 1}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <a href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-accent/15 border border-accent/25 text-accent active:scale-95 transition-transform">
            Открыть MafBoard
          </a>
        </div>
      </div>
    </div>
  );
}
