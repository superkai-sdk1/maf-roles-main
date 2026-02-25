import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { sessionManager } from '../services/sessionManager';
import { goMafiaApi, profileApi, sessionsApi } from '../services/api';
import { authService } from '../services/auth';
import { COLOR_SCHEMES, applyTheme } from '../constants/themes';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
import {
  IconPlayCircle, IconHistory, IconPlus, IconPalette, IconUser,
  IconTrophy, IconDice, IconChevronDown, IconTrash, IconStats, IconMafBoard,
  IconCheck, IconArrowRight, IconLock, IconArchive, IconX, IconList,
  IconGoMafia, IconSettings, IconCamera, IconLink, IconEdit,
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

const getResultDotClass = (s) => {
  if (s.gameFinished && s.winnerTeam === 'civilians') return 'dot-red';
  if (s.gameFinished && s.winnerTeam === 'mafia') return 'dot-dark';
  if (s.gameFinished && s.winnerTeam === 'draw') return 'dot-white';
  if (s.winnerTeam && !s.gameFinished) return 'dot-orange';
  return 'dot-green';
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
    <div className={`series-card ${expanded ? 'series-card--expanded' : ''} ${group.archived ? 'series-card--archived' : ''}`}>
      <div className="series-card-header" onClick={handleToggle}>
        <div className="series-card-icon">
          {group.archived
            ? <IconLock size={20} color="rgba(255,255,255,0.4)" />
            : group.gameMode === 'gomafia'
              ? <IconGoMafia size={28} />
              : group.isFunky
                ? <IconDice size={20} color="var(--accent-color, #a855f7)" />
                : <IconTrophy size={20} color="var(--accent-color, #a855f7)" />
          }
        </div>
        <div className="series-card-info">
          <div className="series-card-name">{group.tournamentName}</div>
          <div className="series-card-meta">
            {modeLabel && <span className="series-mode-badge">{modeLabel}</span>}
            {!group.isFunky && group.tableSelected && <span className="series-meta-item">Стол {group.tableSelected}</span>}
            {!group.isFunky && (
              <span className="series-meta-item">
                Игра {group.lastStartedGameNumber || group.sessions.length}
              </span>
            )}
          </div>
          {group.isFunky ? (
            <div className="series-progress-text">
              {completedGames} {completedGames === 1 ? 'игра' : completedGames < 5 ? 'игры' : 'игр'} сыграно
            </div>
          ) : (
            <>
              <div className="series-progress-bar">
                <div className="series-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="series-progress-text">
                {completedGames} из {totalGames} завершено
              </div>
            </>
          )}
        </div>
        <span className="series-card-chevron" style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
        }}>
          <IconChevronDown size={18} color="rgba(255,255,255,0.3)" />
        </span>
      </div>

      {expanded && (
        <div className="series-card-body">
              <div className="series-games-list">
                {group.sessions.map((s, idx) => (
                  <div
                    key={s.sessionId}
                    className={`series-game-row ${s.seriesArchived ? 'series-game-row--archived' : ''}`}
                    onClick={() => handleGameRowClick(s)}
                  >
                    <div className="series-game-left">
                      <span className="series-game-number">
                        Игра {s.gameSelected || idx + 1}
                      </span>
                      {s.tableSelected && (
                        <span className="series-game-table">Стол {s.tableSelected}</span>
                      )}
                    </div>
                    <div className="series-game-right">
                      <span className={`result-dot ${getResultDotClass(s)}`} />
                      <span className="series-game-result">{getResultText(s)}</span>
                      <span className="series-game-date">{formatTime(s.timestamp || s.updatedAt)}</span>
                      {!s.seriesArchived && !isGameComplete(s) && (
                        <button
                          className="series-game-delete"
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

              <div className="series-actions series-actions--wrap">
                {!group.archived && onNewGame && (
                  <button
                    className="series-action-btn series-action-newgame"
                    onClick={(e) => { e.stopPropagation(); onNewGame(group); triggerHaptic('medium'); }}
                  >
                    <IconPlus size={15} />
                    <span>Новая игра</span>
                  </button>
                )}
                {hasFinishedGames && (
                  <button
                    className="series-action-btn series-action-table"
                    onClick={(e) => { e.stopPropagation(); onShowTable?.(group); triggerHaptic('light'); }}
                  >
                    <IconList size={15} />
                    <span>{group.isFunky ? 'Итоги' : 'Таблица'}</span>
                  </button>
                )}
                {!group.archived && !group.allGamesFinished && (
                  confirmAction === 'delete' ? (
                    <div className="series-archive-confirm">
                      <span className="series-archive-confirm-text">Удалить все игры серии?</span>
                      <button className="series-archive-confirm-yes" onClick={handleDeleteSeriesClick}>Да</button>
                      <button className="series-archive-confirm-no" onClick={handleCancelConfirm}>Нет</button>
                    </div>
                  ) : (
                    <button
                      className="series-action-btn series-action-archive"
                      onClick={handleDeleteSeriesClick}
                    >
                      <IconTrash size={15} />
                      <span>Удалить серию</span>
                    </button>
                  )
                )}
                {!group.archived && group.allGamesFinished && (
                  confirmAction === 'save' ? (
                    <div className="series-archive-confirm">
                      <span className="series-archive-confirm-text">Сохранить серию в историю?</span>
                      <button className="series-archive-confirm-yes" onClick={handleSaveSeriesClick}>Да</button>
                      <button className="series-archive-confirm-no" onClick={handleCancelConfirm}>Нет</button>
                    </div>
                  ) : (
                    <button
                      className="series-action-btn series-action-newgame"
                      onClick={handleSaveSeriesClick}
                    >
                      <IconCheck size={15} />
                      <span>Сохранить серию</span>
                    </button>
                  )
                )}
                {group.archived && (
                  <div className="series-archived-badge">
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
      <div className={`session-card session-card--multi ${expanded ? 'session-card--expanded' : ''}`}>
        <div className="session-card-top" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <div className="session-card-name">
            {getSessionName(session)}
            <span className="session-card-games-badge">{totalGames} {totalGames === 1 ? 'игра' : totalGames < 5 ? 'игры' : 'игр'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="session-card-date">
              {formatTime(session.timestamp || session.updatedAt)}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="transition-transform duration-200 shrink-0" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="session-card-bottom" onClick={() => { setExpanded(!expanded); triggerHaptic('selection'); }}>
          <span className="session-card-status">
            <span className={`result-dot ${getResultDotClass(session)}`} />
            {getResultText(session)}
          </span>
          <div className="flex items-center gap-2">
            {modeLabel && <span className="session-card-mode">{modeLabel}</span>}
            {(civWins > 0 || mafWins > 0) && (
              <span className="session-card-score-mini">
                <span style={{ color: '#ff5252' }}>{civWins}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>:</span>
                <span style={{ color: '#4fc3f7' }}>{mafWins}</span>
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className="session-card-games-list animate-fadeIn">
            {allGamesForDisplay.map((g, idx) => {
              const winLabel = g.winnerTeam === 'civilians' ? 'Мирные' : g.winnerTeam === 'mafia' ? 'Мафия' : g.winnerTeam === 'draw' ? 'Ничья' : 'В процессе';
              const winColor = g.winnerTeam === 'civilians' ? '#ff5252' : g.winnerTeam === 'mafia' ? '#4fc3f7' : g.winnerTeam === 'draw' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
              const rounds = Math.max(g.nightNumber || 0, g.dayNumber || 0);
              return (
                <div key={idx} className="session-card-game-row">
                  <div className="session-card-game-num">{g.gameNumber}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold">Игра {g.gameNumber}</span>
                    {rounds > 0 && <span className="text-[0.6rem] text-white/20 ml-1.5">{rounds}р</span>}
                  </div>
                  <span className="text-xs font-bold" style={{ color: winColor }}>{winLabel}</span>
                </div>
              );
            })}
            <button
              className="session-card-open-btn"
              onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}
            >
              Открыть сессию
            </button>
          </div>
        )}

        <button
          className="session-card-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(session.sessionId); triggerHaptic('warning'); }}
        >
          <IconTrash size={14} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
    );
  }

  return (
    <div className="session-card" onClick={() => { onLoad(session.sessionId); triggerHaptic('light'); }}>
      <div className="session-card-top">
        <div className="session-card-name">
          {getSessionName(session)}
          {session.gameSelected && (
            <span className="session-card-nums">И{session.gameSelected}/С{session.tableSelected}</span>
          )}
        </div>
        <span className="session-card-date">
          {formatTime(session.timestamp || session.updatedAt)}
        </span>
      </div>
      <div className="session-card-bottom">
        <span className="session-card-status">
          <span className={`result-dot ${getResultDotClass(session)}`} />
          {getResultText(session)}
        </span>
        {modeLabel && <span className="session-card-mode">{modeLabel}</span>}
      </div>
      <button
        className="session-card-delete"
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
  } = useGame();

  const [activeTab, setActiveTab] = useState('active');
  const [expandedSeries, setExpandedSeries] = useState({});
  const [menuScreen, setMenuScreen] = useState('game');

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
      return {
        tournamentId: s.tournamentId,
        tournamentName: s.tournamentName || 'Фанки',
        gameMode: 'funky',
        isFunky: true,
        archived: false,
        sessions: pseudoSessions,
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
  const activeGroups = useMemo(() => [...groups.filter(g => !g.archived), ...funkyGroups], [groups, funkyGroups]);
  const historyGroups = useMemo(() => groups.filter(g => g.archived), [groups]);

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
    if (menuScreen === 'profile' || menuScreen === 'themes') { setMenuScreen('game'); return; }
  }, [tableGroup, menuScreen]);

  const canSwipeBack = tableGroup || menuScreen !== 'game';
  useSwipeBack(handleSwipeBack, canSwipeBack);

  return (
    <>
      {/* === TOURNAMENT TABLE FULLSCREEN === */}
      {tableGroup && (
        <div className="fullscreen-page animate-fadeIn" style={{ zIndex: 200 }}>
          <div className="fullscreen-page-container">
            <div className="fullscreen-page-header" style={{ justifyContent: 'center' }}>
              <span className="fullscreen-page-title">Таблица</span>
            </div>

            <div className="text-center mb-1">
              <div className="text-xs font-semibold text-white/50">{tableGroup.tournamentName}</div>
            </div>

            {/* Tab switcher */}
            <div className="relative flex w-full rounded-2xl p-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl mb-3">
              <div className="absolute top-1 bottom-1 rounded-[14px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
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
              <div className="glass-card" style={{ padding: 32, textAlign: 'center', position: 'relative', zIndex: 1 }}>
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
                          className={`score-card transition-all duration-200 cursor-pointer ${topClass} ${topBg} ${expanded ? 'ring-1 ring-purple-500/20' : ''}`}
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
                          className="score-card cursor-pointer transition-all duration-200"
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

      <div className="main-menu-screen">
        <div className="main-menu-container">
          {/* Header */}
          <div className="main-menu-header" style={{ animation: 'floatUp 0.5s var(--ease-out) both' }}>
            <div className="main-menu-logo">
              <IconMafBoard size={32} color="var(--accent-color, #a855f7)" />
            </div>
            <h1 className="main-menu-title">MafBoard</h1>
            <p className="main-menu-subtitle">Панель управления мафией</p>
          </div>

          {/* =================== GAME SCREEN =================== */}
          {menuScreen === 'game' && (
            <>
              <div className="main-menu-section-label">
                {activeTab === 'active' ? 'Активные игры' : 'История игр'}
                <span className="main-menu-count-badge">{totalCount}</span>
              </div>

              <div className="main-menu-list">
                {displayGroups.length === 0 && displayStandalone.length === 0 ? (
                  <div className="main-menu-empty">
                    <div className="main-menu-empty-icon">
                      <IconDice size={48} color="rgba(255,255,255,0.15)" />
                    </div>
                    <div className="main-menu-empty-text">
                      Нет {activeTab === 'active' ? 'активных' : 'завершенных'} игр
                    </div>
                    {activeTab === 'active' && (
                      <div className="main-menu-empty-hint">
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
            return (
              <div className="animate-fadeIn" style={{ width: '100%', maxWidth: 400, paddingBottom: 100 }}>
                <div className="profile-bento">

                  {/* Profile card */}
                  <div className="profile-card-hero">
                    <button
                      className="profile-settings-btn"
                      onClick={() => {
                        const name = userDisplayName || (tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : '');
                        setProfileSettingsName(name);
                        setMenuScreen('profileSettings');
                        triggerHaptic('light');
                      }}
                    >
                      <IconSettings size={16} color="rgba(255,255,255,0.4)" />
                    </button>

                    <div className="profile-avatar-wrap">
                      <div className="profile-avatar-ring" />
                      {avatarSrc ? (
                        <div className="profile-avatar-img" style={{ backgroundImage: `url(${avatarSrc})` }} />
                      ) : (
                        <div className="profile-avatar-initials">{initials}</div>
                      )}
                    </div>

                    <div className="profile-card-hero-info">
                      <div className="profile-name">{displayName}</div>
                      {tgUser?.username && <div className="profile-username">@{tgUser.username}</div>}
                      {tgUser?.id && <div className="profile-id">UID {tgUser.id}</div>}
                      {goMafiaProfile && (
                        <div className="profile-gomafia-badge">
                          <IconGoMafia size={14} />
                          <span>{goMafiaProfile.nickname}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status placeholder */}
                  <div className="profile-status-card">
                    <div className="profile-status-icon">
                      <IconHistory size={18} color="rgba(255,255,255,0.2)" />
                    </div>
                    <div>
                      <div className="profile-status-label">Статус</div>
                      <div className="profile-status-value">Скоро</div>
                    </div>
                  </div>

                  {/* Total games — tall left card */}
                  <div className="profile-total-card">
                    <div className="profile-total-card-icon">
                      <IconStats size={18} color="rgba(255,255,255,0.4)" />
                    </div>
                    <div className="profile-total-card-bottom">
                      <div className="profile-total-card-value">{profileStats.totalGames}</div>
                      <div className="profile-total-card-label">{pluralGames(profileStats.totalGames)}<br/>проведено</div>
                    </div>
                  </div>

                  {/* Tournaments */}
                  <div className="profile-mini-card">
                    <div className="profile-mini-card-icon" style={{ background: 'linear-gradient(135deg, rgba(137,119,254,0.15), rgba(10,232,240,0.08))', borderColor: 'rgba(137,119,254,0.2)' }}>
                      <IconGoMafia size={18} />
                    </div>
                    <div className="profile-mini-card-bottom">
                      <div className="profile-mini-card-value">{profileStats.gomafiaTournamentsCount}</div>
                      <div className="profile-mini-card-label">Турниры</div>
                    </div>
                  </div>

                  {/* Minicaps */}
                  <div className="profile-mini-card">
                    <div className="profile-mini-card-icon" style={{ background: 'linear-gradient(135deg, rgba(255,213,0,0.12), rgba(255,170,0,0.06))', borderColor: 'rgba(255,213,0,0.2)' }}>
                      <IconTrophy size={17} color="#ffd700" />
                    </div>
                    <div className="profile-mini-card-bottom">
                      <div className="profile-mini-card-value">{profileStats.minicapsCount}</div>
                      <div className="profile-mini-card-label">Миникапы</div>
                    </div>
                  </div>

                  {/* Funky — full width */}
                  <div className="profile-wide-card">
                    <div className="profile-wide-card-left">
                      <div className="profile-mini-card-icon" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(139,92,246,0.06))', borderColor: 'rgba(168,85,247,0.2)' }}>
                        <IconDice size={17} color="var(--accent-color, #a855f7)" />
                      </div>
                      <div className="profile-mini-card-label">Фанки</div>
                    </div>
                    <div className="profile-mini-card-value">{profileStats.funkyGamesCount}</div>
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

            return (
              <div className="animate-fadeIn" style={{ width: '100%', maxWidth: 400, paddingBottom: 100 }}>

                {/* Header */}
                <div className="settings-header">
                  <div className="settings-header-left">
                    <button
                      className="profile-settings-back"
                      onClick={() => { setMenuScreen('profile'); triggerHaptic('light'); }}
                    >
                      <IconArrowRight size={16} color="rgba(255,255,255,0.7)" style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h2 className="settings-title">Настройки</h2>
                  </div>
                  <div className="settings-version">v2.1</div>
                </div>

                <div className="settings-sections">

                  {/* Profile block (avatar + name) */}
                  <div className="settings-card settings-profile-card">
                    <div className="settings-profile-avatar-wrap">
                      <div className="settings-profile-avatar-ring">
                        <div className="settings-profile-avatar-inner">
                          {avatarSrc ? (
                            <div className="settings-profile-avatar-img" style={{ backgroundImage: `url(${avatarSrc})` }} />
                          ) : (
                            <div className="settings-profile-avatar-initials">{initials}</div>
                          )}
                        </div>
                      </div>
                      <button
                        className="settings-profile-camera"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <IconCamera size={13} color="#fff" />
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: 'none' }}
                      />
                    </div>

                    <div className="settings-profile-fields">
                      <div>
                        <div className="settings-field-label">Никнейм</div>
                        <input
                          className="settings-inline-input"
                          type="text"
                          value={profileSettingsName}
                          onChange={e => setProfileSettingsName(e.target.value)}
                          placeholder="Введите имя..."
                          maxLength={40}
                        />
                      </div>
                      {userAvatarUrl && (
                        <button className="settings-remove-photo" onClick={handleRemoveAvatar}>
                          <IconTrash size={11} /> Удалить фото
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GoMafia integration */}
                  {goMafiaProfile ? (
                    <div className="settings-card">
                      <div className="settings-integration-header">
                        <div className="settings-integration-icon settings-integration-icon--green">
                          <IconGoMafia size={16} />
                        </div>
                        <div className="settings-integration-info">
                          <div className="settings-integration-name">GoMafia</div>
                          <div className="settings-integration-status">Подключено</div>
                        </div>
                        <div className="settings-integration-actions">
                          <button
                            className="settings-icon-btn"
                            onClick={async () => {
                              triggerHaptic('light');
                              try {
                                const res = await goMafiaApi.lookupGoMafiaPlayer(goMafiaProfile.nickname);
                                if (res.success && res.profile) {
                                  const updated = {
                                    ...goMafiaProfile,
                                    nickname: res.profile.nickname || goMafiaProfile.nickname,
                                    avatar: res.profile.avatar || goMafiaProfile.avatar,
                                    id: res.profile.id || goMafiaProfile.id,
                                    title: res.profile.title || goMafiaProfile.title,
                                  };
                                  goMafiaApi.saveGoMafiaProfile(updated);
                                  setGoMafiaProfile(updated);
                                  if (updated.nickname) {
                                    setUserDisplayName(updated.nickname);
                                    try { localStorage.setItem('maf_user_display_name', updated.nickname); } catch {}
                                  }
                                  if (updated.avatar) {
                                    setUserAvatarUrl(updated.avatar);
                                    try { localStorage.setItem('maf_user_avatar', updated.avatar); } catch {}
                                  }
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
                            className="settings-icon-btn settings-icon-btn--danger"
                            onClick={() => {
                              goMafiaApi.removeGoMafiaProfile();
                              setGoMafiaProfile(null);
                              const token = authService.getStoredToken();
                              if (token) profileApi.clearGoMafia(token);
                              triggerHaptic('medium');
                            }}
                          >
                            <IconX size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="settings-integration-profile">
                        {goMafiaProfile.avatar ? (
                          <img src={goMafiaProfile.avatar} alt="" className="settings-integration-profile-avatar" />
                        ) : (
                          <div className="settings-integration-profile-avatar settings-integration-profile-avatar--initials">
                            {(goMafiaProfile.nickname || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="settings-integration-profile-name">{goMafiaProfile.nickname}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="settings-card settings-gomafia-connect"
                      onClick={() => {
                        setGoMafiaModal(true);
                        setGoMafiaLogin({ nickname: '', password: '', loading: false, error: '' });
                        triggerHaptic('light');
                      }}
                    >
                      <div className="settings-integration-icon">
                        <IconGoMafia size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82em', fontWeight: 700, color: '#fff' }}>Подключить GoMafia</div>
                        <div style={{ fontSize: '0.68em', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Привяжите аккаунт gomafia.pro</div>
                      </div>
                      <IconLink size={15} color="rgba(255,255,255,0.2)" />
                    </button>
                  )}

                  {/* Auth grid */}
                  {!linkedAccounts ? (
                    <div className="settings-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
                      <div className="gomafia-modal-spinner" />
                      <span style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.35)' }}>Загрузка...</span>
                    </div>
                  ) : (
                    <>
                      <div className="settings-auth-grid">
                        {/* Telegram */}
                        <div className="settings-auth-tile">
                          <div className="settings-auth-tile-icon" style={{ background: 'rgba(56,163,224,0.1)', color: '#38a3e0' }}>
                            <span style={{ fontSize: '1em' }}>✈️</span>
                          </div>
                          <div className="settings-auth-tile-label">Telegram</div>
                          <div className="settings-auth-tile-sub">
                            {linkedAccounts.telegram?.linked
                              ? (linkedAccounts.telegram.username ? `@${linkedAccounts.telegram.username}` : 'Привязан')
                              : 'Не привязан'
                            }
                          </div>
                          {linkedAccounts.telegram?.linked && (
                            <div className="settings-auth-dot settings-auth-dot--green" />
                          )}
                          {!linkedAccounts.telegram?.linked && !linkTelegramMode && (
                            <button
                              className="settings-auth-tile-action"
                              onClick={async () => {
                                triggerHaptic('light');
                                const token = authService.getStoredToken();
                                if (!token) return;
                                const res = await fetch('/login/code-generate.php', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ link_token: token }),
                                }).then(r => r.json());
                                if (!res.code) return;
                                setLinkTelegramMode({ code: res.code, expiresIn: res.expires_in, botLink: res.bot_link, botUsername: res.bot_username });
                                stopLinkPolling();
                                let remaining = res.expires_in;
                                linkTimerRef.current = setInterval(() => {
                                  remaining--;
                                  setLinkTelegramMode(prev => prev ? { ...prev, expiresIn: remaining } : null);
                                  if (remaining <= 0) { stopLinkPolling(); setLinkTelegramMode(null); }
                                }, 1000);
                                linkPollRef.current = setInterval(async () => {
                                  const check = await authService.checkCode(res.code);
                                  if (check.confirmed) {
                                    stopLinkPolling();
                                    setLinkTelegramMode(null);
                                    authService.storeAuth(check.token, check.user);
                                    loadLinkedAccounts();
                                    triggerHaptic('success');
                                  } else if (check.expired) {
                                    stopLinkPolling();
                                    setLinkTelegramMode(null);
                                  }
                                }, 2500);
                              }}
                            >
                              Привязать
                            </button>
                          )}
                        </div>

                        {/* PassKey */}
                        <div className="settings-auth-tile">
                          <div className="settings-auth-tile-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                            <span style={{ fontSize: '1em' }}>🔐</span>
                          </div>
                          <div className="settings-auth-tile-label">PassKey</div>
                          <div className="settings-auth-tile-sub">
                            {linkedAccounts.passkeys?.length > 0
                              ? `${linkedAccounts.passkeys.length} ключ${linkedAccounts.passkeys.length > 1 ? (linkedAccounts.passkeys.length < 5 ? 'а' : 'ей') : ''}`
                              : 'Не настроен'
                            }
                          </div>
                          {linkedAccounts.passkeys?.length > 0 && (
                            <div className="settings-auth-dot settings-auth-dot--purple" />
                          )}
                          <button
                            className="settings-auth-tile-action"
                            disabled={passkeyRegistering}
                            onClick={async () => {
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
                            }}
                          >
                            {passkeyRegistering ? '...' : 'Добавить'}
                          </button>
                        </div>
                      </div>

                      {passkeyError && (
                        <div style={{ fontSize: '0.75em', color: '#ff453a', padding: '4px 4px 0' }}>{passkeyError}</div>
                      )}

                      {/* Telegram link code display */}
                      {linkTelegramMode && (
                        <div className="settings-card" style={{ textAlign: 'center', padding: '20px' }}>
                          <div style={{ fontSize: '1.8em', fontWeight: 900, letterSpacing: 8, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                            {linkTelegramMode.code}
                          </div>
                          <div style={{ fontSize: '0.72em', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            Отправьте код боту • {Math.floor(linkTelegramMode.expiresIn / 60)}:{String(linkTelegramMode.expiresIn % 60).padStart(2, '0')}
                          </div>
                          {linkTelegramMode.botLink && (
                            <a
                              href={linkTelegramMode.botLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="auth-method-link-btn"
                              style={{ marginTop: 8, display: 'inline-flex', textDecoration: 'none', padding: '8px 16px' }}
                            >
                              Открыть @{linkTelegramMode.botUsername || 'бота'}
                            </a>
                          )}
                          <button
                            className="auth-method-link-btn"
                            style={{ marginTop: 4, color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.08)' }}
                            onClick={() => { stopLinkPolling(); setLinkTelegramMode(null); }}
                          >
                            Отмена
                          </button>
                        </div>
                      )}

                      {/* GoMafia auth (separate from integration) */}
                      {linkedAccounts.gomafia && (
                        <div className="settings-card" style={{ padding: '12px 16px' }}>
                          <div className="auth-method-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                            <div className="auth-method-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
                              <span style={{ fontSize: '1.1em' }}>🎭</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="auth-method-name">GoMafia</div>
                              {linkedAccounts.gomafia.linked ? (
                                <div className="auth-method-detail">{linkedAccounts.gomafia.nickname}</div>
                              ) : goMafiaProfile ? (
                                <div className="auth-method-detail" style={{ color: 'rgba(255,200,50,0.6)' }}>Интеграция есть, авторизация не привязана</div>
                              ) : (
                                <div className="auth-method-detail" style={{ color: 'rgba(255,255,255,0.2)' }}>Не привязан</div>
                              )}
                            </div>
                            {linkedAccounts.gomafia.linked ? (
                              <span className="auth-method-badge auth-method-badge--active">
                                <IconCheck size={10} /> Привязан
                              </span>
                            ) : (
                              <button
                                className="auth-method-link-btn"
                                onClick={() => {
                                  setGoMafiaModal(true);
                                  setGoMafiaLogin({ nickname: goMafiaProfile?.nickname || '', password: '', loading: false, error: '' });
                                  triggerHaptic('light');
                                }}
                              >
                                Привязать
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PassKey list */}
                      {linkedAccounts.passkeys?.length > 0 && (
                        <div className="settings-card" style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {linkedAccounts.passkeys.map(pk => (
                              <div key={pk.id} className="settings-session-row">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="settings-session-name">{pk.device_name || 'PassKey'}</div>
                                  <div className="settings-session-meta">
                                    {pk.last_used_at ? `Использован ${formatSessionDate(pk.last_used_at)}` : `Создан ${formatSessionDate(pk.created_at)}`}
                                  </div>
                                </div>
                                <button
                                  className="settings-session-exit"
                                  onClick={async () => {
                                    triggerHaptic('warning');
                                    const token = authService.getStoredToken();
                                    await authService.unlinkMethod(token, 'passkey', pk.id);
                                    loadLinkedAccounts();
                                    triggerHaptic('success');
                                  }}
                                >
                                  <IconX size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Sessions */}
                  <div className="settings-card">
                    <div className="settings-section-header">
                      <IconLock size={13} color="rgba(255,255,255,0.2)" />
                      <span>Сессии</span>
                    </div>

                    {sessionsLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: 8 }}>
                        <div className="gomafia-modal-spinner" />
                        <span style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.35)' }}>Загрузка...</span>
                      </div>
                    ) : deviceSessions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.8em', color: 'rgba(255,255,255,0.25)' }}>
                        Нет активных сеансов
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {deviceSessions.map(session => (
                          <div key={session.id} className={`settings-session-row ${session.is_current ? 'settings-session-row--current' : ''}`}>
                            <div className={`settings-session-icon ${session.is_current ? 'settings-session-icon--current' : ''}`}>
                              {session.device_name?.includes('iPhone') || session.device_name?.includes('iPad') || session.device_name?.includes('Android') ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="settings-session-name">{session.device_name || 'Неизвестное устройство'}</div>
                              <div className="settings-session-meta">
                                {session.is_current ? 'Текущее' : formatSessionDate(session.last_active)}
                              </div>
                            </div>
                            {!session.is_current && (
                              <button
                                className="settings-session-exit"
                                onClick={() => handleTerminateSession(session.id)}
                                disabled={terminatingId === session.id}
                                style={{ opacity: terminatingId === session.id ? 0.5 : 1 }}
                              >
                                {terminatingId === session.id ? '...' : 'Exit'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!window.Telegram?.WebApp?.initData && (
                      <button
                        className="settings-logout-all"
                        onClick={() => {
                          authService.logout();
                          triggerHaptic('medium');
                          window.location.reload();
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Выйти отовсюду
                      </button>
                    )}
                  </div>

                </div>

                {/* Save button */}
                <button className="profile-save-btn" onClick={handleSaveName}>
                  <IconCheck size={16} /> Сохранить
                </button>
              </div>
            );
          })()}

          {/* =================== THEMES SCREEN =================== */}
          {menuScreen === 'themes' && (
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: 400, paddingBottom: 100 }}>
              <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
                <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconPalette size={16} color="var(--accent-color, #a855f7)" /> Тема оформления
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
                        <div style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Текущая тема</div>
                      </div>
                    </div>
                  );
                })()}

                <div className="theme-selector-grid">
                  {COLOR_SCHEMES.map(c => {
                    const isActive = selectedColorScheme === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => selectColor(c.key)}
                        className={`theme-selector-item ${isActive ? 'theme-selector-item--active' : ''}`}
                        style={{
                          '--ts-color': c.accent,
                          '--ts-g1': c.gradient[0],
                          '--ts-g2': c.gradient[1],
                        }}
                      >
                        <div className="theme-selector-swatch" />
                        <span className="theme-selector-name">{c.name}</span>
                        {isActive && (
                          <span className="theme-selector-check">
                            <IconCheck size={10} color="#fff" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {createPortal(
        <nav className="main-nav-bar">
          <NavItem active={!tableGroup && menuScreen === 'game' && activeTab === 'active'}
            onClick={() => { setTableGroup(null); setMenuScreen('game'); setActiveTab('active'); triggerHaptic('selection'); }}
            icon={<IconPlayCircle size={20} />} label="Активные" />
          <NavItem active={!tableGroup && menuScreen === 'game' && activeTab === 'history'}
            onClick={() => { setTableGroup(null); setMenuScreen('game'); setActiveTab('history'); triggerHaptic('selection'); }}
            icon={<IconHistory size={20} />} label="История" />
          <NavItem primary
            onClick={() => { setTableGroup(null); startNewGame(); triggerHaptic('medium'); }}
            icon={<IconPlus size={22} />} label="Новая" />
          <NavItem active={!tableGroup && menuScreen === 'themes'}
            onClick={() => { setTableGroup(null); setMenuScreen('themes'); triggerHaptic('light'); }}
            icon={<IconPalette size={20} />} label="Темы" />
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
        />,
        document.body
      )}

      {goMafiaModal && createPortal(
        <div className="gomafia-modal-overlay" onClick={() => !goMafiaLogin.loading && setGoMafiaModal(false)}>
          <div className="gomafia-modal animate-fadeIn" onClick={e => e.stopPropagation()}>
            <button
              className="gomafia-modal-close"
              onClick={() => !goMafiaLogin.loading && setGoMafiaModal(false)}
            >
              <IconX size={18} color="rgba(255,255,255,0.5)" />
            </button>

            <div className="gomafia-modal-header">
              <div className="gomafia-modal-logo">
                <IconGoMafia size={32} />
              </div>
              <h3 className="gomafia-modal-title">Войти в GoMafia</h3>
              <p className="gomafia-modal-subtitle">Введите данные аккаунта gomafia.pro</p>
            </div>

            <div className="gomafia-modal-form">
              <div className="gomafia-modal-field">
                <label className="gomafia-modal-label">Никнейм</label>
                <input
                  className="gomafia-modal-input"
                  type="text"
                  value={goMafiaLogin.nickname}
                  onChange={e => setGoMafiaLogin(prev => ({ ...prev, nickname: e.target.value, error: '' }))}
                  placeholder="Введите никнейм..."
                  autoComplete="username"
                  disabled={goMafiaLogin.loading}
                />
              </div>
              <div className="gomafia-modal-field">
                <label className="gomafia-modal-label">Пароль</label>
                <input
                  className="gomafia-modal-input"
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
                <div className="gomafia-modal-error">{goMafiaLogin.error}</div>
              )}

              <button
                className="gomafia-modal-submit"
                disabled={!goMafiaLogin.nickname.trim() || !goMafiaLogin.password || goMafiaLogin.loading}
                onClick={handleGoMafiaLogin}
              >
                {goMafiaLogin.loading ? (
                  <><div className="gomafia-modal-spinner" /> Авторизация...</>
                ) : (
                  'Авторизоваться'
                )}
              </button>
            </div>

            <a
              className="gomafia-modal-forgot"
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

  async function handleGoMafiaLogin() {
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
  }
}

function NewGameModal({ modal, onSelect, onClose }) {
  const { loading, error, group, games } = modal;
  const playedGameNums = (group?.sessions || []).map(s => s.gameSelected).filter(Boolean);
  const defaultTable = group?.tableSelected;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content newgame-modal" onClick={e => e.stopPropagation()}>
        <div className="newgame-modal-header">
          <div className="newgame-modal-header-left">
            <IconTrophy size={22} color="var(--accent-color, #a855f7)" />
            <div>
              <h2 className="newgame-modal-title">Новая игра</h2>
              <div className="newgame-modal-subtitle">
                {group?.tournamentName}
                {defaultTable ? ` · Стол ${defaultTable}` : ''}
              </div>
            </div>
          </div>
          <button className="newgame-modal-close" onClick={onClose}>
            <IconX size={18} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {loading && (
          <div className="newgame-modal-loading">
            <div className="newgame-modal-spinner" />
            <span>Загрузка турнира...</span>
          </div>
        )}

        {error && (
          <div className="newgame-modal-error">{error}</div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="newgame-modal-games">
            <div className="newgame-modal-hint">Выберите следующую игру:</div>
            <div className="newgame-modal-games-list">
              {games.map(g => {
                const isPlayed = playedGameNums.includes(g.gameNum);
                const table = defaultTable
                  ? g.game?.find(t => t.tableNum === defaultTable) || g.game?.[0]
                  : g.game?.[0];
                const playerCount = table?.table?.length || 0;
                const tableNum = table?.tableNum || defaultTable || 1;

                return (
                  <button
                    key={g.gameNum}
                    className={`newgame-modal-game-btn ${isPlayed ? 'newgame-modal-game-btn--played' : ''}`}
                    disabled={isPlayed}
                    onClick={() => { onSelect(g.gameNum, tableNum); triggerHaptic('success'); }}
                  >
                    <div className="newgame-modal-game-main">
                      <span className="newgame-modal-game-num">Игра {g.gameNum}</span>
                      {isPlayed && <span className="newgame-modal-game-badge">Уже сыграна</span>}
                    </div>
                    <div className="newgame-modal-game-meta">
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
          <div className="newgame-modal-empty">Игры не найдены в данных турнира</div>
        )}
      </div>
    </div>
  );
}

function NavItem({ active, primary, onClick, icon, label }) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''} ${primary ? 'nav-item--primary' : ''}`}
      onClick={onClick}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </button>
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

