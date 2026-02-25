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

const getResultDotColor = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return 'bg-red-500';
  if (s.gameFinished && s.winnerTeam === 'mafia') return 'bg-slate-400';
  if (s.gameFinished && s.winnerTeam === 'draw') return 'bg-white';
  if (s.winnerTeam && !s.gameFinished) return 'bg-orange-400';
  return 'bg-emerald-400';
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
    <div className={`relative w-full rounded-2xl overflow-hidden transition-all duration-300
      ${group.archived ? 'opacity-70' : ''}
      ${expanded
        ? 'bg-white/[0.06] border border-white/[0.18] shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
        : 'bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.15]'}
      backdrop-blur-md`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none rounded-2xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 p-4 cursor-pointer active:bg-white/[0.03] transition-colors" onClick={handleToggle}>
        <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0
          ${group.archived
            ? 'bg-white/[0.04] border border-white/[0.08]'
            : 'bg-purple-500/10 border border-purple-500/[0.15]'}`}
        >
          {group.archived
            ? <IconLock size={20} color="rgba(255,255,255,0.4)" />
            : group.gameMode === 'gomafia'
              ? <IconGoMafia size={28} />
              : group.isFunky
                ? <IconDice size={20} color="var(--accent-color, #a855f7)" />
                : <IconTrophy size={20} color="var(--accent-color, #a855f7)" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-[1em] text-white truncate mb-1">{group.tournamentName}</div>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            {modeLabel && (
              <span className="text-[0.65em] font-extrabold px-2 py-0.5 rounded-lg bg-purple-500/[0.12] text-[var(--accent-color,#a855f7)] uppercase tracking-wide border border-purple-500/[0.15]">
                {modeLabel}
              </span>
            )}
            {!group.isFunky && group.tableSelected && (
              <span className="text-[0.72em] text-white/40 font-semibold">Стол {group.tableSelected}</span>
            )}
            {!group.isFunky && (
              <span className="text-[0.72em] text-white/40 font-semibold">
                Игра {group.lastStartedGameNumber || group.sessions.length}
              </span>
            )}
          </div>

          {group.isFunky ? (
            <div className="text-[0.65em] text-white/30 font-semibold">
              {completedGames} {completedGames === 1 ? 'игра' : completedGames < 5 ? 'игры' : 'игр'} сыграно
            </div>
          ) : (
            <>
              <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-color,#a855f7)] to-indigo-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[0.65em] text-white/30 font-semibold">
                {completedGames} из {totalGames} завершено
              </div>
            </>
          )}
        </div>

        <span className={`shrink-0 flex transition-transform duration-300 ${expanded ? 'rotate-180' : 'rotate-0'}`}>
          <IconChevronDown size={18} color="rgba(255,255,255,0.3)" />
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="relative z-10 border-t border-white/[0.06] bg-black/20 animate-[fadeIn_0.2s_ease-out]">
          <div className="px-2 pt-1.5">
            {group.sessions.map((s, idx) => (
              <div
                key={s.sessionId}
                className={`flex items-center gap-2 py-[11px] px-3 rounded-xl cursor-pointer transition-colors active:bg-white/[0.05]
                  ${s.seriesArchived ? 'opacity-50 cursor-default' : ''}`}
                onClick={() => handleGameRowClick(s)}
              >
                <div className="flex flex-col gap-0.5 min-w-[80px]">
                  <span className="text-[0.85em] font-bold text-white/75 whitespace-nowrap">
                    Игра {s.gameSelected || idx + 1}
                  </span>
                  {s.tableSelected && (
                    <span className="text-[0.7em] text-white/30 whitespace-nowrap font-semibold">Стол {s.tableSelected}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getResultDotColor(s)}`} />
                  <span className="text-[0.78em] text-white/50 font-medium">{getResultText(s)}</span>
                  <span className="text-[0.7em] text-white/20 whitespace-nowrap">{formatTime(s.timestamp || s.updatedAt)}</span>
                  {!s.seriesArchived && !isGameComplete(s) && (
                    <button
                      className="p-1.5 opacity-40 hover:opacity-100 active:bg-red-500/[0.15] rounded-lg transition-all"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(s.sessionId); triggerHaptic('warning'); }}
                    >
                      <IconTrash size={13} color="rgba(255,255,255,0.4)" />
                    </button>
                  )}
                  <IconArrowRight size={14} color="rgba(255,255,255,0.15)" />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 px-3 py-2.5 pb-3.5">
            {!group.archived && onNewGame && (
              <button
                className="flex-1 flex items-center justify-center gap-[7px] py-[11px] px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all active:scale-[0.97] border border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
                onClick={(e) => { e.stopPropagation(); onNewGame(group); triggerHaptic('medium'); }}
              >
                <IconPlus size={15} /><span>Новая игра</span>
              </button>
            )}
            {hasFinishedGames && (
              <button
                className="flex-1 flex items-center justify-center gap-[7px] py-[11px] px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all active:scale-[0.97] border border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
                onClick={(e) => { e.stopPropagation(); onShowTable?.(group); triggerHaptic('light'); }}
              >
                <IconList size={15} /><span>{group.isFunky ? 'Итоги' : 'Таблица'}</span>
              </button>
            )}
            {!group.archived && !group.allGamesFinished && (
              confirmAction === 'delete' ? (
                <div className="flex-1 flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-[0.8em] font-bold text-white/60 whitespace-nowrap">Удалить серию?</span>
                  <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] bg-red-500/[0.15] border border-red-500/30 text-red-400 active:scale-95 transition-transform" onClick={handleDeleteSeriesClick}>Да</button>
                  <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] bg-white/[0.04] border border-white/[0.08] text-white/40 active:scale-95 transition-transform" onClick={handleCancelConfirm}>Нет</button>
                </div>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-[7px] py-[11px] px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all active:scale-[0.97] bg-red-500/[0.05] border border-red-500/[0.18] text-red-400/80 hover:bg-red-500/[0.1]"
                  onClick={handleDeleteSeriesClick}
                >
                  <IconTrash size={15} /><span>Удалить серию</span>
                </button>
              )
            )}
            {!group.archived && group.allGamesFinished && (
              confirmAction === 'save' ? (
                <div className="flex-1 flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-[0.8em] font-bold text-white/60 whitespace-nowrap">Сохранить?</span>
                  <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] bg-emerald-500/[0.15] border border-emerald-500/30 text-emerald-400 active:scale-95 transition-transform" onClick={handleSaveSeriesClick}>Да</button>
                  <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] bg-white/[0.04] border border-white/[0.08] text-white/40 active:scale-95 transition-transform" onClick={handleCancelConfirm}>Нет</button>
                </div>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-[7px] py-[11px] px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all active:scale-[0.97] border border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
                  onClick={handleSaveSeriesClick}
                >
                  <IconCheck size={15} /><span>Сохранить серию</span>
                </button>
              )
            )}
            {group.archived && (
              <div className="flex-1 flex items-center justify-center gap-2 py-[11px] px-3 rounded-xl text-[0.78em] font-bold text-white/30 bg-white/[0.02] border border-white/[0.05]">
                <IconLock size={13} /><span>Серия завершена</span>
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
      <div className={`relative w-full rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-300
        bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.15]
        ${expanded ? 'shadow-[0_4px_24px_rgba(0,0,0,0.3)]' : ''}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none rounded-2xl" />

        <div className="relative z-10 p-4 pr-12 cursor-pointer" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <div className="flex justify-between items-start mb-2 gap-2.5">
            <div className="font-bold text-[1em] text-white flex-1 min-w-0 truncate">
              {getSessionName(session)}
              <span className="text-[0.65em] font-extrabold px-2 py-0.5 rounded-md bg-purple-500/[0.12] text-[var(--accent-color,#a855f7)] ml-2 tracking-tight border border-purple-500/[0.18] align-middle">
                {totalGames} {totalGames === 1 ? 'игра' : totalGames < 5 ? 'игры' : 'игр'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.75em] text-white/30 whitespace-nowrap shrink-0">
                {formatTime(session.timestamp || session.updatedAt)}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : 'rotate-0'}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[0.85em] font-bold py-0.5 px-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.08]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${getResultDotColor(session)}`} />
              {getResultText(session)}
            </span>
            {modeLabel && (
              <span className="text-[0.7em] py-0.5 px-2 rounded-lg bg-purple-500/10 text-[var(--accent-color,#a855f7)] font-extrabold uppercase tracking-wide border border-purple-500/[0.15]">
                {modeLabel}
              </span>
            )}
            {(civWins > 0 || mafWins > 0) && (
              <span className="text-[0.8em] font-extrabold inline-flex items-center gap-[3px] font-mono tracking-tight">
                <span className="text-red-400">{civWins}</span>
                <span className="text-white/20">:</span>
                <span className="text-sky-400">{mafWins}</span>
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className="relative z-10 border-t border-white/[0.06] mt-0 pt-2 pb-1 px-4 animate-[fadeIn_0.15s_ease-out]">
            {allGamesForDisplay.map((g, idx) => {
              const winLabel = g.winnerTeam === 'civilians' ? 'Мирные' : g.winnerTeam === 'mafia' ? 'Мафия' : g.winnerTeam === 'draw' ? 'Ничья' : 'В процессе';
              const winColor = g.winnerTeam === 'civilians' ? 'text-red-400' : g.winnerTeam === 'mafia' ? 'text-sky-400' : g.winnerTeam === 'draw' ? 'text-white/50' : 'text-white/30';
              const rounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
              return (
                <div key={idx} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-1 transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.8em] font-extrabold bg-purple-500/[0.08] border border-purple-500/[0.15] text-[var(--accent-color,#a855f7)] shrink-0">
                    {g.gameNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold">Игра {g.gameNumber}</span>
                    {rounds > 0 && <span className="text-[0.6rem] text-white/20 ml-1.5">{rounds}р</span>}
                  </div>
                  <span className={`text-xs font-bold ${winColor}`}>{winLabel}</span>
                </div>
              );
            })}
            <button
              className="w-full py-2.5 mt-1.5 mb-2 rounded-xl bg-purple-500/[0.08] border border-purple-500/[0.18] text-[var(--accent-color,#a855f7)] text-[0.85em] font-bold cursor-pointer transition-all active:scale-[0.98] active:bg-purple-500/[0.15] hover:bg-purple-500/[0.12]"
              onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
            >
              Открыть сессию
            </button>
          </div>
        )}

        <button
          className="absolute top-1/2 right-2.5 -translate-y-1/2 z-20 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-transparent border border-red-500/25 text-red-500/50 cursor-pointer transition-all active:scale-90 active:bg-red-500/70 active:text-white"
          onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
        >
          <IconTrash size={14} color="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full py-4 px-4 pr-12 rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-md overflow-hidden bg-white/[0.04] border border-white/[0.10] hover:border-white/[0.15] active:scale-[0.98] active:bg-white/[0.08]"
      onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

      <div className="relative z-10 flex justify-between items-start mb-2 gap-2.5">
        <div className="font-bold text-[1em] text-white flex-1 min-w-0 truncate">
          {getSessionName(session)}
          {session.gameSelected && (
            <span className="text-[0.7em] text-white/35 ml-1.5 font-semibold">И{session.gameSelected}/С{session.tableSelected}</span>
          )}
        </div>
        <span className="text-[0.75em] text-white/30 whitespace-nowrap shrink-0">
          {formatTime(session.timestamp || session.updatedAt)}
        </span>
      </div>

      <div className="relative z-10 flex flex-wrap gap-2 items-center">
        <span className="inline-flex items-center gap-1.5 text-[0.85em] font-bold py-0.5 px-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.08]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${getResultDotColor(session)}`} />
          {getResultText(session)}
        </span>
        {modeLabel && (
          <span className="text-[0.7em] py-0.5 px-2 rounded-lg bg-purple-500/10 text-[var(--accent-color,#a855f7)] font-extrabold uppercase tracking-wide border border-purple-500/[0.15]">
            {modeLabel}
          </span>
        )}
      </div>

      <button
        className="absolute top-1/2 right-2.5 -translate-y-1/2 z-20 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-transparent border border-red-500/25 text-red-500/50 cursor-pointer transition-all active:scale-90 active:bg-red-500/70 active:text-white"
        onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
      >
        <IconTrash size={14} color="currentColor" />
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
      <div className="flex items-center w-full max-w-[400px] pl-1 mb-3">
        <span className="text-[0.85em] font-bold text-white/40 uppercase tracking-[1.2px]">
          {activeTab === 'active' ? 'Активные игры' : 'История игр'}
        </span>
        <span className="ml-1.5 bg-white/[0.06] px-2 py-[1px] rounded-[10px] text-[0.76em] text-white/50 border border-white/[0.06]">
          {totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 w-full max-w-[400px] pb-[100px]">
        {displayGroups.length === 0 && displayStandalone.length === 0 ? (
          <div className="py-12 px-5 text-center border-2 border-dashed border-white/[0.08] rounded-2xl">
            <div className="mb-4 flex justify-center opacity-30">
              <IconDice size={48} color="rgba(255,255,255,0.15)" />
            </div>
            <div className="text-[0.9em] text-white/30 font-semibold mb-2">
              Нет {activeTab === 'active' ? 'активных' : 'завершенных'} игр
            </div>
            {activeTab === 'active' && (
              <div className="text-[0.8em] text-white/20 font-medium">
                Создайте новую игру — она сохранится автоматически
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
