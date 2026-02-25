import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { sessionManager } from '../services/sessionManager';
import { goMafiaApi, profileApi, sessionsApi, playerApi } from '../services/api';
import { authService } from '../services/auth';
import { COLOR_SCHEMES, applyTheme, applyDarkMode } from '../constants/themes';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
import {
  IconPlayCircle, IconHistory, IconPlus, IconPalette, IconUser,
  IconTrophy, IconDice, IconChevronDown, IconTrash, IconStats, IconMafBoard,
  IconCheck, IconArrowRight, IconLock, IconArchive, IconX, IconList,
  IconGoMafia, IconSettings, IconCamera, IconLink, IconEdit, IconBell, IconTarget,
} from '../utils/icons';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const formatSessionDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} ч назад`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const getResultText = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return 'Мирные';
  if (s.gameFinished && s.winnerTeam === 'mafia') return 'Мафия';
  if (s.gameFinished && s.winnerTeam === 'draw') return 'Ничья';
  if (s.winnerTeam && !s.gameFinished) return 'Баллы...';
  return 'В процессе';
};

const getResultDotStyle = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return { background: '#ff5252', boxShadow: '0 0 6px rgba(255,82,82,0.4)' };
  if (s.gameFinished && s.winnerTeam === 'mafia') return { background: '#4fc3f7', boxShadow: '0 0 6px rgba(79,195,247,0.4)' };
  if (s.gameFinished && s.winnerTeam === 'draw') return { background: '#ffffff', boxShadow: '0 0 6px rgba(255,255,255,0.3)' };
  if (s.winnerTeam && !s.gameFinished) return { background: '#ffb347', boxShadow: '0 0 6px rgba(255,179,71,0.4)' };
  return { background: '#30d158', boxShadow: '0 0 6px rgba(48,209,88,0.4)' };
};

const getModeLabel = (mode) => {
  if (mode === 'gomafia') return 'GoMafia';
  if (mode === 'funky') return 'Фанки';
  if (mode === 'city') return 'Городская';
  return null;
};

const isFunkySession = (s) =>
  s.gameMode === 'funky' || s.funkyMode || (s.tournamentId && s.tournamentId.startsWith('funky_'));

const computeSessionPlayerScore = (session, roleKey) => {
  if (!session.winnerTeam) return 0;
  let s = 0;
  const role = session.roles?.[roleKey];
  if (session.winnerTeam === 'civilians' && (!role || role === 'sheriff' || role === 'peace')) s += 1;
  if (session.winnerTeam === 'mafia' && (role === 'don' || role === 'black')) s += 1;
  const ps = session.playerScores?.[roleKey];
  if (ps) {
    s += parseFloat(ps.bonus || 0);
    s -= parseFloat(ps.penalty || 0);
  }
  return parseFloat(s.toFixed(2));
};

const getWinnerLabel = (team) => {
  if (team === 'civilians') return 'М';
  if (team === 'mafia') return 'Ч';
  if (team === 'draw') return 'Н';
  return '?';
};

const getWinnerColorClass = (team) => {
  if (team === 'civilians') return 'winner-civ';
  if (team === 'mafia') return 'winner-maf';
  if (team === 'draw') return 'winner-draw';
  return '';
};

function SeriesCard({ group, expanded, onToggle, onLoadSession, onDeleteSession, onArchive, onDeleteSeries, onNewGame, onShowTable }) {
  const [confirmAction, setConfirmAction] = useState(null);

  const modeLabel = group.isFunky ? 'Фанки' : getModeLabel(group.gameMode);
  const totalGames = group.totalGamesForTable || group.totalGamesInTournament || group.sessions.length;
  const completedGames = group.sessions.filter(s => s.winnerTeam).length;
  const progress = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
  const hasFinishedGames = completedGames > 0;
  const isGameComplete = (s) => s.winnerTeam && s.gameFinished;

  const handleDeleteSeriesClick = useCallback((e) => {
    e.stopPropagation();
    if (confirmAction !== 'delete') {
      setConfirmAction('delete');
      triggerHaptic('warning');
      return;
    }
    onDeleteSeries(group.tournamentId);
    setConfirmAction(null);
  }, [confirmAction, onDeleteSeries, group.tournamentId]);

  const handleSaveSeriesClick = useCallback((e) => {
    e.stopPropagation();
    if (confirmAction !== 'save') {
      setConfirmAction('save');
      triggerHaptic('warning');
      return;
    }
    onArchive(group.tournamentId);
    setConfirmAction(null);
  }, [confirmAction, onArchive, group.tournamentId]);

  const handleCancelConfirm = useCallback((e) => {
    e.stopPropagation();
    setConfirmAction(null);
  }, []);

  const handleToggle = useCallback(() => {
    onToggle();
    setConfirmAction(null);
  }, [onToggle]);

  const handleGameRowClick = useCallback((s) => {
    if (isGameComplete(s)) {
      onLoadSession(s.sessionId, { viewOnly: true });
    } else {
      onLoadSession(s.sessionId);
    }
    triggerHaptic('light');
  }, [onLoadSession]);

  return (
    <div className={`relative w-full rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 overflow-hidden ${expanded ? 'border-white/[0.18] shadow-[0_8px_32px_rgba(0,0,0,0.3)]' : ''} ${group.archived ? 'opacity-75' : ''}`}>
      <div className="flex items-center p-4 cursor-pointer relative z-[1] gap-3" onClick={handleToggle}>
        <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 ${group.archived ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-accent/10 border border-accent/15'}`}>
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
          <div className="font-bold text-base truncate text-white mb-1">{group.tournamentName}</div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {modeLabel && <span className="text-[0.65em] font-extrabold px-2 py-0.5 rounded-lg bg-accent/10 text-accent uppercase tracking-wider border border-accent/15">{modeLabel}</span>}
            {!group.isFunky && group.tableSelected && <span className="text-[0.72em] text-white/40 font-semibold">Стол {group.tableSelected}</span>}
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
              <div className="h-0.5 bg-white/[0.06] rounded-sm overflow-hidden mb-1">
                <div className="h-full bg-gradient-to-r from-accent to-indigo-500 rounded-sm transition-all duration-500 ease-spring" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-[0.65em] text-white/30 font-semibold">
                {completedGames} из {totalGames} завершено
              </div>
            </>
          )}
        </div>
        <span className="shrink-0 flex transition-transform duration-300 ease-spring" style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
        }}>
          <IconChevronDown size={18} color="rgba(255,255,255,0.3)" />
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] bg-black/20 relative z-[1] animate-expand">
              <div className="py-1.5 px-2 pt-0">
                {group.sessions.map((s, idx) => (
                  <div
                    key={s.sessionId}
                    className={`flex items-center py-2.5 px-3 cursor-pointer rounded-xl gap-2 transition-colors duration-150 active:bg-white/[0.05] ${s.seriesArchived ? 'opacity-60 cursor-default' : ''}`}
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
                      <span className="w-2 h-2 rounded-full shrink-0" style={getResultDotStyle(s)} />
                      <span className="text-[0.78em] text-white/50 font-medium">{getResultText(s)}</span>
                      <span className="text-[0.7em] text-white/20 whitespace-nowrap font-semibold">{formatTime(s.timestamp || s.updatedAt)}</span>
                      {!s.seriesArchived && !isGameComplete(s) && (
                        <button
                          className="bg-transparent border-none cursor-pointer p-1.5 opacity-40 transition-opacity duration-150 rounded-lg flex items-center justify-center active:opacity-100 active:bg-status-error/15"
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

              <div className="flex gap-2 py-2.5 px-3 pb-3.5 flex-wrap">
                {!group.archived && onNewGame && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all duration-150 border border-accent/22 bg-accent/10 text-accent active:scale-[0.97]"
                    onClick={(e) => { e.stopPropagation(); onNewGame(group); triggerHaptic('medium'); }}
                  >
                    <IconPlus size={15} />
                    <span>Новая игра</span>
                  </button>
                )}
                {hasFinishedGames && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all duration-150 border border-yellow-500/18 bg-yellow-500/5 text-yellow-400 active:scale-[0.97]"
                    onClick={(e) => { e.stopPropagation(); onShowTable?.(group); triggerHaptic('light'); }}
                  >
                    <IconList size={15} />
                    <span>{group.isFunky ? 'Итоги' : 'Таблица'}</span>
                  </button>
                )}
                {!group.archived && !group.allGamesFinished && (
                  confirmAction === 'delete' ? (
                    <div className="flex-1 flex items-center gap-2 animate-fade-in">
                      <span className="text-[0.8em] font-bold text-white/60 whitespace-nowrap">Удалить все игры серии?</span>
                      <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] cursor-pointer border border-status-error/30 bg-status-error/15 text-status-error active:scale-95 active:bg-status-error/25" onClick={handleDeleteSeriesClick}>Да</button>
                      <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] cursor-pointer border border-white/10 bg-white/5 text-white/50 active:scale-95" onClick={handleCancelConfirm}>Нет</button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all duration-150 border border-status-error/18 bg-status-error/5 text-status-error active:scale-[0.97] active:bg-status-error/12"
                      onClick={handleDeleteSeriesClick}
                    >
                      <IconTrash size={15} />
                      <span>Удалить серию</span>
                    </button>
                  )
                )}
                {!group.archived && group.allGamesFinished && (
                  confirmAction === 'save' ? (
                    <div className="flex-1 flex items-center gap-2 animate-fade-in">
                      <span className="text-[0.8em] font-bold text-white/60 whitespace-nowrap">Сохранить серию в историю?</span>
                      <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] cursor-pointer border border-accent/30 bg-accent/15 text-accent active:scale-95 active:bg-accent/25" onClick={handleSaveSeriesClick}>Да</button>
                      <button className="flex-1 py-2.5 px-3.5 rounded-[10px] font-bold text-[0.8em] cursor-pointer border border-white/10 bg-white/5 text-white/50 active:scale-95" onClick={handleCancelConfirm}>Нет</button>
                    </div>
                  ) : (
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-[0.78em] cursor-pointer transition-all duration-150 border border-accent/22 bg-accent/10 text-accent active:scale-[0.97]"
                      onClick={handleSaveSeriesClick}
                    >
                      <IconCheck size={15} />
                      <span>Сохранить серию</span>
                    </button>
                  )
                )}
                {group.archived && (
                  <div className="flex items-center gap-1.5 text-[0.7em] font-bold text-white/40">
                    <IconLock size={13} />
                    <span>Серия завершена</span>
                  </div>
                )}
              </div>
        </div>
      )}
    </div>
  );
}

function StandaloneCard({ session, onLoad, onDelete }) {
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
      <div className={`relative rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 overflow-hidden ${expanded ? 'border-white/[0.18]' : ''}`}>
        <div className="flex items-center justify-between gap-3 p-4 cursor-pointer" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {getSessionName(session)}
              <span className="ml-1.5 text-[0.7em] font-extrabold px-1.5 py-0.5 rounded-md bg-white/10 text-white/70">{totalGames} {totalGames === 1 ? 'игра' : totalGames < 5 ? 'игры' : 'игр'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-white/40 font-semibold">
              {formatTime(session.timestamp || session.updatedAt)}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="transition-transform duration-200 shrink-0" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 pt-0 cursor-pointer" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full shrink-0" style={getResultDotStyle(session)} />
            {getResultText(session)}
          </span>
          <div className="flex items-center gap-2">
            {modeLabel && <span className="text-[0.7em] font-bold px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">{modeLabel}</span>}
            {(civWins > 0 || mafWins > 0) && (
              <span className="text-xs font-bold">
                <span style={{ color: '#ff5252' }}>{civWins}</span>
                <span className="text-white/20">:</span>
                <span style={{ color: '#4fc3f7' }}>{mafWins}</span>
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className="px-4 pb-4 border-t border-white/[0.06] animate-fade-in">
            {allGamesForDisplay.map((g, idx) => {
              const winLabel = g.winnerTeam === 'civilians' ? 'Мирные' : g.winnerTeam === 'mafia' ? 'Мафия' : g.winnerTeam === 'draw' ? 'Ничья' : 'В процессе';
              const winColor = g.winnerTeam === 'civilians' ? '#ff5252' : g.winnerTeam === 'mafia' ? '#4fc3f7' : g.winnerTeam === 'draw' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
              const rounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
              return (
                <div key={idx} className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold bg-white/[0.06] shrink-0">{g.gameNumber}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold">Игра {g.gameNumber}</span>
                    {rounds > 0 && <span className="text-[0.6rem] text-white/20 ml-1.5">{rounds}р</span>}
                  </div>
                  <span className="text-xs font-bold" style={{ color: winColor }}>{winLabel}</span>
                </div>
              );
            })}
            <button
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-accent/15 border border-accent/25 text-accent mt-2 active:scale-[0.98] transition-transform duration-150"
              onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
            >
              Открыть сессию
            </button>
          </div>
        )}

        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] active:scale-95 transition-transform"
          onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
        >
          <IconTrash size={14} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 overflow-hidden cursor-pointer" onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">
            {getSessionName(session)}
            {session.gameSelected && (
              <span className="ml-1.5 text-[0.7em] text-white/50 font-semibold">И{session.gameSelected}/С{session.tableSelected}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-white/40 font-semibold shrink-0">
          {formatTime(session.timestamp || session.updatedAt)}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 pb-4 pt-0">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          <span className="w-2 h-2 rounded-full shrink-0" style={getResultDotStyle(session)} />
          {getResultText(session)}
        </span>
        {modeLabel && <span className="text-[0.7em] font-bold px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">{modeLabel}</span>}
      </div>
      <button
        className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] active:scale-95 transition-transform"
        onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
      >
        <IconTrash size={14} color="rgba(255,255,255,0.5)" />
      </button>
    </div>
  );
}

export function MainMenu() {
  const {
    sessionsList, startNewGame, loadSession, deleteSession, archiveSeries, deleteSeries,
    startTournamentGameFromMenu, startNewFunkyFromMenu,
    selectedColorScheme, setSelectedColorScheme,
    darkMode, setDarkMode,
  } = useGame();

  const [activeTab, setActiveTab] = useState('active');
  const [expandedSeries, setExpandedSeries] = useState({});
  const [menuScreen, setMenuScreen] = useState('game');
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [newGameModal, setNewGameModal] = useState({
    visible: false, loading: false, error: '',
    group: null, tournamentData: null, games: [],
  });
  const [tableGroup, setTableGroup] = useState(null);

  const [userDisplayName, setUserDisplayName] = useState(() => {
    try { return localStorage.getItem('maf_user_display_name') || ''; } catch { return ''; }
  });
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => {
    try { return localStorage.getItem('maf_user_avatar') || ''; } catch { return ''; }
  });
  const [profileSettingsName, setProfileSettingsName] = useState('');
  const avatarInputRef = useRef(null);

  const [goMafiaProfile, setGoMafiaProfile] = useState(() => goMafiaApi.getStoredGoMafiaProfile());
  const [goMafiaModal, setGoMafiaModal] = useState(false);
  const [goMafiaLogin, setGoMafiaLogin] = useState({ nickname: '', password: '', loading: false, error: '' });

  const [deviceSessions, setDeviceSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState(null);

  const [playerGames, setPlayerGames] = useState(null);
  const [playerNickname, setPlayerNickname] = useState('');
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [playerDetailSession, setPlayerDetailSession] = useState(null);
  const [playerDetailLoading, setPlayerDetailLoading] = useState(false);
  const [playerDetailTab, setPlayerDetailTab] = useState('scores');
  const [playerSelectedGame, setPlayerSelectedGame] = useState(null);
  const [playerLastViewed, setPlayerLastViewed] = useState(() => {
    try { return parseInt(localStorage.getItem('maf_player_last_viewed') || '0', 10); } catch { return 0; }
  });

  const [linkedAccounts, setLinkedAccounts] = useState(null);
  const [linkTelegramMode, setLinkTelegramMode] = useState(null);
  const linkPollRef = useRef(null);
  const linkTimerRef = useRef(null);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');

  useEffect(() => {
    const token = authService.getStoredToken();
    if (!token) return;

    profileApi.loadProfile(token).then(serverProfile => {
      if (!serverProfile) return;

      if (serverProfile.gomafia) {
        const gm = serverProfile.gomafia;
        const localProfile = {
          nickname: gm.nickname,
          avatar: gm.avatar,
          id: gm.id,
          title: gm.title,
          connectedAt: gm.connectedAt ? new Date(gm.connectedAt).getTime() : Date.now(),
        };
        goMafiaApi.saveGoMafiaProfile(localProfile);
        setGoMafiaProfile(localProfile);

        if (gm.nickname && !localStorage.getItem('maf_user_display_name')) {
          setUserDisplayName(gm.nickname);
          try { localStorage.setItem('maf_user_display_name', gm.nickname); } catch {}
        }
        if (gm.avatar && !localStorage.getItem('maf_user_avatar')) {
          setUserAvatarUrl(gm.avatar);
          try { localStorage.setItem('maf_user_avatar', gm.avatar); } catch {}
        }
      } else {
        const localGm = goMafiaApi.getStoredGoMafiaProfile();
        if (localGm && localGm.nickname) {
          profileApi.saveProfile(token, { gomafia: localGm });
        }
      }

      if (serverProfile.display_name && !localStorage.getItem('maf_user_display_name')) {
        setUserDisplayName(serverProfile.display_name);
        try { localStorage.setItem('maf_user_display_name', serverProfile.display_name); } catch {}
      }
      if (serverProfile.avatar_url && !localStorage.getItem('maf_user_avatar')) {
        setUserAvatarUrl(serverProfile.avatar_url);
        try { localStorage.setItem('maf_user_avatar', serverProfile.avatar_url); } catch {}
      }
    });
  }, []);

  const loadPlayerGames = useCallback(async () => {
    const token = authService.getStoredToken();
    if (!token) return;
    setPlayerLoading(true);
    setPlayerError('');
    try {
      const data = await playerApi.getPlayerGames(token);
      if (!data) { setPlayerError('Ошибка загрузки'); return; }
      if (data.error === 'no_gomafia') { setPlayerError('no_gomafia'); return; }
      if (data.error) { setPlayerError(data.error); return; }
      setPlayerNickname(data.nickname || '');
      setPlayerGames(data.games || []);
    } catch { setPlayerError('Ошибка сети'); }
    finally { setPlayerLoading(false); }
  }, []);

  const loadPlayerSessionDetail = useCallback(async (sessionId, judgeId) => {
    const token = authService.getStoredToken();
    if (!token) return;
    setPlayerDetailLoading(true);
    try {
      const data = await playerApi.getPlayerSessionDetail(token, sessionId, judgeId);
      if (data && !data.error) {
        setPlayerDetailSession(data);
        setPlayerDetailTab('scores');
        const games = data.gamesHistory || [];
        setPlayerSelectedGame(games.length > 0 ? games.length - 1 : null);
        setMenuScreen('playerDetail');
      }
    } catch {}
    finally { setPlayerDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (menuScreen === 'player') {
      loadPlayerGames();
      const now = Date.now();
      setPlayerLastViewed(now);
      try { localStorage.setItem('maf_player_last_viewed', String(now)); } catch {}
    }
  }, [menuScreen, loadPlayerGames]);

  useEffect(() => {
    if (menuScreen === 'notifications') {
      setNotificationsLoading(true);
      fetch('/api/notifications.php')
        .then(r => r.json())
        .then(data => setNotifications(data.notifications || []))
        .catch(() => setNotifications([]))
        .finally(() => setNotificationsLoading(false));
    }
  }, [menuScreen]);

  const playerHasUpdates = useMemo(() => {
    if (!playerGames || playerGames.length === 0) return false;
    return playerGames.some(g => new Date(g.updated_at).getTime() > playerLastViewed);
  }, [playerGames, playerLastViewed]);

  const loadActiveSessions = useCallback(async () => {
    const token = authService.getStoredToken();
    if (!token) return;
    setSessionsLoading(true);
    const sessions = await sessionsApi.getActiveSessions(token);
    if (sessions) setDeviceSessions(sessions);
    setSessionsLoading(false);
  }, []);

  const loadLinkedAccounts = useCallback(async () => {
    const token = authService.getStoredToken();
    if (!token) return;
    const data = await authService.getLinkedAccounts(token);
    if (data && !data.error) setLinkedAccounts(data);
  }, []);

  const stopLinkPolling = useCallback(() => {
    if (linkPollRef.current) { clearInterval(linkPollRef.current); linkPollRef.current = null; }
    if (linkTimerRef.current) { clearInterval(linkTimerRef.current); linkTimerRef.current = null; }
  }, []);

  useEffect(() => () => stopLinkPolling(), [stopLinkPolling]);

  useEffect(() => {
    if (menuScreen === 'profileSettings') {
      loadActiveSessions();
      loadLinkedAccounts();
    } else {
      stopLinkPolling();
      setLinkTelegramMode(null);
    }
  }, [menuScreen, loadActiveSessions, loadLinkedAccounts, stopLinkPolling]);

  const handleTerminateSession = useCallback(async (sessionId) => {
    const token = authService.getStoredToken();
    if (!token) return;
    setTerminatingId(sessionId);
    triggerHaptic('warning');
    const result = await sessionsApi.terminateSession(token, sessionId);
    if (result?.success) {
      setDeviceSessions(prev => prev.filter(s => s.id !== sessionId));
      triggerHaptic('success');
    }
    setTerminatingId(null);
  }, []);

  const { groups, standalone } = useMemo(
    () => sessionManager.groupByTournament(sessionsList),
    [sessionsList]
  );

  const funkyGroups = useMemo(() => {
    const funkySessions = standalone.filter(s => isFunkySession(s));
    return funkySessions.map(s => {
      const gh = s.gamesHistory || [];
      const pseudoSessions = gh.map((g, idx) => ({
        ...g,
        sessionId: `${s.sessionId}_g${g.gameNumber || idx + 1}`,
        gameSelected: g.gameNumber || idx + 1,
        gameFinished: true,
        timestamp: g.completedAt,
        updatedAt: g.completedAt,
        seriesArchived: true,
      }));
      if (s.gamePhase && s.gamePhase !== 'roles') {
        pseudoSessions.push({
          ...s,
          sessionId: s.sessionId,
          gameSelected: gh.length + 1,
          seriesArchived: false,
        });
      }
      const hasActiveGame = s.gamePhase && s.gamePhase !== 'roles' && !s.gameFinished;
      const allFinished = pseudoSessions.length > 0
        && pseudoSessions.every(ps => ps.winnerTeam && ps.gameFinished);
      return {
        tournamentId: s.tournamentId,
        tournamentName: s.tournamentName || 'Фанки',
        gameMode: 'funky',
        isFunky: true,
        archived: s.seriesArchived || false,
        allGamesFinished: !hasActiveGame && allFinished,
        sessions: pseudoSessions,
        finishedGamesCount: pseudoSessions.filter(ps => ps.gameFinished).length,
        totalGamesInTournament: pseudoSessions.length,
        lastStartedGameNumber: pseudoSessions.length,
        _originalSessionId: s.sessionId,
        updatedAt: s.updatedAt || s.timestamp,
      };
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [standalone]);

  const nonFunkyStandalone = useMemo(() => standalone.filter(s => !isFunkySession(s)), [standalone]);
  const activeSessions = useMemo(() => nonFunkyStandalone.filter(s => !s.gameFinished && !s.winnerTeam), [nonFunkyStandalone]);
  const historySessions = useMemo(() => nonFunkyStandalone.filter(s => (s.gameFinished || s.winnerTeam)), [nonFunkyStandalone]);
  const activeGroups = useMemo(() => [...groups.filter(g => !g.archived), ...funkyGroups.filter(g => !g.archived)], [groups, funkyGroups]);
  const historyGroups = useMemo(() => [...groups.filter(g => g.archived), ...funkyGroups.filter(g => g.archived)], [groups, funkyGroups]);

  const displayGroups = activeTab === 'active' ? activeGroups : historyGroups;
  const displayStandalone = activeTab === 'active' ? activeSessions : historySessions;

  const profileStats = useMemo(() => {
    const totalGames = sessionsList.length;

    const gomafiaGames = sessionsList.filter(s =>
      s.gameMode === 'gomafia' && s.tournamentId &&
      !s.tournamentId.startsWith('funky_') && !s.tournamentId.startsWith('city_')
    );
    const gomafiaTournamentIds = new Set(gomafiaGames.map(s => s.tournamentId));

    const minicapGames = sessionsList.filter(s =>
      s.gameMode === 'minicap' && s.tournamentId
    );
    const minicapIds = new Set(minicapGames.map(s => s.tournamentId));

    const funkyGamesCount = sessionsList.filter(s =>
      s.gameMode === 'funky' || s.funkyMode || (s.tournamentId && s.tournamentId.startsWith('funky_'))
    ).length;

    return {
      totalGames,
      gomafiaTournamentsCount: gomafiaTournamentIds.size,
      gomafiaGamesCount: gomafiaGames.length,
      minicapsCount: minicapIds.size,
      minicapGamesCount: minicapGames.length,
      funkyGamesCount,
    };
  }, [sessionsList]);
  const totalCount = displayGroups.length + displayStandalone.length;

  const toggleExpanded = useCallback((id) => {
    setExpandedSeries(prev => ({ ...prev, [id]: !prev[id] }));
    triggerHaptic('selection');
  }, []);

  const selectColor = (key) => {
    setSelectedColorScheme(key);
    applyTheme(key);
    triggerHaptic('selection');
  };

  const handleNewGameInTournament = useCallback(async (group) => {
    setNewGameModal({ visible: true, loading: true, error: '', group, tournamentData: null, games: [] });
    try {
      const data = await goMafiaApi.getTournament(group.tournamentId);
      const games = data?.props?.pageProps?.serverData?.games || [];
      setNewGameModal(prev => ({ ...prev, loading: false, tournamentData: data, games }));
    } catch (e) {
      setNewGameModal(prev => ({
        ...prev, loading: false, error: 'Ошибка загрузки турнира: ' + (e.message || 'Неизвестная ошибка'),
      }));
    }
  }, []);

  const handleSelectNewGameInTournament = useCallback((gameNum, tableNum) => {
    const { group, tournamentData } = newGameModal;
    if (!group || !tournamentData) return;
    startTournamentGameFromMenu(tournamentData, group.tournamentId, group.tournamentName, gameNum, tableNum);
    setNewGameModal({ visible: false, loading: false, error: '', group: null, tournamentData: null, games: [] });
  }, [newGameModal, startTournamentGameFromMenu]);

  const closeNewGameModal = useCallback(() => {
    setNewGameModal({ visible: false, loading: false, error: '', group: null, tournamentData: null, games: [] });
  }, []);

  const [tableTab, setTableTab] = useState('overall');
  const [tableExpanded, setTableExpanded] = useState(null);
  const [tableGameExpanded, setTableGameExpanded] = useState(null);
  const [tablePlayerExpanded, setTablePlayerExpanded] = useState(null);

  const tableData = useMemo(() => {
    if (!tableGroup) return null;
    const finished = tableGroup.sessions.filter(s => s.winnerTeam);
    if (finished.length === 0) return null;
    finished.sort((a, b) => (a.gameSelected || 0) - (b.gameSelected || 0));

    const playerMap = {};
    const isBlack = (r) => r === 'mafia' || r === 'don' || r === 'black';

    for (const session of finished) {
      for (const player of (session.players || [])) {
        const login = player.login;
        if (!login) continue;
        const rk = player.roleKey;
        const role = session.roles?.[rk] || 'peace';
        const score = computeSessionPlayerScore(session, rk);
        const won = (session.winnerTeam === 'civilians' && !isBlack(role)) || (session.winnerTeam === 'mafia' && isBlack(role));
        const ps = session.playerScores?.[rk] || {};
        const action = session.playersActions?.[rk];
        const foulCount = session.fouls?.[rk] || 0;
        const techFoulCount = session.techFouls?.[rk] || 0;
        const isFK = session.firstKilledPlayer === rk;
        const wasKilledAtNight = session.killedOnNight?.[rk] != null;
        const avatar = session.avatars?.[login];

        if (!playerMap[login]) {
          playerMap[login] = {
            login, avatar, totalScore: 0, gamesCount: 0, wins: 0,
            bonusTotal: 0, penaltyTotal: 0, firstKilled: 0, nightKilled: 0,
            peacePlayed: 0, peaceWins: 0, sheriffPlayed: 0, sheriffWins: 0,
            mafiaPlayed: 0, mafiaWins: 0, donPlayed: 0, donWins: 0,
            foulsTotal: 0, techFoulsTotal: 0, removals: 0,
            gameScores: {},
          };
        }
        const p = playerMap[login];
        if (avatar && !p.avatar) p.avatar = avatar;
        p.totalScore = parseFloat((p.totalScore + score).toFixed(2));
        p.gamesCount++;
        if (won) p.wins++;
        p.bonusTotal = parseFloat((p.bonusTotal + (ps.bonus || 0)).toFixed(2));
        p.penaltyTotal = parseFloat((p.penaltyTotal + (ps.penalty || 0)).toFixed(2));
        if (isFK) p.firstKilled++;
        if (wasKilledAtNight) p.nightKilled++;
        p.foulsTotal += foulCount;
        p.techFoulsTotal += techFoulCount;
        if (action === 'removed' || action === 'fall_removed' || action === 'tech_fall_removed') p.removals++;

        const normRole = role === 'black' ? 'mafia' : role;
        if (normRole === 'peace') { p.peacePlayed++; if (won) p.peaceWins++; }
        else if (normRole === 'sheriff') { p.sheriffPlayed++; if (won) p.sheriffWins++; }
        else if (normRole === 'mafia') { p.mafiaPlayed++; if (won) p.mafiaWins++; }
        else if (normRole === 'don') { p.donPlayed++; if (won) p.donWins++; }

        p.gameScores[session.gameSelected || 0] = score;
      }
    }

    const roleLabel = r => ({ peace: 'Мирный', sheriff: 'Шериф', mafia: 'Мафия', don: 'Дон', black: 'Мафия' }[r] || 'Мирный');

    const games = finished.map(s => {
      const nightChecks = (s.nightCheckHistory || []);
      return {
        gameNum: s.gameSelected || 0, winnerTeam: s.winnerTeam,
        bestMove: s.bestMoveAccepted && s.bestMove?.length ? s.bestMove : null,
        nightNumber: s.nightNumber || 1,
        nightMisses: s.nightMisses || {},
        players: (s.players || []).map(pl => {
          const rk = pl.roleKey;
          const role = s.roles?.[rk] || 'peace';
          const ps = s.playerScores?.[rk] || {};
          const action = s.playersActions?.[rk];
          const isFK = s.firstKilledPlayer === rk;
          const isSelfKill = isFK && isBlack(role);

          const protocolResults = s.protocolData?.[rk]
            ? Object.entries(s.protocolData[rk]).map(([num, r]) => ({ num: Number(num), role: r, roleLabel: roleLabel(r) }))
            : null;
          const opinionResults = s.opinionData?.[rk]
            ? Object.entries(s.opinionData[rk]).map(([num, r]) => ({ num: Number(num), role: r, roleLabel: roleLabel(r) }))
            : null;

          const playerNightChecks = (role === 'don' || role === 'sheriff')
            ? nightChecks.filter(c => c.checkerRole === role)
            : null;

          return {
            ...pl, role, action, isFirstKilled: isFK, isSelfKill,
            score: computeSessionPlayerScore(s, rk),
            won: (s.winnerTeam === 'civilians' && !isBlack(role)) || (s.winnerTeam === 'mafia' && isBlack(role)),
            bonus: ps.bonus || 0, penalty: ps.penalty || 0,
            reveal: !!ps.reveal,
            foul: s.fouls?.[rk] || 0, techFoul: s.techFouls?.[rk] || 0,
            protocolResults, opinionResults, nightChecks: playerNightChecks,
          };
        }).sort((a, b) => a.num - b.num),
      };
    });

    return {
      players: Object.values(playerMap).sort((a, b) => b.totalScore - a.totalScore),
      gameNums: finished.map(s => s.gameSelected || 0),
      sessions: finished,
      games,
    };
  }, [tableGroup]);

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  const handleSwipeBack = useCallback(() => {
    if (tableGroup) { setTableGroup(null); return; }
    if (menuScreen === 'profileSettings') { setMenuScreen('profile'); return; }
    if (menuScreen === 'playerDetail') { setMenuScreen('player'); return; }
    if (menuScreen === 'profile' || menuScreen === 'themes' || menuScreen === 'notifications' || menuScreen === 'player') { setMenuScreen('game'); return; }
  }, [tableGroup, menuScreen]);

  const canSwipeBack = tableGroup || menuScreen !== 'game';
  useSwipeBack(handleSwipeBack, canSwipeBack);

  const handleGoMafiaLogin = useCallback(async () => {
    const nickname = goMafiaLogin.nickname.trim();
    const password = goMafiaLogin.password;
    if (!nickname || !password) return;

    setGoMafiaLogin(prev => ({ ...prev, loading: true, error: '' }));
    triggerHaptic('light');

    try {
      const result = await goMafiaApi.loginGoMafia(nickname, password);

      if (result.success) {
        const profile = {
          nickname: result.profile?.nickname || nickname,
          avatar: result.profile?.avatar || null,
          id: result.profile?.id || null,
          title: result.profile?.title || null,
          connectedAt: Date.now(),
        };
        goMafiaApi.saveGoMafiaProfile(profile);
        setGoMafiaProfile(profile);

        if (profile.nickname) {
          setUserDisplayName(profile.nickname);
          try { localStorage.setItem('maf_user_display_name', profile.nickname); } catch {}
        }
        if (profile.avatar) {
          setUserAvatarUrl(profile.avatar);
          try { localStorage.setItem('maf_user_avatar', profile.avatar); } catch {}
        }

        const token = authService.getStoredToken();
        if (token) {
          profileApi.saveProfile(token, { gomafia: profile });
          authService.linkGomafia(token, nickname, password).catch(() => {});
        }

        setGoMafiaModal(false);
        loadLinkedAccounts();
        triggerHaptic('success');
        return;
      }

      setGoMafiaLogin(prev => ({
        ...prev,
        loading: false,
        error: result.error || 'Неверный никнейм или пароль',
      }));
      triggerHaptic('error');
    } catch (err) {
      setGoMafiaLogin(prev => ({
        ...prev,
        loading: false,
        error: 'Ошибка соединения. Попробуйте позже.',
      }));
      triggerHaptic('error');
    }
  }, [goMafiaLogin, loadLinkedAccounts]);

  return (
    <>
      {/* === TOURNAMENT TABLE FULLSCREEN === */}
      {tableGroup && (
        <div className="fixed inset-0 z-[200] native-scroll animate-fade-in" style={{ background: 'var(--maf-gradient-bg)' }}>
          <div className="max-w-[480px] mx-auto min-h-full" style={{ padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(120px + var(--safe-bottom, 0px))' }}>
            <div className="flex items-center justify-center gap-3 py-3 pb-4">
              <span className="text-[1.1em] font-extrabold text-white/80">Таблица</span>
            </div>

            <div className="text-center mb-1">
              <div className="text-xs font-semibold text-white/50">{tableGroup.tournamentName}</div>
            </div>

            {/* Tab switcher */}
            <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl mb-3">
              <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-smooth"
                style={{
                  width: 'calc(50% - 4px)',
                  left: tableTab === 'overall' ? 4 : 'calc(50%)',
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(99,102,241,0.12))',
                  border: '1px solid rgba(168,85,247,0.2)',
                  boxShadow: '0 4px 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                }} />
              {[{ id: 'overall', label: 'Общая' }, { id: 'games', label: 'По играм' }].map(t => (
                <button key={t.id}
                  onClick={() => { setTableTab(t.id); triggerHaptic('light'); }}
                  className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${tableTab === t.id ? 'text-white' : 'text-white/35'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {!tableData ? (
              <div className="relative z-[1] p-4 rounded-2xl glass-card-md p-8 text-center">
                <div className="text-4xl mb-2 opacity-30">📊</div>
                <p className="text-sm text-white/35">Нет завершённых игр для формирования таблицы</p>
              </div>
            ) : (
              <>
                {/* ===== OVERALL TAB ===== */}
                {tableTab === 'overall' && (
                  <div className="flex flex-col gap-2.5">
                    {tableData.players.map((p, rank) => {
                      const expanded = tableExpanded === p.login;
                      const topClass = rank === 0 ? 'ring-1 ring-yellow-500/30' : rank === 1 ? 'ring-1 ring-gray-400/20' : rank === 2 ? 'ring-1 ring-orange-600/20' : '';
                      const topBg = rank === 0 ? 'bg-yellow-500/[0.04]' : rank === 1 ? 'bg-gray-300/[0.03]' : rank === 2 ? 'bg-orange-600/[0.03]' : '';
                      const rankColor = rank === 0 ? '#ffd700' : rank === 1 ? '#c0c0c0' : rank === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)';
                      const wr = p.gamesCount > 0 ? Math.round(p.wins / p.gamesCount * 100) : 0;

                      return (
                        <div key={p.login}
                          className={`glass-card rounded-2xl transition-all duration-200 cursor-pointer ${topClass} ${topBg} ${expanded ? 'ring-1 ring-purple-500/20' : ''}`}
                          onClick={() => { setTableExpanded(expanded ? null : p.login); triggerHaptic('selection'); }}>

                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="w-7 text-center font-black text-sm shrink-0" style={{ fontFamily: 'var(--mono, monospace)', color: rankColor }}>{rank + 1}</div>
                            <div className="w-9 h-9 rounded-full bg-white/[0.08] shrink-0 flex items-center justify-center overflow-hidden">
                              {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white/30 text-lg">{p.login[0]?.toUpperCase()}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate">{p.login}</div>
                              <div className="text-[0.65rem] text-white/30 font-semibold mt-0.5">{p.gamesCount} {p.gamesCount === 1 ? 'игра' : p.gamesCount < 5 ? 'игры' : 'игр'}</div>
                            </div>
                            <div className="text-xl font-black tabular-nums" style={{ fontFamily: 'var(--mono, monospace)', color: p.totalScore > 0 ? '#30d158' : p.totalScore < 0 ? '#ff453a' : '#fff', textShadow: '0 0 10px rgba(168,85,247,0.4)' }}>
                              {p.totalScore > 0 ? '+' : ''}{p.totalScore.toFixed(2)}
                            </div>
                          </div>

                          {expanded && (
                            <div className="px-3 pb-3 pt-0" onClick={e => e.stopPropagation()}>

                              {/* Hero: Total + Games + Wins */}
                              <div className="flex gap-2 mb-2.5">
                                <div className="flex-[1.3] rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden"
                                  style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(168,85,247,0.03))', border: '1px solid rgba(168,85,247,0.25)', boxShadow: '0 0 30px rgba(168,85,247,0.15)' }}>
                                  <div className="text-[0.55rem] font-bold uppercase tracking-widest text-purple-300/60 mb-1">Итого баллов</div>
                                  <div className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--mono, monospace)', textShadow: '0 0 30px rgba(168,85,247,0.6)' }}>
                                    {p.totalScore > 0 ? '+' : ''}{p.totalScore.toFixed(2)}
                                  </div>
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                  <div className="rounded-2xl p-2.5 flex flex-col items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div className="text-[0.55rem] font-bold uppercase tracking-wider text-white/35 mb-0.5">Игры</div>
                                    <div className="text-xl font-extrabold tabular-nums">{p.gamesCount}</div>
                                  </div>
                                  <div className="rounded-2xl p-2.5 flex flex-col items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div className="text-[0.55rem] font-bold uppercase tracking-wider text-white/35 mb-0.5">Победы</div>
                                    <div className="text-xl font-extrabold tabular-nums text-green-400">{p.wins}</div>
                                    <div className="text-[0.55rem] font-semibold text-white/30 tabular-nums">{wr}%</div>
                                    <div className="w-full h-1 rounded-full bg-white/[0.08] mt-1 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${wr}%`, background: 'linear-gradient(90deg, #30d158, #34c759)', boxShadow: '0 0 6px rgba(48,209,88,0.5)' }} />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Bonus / Penalty / PU / Killed */}
                              <div className="grid grid-cols-2 gap-2 mb-2.5">
                                {[
                                  { label: '＋ Доп', value: p.bonusTotal.toFixed(1), color: '#4caf50' },
                                  { label: '− Штраф', value: p.penaltyTotal.toFixed(1), color: '#f44336' },
                                  { label: 'ПУ', value: p.firstKilled, color: '#ffd54f' },
                                  { label: 'Убит ночью', value: p.nightKilled, color: 'rgba(255,255,255,0.5)' },
                                ].map(s => (
                                  <div key={s.label} className="rounded-xl p-2.5 flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div className="text-[0.55rem] font-bold uppercase tracking-wider mb-1" style={{ color: s.color + '99' }}>{s.label}</div>
                                    <div className="text-lg font-extrabold tabular-nums" style={{ fontFamily: 'var(--mono, monospace)' }}>{s.value}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Roles */}
                              <div className="grid grid-cols-2 gap-2 mb-2.5">
                                <div className="rounded-2xl p-2.5 flex flex-col gap-2" style={{ background: 'rgba(255,82,82,0.04)', border: '1px solid rgba(255,82,82,0.12)' }}>
                                  <div className="text-[0.55rem] font-extrabold uppercase tracking-widest text-red-400/60">Мирные</div>
                                  {[
                                    { name: 'Мирный', played: p.peacePlayed, wins: p.peaceWins, color: '#ef9a9a', barClass: 'red' },
                                    { name: 'Шериф', played: p.sheriffPlayed, wins: p.sheriffWins, color: '#ffd54f', barClass: 'gold' },
                                  ].map(r => (
                                    <div key={r.name} className={`rounded-xl p-2 ${r.played === 0 ? 'opacity-30' : ''}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <div className="text-[0.6rem] font-bold uppercase tracking-wide mb-1" style={{ color: r.color }}>{r.name}</div>
                                      <div className="flex items-baseline gap-1.5">
                                        <span className="text-lg font-extrabold tabular-nums">{r.played}</span>
                                        <span className="text-[0.65rem] text-white/35 font-semibold">/ {r.wins} побед</span>
                                      </div>
                                      <div className="w-full h-1 rounded-full bg-white/[0.08] mt-1 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${r.played > 0 ? Math.round(r.wins / r.played * 100) : 0}%`, background: r.barClass === 'gold' ? 'linear-gradient(90deg, #ffd54f, #ffb300)' : 'linear-gradient(90deg, #ef5350, #ef9a9a)', boxShadow: `0 0 6px ${r.color}66` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="rounded-2xl p-2.5 flex flex-col gap-2" style={{ background: 'rgba(206,147,216,0.04)', border: '1px solid rgba(206,147,216,0.12)' }}>
                                  <div className="text-[0.55rem] font-extrabold uppercase tracking-widest text-purple-300/60">Мафия</div>
                                  {[
                                    { name: 'Мафия', played: p.mafiaPlayed, wins: p.mafiaWins, color: '#c084fc' },
                                    { name: 'Дон', played: p.donPlayed, wins: p.donWins, color: '#e1bee7' },
                                  ].map(r => (
                                    <div key={r.name} className={`rounded-xl p-2 ${r.played === 0 ? 'opacity-30' : ''}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <div className="text-[0.6rem] font-bold uppercase tracking-wide mb-1" style={{ color: r.color }}>{r.name}</div>
                                      <div className="flex items-baseline gap-1.5">
                                        <span className="text-lg font-extrabold tabular-nums">{r.played}</span>
                                        <span className="text-[0.65rem] text-white/35 font-semibold">/ {r.wins} побед</span>
                                      </div>
                                      <div className="w-full h-1 rounded-full bg-white/[0.08] mt-1 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${r.played > 0 ? Math.round(r.wins / r.played * 100) : 0}%`, background: 'linear-gradient(90deg, #9c64ff, #ce93d8)', boxShadow: `0 0 6px ${r.color}66` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Discipline */}
                              <div className="flex items-center justify-center gap-0 rounded-xl py-2.5 px-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {[
                                  { label: 'Фолы', val: p.foulsTotal },
                                  { label: 'Тех', val: p.techFoulsTotal },
                                  { label: 'Удал', val: p.removals },
                                ].map((d, i) => (
                                  <React.Fragment key={d.label}>
                                    {i > 0 && <div className="w-0.5 h-0.5 rounded-full bg-white/15 mx-3" />}
                                    <div className="flex items-center gap-1.5 text-xs text-white/35 font-semibold">
                                      {d.label} <span className="font-extrabold text-white/60 tabular-nums">{d.val}</span>
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>

                              {/* Per-game scores */}
                              <div className="mt-2.5 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="text-[0.55rem] font-bold uppercase tracking-wider text-white/30 mb-2">Баллы по играм</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {tableData.gameNums.map(gn => {
                                    const sc = p.gameScores[gn];
                                    return (
                                      <div key={gn} className="flex flex-col items-center rounded-lg px-2 py-1.5" style={{ background: sc != null ? 'rgba(255,255,255,0.04)' : 'transparent', border: '1px solid rgba(255,255,255,0.06)', minWidth: 40 }}>
                                        <span className="text-[0.55rem] text-white/25 font-bold">И{gn}</span>
                                        <span className={`text-xs font-extrabold tabular-nums ${sc == null ? 'text-white/15' : sc > 0 ? 'text-green-400' : sc < 0 ? 'text-red-400' : 'text-white/50'}`}>
                                          {sc != null ? (sc > 0 ? '+' : '') + sc.toFixed(1) : '—'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2.5 mt-4 mb-6">
                      <button onClick={() => { setTableGroup(null); setTableExpanded(null); setTableTab('overall'); triggerHaptic('light'); }}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white/40 active:text-white/60 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        Закрыть
                      </button>
                      <button disabled
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white/20 cursor-not-allowed flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        Поделиться
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== GAMES TAB ===== */}
                {tableTab === 'games' && (
                  <div className="flex flex-col gap-2.5">
                    {tableData.games.map(game => {
                      const expanded = tableGameExpanded === game.gameNum;
                      const isCiv = game.winnerTeam === 'civilians';
                      const accentColor = isCiv ? 'rgba(255,82,82,' : 'rgba(79,195,247,';
                      return (
                        <div key={game.gameNum}
                          className="glass-card rounded-2xl cursor-pointer transition-all duration-200"
                          style={{ boxShadow: `inset 0 0 0 1px ${accentColor}0.2)` }}
                          onClick={() => { setTableGameExpanded(expanded ? null : game.gameNum); setTablePlayerExpanded(null); triggerHaptic('selection'); }}>

                          <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0"
                              style={{ background: `${accentColor}0.12)`, color: isCiv ? '#ff5252' : '#4fc3f7' }}>
                              {game.gameNum}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm">Игра {game.gameNum}</div>
                              <div className="text-xs text-white/40">
                                Победа: <span style={{ color: isCiv ? '#ff5252' : '#4fc3f7' }}>{isCiv ? 'Мирных' : game.winnerTeam === 'mafia' ? 'Мафии' : 'Ничья'}</span>
                              </div>
                            </div>
                            <IconChevronDown size={16} color="rgba(255,255,255,0.3)" />
                          </div>

                          {expanded && (
                            <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
                              {game.bestMove && (
                                <div className="rounded-xl p-2.5 mb-2.5 flex items-center gap-2" style={{ background: 'rgba(255,214,10,0.05)', border: '1px solid rgba(255,214,10,0.12)' }}>
                                  <span className="text-[0.65rem] font-bold text-yellow-400/70 uppercase">ЛХ:</span>
                                  <div className="flex gap-1">
                                    {game.bestMove.map(n => (
                                      <span key={n} className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-extrabold" style={{ background: 'rgba(255,214,10,0.12)', color: '#ffd60a', border: '1px solid rgba(255,214,10,0.2)' }}>{n}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-col gap-1.5">
                                {game.players.map(pl => {
                                  const rl = { peace: 'Мирный', sheriff: 'Шериф', mafia: 'Мафия', don: 'Дон', black: 'Мафия' }[pl.role] || 'Мирный';
                                  const isElim = ['killed', 'voted', 'removed', 'fall_removed', 'tech_fall_removed'].includes(pl.action);
                                  const plKey = `${game.gameNum}-${pl.num}`;
                                  const plExpanded = tablePlayerExpanded === plKey;

                                  return (
                                    <div key={pl.num} className="rounded-xl overflow-hidden transition-all duration-200"
                                      style={{ background: plExpanded ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.03)', border: plExpanded ? '1px solid rgba(168,85,247,0.15)' : '1px solid rgba(255,255,255,0.06)' }}>
                                      <div className="flex items-center gap-2.5 py-2.5 px-3 cursor-pointer active:bg-white/[0.04]"
                                        onClick={() => { setTablePlayerExpanded(plExpanded ? null : plKey); triggerHaptic('selection'); }}>
                                        <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white/50 tabular-nums shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>{pl.num}</span>
                                        <span className={`flex-1 text-sm font-semibold truncate ${isElim ? 'opacity-40 line-through' : ''}`}>{pl.login || `Игрок ${pl.num}`}</span>
                                        <span className={`role-tag ${pl.role === 'black' ? 'mafia' : pl.role || 'peace'}`} style={{ fontSize: '0.6em' }}>{rl}</span>
                                        <span className={`text-sm font-extrabold tabular-nums min-w-[32px] text-right ${pl.score > 0 ? 'text-green-400' : pl.score < 0 ? 'text-red-400' : 'text-white/50'}`}>
                                          {pl.score > 0 ? '+' : ''}{pl.score.toFixed(1)}
                                        </span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                          className="shrink-0 transition-transform duration-200" style={{ transform: plExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                          <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                      </div>

                                      {plExpanded && (
                                        <div className="px-2.5 pb-2.5 pt-1">
                                          {/* Score hero */}
                                          <div className="rounded-xl p-3 mb-2 flex flex-col items-center"
                                            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02))', border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 0 20px rgba(168,85,247,0.1)' }}>
                                            <div className="text-[0.5rem] font-bold uppercase tracking-widest text-purple-300/50 mb-0.5">Итого</div>
                                            <div className="text-2xl font-black tabular-nums" style={{ fontFamily: 'var(--mono, monospace)', textShadow: '0 0 20px rgba(168,85,247,0.5)' }}>
                                              {pl.score > 0 ? '+' : ''}{pl.score.toFixed(1)}
                                            </div>
                                            {pl.won && <div className="text-[0.6rem] font-bold text-yellow-400 mt-0.5" style={{ textShadow: '0 0 8px rgba(255,214,10,0.3)' }}>+1 Победа</div>}
                                          </div>

                                          {/* Bonus / Penalty */}
                                          <div className="grid grid-cols-2 gap-1.5 mb-2">
                                            <div className="rounded-lg p-2 flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                              <div className="text-[0.5rem] font-bold uppercase tracking-wider text-green-500/60 mb-0.5">Доп</div>
                                              <div className="text-base font-extrabold tabular-nums">{pl.bonus}</div>
                                            </div>
                                            <div className="rounded-lg p-2 flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                              <div className="text-[0.5rem] font-bold uppercase tracking-wider text-red-400/60 mb-0.5">Штраф</div>
                                              <div className="text-base font-extrabold tabular-nums">{pl.penalty}</div>
                                            </div>
                                          </div>

                                          {/* Protocol & Opinion */}
                                          {(pl.protocolResults || pl.opinionResults) && (
                                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                                              <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div className="text-[0.5rem] font-bold uppercase tracking-wider text-white/30 mb-1.5">Протокол</div>
                                                {pl.protocolResults ? pl.protocolResults.map(pr => (
                                                  <div key={pr.num} className="flex items-center justify-between py-0.5 text-xs">
                                                    <span className="text-white/40 tabular-nums font-bold">#{pr.num}</span>
                                                    <span className={`font-semibold ${pr.role === 'don' || pr.role === 'black' || pr.role === 'mafia' ? 'text-purple-300' : pr.role === 'sheriff' ? 'text-yellow-300' : 'text-blue-300'}`}>{pr.roleLabel}</span>
                                                  </div>
                                                )) : <div className="text-xs text-white/15 text-center">—</div>}
                                              </div>
                                              <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div className="text-[0.5rem] font-bold uppercase tracking-wider text-white/30 mb-1.5">Мнение</div>
                                                {pl.opinionResults ? pl.opinionResults.map(op => (
                                                  <div key={op.num} className="flex items-center justify-between py-0.5 text-xs">
                                                    <span className="text-white/40 tabular-nums font-bold">#{op.num}</span>
                                                    <span className={`font-semibold ${op.role === 'don' || op.role === 'black' || op.role === 'mafia' ? 'text-purple-300' : op.role === 'sheriff' ? 'text-yellow-300' : 'text-blue-300'}`}>{op.roleLabel}</span>
                                                  </div>
                                                )) : <div className="text-xs text-white/15 text-center">—</div>}
                                              </div>
                                            </div>
                                          )}

                                          {/* Night checks */}
                                          {pl.nightChecks && pl.nightChecks.length > 0 && (
                                            <div className="rounded-lg p-2 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                              <div className="text-[0.5rem] font-bold uppercase tracking-wider text-white/30 mb-1.5">
                                                {pl.role === 'don' ? 'Проверки Дона' : 'Проверки Шерифа'}
                                              </div>
                                              {pl.nightChecks.map((c, ci) => (
                                                <div key={ci} className="flex items-center justify-between py-0.5 text-xs" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '4px 8px', marginBottom: 2 }}>
                                                  <span className="text-white/35 tabular-nums font-semibold">Н{c.night}</span>
                                                  <span className="text-white/50">→ №{c.target}</span>
                                                  <span className={`font-bold ${c.found ? 'text-green-400' : 'text-red-400'}`}>{c.result}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Status row */}
                                          <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg py-2 px-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span className="text-white/40">Вскрытие: <b className={pl.reveal ? 'text-green-400' : 'text-white/25'}>{pl.reveal ? 'Да' : 'Нет'}</b></span>
                                            {pl.isSelfKill && <span className="font-bold text-red-400" style={{ textShadow: '0 0 6px rgba(255,69,58,0.4)' }}>САМОСТРЕЛ</span>}
                                            {pl.isFirstKilled && <span className="font-bold text-yellow-400">ПУ</span>}
                                            <span className="text-white/25 tabular-nums ml-auto" style={{ fontFamily: 'var(--mono, monospace)' }}>Ф:{pl.foul} · ТФ:{pl.techFoul}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2.5 mt-4 mb-6">
                      <button onClick={() => { setTableGroup(null); setTableGameExpanded(null); setTablePlayerExpanded(null); setTableTab('overall'); triggerHaptic('light'); }}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white/40 active:text-white/60 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        Закрыть
                      </button>
                      <button disabled
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white/20 cursor-not-allowed flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        Поделиться
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="h-[100dvh] native-scroll" style={{ background: 'var(--maf-gradient-bg)', paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'calc(120px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))' }}>
        <div className="w-full max-w-[480px] mx-auto px-5 pt-10 pb-10 flex flex-col items-center">
          {/* Header */}
          <div className="flex flex-col items-center mb-7 pt-8 animate-float-up">
            <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-accent/15 to-indigo-500/10 border border-accent/25 flex items-center justify-center text-3xl text-accent mb-4 shadow-[0_8px_32px_rgba(168,85,247,0.2),0_0_60px_rgba(168,85,247,0.06)] backdrop-blur-xl">
              <IconMafBoard size={32} color="var(--accent-color, #a855f7)" />
            </div>
            <h1 className="text-[1.8em] font-extrabold text-white m-0 tracking-tight">MafBoard</h1>
            <p className="text-[0.9em] text-white/40 mt-1 font-medium">Панель управления мафией</p>
          </div>

          {/* =================== GAME SCREEN =================== */}
          {menuScreen === 'game' && (
            <>
              <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl mx-4 mb-3">
                <div
                  className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-smooth"
                  style={{
                    left: activeTab === 'active' ? 4 : 'calc(50%)',
                    width: 'calc(50% - 4px)',
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(99,102,241,0.12))',
                    border: '1px solid rgba(168,85,247,0.2)',
                    boxShadow: '0 4px 16px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                />
                <button
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${activeTab === 'active' ? 'text-white' : 'text-white/35'}`}
                  onClick={() => { setActiveTab('active'); triggerHaptic('light'); }}
                >
                  Активные
                </button>
                <button
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] text-sm font-bold tracking-wide transition-colors duration-200 ${activeTab === 'history' ? 'text-white' : 'text-white/35'}`}
                  onClick={() => { setActiveTab('history'); triggerHaptic('light'); }}
                >
                  История
                </button>
              </div>
              <div className="flex items-center justify-between w-full px-4 mb-3">
                <span className="text-sm font-bold text-white/70">
                  {activeTab === 'active' ? 'Активные игры' : 'История игр'}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[0.65em] font-extrabold bg-white/10 text-white/70">{totalCount}</span>
              </div>

              <div className="flex flex-col gap-2.5 w-full px-4">
                {displayGroups.length === 0 && displayStandalone.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
                    <div className="text-5xl opacity-30 mb-3">
                      <IconDice size={48} color="rgba(255,255,255,0.15)" />
                    </div>
                    <div className="text-sm text-white/40 font-medium">
                      Нет {activeTab === 'active' ? 'активных' : 'завершенных'} игр
                    </div>
                    {activeTab === 'active' && (
                      <div className="text-xs text-white/25 mt-1">
                        Создайте новую игру — она сохранится автоматически
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {displayGroups.map(g => (
                      <SeriesCard
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
                      <StandaloneCard
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
          )}

          {/* =================== PROFILE SCREEN =================== */}
          {menuScreen === 'profile' && (() => {
            const avatarSrc = userAvatarUrl || tgUser?.photo_url || '';
            const displayName = userDisplayName || (tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'Ведущий');
            const initials = (displayName[0] || '?').toUpperCase();
            const { totalGames, gomafiaTournamentsCount, gomafiaGamesCount, minicapsCount, minicapGamesCount, funkyGamesCount } = profileStats;
            const otherGames = Math.max(0, totalGames - gomafiaGamesCount - minicapGamesCount - funkyGamesCount);
            const segments = [
              { count: gomafiaGamesCount, color: '#8977fe', label: 'GoMafia' },
              { count: minicapGamesCount, color: '#ffd700', label: 'Миникап' },
              { count: funkyGamesCount, color: 'var(--accent-color, #a855f7)', label: 'Фанки' },
              { count: otherGames, color: 'rgba(255,255,255,0.15)', label: 'Другие' },
            ].filter(s => s.count > 0);
            return (
              <div className="animate-fade-in w-full max-w-[400px] pb-[100px]">
                <div className="flex flex-col gap-3 py-3 px-4">

                  {/* Compact header card */}
                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-2xl p-[2px] overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--accent-color), #6366f1)' }}>
                        <div className="w-full h-full rounded-[14px] overflow-hidden" style={{ background: 'var(--glass-surface)' }}>
                          {avatarSrc ? (
                            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarSrc})` }} />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-accent/20 to-indigo-500/20 flex items-center justify-center text-2xl font-black text-white">{initials}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-black tracking-tight text-white truncate">{displayName}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tgUser?.username && <span className="text-xs font-medium text-white/40 truncate">@{tgUser.username}</span>}
                        {tgUser?.id && <span className="text-[0.65em] text-white/20 tabular-nums shrink-0">ID {tgUser.id}</span>}
                      </div>
                      {goMafiaProfile && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <IconGoMafia size={12} />
                          <span className="text-accent text-xs font-bold truncate">{goMafiaProfile.nickname}</span>
                        </div>
                      )}
                    </div>
                    <button className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] active:scale-90 transition-transform"
                      onClick={() => {
                        const name = userDisplayName || (tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : '');
                        setProfileSettingsName(name);
                        setMenuScreen('profileSettings');
                        triggerHaptic('light');
                      }}>
                      <IconSettings size={16} color="var(--text-muted, rgba(255,255,255,0.4))" />
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: totalGames, label: pluralGames(totalGames), color: 'var(--accent-color)' },
                      { value: gomafiaTournamentsCount, label: 'турниры', color: '#8977fe' },
                      { value: minicapsCount, label: 'миникапы', color: '#ffd700' },
                      { value: funkyGamesCount, label: 'фанки', color: 'var(--accent-color)' },
                    ].map(s => (
                      <div key={s.label} className="glass-card rounded-xl py-3 px-2 flex flex-col items-center gap-1 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-[2px] opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }} />
                        <span className="text-xl font-black text-white tabular-nums leading-none">{s.value}</span>
                        <span className="text-[0.55rem] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--text-muted, rgba(255,255,255,0.35))' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Activity bar */}
                  {totalGames > 0 && (
                    <div className="glass-card rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted, rgba(255,255,255,0.3))' }}>Активность</span>
                        <span className="text-[0.6rem] font-bold tabular-nums" style={{ color: 'var(--text-muted, rgba(255,255,255,0.3))' }}>{totalGames} {pluralGames(totalGames)}</span>
                      </div>
                      <div className="flex w-full h-1.5 rounded-full overflow-hidden gap-[2px]">
                        {segments.map(s => (
                          <div key={s.label} className="h-full rounded-full transition-all duration-500" style={{ width: `${(s.count / totalGames) * 100}%`, background: s.color, minWidth: s.count > 0 ? 3 : 0 }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                        {segments.map(s => (
                          <div key={s.label} className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                            <span className="text-[0.6rem] font-semibold text-white/40">{s.label}</span>
                            <span className="text-[0.6rem] font-bold text-white/55 tabular-nums">{Math.round((s.count / totalGames) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl glass-card active:scale-[0.97] transition-all duration-200 group"
                      onClick={() => { setMenuScreen('themes'); triggerHaptic('light'); }}
                    >
                      <IconPalette size={16} color="var(--accent-color, #a855f7)" />
                      <span className="text-[0.8em] font-bold text-white/70">Темы</span>
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl glass-card active:scale-[0.97] transition-all duration-200 group"
                      onClick={() => {
                        const name = userDisplayName || (tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : '');
                        setProfileSettingsName(name);
                        setMenuScreen('profileSettings');
                        triggerHaptic('light');
                      }}
                    >
                      <IconEdit size={16} color="var(--accent-color, #a855f7)" />
                      <span className="text-[0.8em] font-bold text-white/70">Редактировать</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* =================== PROFILE SETTINGS SCREEN =================== */}
          {menuScreen === 'profileSettings' && (() => {
            const avatarSrc = userAvatarUrl || tgUser?.photo_url || '';
            const initials = ((profileSettingsName || userDisplayName)?.[0] || '?').toUpperCase();

            const handleAvatarChange = (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) return;
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const size = Math.min(img.width, img.height, 256);
                  canvas.width = size;
                  canvas.height = size;
                  const ctx = canvas.getContext('2d');
                  const sx = (img.width - size) / 2;
                  const sy = (img.height - size) / 2;
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  setUserAvatarUrl(dataUrl);
                  try { localStorage.setItem('maf_user_avatar', dataUrl); } catch {}
                  const token = authService.getStoredToken();
                  if (token) profileApi.saveProfile(token, { avatar_url: dataUrl });
                  triggerHaptic('success');
                };
                img.src = reader.result;
              };
              reader.readAsDataURL(file);
            };

            const handleSaveName = () => {
              const trimmed = profileSettingsName.trim();
              setUserDisplayName(trimmed);
              try { localStorage.setItem('maf_user_display_name', trimmed); } catch {}
              const token = authService.getStoredToken();
              if (token) profileApi.saveProfile(token, { display_name: trimmed });
              triggerHaptic('success');
              setMenuScreen('profile');
            };

            const handleRemoveAvatar = () => {
              setUserAvatarUrl('');
              try { localStorage.removeItem('maf_user_avatar'); } catch {}
              const token = authService.getStoredToken();
              if (token) profileApi.saveProfile(token, { avatar_url: null });
              triggerHaptic('medium');
            };

            const nameDirty = profileSettingsName !== (userDisplayName || (tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : ''));

            return (
              <div className="animate-fade-in w-full max-w-[400px] pb-[100px]">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <button
                      className="w-9 h-9 rounded-xl flex items-center justify-center glass-card cursor-pointer active:scale-90 transition-transform"
                      onClick={() => { setMenuScreen('profile'); triggerHaptic('light'); }}
                    >
                      <IconArrowRight size={16} color="rgba(255,255,255,0.7)" style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h2 className="text-[1.2em] font-black text-white tracking-tight">Настройки</h2>
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[0.6em] font-bold text-white/20 tracking-wider">v2.1</div>
                </div>

                <div className="flex flex-col gap-4 animate-stagger">

                  {/* ── Profile card ── */}
                  <div className="relative glass-card-md rounded-[22px] p-5 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.04]" style={{ background: 'var(--accent-color)' }} />

                    <div className="flex items-center gap-5">
                      <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-full p-[2.5px]" style={{ background: 'linear-gradient(135deg, var(--accent-color), #6366f1)' }}>
                          <div className="w-full h-full rounded-full bg-[#0a0a0c] p-[2px] overflow-hidden">
                            {avatarSrc ? (
                              <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarSrc})` }} />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-accent/20 to-indigo-500/20 flex items-center justify-center text-2xl font-black text-white">{initials}</div>
                            )}
                          </div>
                        </div>
                        <button
                          className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-accent border-[3px] border-[#0a0a0c] flex items-center justify-center cursor-pointer active:scale-[0.85] transition-transform shadow-[0_2px_8px_rgba(var(--accent-rgb),0.4)]"
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <IconCamera size={13} color="#fff" />
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                        <div>
                          <div className="text-[0.55em] font-bold uppercase tracking-[0.15em] text-white/25 mb-1.5 ml-0.5">Никнейм</div>
                          <input
                            className="input-field w-full"
                            type="text"
                            value={profileSettingsName}
                            onChange={e => setProfileSettingsName(e.target.value)}
                            placeholder="Введите имя..."
                            maxLength={40}
                          />
                        </div>
                        {userAvatarUrl && (
                          <button className="flex items-center gap-1.5 text-[0.68em] font-semibold text-red-400/40 bg-transparent border-none cursor-pointer hover:text-red-400 transition-colors" onClick={handleRemoveAvatar}>
                            <IconTrash size={11} /> Удалить фото
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Интеграции ── */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[0.6rem] font-bold text-white/20 uppercase tracking-[0.15em]">Интеграции</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  {goMafiaProfile ? (
                    <div className="relative glass-card rounded-[22px] p-5 overflow-hidden">
                      <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-[#22c55e] to-[#22c55e]/20 rounded-l-full" />

                      <div className="flex items-center gap-3 mb-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] flex items-center justify-center">
                          <IconGoMafia size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.85em] font-bold text-white">GoMafia</div>
                          <div className="text-[0.6em] font-semibold text-[#22c55e]/70 uppercase tracking-[0.05em]">Подключено</div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 cursor-pointer active:scale-90 transition-transform hover:bg-white/[0.08]"
                            onClick={async () => {
                              triggerHaptic('light');
                              try {
                                const res = await goMafiaApi.lookupGoMafiaPlayer(goMafiaProfile.nickname);
                                if (res.success && res.profile) {
                                  const updated = { ...goMafiaProfile, nickname: res.profile.nickname || goMafiaProfile.nickname, avatar: res.profile.avatar || goMafiaProfile.avatar, id: res.profile.id || goMafiaProfile.id, title: res.profile.title || goMafiaProfile.title };
                                  goMafiaApi.saveGoMafiaProfile(updated);
                                  setGoMafiaProfile(updated);
                                  if (updated.nickname) { setUserDisplayName(updated.nickname); try { localStorage.setItem('maf_user_display_name', updated.nickname); } catch {} }
                                  if (updated.avatar) { setUserAvatarUrl(updated.avatar); try { localStorage.setItem('maf_user_avatar', updated.avatar); } catch {} }
                                  const token = authService.getStoredToken();
                                  if (token) profileApi.saveProfile(token, { gomafia: updated });
                                  triggerHaptic('success');
                                }
                              } catch {}
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                          </button>
                          <button
                            className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.06)] flex items-center justify-center text-[rgba(239,68,68,0.4)] cursor-pointer active:scale-90 transition-transform hover:text-red-400"
                            onClick={() => { goMafiaApi.removeGoMafiaProfile(); setGoMafiaProfile(null); const token = authService.getStoredToken(); if (token) profileApi.clearGoMafia(token); triggerHaptic('medium'); }}
                          >
                            <IconX size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 py-2.5 px-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                        {goMafiaProfile.avatar ? (
                          <img src={goMafiaProfile.avatar} alt="" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-[rgba(137,119,254,0.15)] text-[0.75em] font-bold text-white">
                            {(goMafiaProfile.nickname || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-[0.82em] font-bold text-white/70">{goMafiaProfile.nickname}</span>
                        {goMafiaProfile.title && <span className="text-[0.65em] text-white/25 font-medium ml-auto">{goMafiaProfile.title}</span>}
                      </div>

                      {linkedAccounts && (
                        <div className="flex items-center justify-between mt-3 py-2.5 px-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                          <div className="text-[0.72em] font-semibold text-white/30">Авторизация</div>
                          {linkedAccounts.gomafia?.linked ? (
                            <span className="inline-flex items-center gap-1 text-[0.62em] font-bold py-0.5 px-2 rounded-md bg-[rgba(34,197,94,0.1)] text-[#22c55e]">
                              <IconCheck size={10} /> Привязан
                            </span>
                          ) : (
                            <button
                              className="text-[0.65em] font-bold py-1 px-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent cursor-pointer active:scale-[0.92] transition-transform"
                              onClick={() => { setGoMafiaModal(true); setGoMafiaLogin({ nickname: goMafiaProfile?.nickname || '', password: '', loading: false, error: '' }); triggerHaptic('light'); }}
                            >
                              Привязать
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      className="relative glass-card rounded-[22px] p-5 overflow-hidden flex items-center gap-4 cursor-pointer text-left active:scale-[0.98] transition-all hover:border-[rgba(137,119,254,0.2)] group"
                      onClick={() => { setGoMafiaModal(true); setGoMafiaLogin({ nickname: '', password: '', loading: false, error: '' }); triggerHaptic('light'); }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[rgba(137,119,254,0.15)] to-[rgba(10,232,240,0.08)] border border-[rgba(137,119,254,0.2)] flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(137,119,254,0.15)] transition-shadow">
                        <IconGoMafia size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.85em] font-bold text-white">Подключить GoMafia</div>
                        <div className="text-[0.68em] text-white/30 mt-0.5">Привяжите аккаунт gomafia.pro</div>
                      </div>
                      <IconArrowRight size={14} color="rgba(255,255,255,0.15)" />
                    </button>
                  )}

                  {/* ── Section: Безопасность ── */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[0.6rem] font-bold text-white/20 uppercase tracking-[0.15em]">Безопасность</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  {!linkedAccounts ? (
                    <div className="glass-card rounded-[22px] p-6 flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
                      <span className="text-[0.8em] text-white/35">Загрузка...</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative glass-card rounded-[22px] p-4 flex flex-col items-center gap-2.5 text-center overflow-hidden cursor-pointer transition-all active:scale-[0.97] hover:border-[rgba(56,163,224,0.2)]">
                          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#38a3e0] to-transparent opacity-50" />
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[rgba(56,163,224,0.08)] border border-[rgba(56,163,224,0.12)]">
                            <span className="text-lg">✈️</span>
                          </div>
                          <div className="text-[0.82em] font-bold text-white">Telegram</div>
                          <div className="text-[0.62em] text-white/30 font-medium">
                            {linkedAccounts.telegram?.linked
                              ? (linkedAccounts.telegram.username ? `@${linkedAccounts.telegram.username}` : 'Привязан')
                              : 'Не привязан'
                            }
                          </div>
                          {linkedAccounts.telegram?.linked && (
                            <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-role-dot" />
                          )}
                          {!linkedAccounts.telegram?.linked && !linkTelegramMode && (
                            <button
                              className="text-[0.62em] font-bold py-1 px-3 rounded-lg bg-[rgba(56,163,224,0.1)] border border-[rgba(56,163,224,0.2)] text-[#38a3e0] cursor-pointer active:scale-[0.92] transition-transform mt-0.5"
                              onClick={async () => {
                                triggerHaptic('light');
                                const token = authService.getStoredToken();
                                if (!token) return;
                                const res = await fetch('/login/code-generate.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link_token: token }) }).then(r => r.json());
                                if (!res.code) return;
                                setLinkTelegramMode({ code: res.code, expiresIn: res.expires_in, botLink: res.bot_link, botUsername: res.bot_username });
                                stopLinkPolling();
                                let remaining = res.expires_in;
                                linkTimerRef.current = setInterval(() => { remaining--; setLinkTelegramMode(prev => prev ? { ...prev, expiresIn: remaining } : null); if (remaining <= 0) { stopLinkPolling(); setLinkTelegramMode(null); } }, 1000);
                                linkPollRef.current = setInterval(async () => { const check = await authService.checkCode(res.code); if (check.confirmed) { stopLinkPolling(); setLinkTelegramMode(null); authService.storeAuth(check.token, check.user); loadLinkedAccounts(); triggerHaptic('success'); } else if (check.expired) { stopLinkPolling(); setLinkTelegramMode(null); } }, 2500);
                              }}
                            >
                              Привязать
                            </button>
                          )}
                        </div>

                        <div
                          className="relative glass-card rounded-[22px] p-4 flex flex-col items-center gap-2.5 text-center overflow-hidden cursor-pointer transition-all active:scale-[0.97] hover:border-[rgba(34,197,94,0.2)]"
                          onClick={() => { setMenuScreen('passkeys'); triggerHaptic('light'); }}
                        >
                          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#22c55e] to-transparent opacity-50" />
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.12)]">
                            <span className="text-lg">🔐</span>
                          </div>
                          <div className="text-[0.82em] font-bold text-white">PassKey</div>
                          <div className="text-[0.62em] text-white/30 font-medium">
                            {linkedAccounts.passkeys?.length > 0
                              ? `${linkedAccounts.passkeys.length} ключ${linkedAccounts.passkeys.length > 1 ? (linkedAccounts.passkeys.length < 5 ? 'а' : 'ей') : ''}`
                              : 'Не настроен'
                            }
                          </div>
                          {linkedAccounts.passkeys?.length > 0 && (
                            <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(168,85,247,0.6)] animate-role-dot" />
                          )}
                        </div>
                      </div>

                      {linkTelegramMode && (
                        <div className="glass-card-md rounded-[22px] p-5 text-center overflow-hidden animate-scale-in">
                          <div className="text-[1.8em] font-black tracking-[8px] text-white tabular-nums py-1">{linkTelegramMode.code}</div>
                          <div className="text-[0.72em] text-white/35 mt-1">
                            Отправьте код боту · <span className="tabular-nums">{Math.floor(linkTelegramMode.expiresIn / 60)}:{String(linkTelegramMode.expiresIn % 60).padStart(2, '0')}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            {linkTelegramMode.botLink && (
                              <a href={linkTelegramMode.botLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center justify-center py-2 px-4 rounded-xl bg-[rgba(56,163,224,0.1)] border border-[rgba(56,163,224,0.2)] text-[#38a3e0] text-xs font-bold no-underline cursor-pointer active:scale-95 transition-transform">
                                Открыть @{linkTelegramMode.botUsername || 'бота'}
                              </a>
                            )}
                            <button
                              className="inline-flex items-center justify-center py-2 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/30 text-xs font-bold cursor-pointer active:scale-95 transition-transform"
                              onClick={() => { stopLinkPolling(); setLinkTelegramMode(null); }}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Sessions ── */}
                  <div className="glass-card rounded-[22px] p-5 overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
                        <IconLock size={13} color="rgba(255,255,255,0.25)" />
                      </div>
                      <span className="text-[0.72em] font-bold text-white/35 uppercase tracking-wider">Сессии</span>
                      {deviceSessions.length > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[0.6em] font-bold text-white/25 tabular-nums">{deviceSessions.length}</span>
                      )}
                    </div>

                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-5 gap-2">
                        <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
                        <span className="text-[0.8em] text-white/35">Загрузка...</span>
                      </div>
                    ) : deviceSessions.length === 0 ? (
                      <div className="text-center py-4 text-[0.8em] text-white/20">Нет активных сеансов</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {deviceSessions.map(session => (
                          <div key={session.id} className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-all ${session.is_current ? 'bg-accent/[0.05] border border-accent/15' : 'bg-white/[0.02] border border-white/[0.04]'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${session.is_current ? 'bg-accent/10 text-accent' : 'bg-white/[0.04] text-white/25'}`}>
                              {session.device_name?.includes('iPhone') || session.device_name?.includes('iPad') || session.device_name?.includes('Android') ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.78em] font-bold text-white truncate">{session.device_name || 'Неизвестное устройство'}</div>
                              <div className={`text-[0.6em] font-medium ${session.is_current ? 'text-accent/60' : 'text-white/20'}`}>
                                {session.is_current ? 'Текущее устройство' : formatSessionDate(session.last_active)}
                              </div>
                            </div>
                            {!session.is_current && (
                              <button
                                className="text-[0.6em] font-bold py-1 px-2.5 rounded-lg bg-red-500/[0.06] text-red-400/40 border-none cursor-pointer active:text-red-400 hover:bg-red-500/[0.1] transition-all"
                                onClick={() => handleTerminateSession(session.id)}
                                disabled={terminatingId === session.id}
                                style={{ opacity: terminatingId === session.id ? 0.5 : 1 }}
                              >
                                {terminatingId === session.id ? '...' : 'Завершить'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Danger zone ── */}
                  {!window.Telegram?.WebApp?.initData && (
                    <>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-px flex-1 bg-red-500/10" />
                        <span className="text-[0.6rem] font-bold text-red-400/25 uppercase tracking-[0.15em]">Опасная зона</span>
                        <div className="h-px flex-1 bg-red-500/10" />
                      </div>
                      <button
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[18px] text-[0.8em] font-bold text-red-400/50 bg-red-500/[0.04] border border-red-500/10 cursor-pointer active:scale-[0.97] transition-all hover:bg-red-500/[0.08] hover:text-red-400/70"
                        onClick={() => { authService.logout(); triggerHaptic('medium'); window.location.reload(); }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Выйти отовсюду
                      </button>
                    </>
                  )}

                </div>

                {/* Save button */}
                <button
                  className={`w-full mt-5 flex items-center justify-center gap-2 py-4 rounded-2xl text-[0.9em] font-bold active:scale-[0.97] transition-all ${nameDirty ? 'bg-accent text-white shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)] animate-pulse-glow' : 'bg-accent/80 text-white/80 shadow-[0_0_16px_rgba(var(--accent-rgb),0.2)]'}`}
                  onClick={handleSaveName}
                >
                  <IconCheck size={16} /> Сохранить
                </button>
              </div>
            );
          })()}

          {/* =================== PASSKEYS SCREEN =================== */}
          {menuScreen === 'passkeys' && (() => {
            const handleAddPasskey = async () => {
              setPasskeyError('');
              triggerHaptic('light');
              const token = authService.getStoredToken();

              if (authService.isTelegramWebView()) {
                const url = `${window.location.origin}/login/passkey-setup.php?token=${encodeURIComponent(token)}`;
                if (window.Telegram?.WebApp?.openLink) {
                  window.Telegram.WebApp.openLink(url);
                } else {
                  window.open(url, '_blank');
                }
                return;
              }

              setPasskeyRegistering(true);
              const result = await authService.passkeyRegister(token);
              setPasskeyRegistering(false);
              if (result.success) {
                loadLinkedAccounts();
                triggerHaptic('success');
              } else {
                setPasskeyError(result.error || 'Не удалось добавить PassKey');
                triggerHaptic('error');
              }
            };

            const handleDeletePasskey = async (pkId) => {
              triggerHaptic('warning');
              const token = authService.getStoredToken();
              await authService.unlinkMethod(token, 'passkey', pkId);
              loadLinkedAccounts();
              triggerHaptic('success');
            };

            const passkeys = linkedAccounts?.passkeys || [];

            return (
              <div className="animate-fade-in w-full max-w-[400px] pb-[100px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <button
                      className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] cursor-pointer active:scale-90 transition-transform"
                      onClick={() => { setMenuScreen('profileSettings'); setPasskeyError(''); triggerHaptic('light'); }}
                    >
                      <IconArrowRight size={16} color="rgba(255,255,255,0.7)" style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h2 className="text-[1.1em] font-extrabold text-white">PassKey</h2>
                  </div>
                  <div className="min-w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-[0.7em] font-bold text-white/40">{passkeys.length}</div>
                </div>

                <div className="flex flex-col gap-3.5">
                  {!linkedAccounts ? (
                    <div className="bg-[rgba(18,18,26,0.8)] backdrop-blur-[24px] border border-white/[0.05] rounded-[20px] p-5 relative overflow-hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8 }}>
                      <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
                      <span style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.35)' }}>Загрузка...</span>
                    </div>
                  ) : passkeys.length === 0 ? (
                    <div className="bg-[rgba(18,18,26,0.8)] backdrop-blur-[24px] border border-white/[0.05] rounded-[20px] p-5 relative overflow-hidden text-center py-10 px-6">
                      <div className="text-[2.4em] mb-3 opacity-40">🔐</div>
                      <div className="text-[0.95em] font-bold text-white/50 mb-1.5">Нет ключей</div>
                      <div className="text-[0.72em] text-white/25 leading-relaxed max-w-[260px] mx-auto">Добавьте PassKey для быстрого и безопасного входа без пароля</div>
                    </div>
                  ) : (
                    <div className="bg-[rgba(18,18,26,0.8)] backdrop-blur-[24px] border border-white/[0.05] rounded-[20px] p-5 relative overflow-hidden" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {passkeys.map(pk => (
                          <div key={pk.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <div className="text-lg shrink-0">🔑</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.78em] font-bold text-white truncate">{pk.device_name || 'PassKey'}</div>
                              <div className="text-[0.6em] text-white/25 font-medium">
                                {pk.last_used_at ? `Использован ${formatSessionDate(pk.last_used_at)}` : `Создан ${formatSessionDate(pk.created_at)}`}
                              </div>
                            </div>
                            <button
                              className="w-7 h-7 rounded-lg bg-red-500/[0.06] flex items-center justify-center text-red-400/40 cursor-pointer active:scale-90 active:text-red-400 transition-all shrink-0"
                              onClick={() => handleDeletePasskey(pk.id)}
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {passkeyError && (
                    <div style={{ fontSize: '0.78em', color: '#ff453a', padding: '2px 4px', textAlign: 'center' }}>{passkeyError}</div>
                  )}

                  <button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[20px] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] text-[#22c55e] text-[0.82em] font-bold cursor-pointer active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-wait"
                    disabled={passkeyRegistering}
                    onClick={handleAddPasskey}
                  >
                    <IconPlus size={16} />
                    {passkeyRegistering ? 'Создание...' : 'Добавить PassKey'}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* =================== THEMES SCREEN =================== */}
          {menuScreen === 'themes' && (
            <div className="animate-fade-in w-full max-w-[400px] pb-[100px] flex flex-col gap-3">
              {/* Dark / Light mode */}
              <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
                <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {darkMode ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #a855f7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #a855f7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  )}
                  Режим
                </h3>
                <div className="flex items-center gap-2 p-1 rounded-[14px]" style={{ background: 'var(--surface-primary)', border: '1px solid var(--surface-border)' }}>
                  <button
                    onClick={() => { setDarkMode(true); applyDarkMode(true); triggerHaptic('medium'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[0.8em] font-bold transition-all duration-200 ${darkMode ? 'shadow-glass-sm' : ''}`}
                    style={darkMode ? { background: 'var(--accent-color)', color: '#fff' } : { color: 'var(--text-secondary)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    Тёмная
                  </button>
                  <button
                    onClick={() => { setDarkMode(false); applyDarkMode(false); triggerHaptic('medium'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[0.8em] font-bold transition-all duration-200 ${!darkMode ? 'shadow-glass-sm' : ''}`}
                    style={!darkMode ? { background: 'var(--accent-color)', color: '#fff' } : { color: 'var(--text-secondary)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    Светлая
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
                <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconPalette size={16} color="var(--accent-color, #a855f7)" /> Акцент
                </h3>

                {/* Current theme */}
                {(() => {
                  const cur = COLOR_SCHEMES.find(s => s.key === selectedColorScheme) || COLOR_SCHEMES[0];
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                      padding: '10px 14px', borderRadius: 14,
                      background: `linear-gradient(135deg, ${cur.gradient[0]}12, ${cur.gradient[1]}08)`,
                      border: `1px solid ${cur.accent}25`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg, ${cur.gradient[0]}, ${cur.gradient[1]})`,
                        boxShadow: `0 4px 14px ${cur.accent}40`,
                      }} />
                      <div>
                        <div style={{ fontSize: '0.85em', fontWeight: 700, color: cur.accent }}>{cur.name}</div>
                        <div style={{ fontSize: '0.7em', fontWeight: 500, color: 'var(--text-muted)' }}>Текущая тема</div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-5 gap-2">
                  {COLOR_SCHEMES.map(c => {
                    const isActive = selectedColorScheme === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => selectColor(c.key)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                          isActive
                            ? 'border-accent/30'
                            : 'border-transparent hover:border-[var(--surface-border-hover)]'
                        }`}
                        style={isActive ? { background: 'var(--accent-surface)' } : { background: 'var(--surface-primary)' }}
                      >
                        <div className="relative w-6 h-6 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}>
                          {isActive && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <IconCheck size={10} color="#fff" className="drop-shadow-md" />
                            </span>
                          )}
                        </div>
                        <span className="text-[0.65em] font-bold text-center leading-tight">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================== NOTIFICATIONS SCREEN =================== */}
          {menuScreen === 'notifications' && (
            <div className="animate-fade-in w-full max-w-[400px] pb-[100px] flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[1.3em] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Уведомления</h2>
                {notifications.length > 0 && (
                  <span className="text-[0.65em] font-bold tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', color: 'var(--accent-color)' }}>
                    {notifications.length}
                  </span>
                )}
              </div>

              {notificationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-border)', borderTopColor: 'var(--accent-color)' }} />
                </div>
              ) : notifications.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {notifications.map(n => (
                    <NotificationCard
                      key={n.id}
                      icon={n.icon || '📢'}
                      accentColor={n.accentColor || 'var(--accent-color)'}
                      title={n.title}
                      description={n.description}
                      time={formatSessionDate(n.created_at)}
                      isNew={n.pinned}
                      link={n.link}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 mt-6 py-8">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)' }}>
                    <IconBell size={28} color="var(--accent-color)" />
                  </div>
                  <div className="text-center">
                    <div className="text-[0.95em] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Нет уведомлений</div>
                    <div className="text-[0.8em] font-medium max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
                      Здесь будут появляться уведомления о турнирах, результатах игр и обновлениях.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================== PLAYER SCREEN =================== */}
          {menuScreen === 'player' && (
            <div className="animate-fade-in w-full max-w-[400px] pb-[100px] flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[1.3em] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Мои игры</h2>
                {playerNickname && (
                  <span className="text-[0.7em] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', color: 'var(--accent-color)' }}>
                    {playerNickname}
                  </span>
                )}
              </div>

              {playerLoading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-8 h-8 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[0.8em] font-medium" style={{ color: 'var(--text-muted)' }}>Загрузка...</span>
                </div>
              )}

              {!playerLoading && playerError === 'no_gomafia' && (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)' }}>
                    <IconGoMafia size={32} />
                  </div>
                  <div className="text-center">
                    <div className="text-[0.95em] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Привяжите GoMafia</div>
                    <div className="text-[0.8em] font-medium max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
                      Чтобы видеть свои игры, привяжите аккаунт GoMafia в настройках профиля.
                    </div>
                  </div>
                  <button
                    className="px-5 py-2.5 rounded-xl font-bold text-[0.85em] text-white transition-all active:scale-95"
                    style={{ background: 'var(--accent-color)' }}
                    onClick={() => { setMenuScreen('profile'); triggerHaptic('light'); }}
                  >
                    Перейти в профиль
                  </button>
                </div>
              )}

              {!playerLoading && playerError && playerError !== 'no_gomafia' && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="text-[0.9em] font-medium" style={{ color: 'var(--text-muted)' }}>{playerError}</div>
                  <button
                    className="px-4 py-2 rounded-xl font-bold text-[0.8em] transition-all active:scale-95"
                    style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)', color: 'var(--accent-color)' }}
                    onClick={loadPlayerGames}
                  >
                    Повторить
                  </button>
                </div>
              )}

              {!playerLoading && !playerError && playerGames && playerGames.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)' }}>
                    <IconTarget size={28} color="var(--accent-color)" />
                  </div>
                  <div className="text-center">
                    <div className="text-[0.95em] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Пока нет игр</div>
                    <div className="text-[0.8em] font-medium max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
                      Вы пока не участвовали в играх. Когда ведущий добавит вас в стол, игры появятся здесь.
                    </div>
                  </div>
                </div>
              )}

              {!playerLoading && !playerError && playerGames && playerGames.length > 0 && (() => {
                const grouped = {};
                playerGames.forEach(g => {
                  const key = g.session_id;
                  if (!grouped[key]) grouped[key] = { tournament_name: g.tournament_name, game_mode: g.game_mode, session_id: g.session_id, judge_telegram_id: g.judge_telegram_id, games: [] };
                  grouped[key].games.push(g);
                });
                const sessions = Object.values(grouped);
                return (
                  <div className="flex flex-col gap-3">
                    {sessions.map((sess) => {
                      const latestGame = sess.games[0];
                      const isNew = sess.games.some(g => new Date(g.updated_at).getTime() > playerLastViewed);
                      const winColor = latestGame.winner_team === 'civilians' ? '#30d158' : latestGame.winner_team === 'mafia' ? '#ff453a' : 'var(--text-muted)';
                      const winLabel = latestGame.winner_team === 'civilians' ? 'Мирные' : latestGame.winner_team === 'mafia' ? 'Мафия' : latestGame.game_finished ? 'Ничья' : 'В процессе';
                      return (
                        <button
                          key={sess.session_id}
                          className="relative w-full text-left p-3.5 rounded-2xl glass-card transition-all active:scale-[0.98] cursor-pointer"
                          style={isNew ? { borderLeft: '3px solid var(--accent-color)' } : {}}
                          onClick={() => { loadPlayerSessionDetail(sess.session_id, sess.judge_telegram_id); triggerHaptic('light'); }}
                          disabled={playerDetailLoading}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.85em] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {sess.tournament_name || 'Игра'}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {sess.game_mode && (
                                  <span className="text-[0.6em] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: 'var(--accent-surface)', color: 'var(--accent-color)' }}>
                                    {sess.game_mode}
                                  </span>
                                )}
                                <span className="text-[0.65em] font-medium" style={{ color: 'var(--text-muted)' }}>
                                  {new Date(latestGame.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            {latestGame.player_score !== null && (
                              <div className="text-[1.4em] font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                {latestGame.player_score}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {latestGame.player_num !== null && (
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.7em] font-black shrink-0" style={{ background: 'var(--accent-surface)', color: 'var(--accent-color)' }}>
                                {latestGame.player_num}
                              </div>
                            )}
                            {latestGame.player_role && (
                              <span className="text-[0.75em] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                {latestGame.player_role}
                              </span>
                            )}
                            {latestGame.player_action && (
                              <span className="text-[0.65em] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,69,58,0.1)', color: '#ff453a' }}>
                                {latestGame.player_action}
                              </span>
                            )}
                            <span className="ml-auto text-[0.65em] font-bold" style={{ color: winColor }}>
                              {winLabel}
                            </span>
                          </div>

                          {isNew && (
                            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--accent-color)] shadow-[0_0_6px_var(--accent-color)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* =================== PLAYER DETAIL SCREEN =================== */}
          {menuScreen === 'playerDetail' && playerDetailSession && (() => {
            const allGames = playerDetailSession.gamesHistory || [];
            const hasMultipleGames = allGames.length > 1;
            const activeGame = playerSelectedGame !== null && allGames[playerSelectedGame] ? allGames[playerSelectedGame] : (allGames.length > 0 ? allGames[allGames.length - 1] : playerDetailSession.currentGame);
            const gamePlayers = activeGame?.players || [];
            const wt = activeGame?.winnerTeam;
            const wtIsCiv = wt === 'civilians';
            const wtLabel = wtIsCiv ? 'Победа мирных' : wt === 'mafia' ? 'Победа мафии' : wt === 'draw' ? 'Ничья' : null;

            return (
            <div className="animate-fade-in w-full max-w-[400px] pb-[100px] flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center gap-3 mb-1">
                <button
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90"
                  style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)' }}
                  onClick={() => { setMenuScreen('player'); setPlayerDetailSession(null); setPlayerSelectedGame(null); triggerHaptic('light'); }}
                >
                  <IconArrowRight size={16} color="var(--accent-color)" style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[1.1em] font-black tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                    {playerDetailSession.tournamentName || 'Результаты'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {playerDetailSession.gameMode && (
                      <span className="text-[0.6em] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: 'var(--accent-surface)', color: 'var(--accent-color)' }}>
                        {playerDetailSession.gameMode}
                      </span>
                    )}
                    {playerDetailSession.gameSelected && (
                      <span className="text-[0.6em] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Игра {playerDetailSession.gameSelected}{playerDetailSession.tableSelected ? ` • Стол ${playerDetailSession.tableSelected}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Game selector for multiple games */}
              {hasMultipleGames && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {allGames.map((g, idx) => {
                    const isActive = playerSelectedGame === idx;
                    const gWt = g.winnerTeam;
                    const gColor = gWt === 'civilians' ? '#30d158' : gWt === 'mafia' ? '#ff453a' : 'var(--text-muted)';
                    return (
                      <button
                        key={idx}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-[0.72em] font-bold transition-all active:scale-95"
                        style={{
                          background: isActive ? 'var(--accent-color)' : 'var(--accent-surface)',
                          color: isActive ? '#fff' : gColor,
                          border: isActive ? 'none' : '1px solid var(--accent-border)',
                        }}
                        onClick={() => { setPlayerSelectedGame(idx); setPlayerDetailTab('scores'); triggerHaptic('selection'); }}
                      >
                        Игра {g.gameNumber || idx + 1}
                      </button>
                    );
                  })}
                  <button
                    className="shrink-0 px-3 py-1.5 rounded-xl text-[0.72em] font-bold transition-all active:scale-95"
                    style={{
                      background: playerSelectedGame === -1 ? 'var(--accent-color)' : 'var(--accent-surface)',
                      color: playerSelectedGame === -1 ? '#fff' : 'var(--accent-color)',
                      border: playerSelectedGame === -1 ? 'none' : '1px solid var(--accent-border)',
                    }}
                    onClick={() => { setPlayerSelectedGame(-1); triggerHaptic('selection'); }}
                  >
                    Общая таблица
                  </button>
                </div>
              )}

              {/* ===== OVERALL TABLE MODE ===== */}
              {playerSelectedGame === -1 && hasMultipleGames && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 text-[0.75em] font-bold" style={{ color: 'var(--text-muted)' }}>
                    <span>Всего игр: {allGames.length}</span>
                    <span style={{ color: '#30d158' }}>Мирные: {allGames.filter(g => g.winnerTeam === 'civilians').length}</span>
                    <span style={{ color: '#ff453a' }}>Мафия: {allGames.filter(g => g.winnerTeam === 'mafia').length}</span>
                  </div>
                  {/* Per-game summary rows */}
                  {allGames.map((g, idx) => {
                    const selfPlayer = g.players?.find(p => p.login === playerNickname);
                    const gWt = g.winnerTeam;
                    const gColor = gWt === 'civilians' ? '#30d158' : gWt === 'mafia' ? '#ff453a' : 'var(--text-muted)';
                    const gLabel = gWt === 'civilians' ? 'Мирные' : gWt === 'mafia' ? 'Мафия' : 'Ничья';
                    return (
                      <button
                        key={idx}
                        className="w-full text-left p-3 rounded-xl glass-card transition-all active:scale-[0.98]"
                        onClick={() => { setPlayerSelectedGame(idx); setPlayerDetailTab('scores'); triggerHaptic('light'); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[0.75em] font-black w-6 text-center" style={{ color: 'var(--accent-color)' }}>#{g.gameNumber || idx + 1}</span>
                            {selfPlayer && (
                              <>
                                <span className="text-[0.72em] font-semibold" style={{ color: selfPlayer.isBlack ? '#ff453a' : '#30d158' }}>
                                  {selfPlayer.role}
                                </span>
                                {selfPlayer.action && (
                                  <span className="text-[0.6em] font-medium px-1 py-0.5 rounded" style={{ background: 'rgba(255,69,58,0.1)', color: '#ff453a' }}>
                                    {selfPlayer.action}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[0.65em] font-bold" style={{ color: gColor }}>{gLabel}</span>
                            {selfPlayer && selfPlayer.score !== null && (
                              <span className="text-[1em] font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{selfPlayer.score}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {/* Overall totals table */}
                  <PlayerDetailScoresTable players={(() => {
                    const totals = {};
                    allGames.forEach(g => {
                      (g.players || []).forEach(p => {
                        if (!totals[p.login]) totals[p.login] = { login: p.login, totalScore: 0, games: 0, roles: [] };
                        totals[p.login].totalScore += (p.score || 0);
                        totals[p.login].games++;
                        if (p.role) totals[p.login].roles.push(p.role);
                      });
                    });
                    return Object.values(totals).sort((a, b) => b.totalScore - a.totalScore).map((t, i) => ({
                      num: i + 1, login: t.login, role: `${t.games} игр`, isBlack: false,
                      action: null, score: Math.round(t.totalScore * 100) / 100, fouls: 0, techFouls: 0,
                    }));
                  })()} selfNickname={playerNickname} isOverall />
                </div>
              )}

              {/* ===== SINGLE GAME MODE ===== */}
              {playerSelectedGame !== -1 && activeGame && (
                <div className="flex flex-col gap-3">
                  {/* Winner banner */}
                  {wtLabel && (
                    <div className="p-3 rounded-xl text-center font-bold text-[0.85em]" style={{
                      background: wtIsCiv ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                      color: wtIsCiv ? '#30d158' : '#ff453a',
                      border: `1px solid ${wtIsCiv ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}`,
                    }}>
                      {wtLabel}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex rounded-xl overflow-hidden" style={{ background: 'var(--accent-surface)', border: '1px solid var(--accent-border)' }}>
                    {['scores', 'summary'].map(tab => (
                      <button
                        key={tab}
                        className="flex-1 py-2 text-[0.75em] font-bold transition-all"
                        style={{
                          background: playerDetailTab === tab ? 'var(--accent-color)' : 'transparent',
                          color: playerDetailTab === tab ? '#fff' : 'var(--text-muted)',
                        }}
                        onClick={() => { setPlayerDetailTab(tab); triggerHaptic('selection'); }}
                      >
                        {tab === 'scores' ? 'Баллы' : 'Сводка'}
                      </button>
                    ))}
                  </div>

                  {/* Scores tab */}
                  {playerDetailTab === 'scores' && (
                    <PlayerDetailScoresTable players={gamePlayers} selfNickname={playerNickname} />
                  )}

                  {/* Summary tab */}
                  {playerDetailTab === 'summary' && (
                    <PlayerDetailSummary game={activeGame} selfNickname={playerNickname} />
                  )}
                </div>
              )}
            </div>
            );
          })()}

        </div>
      </div>

      {createPortal(
        <nav className="fixed z-50 left-0 right-0 max-w-[448px] mx-auto flex items-center justify-around rounded-3xl glass-surface shadow-nav-bar py-2 animate-nav-slide-in" style={{ bottom: 'calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))' }}>
          <NavItem active={!tableGroup && menuScreen === 'game' && activeTab === 'active'}
            onClick={() => { setTableGroup(null); setMenuScreen('game'); setActiveTab('active'); triggerHaptic('selection'); }}
            icon={<IconPlayCircle size={20} />} label="Активные" />
          <NavItem active={!tableGroup && menuScreen === 'player'}
            onClick={() => { setTableGroup(null); setMenuScreen('player'); triggerHaptic('selection'); }}
            icon={<IconTarget size={20} />} label="Игрок" badge={playerHasUpdates} />
          <NavItem primary
            onClick={() => { setTableGroup(null); startNewGame(); triggerHaptic('medium'); }}
            icon={<IconPlus size={22} />} label="Новая" />
          <NavItem active={!tableGroup && menuScreen === 'notifications'}
            onClick={() => { setTableGroup(null); setMenuScreen('notifications'); triggerHaptic('light'); }}
            icon={<IconBell size={20} />} label="События" />
          <NavItem active={!tableGroup && (menuScreen === 'profile' || menuScreen === 'profileSettings')}
            onClick={() => { setTableGroup(null); setMenuScreen('profile'); triggerHaptic('light'); }}
            icon={<IconUser size={20} />} label="Профиль" />
        </nav>,
        document.body
      )}

      {newGameModal.visible && createPortal(
        <NewGameModal
          modal={newGameModal}
          onSelect={handleSelectNewGameInTournament}
          onClose={closeNewGameModal}
          onLoadSession={loadSession}
        />,
        document.body
      )}

      {goMafiaModal && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/60 flex items-center justify-center p-6" onClick={() => !goMafiaLogin.loading && setGoMafiaModal(false)}>
          <div className="w-full max-w-[360px] bg-[rgba(18,18,26,0.95)] backdrop-blur-[24px] border border-white/[0.08] rounded-3xl p-6 relative animate-fade-in" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center cursor-pointer active:scale-90 transition-transform border-none"
              onClick={() => !goMafiaLogin.loading && setGoMafiaModal(false)}
            >
              <IconX size={18} color="rgba(255,255,255,0.5)" />
            </button>

            <div className="flex flex-col items-center gap-2 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[rgba(137,119,254,0.2)] to-[rgba(10,232,240,0.1)] border border-[rgba(137,119,254,0.3)] flex items-center justify-center">
                <IconGoMafia size={32} />
              </div>
              <h3 className="text-[1.1em] font-extrabold text-white">Войти в GoMafia</h3>
              <p className="text-[0.75em] text-white/35 font-medium">Введите данные аккаунта gomafia.pro</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[0.6em] font-bold uppercase tracking-[0.12em] text-white/25 ml-0.5">Никнейм</label>
                <input
                  className="input-field w-full"
                  type="text"
                  value={goMafiaLogin.nickname}
                  onChange={e => setGoMafiaLogin(prev => ({ ...prev, nickname: e.target.value, error: '' }))}
                  placeholder="Введите никнейм..."
                  autoComplete="username"
                  disabled={goMafiaLogin.loading}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.6em] font-bold uppercase tracking-[0.12em] text-white/25 ml-0.5">Пароль</label>
                <input
                  className="input-field w-full"
                  type="password"
                  value={goMafiaLogin.password}
                  onChange={e => setGoMafiaLogin(prev => ({ ...prev, password: e.target.value, error: '' }))}
                  placeholder="Введите пароль..."
                  autoComplete="current-password"
                  disabled={goMafiaLogin.loading}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && goMafiaLogin.nickname && goMafiaLogin.password && !goMafiaLogin.loading) {
                      handleGoMafiaLogin();
                    }
                  }}
                />
              </div>

              {goMafiaLogin.error && (
                <div className="text-[0.78em] text-[#ff453a] text-center py-0.5 px-1">{goMafiaLogin.error}</div>
              )}

              <button
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-[0.85em] font-bold active:scale-[0.97] transition-transform disabled:opacity-40"
                disabled={!goMafiaLogin.nickname.trim() || !goMafiaLogin.password || goMafiaLogin.loading}
                onClick={handleGoMafiaLogin}
              >
                {goMafiaLogin.loading ? (
                  <><div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" /> Авторизация...</>
                ) : (
                  'Авторизоваться'
                )}
              </button>
            </div>

            <a
              className="block text-center mt-3 text-[0.7em] text-white/25 font-semibold no-underline hover:text-white/40"
              href="https://gomafia.pro/forgot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Забыли пароль?
            </a>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function NewGameModal({ modal, onSelect, onClose, onLoadSession }) {
  const { loading, error, group, games } = modal;
  const sessions = group?.sessions || [];
  const completedNums = new Set(sessions.filter(s => s.winnerTeam && s.gameFinished).map(s => s.gameSelected));
  const inProgressMap = {};
  for (const s of sessions) {
    if (s.gameSelected != null && !completedNums.has(s.gameSelected)) {
      inProgressMap[s.gameSelected] = s.sessionId;
    }
  }
  const defaultTable = group?.tableSelected;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-[rgba(18,18,26,0.95)] backdrop-blur-[24px] border border-white/[0.08] rounded-3xl p-5 relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <IconTrophy size={22} color="var(--accent-color, #a855f7)" />
            <div>
              <h2 className="text-[1.05em] font-extrabold text-white">Новая игра</h2>
              <div className="text-[0.7em] text-white/35 font-medium">
                {group?.tournamentName}
                {defaultTable ? ` · Стол ${defaultTable}` : ''}
              </div>
            </div>
          </div>
          <button className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center cursor-pointer active:scale-90 transition-transform border-none" onClick={onClose}>
            <IconX size={18} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
            <span>Загрузка турнира...</span>
          </div>
        )}

        {error && (
          <div className="text-[0.8em] text-[#ff453a] text-center py-2">{error}</div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-[0.7em] font-bold text-white/30 uppercase tracking-wider mb-1">Выберите игру:</div>
            <div className="flex flex-col gap-2">
              {games.map(g => {
                const isCompleted = completedNums.has(g.gameNum);
                const inProgressSid = inProgressMap[g.gameNum];
                const table = defaultTable
                  ? g.game?.find(t => t.tableNum === defaultTable) || g.game?.[0]
                  : g.game?.[0];
                const playerCount = table?.table?.length || 0;
                const tableNum = table?.tableNum || defaultTable || 1;

                return (
                  <button
                    key={g.gameNum}
                    className={`flex flex-col gap-1 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer text-left active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-default ${isCompleted ? 'opacity-40' : ''} ${inProgressSid ? 'border-accent/25 bg-accent/[0.06]' : ''}`}
                    disabled={isCompleted}
                    onClick={() => {
                      if (inProgressSid) {
                        onLoadSession(inProgressSid);
                        onClose();
                      } else {
                        onSelect(g.gameNum, tableNum);
                      }
                      triggerHaptic('success');
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[0.85em] font-bold text-white">Игра {g.gameNum}</span>
                      {isCompleted && <span className="text-[0.6em] font-bold py-0.5 px-2 rounded-md bg-white/[0.06] text-white/40">Уже сыграна</span>}
                      {inProgressSid && <span className="text-[0.6em] font-bold py-0.5 px-2 rounded-md bg-accent/15 text-accent">В процессе</span>}
                    </div>
                    <div className="text-[0.68em] text-white/30 font-medium flex items-center gap-2">
                      <span>Стол {tableNum}</span>
                      <span>{playerCount} игроков</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="text-center py-6 text-[0.8em] text-white/30">Игры не найдены в данных турнира</div>
        )}
      </div>
    </div>
  );
}

function NavItem({ active, primary, onClick, icon, label, badge }) {
  return (
    <button
      className={`relative flex flex-col items-center gap-0.5 py-2 px-1 min-w-[60px] transition-all duration-300 ease-spring ${active ? 'text-white' : 'text-white/40'} ${primary ? 'bg-gradient-to-br from-accent via-indigo-500 to-blue-500 text-white rounded-[22px] py-2.5 px-1 shadow-[0_4px_20px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-95' : ''}`}
      onClick={onClick}
    >
      <span className="text-2xl flex items-center justify-center relative">
        {icon}
        {badge && <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-[var(--accent-color)] shadow-[0_0_6px_var(--accent-color)]" />}
      </span>
      <span className="text-[0.55em] font-bold tracking-wider uppercase">{label}</span>
    </button>
  );
}

function NotificationCard({ icon, accentColor, title, description, time, isNew, link }) {
  const Wrapper = link ? 'a' : 'div';
  const wrapperProps = link ? { href: link, target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className="relative p-4 rounded-2xl glass-card flex gap-3 no-underline"
      style={isNew ? { borderLeft: `3px solid ${accentColor}` } : {}}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
        style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}20` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[0.82em] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</div>
          {isNew && (
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
          )}
        </div>
        <div className="text-[0.72em] font-medium mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</div>
        <div className="text-[0.62em] font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>{time}</div>
      </div>
    </Wrapper>
  );
}

function pluralGames(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'игр';
  if (last === 1) return 'игра';
  if (last >= 2 && last <= 4) return 'игры';
  return 'игр';
}

function PlayerDetailScoresTable({ players, selfNickname, isOverall }) {
  return (
    <div className="rounded-2xl overflow-hidden glass-card">
      <div className="grid gap-x-2 p-2.5 text-[0.6em] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', gridTemplateColumns: '32px 1fr auto auto' }}>
        <span className="text-center">#</span>
        <span>Игрок</span>
        <span className="text-center">{isOverall ? 'Игры' : 'Роль'}</span>
        <span className="text-center w-12">Балл</span>
      </div>
      {players.map((p, i) => {
        const isSelf = p.login === selfNickname;
        return (
          <div
            key={i}
            className="grid gap-x-2 px-2.5 py-2 items-center"
            style={{
              gridTemplateColumns: '32px 1fr auto auto',
              borderBottom: i < players.length - 1 ? '1px solid var(--border-color)' : 'none',
              background: isSelf ? 'var(--accent-surface)' : 'transparent',
            }}
          >
            <span className="text-center text-[0.8em] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {p.num || i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[0.82em] font-semibold truncate" style={{ color: isSelf ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                {p.login || '—'}
              </div>
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                {p.action && (
                  <span className="text-[0.6em] font-medium px-1 py-0.5 rounded" style={{ background: 'rgba(255,69,58,0.1)', color: '#ff453a' }}>
                    {p.action}
                  </span>
                )}
                {p.fouls > 0 && (
                  <span className="text-[0.6em] font-medium px-1 py-0.5 rounded" style={{ background: 'rgba(255,165,0,0.1)', color: '#ffa500' }}>
                    {p.fouls} фол{p.fouls > 1 ? 'а' : ''}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[0.72em] font-semibold px-1.5 py-0.5 rounded-md text-center" style={{
              background: isOverall ? 'var(--accent-surface)' : (p.isBlack ? 'rgba(255,69,58,0.1)' : 'rgba(48,209,88,0.08)'),
              color: isOverall ? 'var(--accent-color)' : (p.isBlack ? '#ff453a' : '#30d158'),
            }}>
              {p.role || '—'}
            </span>
            <span className="text-[0.9em] font-black tabular-nums text-center w-12" style={{ color: 'var(--text-primary)' }}>
              {p.score !== null && p.score !== undefined ? p.score : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerDetailSummary({ game, selfNickname }) {
  if (!game) return null;
  const { votingHistory = [], nightCheckHistory = [], killedOnNight = {}, nightMisses = {}, doctorHealHistory = [], bestMove = [], bestMoveAccepted, firstKilledPlayer, players = [], dayNumber = 0, nightNumber = 0 } = game;
  const maxRound = Math.max(dayNumber, nightNumber, Object.keys(killedOnNight).length);

  const playerByRk = {};
  const playerByNum = {};
  players.forEach(p => { if (p.login) playerByRk[p.login] = p; if (p.num) playerByNum[p.num] = p; });

  const getLogin = (rk) => {
    const p = players.find(pl => pl.login === rk || pl.num === rk);
    return p ? p.login : rk;
  };

  const rounds = [];
  for (let r = 1; r <= maxRound; r++) {
    const nightEvents = [];
    const killedKey = String(r);
    const killed = killedOnNight[killedKey] || killedOnNight[r];
    if (killed) {
      const kp = players.find(p => p.num === killed);
      nightEvents.push({ type: 'kill', icon: '💀', text: `Убит: ${kp ? kp.login : killed} (${killed})` });
    }
    if (nightMisses[killedKey] || nightMisses[r]) {
      nightEvents.push({ type: 'miss', icon: '🎯', text: 'Промах мафии' });
    }
    const heals = doctorHealHistory.filter(h => h.night === r);
    heals.forEach(h => nightEvents.push({ type: 'heal', icon: '💊', text: `Доктор лечит: ${h.targetLogin || h.target}` }));

    const checks = nightCheckHistory.filter(c => c.night === r);
    checks.forEach(c => {
      const checkerLabel = c.checkerRole === 'don' ? 'Дон' : c.checkerRole === 'sheriff' ? 'Шериф' : c.checkerRole;
      nightEvents.push({ type: 'check', icon: c.found ? '✅' : '❌', text: `${checkerLabel} → ${c.targetLogin || c.target}: ${c.result || (c.found ? 'Найден' : 'Не найден')}` });
    });

    const dayEvents = [];
    const dayVotes = votingHistory.filter(v => v.dayNumber === r);
    dayVotes.forEach(v => {
      const stages = v.stages || [];
      stages.forEach(st => {
        const results = st.results || [];
        results.forEach(res => {
          const numVoted = res.candidate || res.num;
          const vp = players.find(p => p.num === numVoted);
          const voterNums = res.voters || [];
          dayEvents.push({
            type: 'vote',
            icon: '🗳️',
            text: `${vp ? vp.login : numVoted} (${numVoted}): ${voterNums.length} голос${voterNums.length !== 1 ? 'ов' : ''}`,
            voters: voterNums,
          });
        });
        if (st.type === 'tie' || st.type === 'lift') {
          dayEvents.push({ type: 'stage', icon: '⚖️', text: st.type === 'tie' ? 'Перестрелка' : 'Подъём' });
        }
      });
      if (v.finalWinners && v.finalWinners.length > 0) {
        const names = v.finalWinners.map(num => { const p = players.find(pl => pl.num === num); return p ? p.login : num; });
        dayEvents.push({ type: 'result', icon: '🚪', text: `Выбывают: ${names.join(', ')}` });
      }
    });

    if (nightEvents.length > 0 || dayEvents.length > 0) {
      rounds.push({ round: r, nightEvents, dayEvents });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Best move */}
      {bestMove.length > 0 && (
        <div className="p-3 rounded-xl glass-card">
          <div className="text-[0.65em] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Лучший ход</div>
          <div className="flex items-center gap-2">
            {bestMove.map((num, i) => {
              const p = players.find(pl => pl.num === num);
              return (
                <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.75em] font-black" style={{
                  background: p?.isBlack ? 'rgba(255,69,58,0.15)' : 'rgba(48,209,88,0.1)',
                  color: p?.isBlack ? '#ff453a' : '#30d158',
                  border: `1px solid ${p?.isBlack ? 'rgba(255,69,58,0.25)' : 'rgba(48,209,88,0.2)'}`,
                }}>
                  {num}
                </div>
              );
            })}
            <span className="ml-2 text-[0.72em] font-semibold" style={{ color: bestMoveAccepted ? '#30d158' : '#ff453a' }}>
              {bestMoveAccepted ? 'Принят' : 'Не принят'}
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      {rounds.map(({ round, nightEvents, dayEvents }) => (
        <div key={round} className="flex flex-col gap-1.5">
          <div className="text-[0.65em] font-black uppercase tracking-wider px-1" style={{ color: 'var(--accent-color)' }}>
            Раунд {round}
          </div>

          {nightEvents.length > 0 && (
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div className="text-[0.58em] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(129,140,248,0.8)' }}>Ночь {round}</div>
              {nightEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="text-[0.75em] shrink-0">{ev.icon}</span>
                  <span className="text-[0.72em] font-medium" style={{ color: 'var(--text-secondary)' }}>{ev.text}</span>
                </div>
              ))}
            </div>
          )}

          {dayEvents.length > 0 && (
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.1)' }}>
              <div className="text-[0.58em] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(251,191,36,0.7)' }}>День {round}</div>
              {dayEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="text-[0.75em] shrink-0">{ev.icon}</span>
                  <span className="text-[0.72em] font-medium" style={{ color: 'var(--text-secondary)' }}>{ev.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {rounds.length === 0 && (
        <div className="text-center py-8 text-[0.8em] font-medium" style={{ color: 'var(--text-muted)' }}>
          Нет данных о ходе игры
        </div>
      )}
    </div>
  );
}

