import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MafiaWebSocket } from '../services/websocket';
import { isBlackRole, getCityBestMoveMax } from '../constants/roles';
import { sessionManager } from '../services/sessionManager';
import { timerModule } from '../services/timerModule';
import { goMafiaApi } from '../services/api';
import { authService } from '../services/auth';
import { triggerHaptic } from '../utils/haptics';

const GameContext = createContext();

const INACTIVE = ['killed', 'voted', 'removed', 'tech_fall_removed', 'fall_removed'];

export const GameProvider = ({ children }) => {
  // === Screen / Navigation ===
  const [screen, setScreen] = useState('menu'); // 'menu'|'modes'|'gomafia'|'funky'|'city'|'manual'|'game'|'gameTable'|'settings'|'themes'|'profile'|'tournamentBrowser'
  const [activeTab, setActiveTab] = useState('table'); // 'table'|'voting'|'results'|'settings'

  // === Tournament / Session ===
  const [tournament, setTournament] = useState(null);
  const [tournamentId, setTournamentId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [gameSelected, setGameSelected] = useState(null);
  const [tableSelected, setTableSelected] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionsList, setSessionsList] = useState([]);
  const [playedGameNums, setPlayedGameNums] = useState([]);

  // === Game Mode ===
  const [gameMode, setGameMode] = useState('gomafia');
  const [cityMode, setCityMode] = useState(false);
  const [funkyMode, setFunkyMode] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  // === Players ===
  const [players, setPlayers] = useState([]);
  const [roles, setRoles] = useState({});
  const [playersActions, setPlayersActions] = useState({});
  const [fouls, setFouls] = useState({});
  const [techFouls, setTechFouls] = useState({});
  const [removed, setRemoved] = useState({});
  const [avatars, setAvatars] = useState({});

  // === Game Phase System ===
  const [gamePhase, setGamePhase] = useState('roles');
  const [dayNumber, setDayNumber] = useState(0);
  const [nightNumber, setNightNumber] = useState(0);
  const [rolesDistributed, setRolesDistributed] = useState(false);
  const [editRoles, setEditRoles] = useState(true);

  // === Night Sequence ===
  const [nightPhase, setNightPhase] = useState(null);
  const [nightChecks, setNightChecks] = useState({});
  const [nightCheckHistory, setNightCheckHistory] = useState([]);
  const [killedOnNight, setKilledOnNight] = useState({});
  const [nightMisses, setNightMisses] = useState({});
  const [dayButtonBlink, setDayButtonBlink] = useState(false);

  // === Doctor (City Mode) ===
  const [doctorHeal, setDoctorHeal] = useState(null);
  const [doctorHealHistory, setDoctorHealHistory] = useState([]);
  const [doctorLastHealTarget, setDoctorLastHealTarget] = useState(null);

  // === Best Move ===
  const [firstKilledPlayer, setFirstKilledPlayer] = useState(null);
  const [bestMove, setBestMove] = useState([]);
  const [bestMoveAccepted, setBestMoveAccepted] = useState(false);
  const [bestMoveSelected, setBestMoveSelected] = useState(false);
  const [firstKilledEver, setFirstKilledEver] = useState(false);

  // === Killed Card Phases ===
  const [killedCardPhase, setKilledCardPhase] = useState({});
  const [killedPlayerBlink, setKilledPlayerBlink] = useState({});
  const [protocolAccepted, setProtocolAccepted] = useState({});

  // === Protocol / Opinion ===
  const [protocolData, setProtocolData] = useState({});
  const [opinionData, setOpinionData] = useState({});
  const [opinionText, setOpinionText] = useState({});

  // === Voting ===
  const [nominations, setNominations] = useState({});
  const [nominationOrder, setNominationOrder] = useState([]);
  const [nominationsLocked, setNominationsLocked] = useState(false);
  const [votingOrder, setVotingOrder] = useState([]);
  const [votingCurrentIndex, setVotingCurrentIndex] = useState(0);
  const [votingResults, setVotingResults] = useState({});
  const [votingVotedPlayers, setVotingVotedPlayers] = useState([]);
  const [votingFinished, setVotingFinished] = useState(false);
  const [votingWinners, setVotingWinners] = useState([]);
  const [votingStage, setVotingStage] = useState('main');
  const [votingTiePlayers, setVotingTiePlayers] = useState([]);
  const [votingLiftResults, setVotingLiftResults] = useState([]);
  const [votingHistory, setVotingHistory] = useState([]);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [votingScreenTab, setVotingScreenTab] = useState('voting');
  const [currentVotingSession, setCurrentVotingSession] = useState(null);
  const [votingSessionStages, setVotingSessionStages] = useState([]);
  const [dayVoteOuts, setDayVoteOuts] = useState({});
  const [cityVoteCounts, setCityVoteCounts] = useState({});
  const [votingDay0SingleCandidate, setVotingDay0SingleCandidate] = useState(null);
  const [votingDay0TripleTie, setVotingDay0TripleTie] = useState(false);
  const [votingDay0TripleTiePlayers, setVotingDay0TripleTiePlayers] = useState([]);

  // === Voting Timers ===
  const [votingTieTimerActive, setVotingTieTimerActive] = useState(false);
  const [votingTieSpeakerIdx, setVotingTieSpeakerIdx] = useState(0);
  const [votingTieAllDone, setVotingTieAllDone] = useState(false);
  const [votingLastSpeechActive, setVotingLastSpeechActive] = useState(false);
  const [votingLastSpeechTimeLeft, setVotingLastSpeechTimeLeft] = useState(60);
  const [votingLastSpeechRunning, setVotingLastSpeechRunning] = useState(false);
  const [votingLastSpeechPlayerIdx, setVotingLastSpeechPlayerIdx] = useState(0);

  // === Scores / Results ===
  const [winnerTeam, setWinnerTeam] = useState(null);
  const [playerScores, setPlayerScores] = useState({});
  const [gameFinished, setGameFinished] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  // === Games History (multiple games per session) ===
  const [gamesHistory, setGamesHistory] = useState([]);

  // === Broadcast / OBS ===
  const [mainInfoText, setMainInfoText] = useState('');
  const [additionalInfoText, setAdditionalInfoText] = useState('');
  const [mainInfoVisible, setMainInfoVisible] = useState(true);
  const [additionalInfoVisible, setAdditionalInfoVisible] = useState(true);
  const [hideSeating, setHideSeating] = useState(false);
  const [hideLeaveOrder, setHideLeaveOrder] = useState(false);
  const [hideRolesStatus, setHideRolesStatus] = useState(false);
  const [hideBestMove, setHideBestMove] = useState(false);
  const [highlightedPlayer, setHighlightedPlayer] = useState(null);
  const [autoExpandPlayer, setAutoExpandPlayer] = useState(null);
  const [autoStartTimerRK, setAutoStartTimerRK] = useState(null);
  const [expandedCardRK, setExpandedCardRK] = useState(null);

  // === Room / WS ===
  const [roomId, setRoomId] = useState(null);
  const [roomInput, setRoomInput] = useState('');

  // === Discussion / FreeSeating ===
  const [discussionTimeLeft, setDiscussionTimeLeft] = useState(60);
  const [discussionRunning, setDiscussionRunning] = useState(false);
  const [freeSeatingTimeLeft, setFreeSeatingTimeLeft] = useState(40);
  const [freeSeatingRunning, setFreeSeatingRunning] = useState(false);

  // === Day Speaker ===
  const [currentDaySpeakerIndex, setCurrentDaySpeakerIndex] = useState(-1);
  const [daySpeakerStartNum, setDaySpeakerStartNum] = useState(1);
  const [showGoToNightPrompt, setShowGoToNightPrompt] = useState(false);
  const [showNoVotingAlert, setShowNoVotingAlert] = useState(false);

  // === Funky Mode ===
  const [funkyPlayers, setFunkyPlayers] = useState([]);
  const [funkyPlayerInputs, setFunkyPlayerInputs] = useState([]);
  const [funkyGameNumber, setFunkyGameNumber] = useState(1);
  const [funkyEditSessionId, setFunkyEditSessionId] = useState(null);

  // === Theme ===
  const [selectedColorScheme, setSelectedColorScheme] = useState(() => {
    try { return localStorage.getItem('maf_color_scheme') || 'purple'; } catch { return 'purple'; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const val = localStorage.getItem('maf_dark_mode');
      return val !== 'light';
    } catch { return true; }
  });

  // === Judge / Broadcast ===
  const [judgeNickname, setJudgeNickname] = useState('');
  const [judgeAvatar, setJudgeAvatar] = useState('');

  // === Tournament Browser ===
  const [tournamentsList, setTournamentsList] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsFilters, setTournamentsFilters] = useState({ period: '', type: '', fsm: '', search: '' });
  const [tournamentsHasMore, setTournamentsHasMore] = useState(false);
  const [tournamentsPage, setTournamentsPage] = useState(1);

  const wsRef = useRef(null);
  const discussionTimerRef = useRef(null);
  const freeSeatingTimerRef = useRef(null);
  const nightAutoCloseRef = useRef(null);
  const votingLastSpeechIntervalRef = useRef(null);

  // =================== tableOut ===================
  const tableOut = useMemo(() => {
    return players.map((p, i) => {
      const rk = p.roleKey || `${gameSelected || 1}-${tableSelected || 1}-${i + 1}`;
      return {
        ...p, num: i + 1, roleKey: rk,
        role: roles[rk] || null,
        action: playersActions[rk] || null,
        fouls: fouls[rk] || 0,
        techFouls: techFouls[rk] || 0,
        removed: !!removed[rk],
        avatar_link: avatars[p.login] || p.avatar_link || null,
        isFirstKilled: rk === firstKilledPlayer,
      };
    });
  }, [players, roles, playersActions, fouls, techFouls, removed, avatars, firstKilledPlayer, gameSelected, tableSelected]);

  // =================== Helpers ===================
  const isPlayerActive = useCallback((rk) => {
    const a = playersActions[rk];
    return !a || !INACTIVE.includes(a);
  }, [playersActions]);

  const findRoleKey = useCallback((role) => {
    return Object.entries(roles).find(([, v]) => v === role)?.[0] || null;
  }, [roles]);

  const wasKilledBeforeThisNight = useCallback((rk) => {
    const a = playersActions[rk];
    if (!a) return false;
    if (['voted', 'removed', 'tech_fall_removed', 'fall_removed'].includes(a)) return true;
    if (a === 'killed') {
      const kn = killedOnNight[rk];
      return kn == null || kn < nightNumber;
    }
    return true;
  }, [playersActions, killedOnNight, nightNumber]);

  // =================== WebSocket ===================
  const syncState = useCallback((s) => {
    if (wsRef.current) wsRef.current.sendFullStateDebounced(s);
  }, []);

  const joinRoom = useCallback((id, { skipInitialState = false } = {}) => {
    if (wsRef.current) wsRef.current.close();
    let ignoreNextState = skipInitialState;
    const ws = new MafiaWebSocket(id, (data) => {
      if (data.type === 'state') {
        if (ignoreNextState) {
          ignoreNextState = false;
          if (data.avatars) setAvatars(prev => ({ ...prev, ...data.avatars }));
          return;
        }
        if (data.players) setPlayers(data.players);
        if (data.roles) setRoles(data.roles);
        if (data.gamePhase) setGamePhase(data.gamePhase);
        if (data.dayNumber !== undefined) setDayNumber(data.dayNumber);
        if (data.nightNumber !== undefined) setNightNumber(data.nightNumber);
        if (data.playersActions) setPlayersActions(data.playersActions);
        if (data.fouls) setFouls(data.fouls);
        if (data.techFouls) setTechFouls(data.techFouls);
        if (data.removed) setRemoved(data.removed);
        if (data.nightCheckHistory) setNightCheckHistory(data.nightCheckHistory);
        if (data.votingHistory) setVotingHistory(data.votingHistory);
        if (data.bestMove) setBestMove(data.bestMove);
        if (data.firstKilledPlayer !== undefined) setFirstKilledPlayer(data.firstKilledPlayer);
        if (data.highlightedPlayer !== undefined) setHighlightedPlayer(data.highlightedPlayer);
        if (data.nightPhase !== undefined) setNightPhase(data.nightPhase);
        if (data.avatarsFromServer) setAvatars(data.avatarsFromServer);
        if (data.nominations) setNominations(data.nominations);
        if (data.winnerTeam) setWinnerTeam(data.winnerTeam);
        if (data.playerScores) setPlayerScores(data.playerScores);
        if (data.mainInfoText !== undefined) setMainInfoText(data.mainInfoText);
        if (data.additionalInfoText !== undefined) setAdditionalInfoText(data.additionalInfoText);
      }
    });
    ws.connect();
    wsRef.current = ws;
    setRoomId(id);
  }, []);

  useEffect(() => () => { if (wsRef.current) wsRef.current.close(); }, []);

  // =================== Roles ===================
  const roleSet = useCallback((rk, type) => {
    setRoles(prev => {
      const next = { ...prev };
      if (next[rk] === type) { delete next[rk]; }
      else {
        const same = Object.entries(next).filter(([k, v]) => v === type && k !== rk).map(([k]) => k);
        if (type === 'don' || type === 'sheriff') same.forEach(k => delete next[k]);
        else if (type === 'black' && same.length >= 2) delete next[same[0]];
        next[rk] = type;
      }
      syncState({ roles: next });
      return next;
    });
  }, [syncState]);

  const validateRoles = useCallback(() => {
    if (cityMode) return { valid: true, errors: [] };
    const vals = Object.values(roles);
    const errors = [];
    if (vals.filter(r => r === 'don').length !== 1) errors.push('Дон: нужен 1');
    if (vals.filter(r => r === 'black').length !== 2) errors.push('Мафия: нужно 2');
    if (vals.filter(r => r === 'sheriff').length !== 1) errors.push('Шериф: нужен 1');
    return { valid: errors.length === 0, errors };
  }, [roles, cityMode]);

  // =================== Fouls ===================
  const addFoul = useCallback((rk) => {
    setFouls(prev => {
      const val = Math.min((prev[rk] || 0) + 1, 4);
      const next = { ...prev, [rk]: val };
      if (val >= 4) {
        setRemoved(r => ({ ...r, [rk]: true }));
        setPlayersActions(a => ({ ...a, [rk]: 'fall_removed' }));
      }
      timerModule.updatePlayerFouls(rk, val);
      syncState({ fouls: next });
      return next;
    });
  }, [syncState]);

  const removeFoul = useCallback((rk) => {
    setFouls(prev => {
      const val = Math.max((prev[rk] || 0) - 1, 0);
      const next = { ...prev, [rk]: val };
      if (val < 4 && playersActions[rk] === 'fall_removed') {
        setRemoved(r => ({ ...r, [rk]: false }));
        setPlayersActions(a => { const n = { ...a }; delete n[rk]; return n; });
      }
      timerModule.updatePlayerFouls(rk, val);
      syncState({ fouls: next });
      return next;
    });
  }, [syncState, playersActions]);

  const addTechFoul = useCallback((rk) => {
    setTechFouls(prev => {
      const val = Math.min((prev[rk] || 0) + 1, 2);
      const next = { ...prev, [rk]: val };
      if (val >= 2) {
        setRemoved(r => ({ ...r, [rk]: true }));
        setPlayersActions(a => ({ ...a, [rk]: 'tech_fall_removed' }));
      }
      syncState({ techFouls: next });
      return next;
    });
  }, [syncState]);

  const removeTechFoul = useCallback((rk) => {
    setTechFouls(prev => {
      const val = Math.max((prev[rk] || 0) - 1, 0);
      const next = { ...prev, [rk]: val };
      if (val < 2 && playersActions[rk] === 'tech_fall_removed') {
        setRemoved(r => ({ ...r, [rk]: false }));
        setPlayersActions(a => { const n = { ...a }; delete n[rk]; return n; });
      }
      syncState({ techFouls: next });
      return next;
    });
  }, [syncState, playersActions]);

  // =================== Kill Player ===================
  const killPlayer = useCallback((num) => {
    const p = tableOut[num - 1];
    if (!p) return;
    const rk = p.roleKey;
    setPlayersActions(prev => ({ ...prev, [rk]: 'killed' }));
    setKilledOnNight(prev => ({ ...prev, [rk]: nightNumber || 1 }));
    const isFirst = !firstKilledEver;
    if (isFirst) {
      setFirstKilledPlayer(rk);
      setFirstKilledEver(true);
      setBestMoveSelected(false);
      setBestMove([]);
      setBestMoveAccepted(false);
      setKilledCardPhase(prev => ({ ...prev, [rk]: 'bm' }));
    } else {
      setKilledCardPhase(prev => ({ ...prev, [rk]: 'timer' }));
    }
    setKilledPlayerBlink(prev => ({ ...prev, [rk]: true }));
    setTimeout(() => setKilledPlayerBlink(prev => ({ ...prev, [rk]: false })), 5000);
    syncState({ playersActions: { ...playersActions, [rk]: 'killed' } });
  }, [tableOut, nightNumber, firstKilledEver, playersActions, syncState]);

  const setNightMiss = useCallback(() => {
    setNightMisses(prev => ({ ...prev, [nightNumber]: true }));
  }, [nightNumber]);

  // =================== Action Set (generic player action) ===================
  const actionSet = useCallback((rk, action, opts = {}) => {
    if (action === null) {
      setPlayersActions(prev => { const n = { ...prev }; delete n[rk]; return n; });
      setRemoved(prev => { const n = { ...prev }; delete n[rk]; return n; });
      syncState({ playersActions: { ...playersActions, [rk]: null } });
      return;
    }
    if (action === 'killed' && opts.nightKill) {
      const p = tableOut.find(x => x.roleKey === rk);
      if (p) killPlayer(p.num);
      return;
    }
    if (action === 'removed') {
      setPlayersActions(prev => ({ ...prev, [rk]: 'removed' }));
      setRemoved(prev => ({ ...prev, [rk]: true }));
      syncState({ playersActions: { ...playersActions, [rk]: 'removed' } });
      return;
    }
    setPlayersActions(prev => ({ ...prev, [rk]: action }));
    syncState({ playersActions: { ...playersActions, [rk]: action } });
  }, [playersActions, tableOut, killPlayer, syncState]);

  // =================== Night Sequence ===================
  const startNightSequence = useCallback(() => {
    if (nightAutoCloseRef.current) { clearTimeout(nightAutoCloseRef.current); nightAutoCloseRef.current = null; }
    setHighlightedPlayer(null);
    setNightPhase('kill');
  }, []);

  const advanceNightPhase = useCallback(() => {
    if (nightAutoCloseRef.current) { clearTimeout(nightAutoCloseRef.current); nightAutoCloseRef.current = null; }
    const donKey = findRoleKey('don');
    const sheriffKey = findRoleKey('sheriff');
    const doctorKey = cityMode ? findRoleKey('doctor') : null;
    const donOk = donKey && !wasKilledBeforeThisNight(donKey);
    const sheriffOk = sheriffKey && !wasKilledBeforeThisNight(sheriffKey);
    const docOk = doctorKey && !wasKilledBeforeThisNight(doctorKey);

    if (nightPhase === 'kill') {
      if (donOk) { setNightPhase('don'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(donKey), 50); }
      else if (sheriffOk) { setNightPhase('sheriff'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(sheriffKey), 50); }
      else if (docOk) { setNightPhase('doctor'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(doctorKey), 50); }
      else { setNightPhase('done'); setHighlightedPlayer(null); setDayButtonBlink(true); }
    } else if (nightPhase === 'don') {
      if (sheriffOk) { setNightPhase('sheriff'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(sheriffKey), 50); }
      else if (docOk) { setNightPhase('doctor'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(doctorKey), 50); }
      else { setNightPhase('done'); setHighlightedPlayer(null); setDayButtonBlink(true); }
    } else if (nightPhase === 'sheriff') {
      if (docOk) { setNightPhase('doctor'); setHighlightedPlayer(null); setTimeout(() => setHighlightedPlayer(doctorKey), 50); }
      else { setNightPhase('done'); setHighlightedPlayer(null); setDayButtonBlink(true); }
    } else if (nightPhase === 'doctor') {
      setNightPhase('done'); setHighlightedPlayer(null); setDayButtonBlink(true);
    }
  }, [nightPhase, findRoleKey, cityMode, wasKilledBeforeThisNight]);

  // =================== Night Check ===================
  const performNightCheck = useCallback((checkerRK, targetNum) => {
    const cRole = roles[checkerRK];
    if (!cRole || (cRole !== 'don' && cRole !== 'sheriff')) return;
    if (nightChecks[checkerRK]) return;
    const tp = tableOut[targetNum - 1];
    if (!tp) return;
    const tRole = roles[tp.roleKey] || null;
    let result, found;
    if (cRole === 'don') { found = tRole === 'sheriff'; result = found ? 'Шериф ✅' : 'Не шериф ❌'; }
    else { found = tRole === 'black' || tRole === 'don'; result = found ? 'Мафия ✅' : 'Мирный ❌'; }
    setNightChecks(prev => ({ ...prev, [checkerRK]: { target: targetNum, result } }));
    setNightCheckHistory(prev => [...prev, { night: nightNumber || 1, checker: checkerRK, checkerRole: cRole, target: targetNum, targetLogin: tp.login || ('Игрок ' + targetNum), result, found }]);
    nightAutoCloseRef.current = setTimeout(() => { nightAutoCloseRef.current = null; advanceNightPhase(); }, 5000);
    syncState({ nightChecks: { ...nightChecks, [checkerRK]: { target: targetNum, result } } });
  }, [roles, nightChecks, tableOut, nightNumber, advanceNightPhase, syncState]);

  // =================== Discussion / FreeSeating ===================
  const startDiscussionTimer = useCallback(() => {
    if (discussionTimerRef.current) return;
    setDiscussionRunning(true);
    const end = Date.now() + discussionTimeLeft * 1000;
    discussionTimerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setDiscussionTimeLeft(rem);
      if (rem <= 0) { clearInterval(discussionTimerRef.current); discussionTimerRef.current = null; setDiscussionRunning(false); setGamePhase('freeSeating'); setFreeSeatingTimeLeft(cityMode ? 20 : 40); }
    }, 1000);
  }, [discussionTimeLeft, cityMode]);

  const stopDiscussionTimer = useCallback(() => { if (discussionTimerRef.current) { clearInterval(discussionTimerRef.current); discussionTimerRef.current = null; } setDiscussionRunning(false); }, []);

  const startFreeSeatingTimer = useCallback(() => {
    if (freeSeatingTimerRef.current) return;
    setFreeSeatingRunning(true);
    const end = Date.now() + freeSeatingTimeLeft * 1000;
    freeSeatingTimerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setFreeSeatingTimeLeft(rem);
      if (rem <= 0) { clearInterval(freeSeatingTimerRef.current); freeSeatingTimerRef.current = null; setFreeSeatingRunning(false); setGamePhase('day'); setDayNumber(1); }
    }, 1000);
  }, [freeSeatingTimeLeft]);

  const stopFreeSeatingTimer = useCallback(() => { if (freeSeatingTimerRef.current) { clearInterval(freeSeatingTimerRef.current); freeSeatingTimerRef.current = null; } setFreeSeatingRunning(false); }, []);

  // =================== Phase Management ===================
  const confirmRolesDistribution = useCallback(() => {
    const v = validateRoles();
    if (!v.valid) return v;
    setRolesDistributed(true); setEditRoles(false);
    setGamePhase('discussion'); setDayNumber(0); setNightNumber(0);
    setDiscussionTimeLeft(60);
    setTimeout(() => startDiscussionTimer(), 100);
    syncState({ gamePhase: 'discussion', rolesDistributed: true });
    return { valid: true };
  }, [validateRoles, syncState, startDiscussionTimer]);

  const advanceFromDiscussion = useCallback(() => {
    stopDiscussionTimer();
    setGamePhase('freeSeating'); setFreeSeatingTimeLeft(cityMode ? 20 : 40);
    syncState({ gamePhase: 'freeSeating' });
  }, [stopDiscussionTimer, cityMode, syncState]);

  const advanceFromFreeSeating = useCallback(() => {
    stopFreeSeatingTimer();
    setGamePhase('day'); setDayNumber(1);
    setDaySpeakerStartNum(1);
    setCurrentDaySpeakerIndex(-1);
    syncState({ gamePhase: 'day', dayNumber: 1 });
  }, [stopFreeSeatingTimer, syncState]);

  const setMode = useCallback((mode) => {
    if (mode === 'night') {
      setGamePhase('night');
      setNightNumber(n => n + 1);
      setNightPhase('kill'); setNightChecks({}); setDayButtonBlink(false);
      if (doctorHeal?.target) setDoctorLastHealTarget(doctorHeal.target);
      setDoctorHeal(null); setHighlightedPlayer(null); setShowGoToNightPrompt(false);
      setCurrentDaySpeakerIndex(-1);
      syncState({ gamePhase: 'night' });
    } else if (mode === 'day') {
      const killedRK = Object.entries(killedOnNight).find(([, n]) => n === nightNumber)?.[0] || null;
      setAutoExpandPlayer(killedRK);
      setGamePhase('day'); setDayNumber(d => d + 1);
      setDayButtonBlink(false); setNightPhase(null); setNightChecks({});
      setHighlightedPlayer(null); setCurrentDaySpeakerIndex(-1);

      const totalPlayers = tableOut.length;
      if (totalPlayers > 0) {
        let nextStart = daySpeakerStartNum;
        for (let i = 0; i < totalPlayers; i++) {
          const candidateNum = ((nextStart - 1 + 1 + i) % totalPlayers) + 1;
          const p = tableOut[candidateNum - 1];
          if (p && isPlayerActive(p.roleKey)) {
            nextStart = candidateNum;
            break;
          }
        }
        setDaySpeakerStartNum(nextStart);
      }

      syncState({ gamePhase: 'day' });
    }
  }, [doctorHeal, killedOnNight, nightNumber, syncState, tableOut, daySpeakerStartNum, isPlayerActive]);

  const handleGoToNight = useCallback((skipVotingCheck = false) => {
    if (!skipVotingCheck) {
      const hasVoting = votingHistory.some(v => v.dayNumber === dayNumber);
      if (!hasVoting && dayNumber > 0) { setShowNoVotingAlert(true); return; }
    }
    setMode('night');
  }, [dayNumber, votingHistory, setMode]);

  // =================== Voting ===================
  const toggleNomination = useCallback((rk, number) => {
    if (!isPlayerActive(rk)) return;
    const trk = tableOut[number - 1]?.roleKey;
    if (trk && !isPlayerActive(trk)) return;
    setNominations(prev => {
      const next = { ...prev };
      const oldTarget = next[rk]?.[0];
      if (next[rk]?.includes(number)) {
        delete next[rk];
        setNominationOrder(ord => ord.filter(n => n !== number));
      } else {
        next[rk] = [number];
        setNominationOrder(ord => {
          const cleaned = oldTarget ? ord.filter(n => n !== oldTarget) : ord;
          return cleaned.includes(number) ? cleaned : [...cleaned, number];
        });
      }
      syncState({ nominations: next });
      return next;
    });
  }, [isPlayerActive, tableOut, syncState]);

  const getNominatedCandidates = useCallback(() => {
    const current = new Set(Object.values(nominations).flat());
    const ordered = nominationOrder.filter(n => current.has(n));
    current.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });
    return ordered;
  }, [nominations, nominationOrder]);

  const startVoting = useCallback(() => {
    const cands = getNominatedCandidates();
    if (cands.length === 0) return;
    setVotingDay0SingleCandidate(null);
    setVotingDay0TripleTie(false);
    setVotingDay0TripleTiePlayers([]);
    if (dayNumber === 0 && cands.length === 1) {
      setVotingDay0SingleCandidate(cands[0]);
      setShowVotingModal(true); setNominationsLocked(true);
      return;
    }
    setVotingOrder(cands); setVotingCurrentIndex(0);
    setVotingResults({}); setVotingVotedPlayers([]);
    setVotingFinished(false); setVotingWinners([]);
    setVotingStage('main'); setVotingTiePlayers([]);
    setVotingLiftResults([]); setCityVoteCounts({});
    setShowVotingModal(true); setNominationsLocked(true);
    setVotingSessionStages([]);
    setCurrentVotingSession({
      mainResults: {}, tieResults: {}, liftResults: [],
      mainWinners: [], tieWinners: [], liftWinners: [],
      finalWinners: [], nominationsAll: [...cands],
    });
  }, [getNominatedCandidates, dayNumber]);

  const toggleVotingSelection = useCallback((number) => {
    const rk = tableOut[number - 1]?.roleKey;
    if (!isPlayerActive(rk)) return;
    setVotingResults(prev => {
      const next = { ...prev };
      const cand = String(votingOrder[votingCurrentIndex]);
      if (!next[cand]) next[cand] = [];
      if (next[cand].includes(number)) {
        next[cand] = next[cand].filter(n => n !== number);
      } else {
        const elsewhere = Object.entries(next).some(([c, v]) => c !== cand && v.includes(number));
        if (!elsewhere) next[cand] = [...next[cand], number];
      }
      return { ...next };
    });
  }, [tableOut, isPlayerActive, votingOrder, votingCurrentIndex]);

  const finishVotingStage = useCallback(() => {
    if (cityMode) {
      const counts = votingOrder.map(c => ({ c, v: cityVoteCounts[c] || 0 }));
      const maxV = Math.max(0, ...counts.map(x => x.v));
      const winners = counts.filter(x => x.v === maxV && maxV > 0).map(x => x.c);
      const finalResults = {};
      votingOrder.forEach(c => { finalResults[String(c)] = cityVoteCounts[c] || 0; });

      if (winners.length === 1) {
        setVotingFinished(true); setVotingWinners(winners);
        setVotingLastSpeechActive(true);
      } else if (winners.length > 1) {
        setVotingTiePlayers(winners);
        if (votingStage === 'main') setVotingTieTimerActive(true);
        else { setVotingTiePlayers(winners); setVotingTieTimerActive(true); }
      } else {
        setVotingFinished(true); setVotingWinners([]);
      }
      setVotingResults(finalResults);
      return;
    }

    const alive = tableOut.filter(p => isPlayerActive(p.roleKey)).map(p => p.num);
    const allVoted = [...new Set(Object.values(votingResults).flat())];
    const notVoted = alive.filter(n => !allVoted.includes(n));
    let finalResults = { ...votingResults };
    if (notVoted.length > 0 && votingOrder.length > 0) {
      const last = String(votingOrder[votingOrder.length - 1]);
      finalResults[last] = [...(finalResults[last] || []), ...notVoted];
    }
    const counts = votingOrder.map(c => ({ c, v: (finalResults[String(c)]?.length || 0) }));
    const maxV = Math.max(0, ...counts.map(x => x.v));
    const winners = counts.filter(x => x.v === maxV && maxV > 0).map(x => x.c);

    if (winners.length === 1) {
      setVotingFinished(true); setVotingWinners(winners);
      setVotingLastSpeechActive(true);
    } else if (winners.length > 1) {
      setVotingTiePlayers(winners);
      if (dayNumber === 0 && winners.length >= 3 && votingStage === 'main') {
        setVotingDay0TripleTie(true);
        setVotingDay0TripleTiePlayers([...winners]);
        setVotingFinished(true); setVotingWinners([]);
      } else if (votingStage === 'tie') {
        setVotingSessionStages(prev => [...prev, { type: 'tie', results: { ...finalResults }, candidates: [...votingOrder] }]);
        setVotingOrder([...winners]); setVotingCurrentIndex(0);
        setVotingResults({}); setVotingLiftResults([]);
        setVotingFinished(false); setVotingWinners([]); setVotingStage('lift');
        setVotingTieTimerActive(false);
      } else {
        setVotingTieSpeakerIdx(0); setVotingTieAllDone(false);
        setVotingTieTimerActive(true);
      }
    } else {
      setVotingFinished(true); setVotingWinners([]);
    }
    setVotingResults(finalResults);
  }, [tableOut, isPlayerActive, votingResults, votingOrder, votingStage, cityMode, cityVoteCounts, dayNumber]);

  const acceptCurrentCandidateVotes = useCallback(() => {
    if (votingCurrentIndex >= votingOrder.length - 1) { finishVotingStage(); }
    else setVotingCurrentIndex(i => i + 1);
  }, [votingCurrentIndex, votingOrder, finishVotingStage]);

  const startTieVoting = useCallback(() => {
    setVotingSessionStages(prev => [...prev, { type: votingStage, results: { ...votingResults }, candidates: [...votingOrder] }]);
    setVotingOrder([...votingTiePlayers]); setVotingCurrentIndex(0);
    setVotingResults({}); setVotingVotedPlayers([]);
    setVotingFinished(false); setVotingWinners([]);
    setVotingStage('tie'); setVotingTieTimerActive(false);
    setVotingTieSpeakerIdx(0); setVotingTieAllDone(false);
  }, [votingTiePlayers, votingStage, votingResults, votingOrder]);

  const startLiftVoting = useCallback(() => {
    setVotingSessionStages(prev => [...prev, { type: votingStage, results: { ...votingResults }, candidates: [...votingOrder] }]);
    setVotingOrder([...votingTiePlayers]); setVotingCurrentIndex(0);
    setVotingResults({}); setVotingLiftResults([]);
    setVotingFinished(false); setVotingWinners([]); setVotingStage('lift');
  }, [votingTiePlayers, votingStage, votingResults, votingOrder]);

  const updateVotingOrder = useCallback((newOrder) => {
    setVotingOrder(newOrder);
    setVotingCurrentIndex(0);
    setVotingResults({});
    setCityVoteCounts({});
    setCurrentVotingSession(prev => prev ? { ...prev, nominationsAll: [...newOrder] } : prev);
  }, []);

  const toggleLiftVote = useCallback((num) => {
    const rk = tableOut[num - 1]?.roleKey;
    if (!isPlayerActive(rk)) return;
    setVotingLiftResults(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  }, [tableOut, isPlayerActive]);

  const finishLiftVoting = useCallback(() => {
    const aliveCount = tableOut.filter(p => isPlayerActive(p.roleKey)).length;
    const liftVotes = votingLiftResults.length;
    setVotingFinished(true);
    if (liftVotes > aliveCount / 2) {
      setVotingWinners([...votingOrder]);
      setVotingLastSpeechActive(true);
    } else {
      setVotingWinners([]);
      setNominations({}); setNominationOrder([]); setNominationsLocked(false);
    }
  }, [tableOut, isPlayerActive, votingLiftResults, votingOrder]);

  const dismissDay0VotingAndGoToNight = useCallback(() => {
    if (votingDay0TripleTie && currentVotingSession) {
      const entry = {
        votingNumber: votingHistory.length + 1, dayNumber,
        nominees: currentVotingSession.nominationsAll || [],
        stages: [{ type: 'main', results: { ...votingResults }, candidates: [...votingOrder] }],
        finalWinners: [],
      };
      setVotingHistory(prev => [...prev, entry]);
    }
    setVotingDay0SingleCandidate(null);
    setVotingDay0TripleTie(false); setVotingDay0TripleTiePlayers([]);
    setNominations({}); setNominationOrder([]); setNominationsLocked(false);
    setVotingOrder([]); setVotingCurrentIndex(0);
    setVotingResults({}); setVotingFinished(false);
    setVotingWinners([]); setVotingStage('main');
    setShowVotingModal(false); setCurrentVotingSession(null);
    setMode('night');
  }, [votingDay0TripleTie, currentVotingSession, votingHistory, dayNumber, votingResults, setMode]);

  const closeVotingAndApply = useCallback(() => {
    // Save to history
    if (currentVotingSession) {
      const finalStage = votingStage === 'lift'
        ? { type: 'lift', liftVoters: [...votingLiftResults], candidates: [...votingOrder] }
        : { type: votingStage, results: { ...votingResults }, candidates: [...votingOrder] };
      const allStages = [...votingSessionStages, finalStage];
      const entry = {
        votingNumber: votingHistory.length + 1, dayNumber,
        nominees: currentVotingSession.nominationsAll || [],
        stages: allStages,
        finalWinners: [...votingWinners],
      };
      setVotingHistory(prev => [...prev, entry]);
    }
    // Apply 'voted'
    votingWinners.forEach(num => {
      const rk = tableOut[num - 1]?.roleKey;
      if (rk) setPlayersActions(prev => ({ ...prev, [rk]: 'voted' }));
    });
    if (votingWinners.length > 0) setDayVoteOuts(prev => ({ ...prev, [dayNumber]: true }));
    // Reset
    setNominations({}); setNominationOrder([]); setNominationsLocked(false);
    setVotingOrder([]); setVotingCurrentIndex(0);
    setVotingResults({}); setVotingFinished(false);
    setVotingWinners([]); setVotingStage('main');
    setShowVotingModal(false); setCurrentVotingSession(null);
    setVotingTieTimerActive(false); setVotingTieAllDone(false); setVotingLastSpeechActive(false);
    setVotingDay0SingleCandidate(null); setVotingDay0TripleTie(false); setVotingDay0TripleTiePlayers([]);
    setVotingScreenTab('voting');
  }, [currentVotingSession, votingHistory, votingSessionStages, votingStage, votingResults, votingLiftResults, votingOrder, votingWinners, dayNumber, tableOut]);

  // =================== Protocol / Opinion ===================
  const toggleProtocolRole = useCallback((rk, idx) => {
    setProtocolData(prev => {
      const next = { ...prev, [rk]: { ...(prev[rk] || {}) } };
      const cur = next[rk][idx] || '';
      const cycle = ['', 'peace', 'sheriff', 'mafia', 'don'];
      next[rk][idx] = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
      return next;
    });
  }, []);

  const toggleOpinionRole = useCallback((rk, idx) => {
    setOpinionData(prev => {
      const next = { ...prev, [rk]: { ...(prev[rk] || {}) } };
      const cur = next[rk][idx] || '';
      const cycle = ['', 'peace', 'sheriff', 'mafia', 'don'];
      next[rk][idx] = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
      return next;
    });
  }, []);

  // =================== Best Move ===================
  const toggleBestMove = useCallback((num) => {
    const maxBM = cityMode ? (getCityBestMoveMax(players.length) || 3) : 3;
    setBestMove(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      if (prev.length < maxBM) return [...prev, num].sort((a, b) => a - b);
      return prev;
    });
  }, [cityMode, players.length]);

  const acceptBestMove = useCallback((rk) => {
    setBestMoveAccepted(true); setBestMoveSelected(true);
    setKilledCardPhase(prev => ({ ...prev, [rk]: 'timer' }));
    syncState({ bestMoveAccepted: true, bestMoveSelected: true, bestMove });
  }, [bestMove, syncState]);

  const canShowBestMove = useCallback(() => {
    if (cityMode && getCityBestMoveMax(players.length) === 0) return false;
    if (dayVoteOuts[0]) return false;
    return true;
  }, [dayVoteOuts, cityMode, players.length]);

  // =================== Scores ===================
  const calculatePlayerScore = useCallback((rk) => {
    if (!winnerTeam) return 0;
    let s = 0;
    const role = roles[rk];
    if (winnerTeam === 'civilians' && (!role || role === 'sheriff' || role === 'peace')) s += 1;
    if (winnerTeam === 'mafia' && (role === 'don' || role === 'black')) s += 1;
    if (playerScores[rk]) { s += parseFloat(playerScores[rk].bonus || 0); s -= parseFloat(playerScores[rk].penalty || 0); }
    return parseFloat(s.toFixed(2));
  }, [winnerTeam, roles, playerScores]);

  const adjustScore = useCallback((rk, type, delta) => {
    setPlayerScores(prev => {
      const cur = prev[rk] || { bonus: 0, penalty: 0, reveal: false };
      let v = Math.round((parseFloat(cur[type] || 0) + delta) * 10) / 10;
      if (type === 'penalty' && v < 0) v = 0;
      return { ...prev, [rk]: { ...cur, [type]: v } };
    });
  }, []);

  const toggleReveal = useCallback((rk) => {
    setPlayerScores(prev => {
      const cur = prev[rk] || { bonus: 0, penalty: 0, reveal: false };
      return { ...prev, [rk]: { ...cur, reveal: !cur.reveal } };
    });
  }, []);

  const computeAutoScores = useCallback(() => {
    if (gameMode !== 'gomafia' && gameMode !== 'funky') return null;
    const isBlack = (role) => role === 'don' || role === 'black';
    const scores = {};

    for (const p of tableOut) {
      const rk = p.roleKey;
      let bonus = 0;
      let penalty = 0;
      const isFK = rk === firstKilledPlayer;

      // 1. Best Move — only for first killed
      if (isFK && bestMoveAccepted && bestMove.length > 0) {
        let blacks = 0;
        for (const num of bestMove) {
          const t = tableOut.find(x => x.num === num);
          if (t && isBlack(roles[t.roleKey])) blacks++;
        }
        const bmTable = { 1: 0.1, 2: 0.3, 3: 0.6 };
        bonus += bmTable[blacks] || 0;
      }

      // 2. Protocol / Opinion
      if (isFK) {
        const proto = protocolData[rk];
        if (proto) {
          let protoBonus = 0;
          let protoPenalty = 0;
          let correctBlacks = 0, wrongBlacks = 0;
          let correctReds = 0, wrongReds = 0;

          for (const [numStr, pred] of Object.entries(proto)) {
            if (!pred) continue;
            const t = tableOut.find(x => x.num === parseInt(numStr));
            if (!t) continue;
            const actual = roles[t.roleKey];
            const targetIsBlack = isBlack(actual);

            if (pred === 'sheriff') {
              if (targetIsBlack) protoPenalty += 0.4;
              else protoBonus += 0.4;
            } else if (pred === 'mafia' || pred === 'don') {
              if (targetIsBlack) correctBlacks++;
              else wrongBlacks++;
            } else if (pred === 'peace') {
              if (!targetIsBlack) correctReds++;
              else wrongReds++;
            }
          }

          const bkBonus = { 1: 0.2, 2: 0.5, 3: 0.8 };
          const bkPenalty = { 1: 0.2, 2: 0.5, 3: 0.8 };
          protoBonus += bkBonus[Math.min(correctBlacks, 3)] || 0;
          protoPenalty += bkPenalty[Math.min(wrongBlacks, 3)] || 0;

          const rdBonus = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7 };
          const rdPenalty = { 1: 0.2, 2: 0.4 };
          if (wrongReds === 0) {
            protoBonus += rdBonus[Math.min(correctReds, 4)] || 0;
          }
          protoPenalty += rdPenalty[Math.min(wrongReds, 2)] || 0;

          bonus += Math.min(protoBonus, 0.8);
          penalty += protoPenalty;
        }
      } else {
        const opinion = opinionData[rk];
        if (opinion) {
          let opBonus = 0;
          for (const [numStr, pred] of Object.entries(opinion)) {
            if (pred !== 'sheriff') continue;
            const t = tableOut.find(x => x.num === parseInt(numStr));
            if (!t) continue;
            if (isBlack(roles[t.roleKey])) penalty += 0.4;
            else opBonus += 0.4;
          }
          bonus += Math.min(opBonus, 0.4);
        }
      }

      // 3. Penalties
      if (p.removed || p.fouls >= 4) penalty += 1.0;
      const tf = p.techFouls || 0;
      if (tf >= 2) penalty += 0.6;
      else if (tf === 1) penalty += 0.3;

      scores[rk] = {
        bonus: Math.round(bonus * 10) / 10,
        penalty: Math.round(penalty * 10) / 10,
        reveal: false,
      };
    }
    return scores;
  }, [gameMode, tableOut, firstKilledPlayer, bestMoveAccepted, bestMove, protocolData, opinionData, roles]);

  // =================== Doctor Heal ===================
  const performDoctorHeal = useCallback((num) => {
    setDoctorHeal({ target: num, night: nightNumber });
    setDoctorHealHistory(prev => [...prev, { target: num, night: nightNumber }]);
  }, [nightNumber]);

  const canDoctorHealTarget = useCallback((num) => {
    if (num === doctorLastHealTarget) return false;
    return true;
  }, [doctorLastHealTarget]);

  // =================== Check Protocol/Opinion ===================
  const checkProtocol = useCallback((rk) => {
    if (!protocolData[rk]) return null;
    const results = {};
    let has = false;
    Object.entries(protocolData[rk]).forEach(([idx, pred]) => {
      if (!pred) return;
      has = true;
      const tp = tableOut.find(p => p.num === parseInt(idx));
      if (!tp) return;
      const actual = roles[tp.roleKey];
      let ok = false;
      if (pred === 'peace' && !actual) ok = true;
      else if (pred === 'sheriff' && actual === 'sheriff') ok = true;
      else if (pred === 'mafia' && actual === 'black') ok = true;
      else if (pred === 'don' && actual === 'don') ok = true;
      results[idx] = { role: pred, correct: ok };
    });
    return has ? results : null;
  }, [protocolData, tableOut, roles]);

  const checkOpinion = useCallback((rk) => {
    if (!opinionData[rk]) return null;
    const results = {};
    let has = false;
    Object.entries(opinionData[rk]).forEach(([idx, pred]) => {
      if (!pred) return;
      has = true;
      const tp = tableOut.find(p => p.num === parseInt(idx));
      if (!tp) return;
      const actual = roles[tp.roleKey];
      let ok = false;
      if (pred === 'peace' && !actual) ok = true;
      else if (pred === 'sheriff' && actual === 'sheriff') ok = true;
      else if (pred === 'mafia' && actual === 'black') ok = true;
      else if (pred === 'don' && actual === 'don') ok = true;
      results[idx] = { role: pred, correct: ok };
    });
    return has ? results : null;
  }, [opinionData, tableOut, roles]);

  // =================== Save Summary to Server ===================
  const saveSummaryToServer = useCallback(async () => {
    try {
      const data = {
        tournamentId, tournamentName, gameMode,
        gameSelected, tableSelected,
        players: tableOut.map(p => ({
          num: p.num, login: p.login, role: p.role,
          action: p.action, score: calculatePlayerScore(p.roleKey),
          fouls: p.fouls, techFouls: p.techFouls,
        })),
        winnerTeam, nightCheckHistory, votingHistory,
        bestMove, bestMoveAccepted, firstKilledPlayer,
        protocolData, opinionData, opinionText,
        doctorHealHistory, nightMisses,
        timestamp: Date.now(),
      };
      return await goMafiaApi.saveSummary(data);
    } catch (e) {
      console.error('Save summary error:', e);
      return null;
    }
  }, [tournamentId, tournamentName, gameMode, gameSelected, tableSelected, tableOut, winnerTeam, nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer, protocolData, opinionData, opinionText, doctorHealHistory, nightMisses, calculatePlayerScore]);

  // =================== Games History ===================
  const saveGameToHistory = useCallback(() => {
    if (!winnerTeam) return null;
    const snapshot = {
      gameNumber: gamesHistory.length + 1,
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
      opinionText: { ...opinionText },
      doctorHealHistory: [...doctorHealHistory],
      nightMisses: { ...nightMisses },
      killedOnNight: { ...killedOnNight },
      dayVoteOuts: { ...dayVoteOuts },
      cityMode,
      completedAt: Date.now(),
    };
    setGamesHistory(prev => [...prev, snapshot]);
    return snapshot;
  }, [gamesHistory.length, gameSelected, tableSelected, players, roles, playersActions, fouls, techFouls, removed, avatars, dayNumber, nightNumber, nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer, winnerTeam, playerScores, protocolData, opinionData, opinionText, doctorHealHistory, nightMisses, killedOnNight, dayVoteOuts, cityMode]);

  const startNextGameInSession = useCallback(() => {
    saveGameToHistory();

    setRoles({});
    setPlayersActions({});
    setFouls({});
    setTechFouls({});
    setRemoved({});
    setGamePhase('roles');
    setDayNumber(0);
    setNightNumber(0);
    setRolesDistributed(false);
    setEditRoles(true);
    setNightPhase(null);
    setNightChecks({});
    setNightCheckHistory([]);
    setKilledOnNight({});
    setNightMisses({});
    setDayButtonBlink(false);
    setFirstKilledPlayer(null);
    setBestMove([]);
    setBestMoveAccepted(false);
    setBestMoveSelected(false);
    setFirstKilledEver(false);
    setKilledCardPhase({});
    setKilledPlayerBlink({});
    setProtocolAccepted({});
    setProtocolData({});
    setOpinionData({});
    setOpinionText({});
    setNominations({});
    setNominationOrder([]);
    setNominationsLocked(false);
    setVotingOrder([]);
    setVotingCurrentIndex(0);
    setVotingResults({});
    setVotingFinished(false);
    setVotingWinners([]);
    setVotingHistory([]);
    setShowVotingModal(false);
    setDayVoteOuts({});
    setWinnerTeam(null);
    setPlayerScores({});
    setGameFinished(false);
    setHighlightedPlayer(null);
    setCurrentDaySpeakerIndex(-1);
    setDaySpeakerStartNum(1);
    setDoctorHeal(null);
    setDoctorHealHistory([]);
    setDoctorLastHealTarget(null);
    timerModule.clearAllTimers();
    setActiveTab('table');
    triggerHaptic('success');
  }, [saveGameToHistory]);

  const currentGameNumber = useMemo(() => gamesHistory.length + 1, [gamesHistory.length]);

  // =================== Session Management ===================
  const saveCurrentSession = useCallback(() => {
    if (!currentSessionId) return;
    const allGames = tournament?.props?.pageProps?.serverData?.games || [];
    const totalGamesInTournament = allGames.length || undefined;
    const totalGamesForTable = tableSelected
      ? allGames.filter(g => (g.game || []).some(t => t.tableNum === tableSelected)).length || undefined
      : undefined;
    sessionManager.saveSession({
      sessionId: currentSessionId, tournamentId, tournamentName, gameMode,
      gameSelected, tableSelected, roles, playersActions, fouls, techFouls,
      removed, gamePhase, dayNumber, nightNumber, rolesDistributed,
      nightCheckHistory, votingHistory, bestMove, bestMoveAccepted,
      firstKilledPlayer, firstKilledEver, bestMoveSelected,
      winnerTeam, playerScores, gameFinished,
      protocolData, opinionData, opinionText, roomId,
      cityMode, funkyMode, manualMode, players, avatars,
      doctorHealHistory, nightMisses, killedOnNight,
      judgeNickname, judgeAvatar,
      killedCardPhase, protocolAccepted, killedPlayerBlink,
      nightPhase, nightChecks, dayVoteOuts,
      nominations, nominationOrder, nominationsLocked,
      discussionTimeLeft, freeSeatingTimeLeft,
      currentDaySpeakerIndex, daySpeakerStartNum, totalGamesInTournament, totalGamesForTable,
      gamesHistory,
    });
  }, [currentSessionId, tournamentId, tournamentName, gameMode, gameSelected, tableSelected, roles, playersActions, fouls, techFouls, removed, gamePhase, dayNumber, nightNumber, rolesDistributed, nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer, firstKilledEver, bestMoveSelected, winnerTeam, playerScores, gameFinished, protocolData, opinionData, opinionText, roomId, cityMode, funkyMode, manualMode, players, avatars, doctorHealHistory, nightMisses, killedOnNight, judgeNickname, judgeAvatar, killedCardPhase, protocolAccepted, killedPlayerBlink, nightPhase, nightChecks, dayVoteOuts, nominations, nominationOrder, nominationsLocked, discussionTimeLeft, freeSeatingTimeLeft, currentDaySpeakerIndex, daySpeakerStartNum, tournament, gamesHistory]);

  const loadSession = useCallback((sid, options) => {
    const s = sessionManager.getSession(sid);
    if (!s) return;
    setCurrentSessionId(s.sessionId);
    setTournamentId(s.tournamentId || ''); setTournamentName(s.tournamentName || '');
    setGameMode(s.gameMode || 'gomafia'); setGameSelected(s.gameSelected); setTableSelected(s.tableSelected);
    setRoles(s.roles || {}); setPlayersActions(s.playersActions || {});
    setFouls(s.fouls || {}); setTechFouls(s.techFouls || {});
    setRemoved(s.removed || {}); setGamePhase(s.gamePhase || 'roles');
    setDayNumber(s.dayNumber || 0); setNightNumber(s.nightNumber || 0);
    setRolesDistributed(s.rolesDistributed || false);
    setNightCheckHistory(s.nightCheckHistory || []); setVotingHistory(s.votingHistory || []);
    setBestMove(s.bestMove || []); setBestMoveAccepted(s.bestMoveAccepted || false);
    setFirstKilledPlayer(s.firstKilledPlayer || null);
    setFirstKilledEver(s.firstKilledEver || (!!s.firstKilledPlayer));
    setBestMoveSelected(s.bestMoveSelected || false);
    setWinnerTeam(s.winnerTeam || null); setPlayerScores(s.playerScores || {});
    setGameFinished(s.gameFinished || false);
    setViewOnly(options?.viewOnly || false);
    setProtocolData(s.protocolData || {}); setOpinionData(s.opinionData || {}); setOpinionText(s.opinionText || {});
    setRoomId(s.roomId || null); setCityMode(s.cityMode || false);
    setFunkyMode(s.funkyMode || false); setManualMode(s.manualMode || false);
    setPlayers(s.players || []); setAvatars(s.avatars || {});
    setDoctorHealHistory(s.doctorHealHistory || []);
    setNightMisses(s.nightMisses || {});
    setKilledOnNight(s.killedOnNight || {});
    setJudgeNickname(s.judgeNickname || '');
    setJudgeAvatar(s.judgeAvatar || '');
    setKilledCardPhase(s.killedCardPhase || {});
    setProtocolAccepted(s.protocolAccepted || {});
    setKilledPlayerBlink(s.killedPlayerBlink || {});
    setNightPhase(s.nightPhase || null);
    setNightChecks(s.nightChecks || {});
    setDayVoteOuts(s.dayVoteOuts || []);
    setNominations(s.nominations || {});
    setNominationOrder(s.nominationOrder || []);
    setNominationsLocked(s.nominationsLocked || false);
    if (s.discussionTimeLeft != null) setDiscussionTimeLeft(s.discussionTimeLeft);
    if (s.freeSeatingTimeLeft != null) setFreeSeatingTimeLeft(s.freeSeatingTimeLeft);
    if (s.currentDaySpeakerIndex != null) setCurrentDaySpeakerIndex(s.currentDaySpeakerIndex);
    if (s.daySpeakerStartNum != null) setDaySpeakerStartNum(s.daySpeakerStartNum);
    setGamesHistory(s.gamesHistory || []);
    setScreen('game');
    if (s.roomId) joinRoom(s.roomId);
  }, [joinRoom]);

  const resetGameState = useCallback(() => {
    setTournament(null); setTournamentId(''); setTournamentName('');
    setGameSelected(null); setTableSelected(null);
    setPlayers([]); setRoles({}); setPlayersActions({});
    setFouls({}); setTechFouls({}); setRemoved({}); setAvatars({});
    setGamePhase('roles'); setDayNumber(0); setNightNumber(0);
    setRolesDistributed(false); setEditRoles(true);
    setNightPhase(null); setNightChecks({}); setNightCheckHistory([]);
    setKilledOnNight({}); setNightMisses({}); setDayButtonBlink(false);
    setFirstKilledPlayer(null); setBestMove([]); setBestMoveAccepted(false);
    setBestMoveSelected(false); setFirstKilledEver(false);
    setKilledCardPhase({}); setKilledPlayerBlink({});
    setProtocolAccepted({}); setProtocolData({}); setOpinionData({}); setOpinionText({});
    setNominations({}); setNominationOrder([]); setNominationsLocked(false);
    setVotingOrder([]); setVotingCurrentIndex(0); setVotingResults({});
    setVotingFinished(false); setVotingWinners([]); setVotingHistory([]);
    setShowVotingModal(false); setDayVoteOuts({});
    setWinnerTeam(null); setPlayerScores({}); setGameFinished(false); setViewOnly(false);
    setHighlightedPlayer(null); setCurrentDaySpeakerIndex(-1); setDaySpeakerStartNum(1);
    setMainInfoText(''); setAdditionalInfoText('');
    setGamesHistory([]);
    timerModule.clearAllTimers();
  }, []);

  const startNewGame = useCallback(() => {
    saveCurrentSession();
    if (wsRef.current) wsRef.current.close();
    resetGameState();
    setCurrentSessionId(null);
    setScreen('modes');
  }, [saveCurrentSession, resetGameState]);

  const returnToMainMenu = useCallback(() => {
    saveCurrentSession();
    if (wsRef.current) wsRef.current.close();
    resetGameState(); setCurrentSessionId(null);
    setSessionsList(sessionManager.getSessions());
    setScreen('menu');
  }, [saveCurrentSession, resetGameState]);

  const startNewFunkyFromMenu = useCallback((sessionId) => {
    const s = sessionManager.getSession(sessionId);
    if (!s) return;

    saveCurrentSession();
    if (wsRef.current) wsRef.current.close();
    resetGameState();

    setCurrentSessionId(s.sessionId);
    setTournamentId(s.tournamentId || '');
    setTournamentName(s.tournamentName || '');
    setGameMode('funky');
    setFunkyMode(true);
    setManualMode(true);
    setGamesHistory(s.gamesHistory || []);

    const existingGames = s.gamesHistory || [];
    if (s.winnerTeam) {
      const snapshot = {
        gameNumber: existingGames.length + 1,
        gameSelected: s.gameSelected, tableSelected: s.tableSelected,
        players: [...(s.players || [])],
        roles: { ...(s.roles || {}) },
        playersActions: { ...(s.playersActions || {}) },
        fouls: { ...(s.fouls || {}) },
        techFouls: { ...(s.techFouls || {}) },
        removed: { ...(s.removed || {}) },
        avatars: { ...(s.avatars || {}) },
        dayNumber: s.dayNumber, nightNumber: s.nightNumber,
        nightCheckHistory: [...(s.nightCheckHistory || [])],
        votingHistory: [...(s.votingHistory || [])],
        bestMove: [...(s.bestMove || [])],
        bestMoveAccepted: s.bestMoveAccepted,
        firstKilledPlayer: s.firstKilledPlayer,
        winnerTeam: s.winnerTeam,
        playerScores: { ...(s.playerScores || {}) },
        protocolData: { ...(s.protocolData || {}) },
        opinionData: { ...(s.opinionData || {}) },
        opinionText: { ...(s.opinionText || {}) },
        doctorHealHistory: [...(s.doctorHealHistory || [])],
        nightMisses: { ...(s.nightMisses || {}) },
        killedOnNight: { ...(s.killedOnNight || {}) },
        dayVoteOuts: { ...(s.dayVoteOuts || {}) },
        cityMode: s.cityMode,
        completedAt: Date.now(),
      };
      setGamesHistory([...existingGames, snapshot]);
    }

    const playersArr = s.players || [];
    const preFilled = Array(10).fill(null).map((_, i) => playersArr[i] || null);
    setFunkyPlayers(preFilled);
    setFunkyPlayerInputs(preFilled.map(p => p ? p.login : ''));

    if (playersArr.length > 0) {
      const avatarMap = { ...(s.avatars || {}) };
      playersArr.forEach(p => { if (p.avatar_link) avatarMap[p.login] = p.avatar_link; });
      setAvatars(avatarMap);
    }

    setFunkyEditSessionId(s.sessionId);
    setScreen('modes');
    triggerHaptic('light');
  }, [saveCurrentSession, resetGameState]);

  const deleteSession = useCallback((sid) => {
    sessionManager.removeSession(sid);
    setSessionsList(sessionManager.getSessions());
  }, []);

  const archiveSeries = useCallback((tournamentId) => {
    sessionManager.archiveSeries(tournamentId);
    setSessionsList(sessionManager.getSessions());
    triggerHaptic('medium');
  }, []);

  const deleteSeries = useCallback((tournamentId) => {
    sessionManager.removeSeries(tournamentId);
    setSessionsList(sessionManager.getSessions());
    triggerHaptic('medium');
  }, []);

  // =================== Avatar Loading ===================
  const loadAvatars = useCallback(async (playerLogins) => {
    if (!playerLogins || playerLogins.length === 0) return;
    const logins = playerLogins.filter(Boolean);
    if (logins.length === 0) return;
    try {
      const cached = await goMafiaApi.getAvatarsCache(logins);
      const cachedMap = {};
      const missing = [];
      for (const login of logins) {
        if (cached && cached[login]) cachedMap[login] = cached[login];
        else missing.push(login);
      }
      if (Object.keys(cachedMap).length > 0) {
        setAvatars(prev => ({ ...prev, ...cachedMap }));
      }
      if (missing.length > 0) {
        const data = await goMafiaApi.getPlayersData(missing);
        if (data) {
          const newAvatars = {};
          (Array.isArray(data) ? data : [data]).forEach(p => {
            if (p?.login && p?.avatar_link) newAvatars[p.login] = p.avatar_link;
          });
          if (Object.keys(newAvatars).length > 0) {
            setAvatars(prev => ({ ...prev, ...newAvatars }));
            goMafiaApi.saveAvatarsCache({ ...cachedMap, ...newAvatars }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error('Avatar loading error:', e);
    }
  }, []);

  // =================== GoMafia Multi-Game/Table ===================
  const getGames = useCallback(() => {
    return tournament?.props?.pageProps?.serverData?.games || [];
  }, [tournament]);

  const getTables = useCallback((gameNum) => {
    const games = getGames();
    const game = games.find(g => g.gameNum === gameNum);
    return game?.game || [];
  }, [getGames]);

  const selectGameTable = useCallback((gameNum, tableNum) => {
    const tables = getTables(gameNum);
    const table = tables.find(t => t.tableNum === tableNum);
    if (!table) return;
    setGameSelected(gameNum);
    setTableSelected(tableNum);
    const newPlayers = (table.table || []).map((p, i) => ({
      ...p, num: i + 1,
      roleKey: `${gameNum}-${tableNum}-${i + 1}`,
    }));
    setPlayers(newPlayers);
    setRoles({});
    setPlayersActions({});
    setFouls({});
    setTechFouls({});
    setRemoved({});
    setNightCheckHistory([]);
    setVotingHistory([]);
    setBestMove([]);
    setBestMoveAccepted(false);
    setFirstKilledPlayer(null);
    setFirstKilledEver(false);
    setWinnerTeam(null);
    setPlayerScores({});
    setGamePhase('roles');
    setDayNumber(0);
    setNightNumber(0);
    setRolesDistributed(false);
    setEditRoles(true);
    setGameFinished(false);
    timerModule.clearAllTimers();
    const logins = newPlayers.map(p => p.login).filter(Boolean);
    if (logins.length > 0) loadAvatars(logins);
  }, [getTables, loadAvatars]);

  const startTournamentGameFromMenu = useCallback((tData, tId, tName, gameNum, tableNum) => {
    saveCurrentSession();
    if (wsRef.current) wsRef.current.close();
    resetGameState();

    setTournament(tData);
    setTournamentId(tId);
    setTournamentName(tName);
    setGameMode('gomafia');
    setGameSelected(gameNum);
    setTableSelected(tableNum);

    const games = tData?.props?.pageProps?.serverData?.games || [];
    const game = games.find(g => g.gameNum === gameNum);
    const table = game?.game?.find(t => t.tableNum === tableNum);

    if (table) {
      const newPlayers = (table.table || []).map((p, i) => ({
        ...p, num: i + 1,
        roleKey: `${gameNum}-${tableNum}-${i + 1}`,
      }));
      setPlayers(newPlayers);
      const logins = newPlayers.map(p => p.login).filter(Boolean);
      if (logins.length > 0) loadAvatars(logins);
    }

    joinRoom(tId, { skipInitialState: true });
    setCurrentSessionId(sessionManager.generateSessionId());
    setScreen('game');
    triggerHaptic('success');
  }, [saveCurrentSession, resetGameState, joinRoom, loadAvatars]);

  const startNextTournamentGame = useCallback(() => {
    saveGameToHistory();
    saveCurrentSession();
    const prevGame = gameSelected;
    const prevTable = tableSelected;
    setPlayedGameNums(prev => [...new Set([...prev, prevGame])]);

    setRoles({}); setPlayersActions({});
    setFouls({}); setTechFouls({}); setRemoved({});
    setGamePhase('roles'); setDayNumber(0); setNightNumber(0);
    setRolesDistributed(false); setEditRoles(true);
    setNightPhase(null); setNightChecks({}); setNightCheckHistory([]);
    setKilledOnNight({}); setNightMisses({}); setDayButtonBlink(false);
    setFirstKilledPlayer(null); setBestMove([]); setBestMoveAccepted(false);
    setBestMoveSelected(false); setFirstKilledEver(false);
    setKilledCardPhase({}); setKilledPlayerBlink({});
    setProtocolAccepted({}); setProtocolData({}); setOpinionData({}); setOpinionText({});
    setNominations({}); setNominationOrder([]); setNominationsLocked(false);
    setVotingOrder([]); setVotingCurrentIndex(0); setVotingResults({});
    setVotingFinished(false); setVotingWinners([]); setVotingHistory([]);
    setShowVotingModal(false); setDayVoteOuts({});
    setWinnerTeam(null); setPlayerScores({}); setGameFinished(false);
    setHighlightedPlayer(null); setCurrentDaySpeakerIndex(-1);
    setDoctorHeal(null); setDoctorHealHistory([]); setDoctorLastHealTarget(null);
    timerModule.clearAllTimers();

    const games = getGames();
    const nextGameNum = (prevGame || 0) + 1;
    const nextGame = games.find(g => g.gameNum === nextGameNum);
    if (nextGame) {
      const table = nextGame.game?.find(t => t.tableNum === prevTable) || nextGame.game?.[0];
      if (table) {
        const tn = table.tableNum;
        setGameSelected(nextGameNum);
        setTableSelected(tn);
        const newPlayers = (table.table || []).map((p, i) => ({
          ...p, num: i + 1,
          roleKey: `${nextGameNum}-${tn}-${i + 1}`,
        }));
        setPlayers(newPlayers);
        const logins = newPlayers.map(p => p.login).filter(Boolean);
        if (logins.length > 0) loadAvatars(logins);
      }
    }
    setCurrentSessionId(sessionManager.generateSessionId());
    setActiveTab('table');
  }, [saveGameToHistory, saveCurrentSession, gameSelected, tableSelected, getGames, loadAvatars]);

  // Load sessions on mount + sync with server
  useEffect(() => {
    setSessionsList(sessionManager.getSessions());
    const token = authService.getStoredToken();
    if (token) {
      sessionManager.setAuthToken(token);
      sessionManager.syncWithServer().then(() => {
        setSessionsList(sessionManager.getSessions());
      });
    }
  }, []);

  // =================== Day Speaker Flow ===================
  const activePlayers = useMemo(() => {
    return tableOut.filter(p => isPlayerActive(p.roleKey));
  }, [tableOut, isPlayerActive]);

  const startDaySpeakerFlow = useCallback(() => {
    if (activePlayers.length === 0) return;
    const startIdx = activePlayers.findIndex(p => p.num === daySpeakerStartNum);
    setCurrentDaySpeakerIndex(startIdx >= 0 ? startIdx : 0);
    triggerHaptic('light');
  }, [activePlayers, daySpeakerStartNum]);

  const nextDaySpeaker = useCallback(() => {
    const startIdx = activePlayers.findIndex(p => p.num === daySpeakerStartNum);
    const actualStart = startIdx >= 0 ? startIdx : 0;
    const nextIdx = currentDaySpeakerIndex + 1;
    const wrappedIdx = nextIdx % activePlayers.length;

    if (wrappedIdx === actualStart && nextIdx > 0) {
      setCurrentDaySpeakerIndex(-1);
      setShowGoToNightPrompt(true);
      triggerHaptic('medium');
    } else {
      setCurrentDaySpeakerIndex(wrappedIdx);
      const nextPlayer = activePlayers[wrappedIdx];
      if (nextPlayer) {
        setAutoExpandPlayer(nextPlayer.roleKey);
        setAutoStartTimerRK(nextPlayer.roleKey);
      }
      triggerHaptic('selection');
    }
  }, [currentDaySpeakerIndex, activePlayers, daySpeakerStartNum]);

  const currentSpeaker = useMemo(() => {
    if (currentDaySpeakerIndex < 0 || currentDaySpeakerIndex >= activePlayers.length) return null;
    return activePlayers[currentDaySpeakerIndex];
  }, [currentDaySpeakerIndex, activePlayers]);

  // =================== Voting Timers ===================
  useEffect(() => {
    if (!votingLastSpeechActive || !votingLastSpeechRunning) {
      if (votingLastSpeechIntervalRef.current) { clearInterval(votingLastSpeechIntervalRef.current); votingLastSpeechIntervalRef.current = null; }
      return;
    }
    votingLastSpeechIntervalRef.current = setInterval(() => {
      setVotingLastSpeechTimeLeft(prev => {
        if (prev <= 1) {
          setVotingLastSpeechRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (votingLastSpeechIntervalRef.current) clearInterval(votingLastSpeechIntervalRef.current); };
  }, [votingLastSpeechActive, votingLastSpeechRunning]);

  const advanceTieSpeaker = useCallback(() => {
    setVotingTieSpeakerIdx(idx => {
      const next = idx + 1;
      if (next >= votingTiePlayers.length) {
        setVotingTieAllDone(true);
        return idx;
      }
      return next;
    });
  }, [votingTiePlayers.length]);


  const startVotingLastSpeechTimer = useCallback((playerIdx = 0) => {
    setVotingLastSpeechTimeLeft(60);
    setVotingLastSpeechPlayerIdx(playerIdx);
    setVotingLastSpeechRunning(true);
    triggerHaptic('medium');
  }, []);

  // =================== Tournament Browser ===================
  const loadTournamentsList = useCallback(async (page = 1, append = false) => {
    setTournamentsLoading(true);
    try {
      const params = { ...tournamentsFilters, page: String(page) };
      const data = await goMafiaApi.getTournamentsList(params);
      const raw = data?.tournaments ?? data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      setTournamentsList(prev => append ? [...prev, ...list] : list);
      setTournamentsHasMore(data?.hasMore || false);
      setTournamentsPage(page);
    } catch (e) {
      console.error('Tournament list error:', e);
      setTournamentsList([]);
    } finally {
      setTournamentsLoading(false);
    }
  }, [tournamentsFilters]);

  // =================== Auto-save on phase/data changes ===================
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!currentSessionId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentSession();
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [gamePhase, dayNumber, nightNumber, winnerTeam, JSON.stringify(playersActions), JSON.stringify(roles), gamesHistory.length]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSessionId) {
        const now = Date.now();
        const data = {
          sessionId: currentSessionId, tournamentId, tournamentName, gameMode,
          gameSelected, tableSelected, roles, playersActions, fouls, techFouls,
          removed, gamePhase, dayNumber, nightNumber, rolesDistributed,
          nightCheckHistory, votingHistory, bestMove, bestMoveAccepted,
          firstKilledPlayer, winnerTeam, playerScores, gameFinished,
          protocolData, opinionData, opinionText, roomId,
          cityMode, funkyMode, manualMode, players, avatars,
          doctorHealHistory, nightMisses, killedOnNight,
          judgeNickname, judgeAvatar,
          gamesHistory,
          updatedAt: now, timestamp: now,
        };
        sessionManager.saveSession(data);
        const beaconPayload = sessionManager.buildBeaconPayload();
        if (beaconPayload) {
          const blob = new Blob([beaconPayload], { type: 'application/json' });
          navigator.sendBeacon?.('/api/sessions-sync.php', blob);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSessionId, tournamentId, tournamentName, gameMode, gameSelected, tableSelected, roles, playersActions, fouls, techFouls, removed, gamePhase, dayNumber, nightNumber, rolesDistributed, nightCheckHistory, votingHistory, bestMove, bestMoveAccepted, firstKilledPlayer, winnerTeam, playerScores, gameFinished, protocolData, opinionData, opinionText, roomId, cityMode, funkyMode, manualMode, players, avatars, doctorHealHistory, nightMisses, killedOnNight, judgeNickname, judgeAvatar, gamesHistory]);

  // =================== Visibility handling ===================
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        document.body.classList.add('page-hidden');
      } else {
        document.body.classList.remove('page-hidden');
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // =================== Phase Label ===================
  const getPhaseLabel = useCallback(() => {
    if (gamePhase === 'roles') return 'Раздача ролей';
    if (gamePhase === 'discussion') return cityMode ? 'Знакомство' : 'Договорка';
    if (gamePhase === 'freeSeating') return 'Свободная посадка';
    if (gamePhase === 'day') return dayNumber === 0 ? 'День 0' : `День ${dayNumber}`;
    if (gamePhase === 'night') return `Ночь ${nightNumber}`;
    if (gamePhase === 'results') return 'Итоги';
    return '';
  }, [gamePhase, dayNumber, nightNumber, cityMode]);

  const getDaySubtitle = useCallback(() => {
    if (dayNumber === 1) return nightMisses[1] ? 'Десятка' : 'Девятка';
    if (dayNumber === 0) return 'Нулевой круг';
    return '';
  }, [dayNumber, nightMisses]);

  // =================== Context Value ===================
  const value = {
    // Navigation
    screen, setScreen, activeTab, setActiveTab,
    // Tournament
    tournament, setTournament, tournamentId, setTournamentId,
    tournamentName, setTournamentName,
    gameSelected, setGameSelected, tableSelected, setTableSelected,
    playedGameNums, setPlayedGameNums,
    // Session
    currentSessionId, setCurrentSessionId, sessionsList, setSessionsList,
    // Mode
    gameMode, setGameMode, cityMode, setCityMode, funkyMode, setFunkyMode, manualMode, setManualMode,
    // Players
    players, setPlayers, tableOut, roles, setRoles, roleSet,
    playersActions, setPlayersActions, fouls, setFouls, techFouls, setTechFouls,
    removed, setRemoved, avatars, setAvatars, isPlayerActive, actionSet,
    // Phase
    gamePhase, setGamePhase, dayNumber, setDayNumber, nightNumber, setNightNumber,
    rolesDistributed, setRolesDistributed, editRoles, setEditRoles,
    validateRoles, confirmRolesDistribution,
    advanceFromDiscussion, advanceFromFreeSeating, setMode, handleGoToNight,
    getPhaseLabel, getDaySubtitle,
    // Discussion/FreeSeating
    discussionTimeLeft, setDiscussionTimeLeft, discussionRunning,
    startDiscussionTimer, stopDiscussionTimer,
    freeSeatingTimeLeft, setFreeSeatingTimeLeft, freeSeatingRunning,
    startFreeSeatingTimer, stopFreeSeatingTimer,
    // Night
    nightPhase, setNightPhase, nightChecks, setNightChecks,
    nightCheckHistory, setNightCheckHistory,
    killedOnNight, nightMisses, setNightMiss, dayButtonBlink, setDayButtonBlink,
    startNightSequence, advanceNightPhase, performNightCheck,
    findRoleKey, wasKilledBeforeThisNight,
    // Doctor
    doctorHeal, setDoctorHeal, doctorHealHistory, doctorLastHealTarget,
    performDoctorHeal, canDoctorHealTarget,
    // Kill
    killPlayer,
    // Fouls
    addFoul, removeFoul, addTechFoul, removeTechFoul,
    // Best Move
    firstKilledPlayer, setFirstKilledPlayer, bestMove, setBestMove,
    bestMoveAccepted, setBestMoveAccepted, bestMoveSelected, setBestMoveSelected,
    firstKilledEver, toggleBestMove, acceptBestMove, canShowBestMove,
    // Killed Card
    killedCardPhase, setKilledCardPhase, killedPlayerBlink, setKilledPlayerBlink,
    protocolAccepted, setProtocolAccepted,
    // Protocol/Opinion
    protocolData, setProtocolData, opinionData, setOpinionData, opinionText, setOpinionText,
    toggleProtocolRole, toggleOpinionRole, checkProtocol, checkOpinion,
    // Voting
    nominations, setNominations, nominationsLocked, setNominationsLocked,
    votingOrder, setVotingOrder, votingCurrentIndex, setVotingCurrentIndex,
    votingResults, setVotingResults, votingVotedPlayers,
    votingFinished, setVotingFinished, votingWinners, setVotingWinners,
    votingStage, setVotingStage, votingTiePlayers, setVotingTiePlayers,
    votingLiftResults, setVotingLiftResults,
    votingHistory, setVotingHistory, showVotingModal, setShowVotingModal,
    votingScreenTab, setVotingScreenTab, currentVotingSession,
    dayVoteOuts, cityVoteCounts, setCityVoteCounts,
    votingDay0SingleCandidate, votingDay0TripleTie, votingDay0TripleTiePlayers,
    dismissDay0VotingAndGoToNight,
    getNominatedCandidates, toggleNomination, startVoting, toggleVotingSelection,
    acceptCurrentCandidateVotes, startTieVoting, startLiftVoting, updateVotingOrder,
    toggleLiftVote, finishLiftVoting, closeVotingAndApply,
    // Voting Timers
    votingTieTimerActive, setVotingTieTimerActive,
    votingTieSpeakerIdx, setVotingTieSpeakerIdx,
    votingTieAllDone, setVotingTieAllDone,
    advanceTieSpeaker,
    votingLastSpeechActive, setVotingLastSpeechActive,
    votingLastSpeechTimeLeft, setVotingLastSpeechTimeLeft,
    votingLastSpeechRunning, setVotingLastSpeechRunning,
    votingLastSpeechPlayerIdx, setVotingLastSpeechPlayerIdx,
    // Scores
    winnerTeam, setWinnerTeam, playerScores, setPlayerScores,
    gameFinished, setGameFinished, viewOnly, setViewOnly,
    calculatePlayerScore, adjustScore, toggleReveal, computeAutoScores,
    // Broadcast
    mainInfoText, setMainInfoText, additionalInfoText, setAdditionalInfoText,
    mainInfoVisible, setMainInfoVisible, additionalInfoVisible, setAdditionalInfoVisible,
    hideSeating, setHideSeating, hideLeaveOrder, setHideLeaveOrder,
    hideRolesStatus, setHideRolesStatus, hideBestMove, setHideBestMove,
    highlightedPlayer, setHighlightedPlayer,
    autoExpandPlayer, setAutoExpandPlayer,
    autoStartTimerRK, setAutoStartTimerRK,
    expandedCardRK, setExpandedCardRK,
    // Room/WS
    roomId, setRoomId, joinRoom, syncState, roomInput, setRoomInput,
    // Day Speaker
    currentDaySpeakerIndex, setCurrentDaySpeakerIndex,
    daySpeakerStartNum,
    showGoToNightPrompt, setShowGoToNightPrompt,
    showNoVotingAlert, setShowNoVotingAlert,
    // Funky
    funkyPlayers, setFunkyPlayers, funkyPlayerInputs, setFunkyPlayerInputs,
    funkyGameNumber, setFunkyGameNumber,
    funkyEditSessionId, setFunkyEditSessionId, startNewFunkyFromMenu,
    // Theme
    selectedColorScheme, setSelectedColorScheme, darkMode, setDarkMode,
    // Judge
    judgeNickname, setJudgeNickname, judgeAvatar, setJudgeAvatar,
    // Tournament Browser
    tournamentsList, setTournamentsList, tournamentsLoading, setTournamentsLoading,
    tournamentsFilters, setTournamentsFilters, tournamentsHasMore, setTournamentsHasMore,
    tournamentsPage, setTournamentsPage,
    // Session
    saveCurrentSession, loadSession, resetGameState, startNewGame, returnToMainMenu, deleteSession, archiveSeries, deleteSeries,
    startNextTournamentGame, startTournamentGameFromMenu, saveSummaryToServer,
    // Games History
    gamesHistory, currentGameNumber, saveGameToHistory, startNextGameInSession,
    // Avatars
    loadAvatars,
    // Multi-Game/Table
    getGames, getTables, selectGameTable,
    // Day Speaker
    activePlayers, startDaySpeakerFlow, nextDaySpeaker, currentSpeaker,
    // Voting Timers
    startVotingLastSpeechTimer,
    // Tournament Browser
    loadTournamentsList,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => useContext(GameContext);
