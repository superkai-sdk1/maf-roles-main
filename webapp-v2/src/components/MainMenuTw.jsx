import React, { useMemo, useState, useCallback } from 'react';
import {
  IconPlayCircle, IconHistory, IconPlus, IconDice, IconChevronDown,
  IconTrash, IconMafBoard, IconCheck, IconArrowRight, IconLock,
  IconGoMafia, IconTrophy, IconList, IconX,
} from '../utils/icons';
import { triggerHaptic } from '../utils/haptics';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const getResultText = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return 'Мирные';
  if (s.gameFinished && s.winnerTeam === 'mafia') return 'Мафия';
  if (s.gameFinished && s.winnerTeam === 'draw') return 'Ничья';
  if (s.winnerTeam && !s.gameFinished) return 'Баллы...';
  return 'В процессе';
};

const getStatusStyle = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return { dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  if (s.gameFinished && s.winnerTeam === 'mafia') return { dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]', text: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
  if (s.gameFinished && s.winnerTeam === 'draw') return { dot: 'bg-zinc-400', text: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' };
  if (s.winnerTeam && !s.gameFinished) return { dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
  return { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
};

const getModeLabel = (mode) => {
  if (mode === 'gomafia') return 'GoMafia';
  if (mode === 'funky') return 'Фанки';
  if (mode === 'city') return 'Городская';
  return null;
};

const isGameComplete = (s) => s.winnerTeam && s.gameFinished;

export function TwSeriesCard({ group, expanded, onToggle, onLoadSession, onDeleteSession, onArchive, onDeleteSeries, onNewGame, onShowTable }) {
  const [confirmAction, setConfirmAction] = useState(null);

  const modeLabel = group.isFunky ? 'Фанки' : getModeLabel(group.gameMode);
  const totalGames = group.totalGamesForTable || group.totalGamesInTournament || group.sessions.length;
  const completedGames = group.sessions.filter(s => s.winnerTeam).length;
  const progress = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
  const hasFinishedGames = completedGames > 0;

  const handleDeleteSeriesClick = useCallback((e) => {
    e.stopPropagation();
    if (confirmAction !== 'delete') { setConfirmAction('delete'); triggerHaptic('warning'); return; }
    onDeleteSeries(group.tournamentId);
    setConfirmAction(null);
  }, [confirmAction, onDeleteSeries, group.tournamentId]);

  const handleSaveSeriesClick = useCallback((e) => {
    e.stopPropagation();
    if (confirmAction !== 'save') { setConfirmAction('save'); triggerHaptic('warning'); return; }
    onArchive(group.tournamentId);
    setConfirmAction(null);
  }, [confirmAction, onArchive, group.tournamentId]);

  const handleCancelConfirm = useCallback((e) => { e.stopPropagation(); setConfirmAction(null); }, []);
  const handleToggle = useCallback(() => { onToggle(); setConfirmAction(null); }, [onToggle]);

  const handleGameRowClick = useCallback((s) => {
    if (isGameComplete(s)) onLoadSession(s.sessionId, { viewOnly: true });
    else onLoadSession(s.sessionId);
    triggerHaptic('light');
  }, [onLoadSession]);

  return (
    <div className={`relative w-full overflow-hidden transition-all duration-300 rounded-3xl
      ${group.archived ? 'opacity-60' : ''}
      ${expanded
        ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-purple-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.4),0_0_60px_rgba(168,85,247,0.08)]'
        : 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-purple-500/15 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'}`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-300
        ${expanded ? 'bg-gradient-to-b from-purple-400 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/[0.08]'}`} />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3.5 pl-5 pr-4 py-4 cursor-pointer active:bg-white/[0.02] transition-colors" onClick={handleToggle}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300
          ${group.archived
            ? 'bg-white/[0.04] border border-white/[0.06]'
            : expanded
              ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/25 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
              : 'bg-purple-500/[0.08] border border-purple-500/10'}`}
        >
          {group.archived
            ? <IconLock size={20} color="rgba(255,255,255,0.35)" />
            : group.gameMode === 'gomafia'
              ? <IconGoMafia size={28} />
              : group.isFunky
                ? <IconDice size={22} color="var(--accent-color, #a855f7)" />
                : <IconTrophy size={22} color="var(--accent-color, #a855f7)" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[0.95em] text-white truncate tracking-tight">{group.tournamentName}</div>

          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {modeLabel && (
              <span className="text-[0.6em] font-black px-2 py-[3px] rounded-md bg-gradient-to-r from-purple-500/15 to-indigo-500/10 text-purple-300 uppercase tracking-widest border border-purple-500/20">
                {modeLabel}
              </span>
            )}
            {!group.isFunky && group.tableSelected && (
              <span className="text-[0.68em] text-white/30 font-semibold">Стол {group.tableSelected}</span>
            )}
            {!group.isFunky && (
              <span className="text-[0.68em] text-white/30 font-semibold">
                Игра {group.lastStartedGameNumber || group.sessions.length}
              </span>
            )}
          </div>

          {group.isFunky ? (
            <div className="text-[0.65em] text-white/25 font-semibold mt-2">
              {completedGames} {completedGames === 1 ? 'игра' : completedGames < 5 ? 'игры' : 'игр'} сыграно
            </div>
          ) : (
            <div className="mt-2.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[0.6em] text-white/25 font-bold uppercase tracking-wider">Прогресс</span>
                <span className="text-[0.6em] text-white/35 font-bold tabular-nums">{completedGames}/{totalGames}</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--accent-color, #a855f7), #818cf8, #6366f1)',
                    boxShadow: progress > 0 ? '0 0 12px rgba(168,85,247,0.4)' : 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <span className={`shrink-0 flex transition-transform duration-300 ease-out ${expanded ? 'rotate-180' : 'rotate-0'}`}>
          <IconChevronDown size={16} color="rgba(255,255,255,0.25)" />
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="relative z-10 mx-3 mb-3 rounded-2xl bg-black/30 border border-white/[0.05] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {group.sessions.map((s, idx) => {
              const st = getStatusStyle(s);
              return (
                <div
                  key={s.sessionId}
                  className={`flex items-center gap-3 py-3 px-4 cursor-pointer transition-all hover:bg-white/[0.03] active:bg-white/[0.06]
                    ${s.seriesArchived ? 'opacity-40' : ''}`}
                  onClick={() => handleGameRowClick(s)}
                >
                  <div className="flex flex-col gap-0.5 min-w-[70px]">
                    <span className="text-[0.82em] font-bold text-white/80">
                      Игра {s.gameSelected || idx + 1}
                    </span>
                    {s.tableSelected && (
                      <span className="text-[0.65em] text-white/25 font-medium">Стол {s.tableSelected}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className={`inline-flex items-center gap-1.5 text-[0.72em] font-bold py-1 px-2.5 rounded-lg border ${st.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={st.text}>{getResultText(s)}</span>
                    </span>
                    <span className="text-[0.65em] text-white/15 font-medium">{formatTime(s.timestamp || s.updatedAt)}</span>
                    {!s.seriesArchived && !isGameComplete(s) && (
                      <button
                        className="p-1 opacity-30 hover:opacity-80 active:bg-red-500/20 rounded-md transition-all"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s.sessionId); triggerHaptic('warning'); }}
                      >
                        <IconTrash size={12} color="rgba(255,255,255,0.5)" />
                      </button>
                    )}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 p-3 pt-2 border-t border-white/[0.04]">
            {!group.archived && onNewGame && (
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.75em] transition-all active:scale-[0.97] bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-purple-300 hover:from-purple-500/15 hover:to-indigo-500/15"
                onClick={(e) => { e.stopPropagation(); onNewGame(group); triggerHaptic('medium'); }}
              >
                <IconPlus size={14} /><span>Новая игра</span>
              </button>
            )}
            {hasFinishedGames && (
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.75em] transition-all active:scale-[0.97] border border-white/[0.06] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                onClick={(e) => { e.stopPropagation(); onShowTable?.(group); triggerHaptic('light'); }}
              >
                <IconList size={14} /><span>{group.isFunky ? 'Итоги' : 'Таблица'}</span>
              </button>
            )}
            {!group.archived && !group.allGamesFinished && (
              confirmAction === 'delete' ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-[0.75em] font-bold text-white/50 whitespace-nowrap">Удалить?</span>
                  <button className="flex-1 py-2 px-3 rounded-xl font-bold text-[0.75em] bg-red-500/15 border border-red-500/25 text-red-400 active:scale-95 transition-transform" onClick={handleDeleteSeriesClick}>Да</button>
                  <button className="flex-1 py-2 px-3 rounded-xl font-bold text-[0.75em] bg-white/[0.03] border border-white/[0.06] text-white/35 active:scale-95 transition-transform" onClick={handleCancelConfirm}>Нет</button>
                </div>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.75em] transition-all active:scale-[0.97] bg-red-500/[0.05] border border-red-500/15 text-red-400/60 hover:bg-red-500/10"
                  onClick={handleDeleteSeriesClick}
                >
                  <IconTrash size={14} /><span>Удалить</span>
                </button>
              )
            )}
            {!group.archived && group.allGamesFinished && (
              confirmAction === 'save' ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-[0.75em] font-bold text-white/50 whitespace-nowrap">Сохранить?</span>
                  <button className="flex-1 py-2 px-3 rounded-xl font-bold text-[0.75em] bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 active:scale-95 transition-transform" onClick={handleSaveSeriesClick}>Да</button>
                  <button className="flex-1 py-2 px-3 rounded-xl font-bold text-[0.75em] bg-white/[0.03] border border-white/[0.06] text-white/35 active:scale-95 transition-transform" onClick={handleCancelConfirm}>Нет</button>
                </div>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.75em] transition-all active:scale-[0.97] bg-emerald-500/[0.08] border border-emerald-500/15 text-emerald-400/70 hover:bg-emerald-500/15"
                  onClick={handleSaveSeriesClick}
                >
                  <IconCheck size={14} /><span>Сохранить серию</span>
                </button>
              )
            )}
            {group.archived && (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[0.75em] font-bold text-white/20 bg-white/[0.02]">
                <IconLock size={12} /><span>Серия завершена</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TwStandaloneCard({ session, onLoad, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const getSessionName = (s) =>
    s.tournamentName || s.tournamentId ||
    (s.gameMode === 'funky' ? 'Фанки' : s.gameMode === 'city' ? 'Городская' : s.gameMode === 'gomafia' ? 'GoMafia' : 'Ручной');

  const modeLabel = getModeLabel(session.gameMode);
  const gh = session.gamesHistory || [];
  const hasMultipleGames = gh.length > 0;
  const st = getStatusStyle(session);

  const allGamesForDisplay = useMemo(() => {
    const result = gh.map((g, idx) => ({
      gameNumber: g.gameNumber || (idx + 1),
      winnerTeam: g.winnerTeam,
      dayNumber: g.dayNumber,
      nightNumber: g.nightNumber,
      completedAt: g.completedAt,
    }));
    if (session.winnerTeam) {
      result.push({
        gameNumber: gh.length + 1,
        winnerTeam: session.winnerTeam,
        dayNumber: session.dayNumber,
        nightNumber: session.nightNumber,
        completedAt: session.updatedAt,
        isCurrent: true,
      });
    }
    return result;
  }, [session, gh]);

  if (hasMultipleGames) {
    const totalGames = gh.length + (session.winnerTeam ? 1 : (session.gamePhase && session.gamePhase !== 'roles' ? 1 : 0));
    const civWins = allGamesForDisplay.filter(g => g.winnerTeam === 'civilians').length;
    const mafWins = allGamesForDisplay.filter(g => g.winnerTeam === 'mafia').length;

    return (
      <div className={`relative w-full overflow-hidden transition-all duration-300 rounded-3xl
        bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-purple-500/15
        ${expanded ? 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]' : ''}`}
      >
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-white/[0.06]" />

        <div className="relative z-10 pl-5 pr-12 py-4 cursor-pointer" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-extrabold text-[0.95em] text-white flex-1 min-w-0 truncate tracking-tight">
              {getSessionName(session)}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[0.65em] font-black px-2 py-[3px] rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 tabular-nums">
                {totalGames} {totalGames === 1 ? 'игра' : totalGames < 5 ? 'игры' : 'игр'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-300 ${expanded ? 'rotate-180' : 'rotate-0'}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[0.72em] font-bold py-1 px-2.5 rounded-lg border ${st.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              <span className={st.text}>{getResultText(session)}</span>
            </span>
            {modeLabel && (
              <span className="text-[0.6em] font-black px-2 py-[3px] rounded-md bg-gradient-to-r from-purple-500/15 to-indigo-500/10 text-purple-300 uppercase tracking-widest border border-purple-500/20">
                {modeLabel}
              </span>
            )}
            {(civWins > 0 || mafWins > 0) && (
              <span className="text-[0.8em] font-black inline-flex items-center gap-1 tabular-nums ml-auto">
                <span className="text-rose-400">{civWins}</span>
                <span className="text-white/15">:</span>
                <span className="text-cyan-400">{mafWins}</span>
              </span>
            )}
            <span className="text-[0.65em] text-white/15 font-medium ml-auto">{formatTime(session.timestamp || session.updatedAt)}</span>
          </div>
        </div>

        {expanded && (
          <div className="relative z-10 mx-3 mb-3 rounded-2xl bg-black/30 border border-white/[0.05] overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {allGamesForDisplay.map((g, idx) => {
                const gst = getStatusStyle(g);
                const rounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
                return (
                  <div key={idx} className="flex items-center gap-3 py-2.5 px-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[0.8em] font-black bg-purple-500/[0.08] border border-purple-500/15 text-purple-300 shrink-0 tabular-nums">
                      {g.gameNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.8em] font-semibold text-white/70">Игра {g.gameNumber}</span>
                      {rounds > 0 && <span className="text-[0.6em] text-white/15 ml-1.5 font-medium">{rounds} раунд</span>}
                    </div>
                    <span className={`text-[0.72em] font-bold ${gst.text}`}>{getResultText(g)}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-2.5 border-t border-white/[0.04]">
              <button
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-purple-300 text-[0.82em] font-bold cursor-pointer transition-all active:scale-[0.98] hover:from-purple-500/15 hover:to-indigo-500/15"
                onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
              >
                Открыть сессию
              </button>
            </div>
          </div>
        )}

        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 z-20 w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.03] border border-red-500/15 text-red-400/40 cursor-pointer transition-all active:scale-90 active:bg-red-500/60 active:text-white hover:bg-red-500/10 hover:text-red-400/70"
          onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
        >
          <IconTrash size={13} color="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden transition-all duration-300 rounded-3xl cursor-pointer bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-purple-500/15 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] active:scale-[0.98]"
      onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
    >
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-white/[0.06]" />

      <div className="relative z-10 pl-5 pr-12 py-4">
        <div className="flex justify-between items-center mb-2">
          <div className="font-extrabold text-[0.95em] text-white flex-1 min-w-0 truncate tracking-tight">
            {getSessionName(session)}
            {session.gameSelected && (
              <span className="text-[0.65em] text-white/25 ml-1.5 font-semibold tracking-normal">И{session.gameSelected}/С{session.tableSelected}</span>
            )}
          </div>
          <span className="text-[0.65em] text-white/15 font-medium shrink-0">
            {formatTime(session.timestamp || session.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[0.72em] font-bold py-1 px-2.5 rounded-lg border ${st.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            <span className={st.text}>{getResultText(session)}</span>
          </span>
          {modeLabel && (
            <span className="text-[0.6em] font-black px-2 py-[3px] rounded-md bg-gradient-to-r from-purple-500/15 to-indigo-500/10 text-purple-300 uppercase tracking-widest border border-purple-500/20">
              {modeLabel}
            </span>
          )}
        </div>
      </div>

      <button
        className="absolute top-1/2 right-3 -translate-y-1/2 z-20 w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.03] border border-red-500/15 text-red-400/40 cursor-pointer transition-all active:scale-90 active:bg-red-500/60 active:text-white hover:bg-red-500/10 hover:text-red-400/70"
        onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
      >
        <IconTrash size={13} color="currentColor" />
      </button>
    </div>
  );
}

export function TwGameList({
  displayGroups, displayStandalone, activeTab, totalCount,
  expandedSeries, toggleExpanded, loadSession, deleteSession,
  archiveSeries, deleteSeries, handleNewGameInTournament,
  startNewFunkyFromMenu, setTableGroup,
}) {
  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between w-full max-w-[400px] mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-400 to-indigo-500" />
          <span className="text-[0.9em] font-extrabold text-white/60 tracking-tight">
            {activeTab === 'active' ? 'Активные игры' : 'История игр'}
          </span>
        </div>
        <span className="text-[0.7em] font-black px-2.5 py-1 rounded-lg bg-white/[0.04] text-white/30 border border-white/[0.06] tabular-nums">
          {totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[400px] pb-[100px]">
        {displayGroups.length === 0 && displayStandalone.length === 0 ? (
          <div className="py-16 px-6 text-center rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent border border-dashed border-white/[0.06]">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/[0.06] border border-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <IconDice size={32} color="rgba(168,85,247,0.3)" />
            </div>
            <div className="text-[0.95em] text-white/35 font-bold mb-1.5">
              {activeTab === 'active' ? 'Нет активных игр' : 'История пуста'}
            </div>
            {activeTab === 'active' && (
              <div className="text-[0.8em] text-white/18 font-medium leading-relaxed max-w-[260px] mx-auto">
                Нажмите «Новая» чтобы создать игру — она сохранится автоматически
              </div>
            )}
          </div>
        ) : (
          <>
            {displayGroups.map(g => (
              <TwSeriesCard
                key={g.tournamentId}
                group={g}
                expanded={!!expandedSeries[g.tournamentId]}
                onToggle={() => toggleExpanded(g.tournamentId)}
                onLoadSession={loadSession}
                onDeleteSession={deleteSession}
                onArchive={archiveSeries}
                onDeleteSeries={g.isFunky ? () => { deleteSession(g._originalSessionId); triggerHaptic('medium'); } : deleteSeries}
                onNewGame={g.gameMode === 'gomafia' ? handleNewGameInTournament : g.isFunky ? () => startNewFunkyFromMenu(g._originalSessionId) : null}
                onShowTable={(grp) => { setTableGroup(grp); triggerHaptic('light'); }}
              />
            ))}
            {displayStandalone.map(s => (
              <TwStandaloneCard
                key={s.sessionId}
                session={s}
                onLoad={loadSession}
                onDelete={deleteSession}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
