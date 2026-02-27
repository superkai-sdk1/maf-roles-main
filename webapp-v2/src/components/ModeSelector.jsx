import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { goMafiaApi } from '../services/api';
import { sessionManager } from '../services/sessionManager';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionGate } from './SubscriptionGate';
import {
  CITY_ROLES_ALL, CITY_OPTIONAL_ROLES, getCityActiveRoles,
} from '../constants/roles';
import {
  IconTrophy, IconDice, IconCity, IconDownload, IconGoMafia,
  IconArrowLeft, IconArrowRight, IconShuffle, IconCheck, IconX,
  IconChevronRight, IconClock, IconScroll, IconMapPin, IconWifi, IconStar,
  IconSearch, IconGripVertical, IconCrown, IconGlobe, IconLock, IconPlus,
  IconTrash,
} from '../utils/icons';

export function ModeSelector() {
  const {
    setScreen, setGameMode, setPlayers, setTournament, setTournamentId, setTournamentName,
    setGameSelected, setTableSelected, setCityMode, setFunkyMode, setManualMode,
    setCurrentSessionId, returnToMainMenu,
    funkyPlayers, setFunkyPlayers, funkyPlayerInputs, setFunkyPlayerInputs,
    funkyGameNumber, setFunkyGameNumber,
    funkyEditSessionId, setFunkyEditSessionId,
    gamesHistory,
    loadAvatars, setAvatars, setRoles, setRolesDistributed,
    loadTournamentsList, tournamentsList, tournamentsLoading, tournamentsFilters, setTournamentsFilters,
    tournamentsHasMore, tournamentsPage,
    setPlayedGameNums,
  } = useGame();

  const [step, setStep] = useState('modes');
  const [gateFeature, setGateFeature] = useState(null);
  const gomafiaSub = useSubscription('gomafia');
  const funkySub = useSubscription('funky');
  const citySub = useSubscription('city_mafia');
  const [tournamentInput, setTournamentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSlot, setActiveSlot] = useState(-1);
  const [tournamentData, setTournamentData] = useState(null);
  const searchTimeoutRef = useRef(null);

  // GoMafia table/game selection state
  const [gmSelectedTable, setGmSelectedTable] = useState(null);
  const [gmSelectedGame, setGmSelectedGame] = useState(null);
  const [gmTableOpen, setGmTableOpen] = useState(false);
  const [gmGameOpen, setGmGameOpen] = useState(false);

  // City mode state
  const [cityCount, setCityCount] = useState(10);
  const [cityStep, setCityStep] = useState('count');
  const [cityPlayers, setCityPlayers] = useState([]);
  const [cityPlayerInputs, setCityPlayerInputs] = useState([]);
  const [citySearchResults, setCitySearchResults] = useState([]);
  const [cityActiveInput, setCityActiveInput] = useState(-1);
  const [cityRoleToggles, setCityRoleToggles] = useState({});
  const [cityAssignedRoles, setCityAssignedRoles] = useState({});
  const citySearchTimeoutRef = useRef(null);

  // Drag state for funky
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const touchStartYRef = useRef(null);
  const touchStartIndexRef = useRef(null);
  const playerListRef = useRef(null);

  // Drag state for city
  const [cityDragIndex, setCityDragIndex] = useState(null);
  const [cityDragOverIndex, setCityDragOverIndex] = useState(null);

  useEffect(() => {
    if (funkyEditSessionId) {
      setStep('funky');
    }
  }, [funkyEditSessionId]);

  // ===== GoMafia =====
  const loadTournament = async () => {
    if (!tournamentInput.trim()) return;
    setLoading(true); setError('');
    try {
      const data = await goMafiaApi.getTournament(tournamentInput.trim());
      setTournament(data);
      setTournamentId(tournamentInput.trim());
      setTournamentName(data._pageTitle || 'Турнир');
      setTournamentData(data);
      openGameSelect(data);
      triggerHaptic('selection');
    } catch (e) {
      setError('Ошибка загрузки турнира: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  const onSelectTable = (tableNum) => {
    setGmSelectedTable(tableNum);
    setGmSelectedGame(null);
    setGmTableOpen(false);
    triggerHaptic('selection');

    const availableGames = getGamesForTable(tournamentData, tableNum);
    if (availableGames.length === 1) {
      setGmSelectedGame(availableGames[0]);
    }
  };

  const onSelectGame = (gameNum) => {
    setGmSelectedGame(gameNum);
    setGmGameOpen(false);
    triggerHaptic('selection');
  };

  // ===== Funky Mode =====
  const initFunky = () => {
    setStep('funky');
    setFunkyPlayers(Array(10).fill(null));
    setFunkyPlayerInputs(Array(10).fill(''));
  };

  const searchPlayer = async (idx, query) => {
    const inputs = [...funkyPlayerInputs];
    inputs[idx] = query;
    setFunkyPlayerInputs(inputs);
    setActiveSlot(idx);
    if (query.trim().length < 1) { setSearchResults([]); return; }
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await goMafiaApi.searchPlayers(query.trim());
        const taken = funkyPlayers.filter(Boolean).map(p => p.login);
        setSearchResults(results.filter(r => !taken.includes(r.login)));
      } catch { setSearchResults([]); }
    }, 300);
  };

  const selectPlayer = (idx, player) => {
    const next = [...funkyPlayers];
    next[idx] = { login: player.login, avatar_link: player.avatar_link, id: player.id, num: idx + 1, roleKey: `1-1-${idx + 1}` };
    setFunkyPlayers(next);
    const inputs = [...funkyPlayerInputs];
    inputs[idx] = player.login;
    setFunkyPlayerInputs(inputs);
    setSearchResults([]); setActiveSlot(-1);
    if (player.avatar_link) {
      setAvatars(prev => ({ ...prev, [player.login]: player.avatar_link }));
    }
    triggerHaptic('selection');
  };

  const clearSlot = (idx) => {
    const next = [...funkyPlayers]; next[idx] = null; setFunkyPlayers(next);
    const inputs = [...funkyPlayerInputs]; inputs[idx] = ''; setFunkyPlayerInputs(inputs);
  };

  const funkyShufflePlayers = () => {
    const filled = funkyPlayers.filter(Boolean);
    if (filled.length < 10) return;
    const shuffled = [...filled];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const reIndexed = shuffled.map((p, i) => ({ ...p, num: i + 1, roleKey: `1-1-${i + 1}` }));
    setFunkyPlayers(reIndexed);
    setFunkyPlayerInputs(reIndexed.map(p => p.login));
    triggerHaptic('medium');
  };

  const setFunkyManualPlayer = (idx) => {
    const name = funkyPlayerInputs[idx];
    if (!name || !name.trim()) return;
    if (funkyPlayers.find(p => p && p.login === name.trim())) return;
    const next = [...funkyPlayers];
    next[idx] = { login: name.trim(), avatar_link: null, id: null, num: idx + 1, roleKey: `1-1-${idx + 1}` };
    setFunkyPlayers(next);
    setSearchResults([]); setActiveSlot(-1);
  };

  const confirmFunkyPlayers = () => {
    const filled = funkyPlayers.filter(Boolean);
    if (filled.length < 10) return;

    const gameNum = funkyEditSessionId ? gamesHistory.length + 1 : 1;
    const newPlayers = filled.map((p, i) => ({
      ...p, num: i + 1, roleKey: `${gameNum}-1-${i + 1}`,
    }));
    setPlayers(newPlayers);
    setFunkyMode(true); setManualMode(true); setGameMode('funky');

    const logins = newPlayers.map(p => p.login).filter(Boolean);
    if (logins.length > 0) loadAvatars(logins);

    if (funkyEditSessionId) {
      setFunkyEditSessionId(null);
    } else {
      setTournamentId('funky_' + Date.now());
      setTournamentName(`Фанки #${funkyGameNumber} ${new Date().toLocaleDateString('ru-RU')}`);
      setCurrentSessionId(sessionManager.generateSessionId());
    }

    setScreen('game');
    triggerHaptic('success');
  };

  // ===== Funky Drag & Drop =====
  const handleFunkyDragStart = useCallback((idx, e) => {
    if (!funkyPlayers[idx]) return;
    setDragIndex(idx);
    if (e.type === 'touchstart') {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartIndexRef.current = idx;
    }
    triggerHaptic('light');
  }, [funkyPlayers]);

  const handleFunkyDragOver = useCallback((idx) => {
    if (dragIndex === null || dragIndex === idx) return;
    setDragOverIndex(idx);
  }, [dragIndex]);

  const handleFunkyDrop = useCallback((idx) => {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newPlayers = [...funkyPlayers];
    const newInputs = [...funkyPlayerInputs];
    const [movedPlayer] = newPlayers.splice(dragIndex, 1);
    const [movedInput] = newInputs.splice(dragIndex, 1);
    newPlayers.splice(idx, 0, movedPlayer);
    newInputs.splice(idx, 0, movedInput);
    const reIndexed = newPlayers.map((p, i) => p ? { ...p, num: i + 1, roleKey: `1-1-${i + 1}` } : null);
    setFunkyPlayers(reIndexed);
    setFunkyPlayerInputs(newInputs);
    setDragIndex(null);
    setDragOverIndex(null);
    triggerHaptic('medium');
  }, [dragIndex, funkyPlayers, funkyPlayerInputs]);

  const handleFunkyDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // Swipe-to-delete state for city
  const [citySwipeOffsets, setCitySwipeOffsets] = useState({});
  const [citySwipeDeleting, setCitySwipeDeleting] = useState(null);
  const cityTouchStartRef = useRef({});

  // ===== City Mode (multi-step) =====
  const initCity = () => {
    setStep('city');
    setCityStep('players');
    const count = 10;
    setCityCount(count);
    setCityPlayers(Array(count).fill(null));
    setCityPlayerInputs(Array(count).fill(''));
    setCityRoleToggles({});
    setCityAssignedRoles({});
    setCitySwipeOffsets({});
  };

  const cityAddPlayer = () => {
    if (cityPlayers.length >= 30) return;
    setCityPlayers(prev => [...prev, null]);
    setCityPlayerInputs(prev => [...prev, '']);
    setCityCount(prev => prev + 1);
    triggerHaptic('light');
  };

  const cityRemovePlayerRow = (index) => {
    if (cityPlayers.length <= 8) return;
    setCitySwipeDeleting(index);
    triggerHaptic('medium');
    setTimeout(() => {
      setCityPlayers(prev => {
        const next = prev.filter((_, i) => i !== index);
        return next.map((p, i) => p ? { ...p, num: i + 1, roleKey: `1-1-${i + 1}` } : null);
      });
      setCityPlayerInputs(prev => prev.filter((_, i) => i !== index));
      setCityCount(prev => prev - 1);
      setCitySwipeOffsets(prev => {
        const next = {};
        Object.keys(prev).forEach(k => {
          const ki = parseInt(k);
          if (ki < index) next[ki] = prev[ki];
          else if (ki > index) next[ki - 1] = prev[ki];
        });
        return next;
      });
      setCitySwipeDeleting(null);
    }, 300);
  };

  const handleCitySwipeStart = useCallback((index, e) => {
    const touch = e.touches[0];
    cityTouchStartRef.current[index] = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleCitySwipeMove = useCallback((index, e) => {
    const start = cityTouchStartRef.current[index];
    if (!start) return;
    const touch = e.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return;
    if (dx < 0) {
      e.preventDefault();
      const offset = Math.max(dx, -100);
      setCitySwipeOffsets(prev => ({ ...prev, [index]: offset }));
    }
  }, []);

  const handleCitySwipeEnd = useCallback((index) => {
    const offset = citySwipeOffsets[index] || 0;
    if (offset < -60 && cityPlayers.length > 8) {
      cityRemovePlayerRow(index);
    } else {
      setCitySwipeOffsets(prev => ({ ...prev, [index]: 0 }));
    }
    delete cityTouchStartRef.current[index];
  }, [citySwipeOffsets, cityPlayers.length]);

  const cityToggleRole = (roleKey) => {
    const current = cityRoleToggles[roleKey] || false;
    const newToggles = { ...cityRoleToggles, [roleKey]: !current };
    const count = cityPlayers.length;
    const activeRoles = getCityActiveRoles(count, newToggles);
    if (activeRoles.length > count) return;
    setCityRoleToggles(newToggles);
    triggerHaptic('selection');
  };

  const citySearchPlayer = async (index, query) => {
    const inputs = [...cityPlayerInputs];
    inputs[index] = query;
    setCityPlayerInputs(inputs);
    setCityActiveInput(index);
    if (!query || query.trim().length < 1) { setCitySearchResults([]); return; }
    clearTimeout(citySearchTimeoutRef.current);
    citySearchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await goMafiaApi.searchPlayers(query.trim());
        const taken = cityPlayers.filter(Boolean).map(p => p.login);
        setCitySearchResults(results.filter(r => !taken.includes(r.login)));
      } catch { setCitySearchResults([]); }
    }, 300);
  };

  const citySelectPlayer = (index, player) => {
    const next = [...cityPlayers];
    next[index] = { login: player.login, avatar_link: player.avatar_link || null, id: player.id, num: index + 1, roleKey: `1-1-${index + 1}` };
    setCityPlayers(next);
    const inputs = [...cityPlayerInputs];
    inputs[index] = player.login;
    setCityPlayerInputs(inputs);
    setCitySearchResults([]); setCityActiveInput(-1);
    if (player.avatar_link) setAvatars(prev => ({ ...prev, [player.login]: player.avatar_link }));
    triggerHaptic('light');
  };

  const citySetManualPlayer = (index) => {
    const name = cityPlayerInputs[index];
    if (!name || !name.trim()) return;
    if (cityPlayers.find(p => p && p.login === name.trim())) return;
    const next = [...cityPlayers];
    next[index] = { login: name.trim(), avatar_link: null, id: null, num: index + 1, roleKey: `1-1-${index + 1}` };
    setCityPlayers(next);
    setCitySearchResults([]); setCityActiveInput(-1);
  };

  const cityClearPlayer = (index) => {
    const next = [...cityPlayers]; next[index] = null; setCityPlayers(next);
    const inputs = [...cityPlayerInputs]; inputs[index] = ''; setCityPlayerInputs(inputs);
    setCitySearchResults([]);
    setCitySwipeOffsets(prev => ({ ...prev, [index]: 0 }));
  };

  const cityShufflePlayers = () => {
    if (!cityPlayers.every(p => p !== null)) return;
    const shuffled = [...cityPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const reIdx = shuffled.map((p, i) => ({ ...p, num: i + 1, roleKey: `1-1-${i + 1}` }));
    setCityPlayers(reIdx);
    setCityPlayerInputs(reIdx.map(p => p.login));
    triggerHaptic('medium');
  };

  // City drag & drop
  const handleCityDragStart = useCallback((idx) => {
    if (!cityPlayers[idx]) return;
    setCityDragIndex(idx);
    triggerHaptic('light');
  }, [cityPlayers]);

  const handleCityDragOver = useCallback((idx) => {
    if (cityDragIndex === null || cityDragIndex === idx) return;
    setCityDragOverIndex(idx);
  }, [cityDragIndex]);

  const handleCityDrop = useCallback((idx) => {
    if (cityDragIndex === null || cityDragIndex === idx) {
      setCityDragIndex(null); setCityDragOverIndex(null);
      return;
    }
    const newPlayers = [...cityPlayers];
    const newInputs = [...cityPlayerInputs];
    const [movedP] = newPlayers.splice(cityDragIndex, 1);
    const [movedI] = newInputs.splice(cityDragIndex, 1);
    newPlayers.splice(idx, 0, movedP);
    newInputs.splice(idx, 0, movedI);
    const reIdx = newPlayers.map((p, i) => p ? { ...p, num: i + 1, roleKey: `1-1-${i + 1}` } : null);
    setCityPlayers(reIdx);
    setCityPlayerInputs(newInputs);
    setCityDragIndex(null); setCityDragOverIndex(null);
    triggerHaptic('medium');
  }, [cityDragIndex, cityPlayers, cityPlayerInputs]);

  const handleCityDragEnd = useCallback(() => {
    setCityDragIndex(null); setCityDragOverIndex(null);
  }, []);

  const cityGoToRolesAssign = () => {
    if (!cityPlayers.every(p => p !== null)) return;
    setCityCount(cityPlayers.length);
    if (cityPlayers.length >= 17) {
      setCityAssignedRoles({});
      setCityStep('roles_config');
    } else {
      setCityAssignedRoles({});
      setCityStep('roles_assign');
    }
    triggerHaptic('medium');
  };

  const cityAutoAssignRoles = () => {
    const count = cityPlayers.length;
    const activeRoles = getCityActiveRoles(count, cityRoleToggles);
    const shuffled = [...activeRoles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const assigned = {};
    for (let i = 0; i < count; i++) {
      assigned[i] = shuffled[i] || 'peace';
    }
    setCityAssignedRoles(assigned);
    triggerHaptic('medium');
  };

  const cityGetAvailableRoles = (playerIndex) => {
    const activeRoles = getCityActiveRoles(cityPlayers.length, cityRoleToggles);
    const roleCounts = {};
    activeRoles.forEach(r => { roleCounts[r] = (roleCounts[r] || 0) + 1; });
    const assignedCounts = {};
    Object.entries(cityAssignedRoles).forEach(([idx, role]) => {
      if (parseInt(idx) !== playerIndex && role) assignedCounts[role] = (assignedCounts[role] || 0) + 1;
    });
    const available = [];
    const added = new Set();
    Object.entries(roleCounts).forEach(([role, needed]) => {
      const used = assignedCounts[role] || 0;
      if (used < needed && !added.has(role)) {
        const info = CITY_ROLES_ALL[role];
        available.push({ id: role, label: info?.label || role, team: info?.team || 'red' });
        added.add(role);
      }
    });
    return available;
  };

  const cityValidateRoles = () => {
    const count = cityPlayers.length;
    const activeRoles = getCityActiveRoles(count, cityRoleToggles);
    const assigned = Object.values(cityAssignedRoles);
    if (assigned.length !== count) return false;
    if (assigned.some(r => !r)) return false;
    const needed = {}; activeRoles.forEach(r => { needed[r] = (needed[r] || 0) + 1; });
    const got = {}; assigned.forEach(r => { got[r] = (got[r] || 0) + 1; });
    for (const role in needed) { if ((got[role] || 0) !== needed[role]) return false; }
    return true;
  };

  const confirmCityPlayers = () => {
    if (!cityValidateRoles()) return;
    const finalPlayers = cityPlayers.map((p, i) => ({ ...p, num: i + 1, roleKey: `1-1-${i + 1}` }));
    setPlayers(finalPlayers);
    const newRoles = {};
    for (let i = 0; i < finalPlayers.length; i++) {
      const roleId = cityAssignedRoles[i] || 'peace';
      newRoles[finalPlayers[i].roleKey] = roleId === 'mafia' ? 'black' : roleId;
    }
    setRoles(newRoles);
    setCityMode(true); setManualMode(true); setGameMode('city');

    const logins = finalPlayers.map(p => p.login).filter(Boolean);
    if (logins.length > 0) loadAvatars(logins);

    setTournamentId('city_' + Date.now());
    setTournamentName('Городская мафия ' + new Date().toLocaleDateString('ru-RU'));
    setCurrentSessionId(sessionManager.generateSessionId());
    setScreen('game');
    triggerHaptic('success');
  };

  // ===== Tournament Browser =====
  const openBrowser = () => {
    setStep('browser');
    loadTournamentsList(1);
  };

  const applyFilter = (key, value) => {
    setTournamentsFilters(f => ({ ...f, [key]: value }));
    triggerHaptic('selection');
    setTimeout(() => loadTournamentsList(1), 50);
  };

  const onSearchInput = (value) => {
    setTournamentsFilters(f => ({ ...f, search: value }));
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => loadTournamentsList(1), 400);
  };

  const isTournamentSeatingReady = (t) => {
    if (!t) return false;
    return t._hasSeating === true && typeof t._elo === 'number' && t._elo >= 100;
  };

  const getUniqueTables = (data) => {
    const games = data?.props?.pageProps?.serverData?.games || [];
    const tableSet = new Set();
    games.forEach(g => g.game?.forEach(t => tableSet.add(t.tableNum)));
    return [...tableSet].sort((a, b) => a - b);
  };

  const getGamesForTable = (data, tableNum) => {
    const games = data?.props?.pageProps?.serverData?.games || [];
    return games
      .filter(g => g.game?.some(t => t.tableNum === tableNum))
      .map(g => g.gameNum)
      .sort((a, b) => a - b);
  };

  const openGameSelect = (data) => {
    setGmSelectedTable(null);
    setGmSelectedGame(null);
    setGmTableOpen(false);
    setGmGameOpen(false);
    setStep('game_select');
  };

  const selectTournamentFromBrowser = async (tid) => {
    setTournamentInput(String(tid));
    setLoading(true); setError('');
    setStep('browser_loading');
    try {
      const data = await goMafiaApi.getTournament(String(tid));
      setTournament(data);
      setTournamentId(String(tid));
      setTournamentName(data._pageTitle || 'Турнир');
      setTournamentData(data);
      openGameSelect(data);
      triggerHaptic('selection');
    } catch (e) {
      setError('Ошибка загрузки турнира: ' + (e.message || 'Неизвестная ошибка'));
      setStep('browser');
    } finally {
      setLoading(false);
    }
  };

  const confirmGameTableSelection = () => {
    if (gmSelectedTable === null || gmSelectedGame === null || !tournamentData) return;
    const games = tournamentData?.props?.pageProps?.serverData?.games || [];
    const g = games.find(x => x.gameNum === gmSelectedGame);
    if (!g) return;
    const t = g.game?.find(x => x.tableNum === gmSelectedTable);
    if (!t) return;

    setGameSelected(gmSelectedGame);
    setTableSelected(gmSelectedTable);
    const table = t.table || [];
    const newPlayers = table.map((p, i) => ({
      ...p, num: i + 1,
      roleKey: `${gmSelectedGame}-${gmSelectedTable}-${i + 1}`,
    }));
    setPlayers(newPlayers);
    const logins = newPlayers.map(p => p.login).filter(Boolean);
    if (logins.length > 0) loadAvatars(logins);

    setGameMode('gomafia');
    setCurrentSessionId(sessionManager.generateSessionId());
    setScreen('game');
    triggerHaptic('success');
  };

  const goBack = useCallback(() => {
    if (step === 'funky' && funkyEditSessionId) {
      setFunkyEditSessionId(null);
      returnToMainMenu();
      return;
    }
    if (step === 'modes') returnToMainMenu();
    else if (step === 'game_select') setStep('browser');
    else if (step === 'paywall') { setGateFeature(null); setStep('modes'); }
    else if (step === 'gomafia') setStep('browser');
    else if (step === 'browser' || step === 'browser_loading') setStep('modes');
    else if (step === 'city') {
      if (cityStep === 'roles_assign') setCityStep('players');
      else if (cityStep === 'players') setStep('modes');
      else if (cityStep === 'roles_config') setCityStep('players');
      else setStep('modes');
    }
    else setStep('modes');
  }, [step, cityStep, returnToMainMenu, funkyEditSessionId, setFunkyEditSessionId, setGateFeature]);

  useSwipeBack(goBack);

  const getTitle = () => {
    if (step === 'modes') return 'Новая игра';
    if (step === 'paywall') return 'Подписка';
    if (step === 'gomafia') return 'GoMafia';
    if (step === 'funky') return 'Фанки';
    if (step === 'city') return 'Городская мафия';
    if (step === 'game_select') return 'GoMafia';
    if (step === 'browser' || step === 'browser_loading') return 'GoMafia';
    return '';
  };

  const getSubtitle = () => {
    if (step === 'modes') return 'Выберите тип сессии';
    if (step === 'gomafia') return 'Загрузка турнира';
    if (step === 'game_select') return 'Выберите стол и игру';
    if (step === 'funky') return `Свободная игра · Игра ${funkyGameNumber}`;
    if (step === 'city') {
      if (cityStep === 'roles_config') return 'Дополнительные роли';
      if (cityStep === 'players') return `Состав — ${cityPlayers.length} игроков`;
      if (cityStep === 'roles_assign') return 'Раздача ролей';
    }
    if (step === 'browser' || step === 'browser_loading') return 'Выберите турнир';
    return null;
  };

  const getIcon = () => {
    if (step === 'gomafia' || step === 'game_select' || step === 'browser' || step === 'browser_loading') return <IconGoMafia size={24} />;
    if (step === 'funky') return <IconDice size={22} color="var(--accent-color, #a855f7)" />;
    if (step === 'city') return <IconCity size={22} color="var(--accent-color, #a855f7)" />;
    return null;
  };

  const cityAllFilled = cityPlayers.length >= 8 && cityPlayers.every(p => p !== null);
  const activeRolesPreview = step === 'city' && cityStep === 'roles_config' ? getCityActiveRoles(cityPlayers.length, cityRoleToggles) : [];
  const funkyFilledCount = funkyPlayers.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center bg-[var(--maf-bg-main,#040410)] overflow-y-auto overflow-x-hidden native-scroll">
      <div className="w-full max-w-[440px] pt-[calc(16px+var(--safe-top,0px))] px-5 pb-[calc(40px+var(--safe-bottom,env(safe-area-inset-bottom,0)))] min-h-screen min-h-dvh">
        {/* Header */}
        <div className="flex items-center gap-3 py-4 animate-float-up">
          <button onClick={goBack} className="w-[42px] h-[42px] rounded-full bg-white/[0.04] border border-white/[0.10] text-white flex items-center justify-center shrink-0 transition-all duration-150 ease-spring active:scale-90 active:bg-white/[0.08] backdrop-blur-[8px]">
            <IconArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            {getIcon()}
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white mb-1 m-0">{getTitle()}</h2>
              {getSubtitle() && <div className="text-sm text-white/40 font-medium mb-4 mt-0.5">{getSubtitle()}</div>}
            </div>
          </div>
        </div>

        {/* ===== Mode Selection ===== */}
        {step === 'modes' && (
          <div className="flex flex-col gap-3 animate-stagger">
            <button
              className={`relative w-full flex items-center gap-4 p-5 rounded-[22px] glass-card-md overflow-hidden text-left active:scale-[0.98] transition-all duration-200 group hover:border-accent/20 ${!gomafiaSub.hasAccess ? 'opacity-60' : ''}`}
              onClick={() => { if (!gomafiaSub.hasAccess) { setGateFeature('gomafia'); setStep('paywall'); return; } openBrowser(); triggerHaptic('selection'); }}
            >
              <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-accent to-indigo-500 rounded-l-full" />
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" style={{ background: 'var(--accent-color)' }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-accent/20 bg-accent/10 group-hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] transition-shadow">
                <IconGoMafia size={28} />
              </div>
              <div className="flex-1 min-w-0 relative z-[1]">
                <div className="text-[1.1em] font-black text-white mb-0.5 flex items-center gap-2">GoMafia{!gomafiaSub.hasAccess && <IconLock size={14} color="rgba(255,255,255,0.3)" />}</div>
                <div className="text-[0.78em] text-white/40 leading-relaxed">Турниры и миникапы с gomafia.pro</div>
              </div>
              <IconChevronRight size={18} color="rgba(255,255,255,0.2)" className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              className={`relative w-full flex items-center gap-4 p-5 rounded-[22px] glass-card-md overflow-hidden text-left active:scale-[0.98] transition-all duration-200 group hover:border-accent/20 ${!funkySub.hasAccess ? 'opacity-60' : ''}`}
              onClick={() => { if (!funkySub.hasAccess) { setGateFeature('funky'); setStep('paywall'); return; } initFunky(); triggerHaptic('selection'); }}
            >
              <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-accent to-purple-400 rounded-l-full" />
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" style={{ background: 'var(--accent-color)' }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-accent/20 bg-accent/10 group-hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] transition-shadow">
                <IconDice size={26} color="var(--accent-color, #a855f7)" />
              </div>
              <div className="flex-1 min-w-0 relative z-[1]">
                <div className="text-[1.1em] font-black text-white mb-0.5 flex items-center gap-2">Фанки{!funkySub.hasAccess && <IconLock size={14} color="rgba(255,255,255,0.3)" />}</div>
                <div className="text-[0.78em] text-white/40 leading-relaxed">Свободные фановые игры с друзьями</div>
              </div>
              <IconChevronRight size={18} color="rgba(255,255,255,0.2)" className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              className={`relative w-full flex items-center gap-4 p-5 rounded-[22px] glass-card-md overflow-hidden text-left active:scale-[0.98] transition-all duration-200 group hover:border-[rgba(79,195,247,0.2)] ${!citySub.hasAccess ? 'opacity-60' : ''}`}
              onClick={() => { if (!citySub.hasAccess) { setGateFeature('city_mafia'); setStep('paywall'); return; } initCity(); triggerHaptic('selection'); }}
            >
              <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-[#4fc3f7] to-[#0288d1] rounded-l-full" />
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" style={{ background: '#4fc3f7' }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-[rgba(79,195,247,0.2)] bg-[rgba(79,195,247,0.08)] group-hover:shadow-[0_0_20px_rgba(79,195,247,0.12)] transition-shadow">
                <IconCity size={26} color="#4fc3f7" />
              </div>
              <div className="flex-1 min-w-0 relative z-[1]">
                <div className="text-[1.1em] font-black text-white mb-0.5 flex items-center gap-2">Городская мафия{!citySub.hasAccess && <IconLock size={14} color="rgba(255,255,255,0.3)" />}</div>
                <div className="text-[0.78em] text-white/40 leading-relaxed">Доктор, камикадзе, маньяк и блэкджек</div>
              </div>
              <IconChevronRight size={18} color="rgba(255,255,255,0.2)" className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 mt-1 mb-0.5">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[0.55rem] font-bold text-white/15 uppercase tracking-[0.15em]">Скоро</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="relative w-full flex items-center gap-4 p-5 rounded-[22px] glass-card overflow-hidden text-left opacity-40 cursor-default">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.06] bg-white/[0.02]">
                <IconCrown size={24} color="rgba(255,255,255,0.2)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[1.05em] font-bold text-white/60 flex items-center gap-2">Миникап <span className="text-[0.6em] font-bold py-0.5 px-2 rounded-md bg-white/[0.06] text-white/30 uppercase tracking-wider"><IconLock size={9} className="inline -mt-px" /> скоро</span></div>
                <div className="text-[0.75em] text-white/25 mt-0.5">Локальные миникапы без gomafia.pro</div>
              </div>
            </div>

            <div className="relative w-full flex items-center gap-4 p-5 rounded-[22px] glass-card overflow-hidden text-left opacity-40 cursor-default">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.06] bg-white/[0.02]">
                <IconGlobe size={24} color="rgba(255,255,255,0.2)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[1.05em] font-bold text-white/60 flex items-center gap-2">Клубный рейтинг <span className="text-[0.6em] font-bold py-0.5 px-2 rounded-md bg-white/[0.06] text-white/30 uppercase tracking-wider"><IconLock size={9} className="inline -mt-px" /> скоро</span></div>
                <div className="text-[0.75em] text-white/25 mt-0.5">Ведение клубного рейтинга игроков</div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Subscription Paywall ===== */}
        {step === 'paywall' && gateFeature && (
          <div className="animate-fade-in">
            <SubscriptionGate feature={gateFeature}>
              <div />
            </SubscriptionGate>
          </div>
        )}

        {/* ===== GoMafia Loading (after selecting from browser) ===== */}
        {step === 'browser_loading' && (
          <div className="flex flex-col items-center gap-3 py-10 animate-fade-in">
            <div className="w-8 h-8 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
            <span className="text-[0.9em] text-[var(--text-secondary)]">Загрузка турнира...</span>
          </div>
        )}

        {/* ===== GoMafia manual ID (fallback from browser) ===== */}
        {step === 'gomafia' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="relative z-[1] p-4 rounded-2xl glass-card-md flex flex-col gap-3">
              <div className="flex items-center gap-3 relative z-[1]">
                <div className="w-[42px] h-[42px] rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <IconTrophy size={20} color="#ffd700" />
                </div>
                <input type="text" inputMode="numeric" placeholder="Номер турнира" value={tournamentInput}
                  onChange={e => setTournamentInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && loadTournament()}
                  className="input-field flex-1" />
              </div>
              <button onClick={loadTournament} disabled={loading || !tournamentInput}
                className="w-full px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring disabled:opacity-40"
                style={{ opacity: !tournamentInput ? 0.4 : 1 }}>
                <span className="inline-flex items-center gap-1.5">
                  <IconDownload size={16} /> {loading ? 'Загрузка...' : 'Загрузить турнир'}
                </span>
              </button>
            </div>
            {error && <div className="text-status-error text-[0.85em] py-2.5 px-3.5 rounded-xl bg-red-500/10 border border-red-500/20">{error}</div>}
          </div>
        )}

        {/* ===== Game/Table select (sequential dropdowns) ===== */}
        {step === 'game_select' && tournamentData && (() => {
          const tables = getUniqueTables(tournamentData);
          const availableGames = gmSelectedTable !== null ? getGamesForTable(tournamentData, gmSelectedTable) : [];
          const canConfirm = gmSelectedTable !== null && gmSelectedGame !== null;
          return (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center gap-2.5 py-3 px-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 font-bold text-[0.9em] text-white">
                <IconTrophy size={16} color="#ffd700" />
                <span>{tournamentData._pageTitle || `Турнир ${tournamentInput}`}</span>
              </div>

              {/* Table dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75em] font-bold uppercase tracking-wider text-white/40 pl-0.5">Стол</label>
                <div className="relative">
                  <button
                    className={`w-full flex items-center justify-between py-3.5 px-4 rounded-xl text-[0.92em] font-semibold cursor-pointer transition-all duration-200 border ${gmTableOpen ? 'border-accent shadow-[0_0_0_2px_rgba(var(--accent-rgb,168,85,247),0.12)]' : ''} ${gmSelectedTable !== null ? 'text-white border-accent-soft bg-accent-soft' : 'text-white/40 bg-white/[0.04] border-white/[0.10]'}`}
                    onClick={() => { setGmTableOpen(!gmTableOpen); setGmGameOpen(false); }}
                  >
                    <span>{gmSelectedTable !== null ? `Стол ${gmSelectedTable}` : 'Выберите стол'}</span>
                    <IconChevronRight size={16} color="rgba(255,255,255,0.4)" className={`transition-transform duration-200 ease-spring ${gmTableOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {gmTableOpen && (
                    <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 flex flex-col gap-0.5 p-1.5 rounded-2xl bg-[rgba(18,18,32,0.96)] border border-white/[0.10] backdrop-blur-xl shadow-glass-md max-h-[220px] overflow-y-auto animate-fade-in">
                      {tables.map(tNum => (
                        <button key={tNum}
                          className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-left text-[0.88em] font-semibold transition-colors ${gmSelectedTable === tNum ? 'bg-accent-soft text-white hover:bg-accent-soft/80' : 'bg-transparent text-white/80 hover:bg-white/[0.06] active:bg-accent-soft/20'}`}
                          onClick={() => onSelectTable(tNum)}>
                          <span className="flex-1">Стол {tNum}</span>
                          {gmSelectedTable === tNum && <IconCheck size={14} color="var(--accent-color, #a855f7)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Game dropdown (shown after table selected) */}
              {gmSelectedTable !== null && availableGames.length > 0 && (
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[0.75em] font-bold uppercase tracking-wider text-white/40 pl-0.5">Игра</label>
                  <div className="relative">
                    <button
                      className={`w-full flex items-center justify-between py-3.5 px-4 rounded-xl text-[0.92em] font-semibold cursor-pointer transition-all duration-200 border ${gmGameOpen ? 'border-accent shadow-[0_0_0_2px_rgba(var(--accent-rgb,168,85,247),0.12)]' : ''} ${gmSelectedGame !== null ? 'text-white border-accent-soft bg-accent-soft' : 'text-white/40 bg-white/[0.04] border-white/[0.10]'}`}
                      onClick={() => { setGmGameOpen(!gmGameOpen); setGmTableOpen(false); }}
                    >
                      <span>{gmSelectedGame !== null ? `Игра ${gmSelectedGame}` : 'Выберите игру'}</span>
                      <IconChevronRight size={16} color="rgba(255,255,255,0.4)" className={`transition-transform duration-200 ease-spring ${gmGameOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {gmGameOpen && (
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 flex flex-col gap-0.5 p-1.5 rounded-2xl bg-[rgba(18,18,32,0.96)] border border-white/[0.10] backdrop-blur-xl shadow-glass-md max-h-[220px] overflow-y-auto animate-fade-in">
                        {availableGames.map(gNum => (
                          <button key={gNum}
                            className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-left text-[0.88em] font-semibold transition-colors ${gmSelectedGame === gNum ? 'bg-accent-soft text-white hover:bg-accent-soft/80' : 'bg-transparent text-white/80 hover:bg-white/[0.06] active:bg-accent-soft/20'}`}
                            onClick={() => onSelectGame(gNum)}>
                            <span className="flex-1">Игра {gNum}</span>
                            {gmSelectedGame === gNum && <IconCheck size={14} color="var(--accent-color, #a855f7)" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <button onClick={confirmGameTableSelection}
                disabled={!canConfirm}
                className="flex-1 py-3.5 px-5 bg-accent text-white rounded-2xl font-bold text-[0.95em] cursor-pointer shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-transform duration-150 ease-spring active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed w-full mt-2">
                <span className="inline-flex items-center gap-1.5">
                  <IconCheck size={16} /> Начать
                </span>
              </button>
            </div>
          );
        })()}

        {/* ===== Funky Mode ===== */}
        {step === 'funky' && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.8em] font-bold text-white/40 uppercase tracking-wider">Игра #{funkyGameNumber}</span>
              <div className="flex gap-1">
                <button onClick={() => setFunkyGameNumber(n => Math.max(1, n - 1))} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.10] text-white text-[0.85em] font-bold flex items-center justify-center transition-colors active:bg-white/[0.1]">-</button>
                <button onClick={() => setFunkyGameNumber(n => n + 1)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.10] text-white text-[0.85em] font-bold flex items-center justify-center transition-colors active:bg-white/[0.1]">+</button>
              </div>
            </div>
            <div ref={playerListRef} className="flex flex-col gap-1.5">
              {funkyPlayers.map((player, i) => (
                <div key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all duration-200 bg-white/[0.03] border-white/[0.08] relative ${dragIndex === i ? 'opacity-35 scale-[0.97]' : ''} ${dragOverIndex === i ? 'border-t-2 border-t-accent pt-0' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); handleFunkyDragOver(i); }}
                  onDrop={() => handleFunkyDrop(i)}
                >
                  <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] rounded-md bg-white/10 border border-white/[0.15] flex items-center justify-center text-[0.6rem] font-bold text-white/70 px-0.5">{i + 1}</span>
                  {player ? (
                    <div className="flex-1 flex items-center gap-2 py-2 px-2.5 rounded-xl bg-accent-soft border border-accent-soft">
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-lg cursor-grab touch-none shrink-0 active:cursor-grabbing active:bg-white/[0.08] transition-colors"
                        draggable
                        onDragStart={(e) => handleFunkyDragStart(i, e)}
                        onDragEnd={handleFunkyDragEnd}
                        onTouchStart={(e) => handleFunkyDragStart(i, e)}
                      >
                        <IconGripVertical size={16} color="rgba(255,255,255,0.25)" />
                      </div>
                      {player.avatar_link && <img src={player.avatar_link} className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] object-cover shrink-0" alt="" />}
                      <span className="flex-1 text-sm font-bold text-white truncate">{player.login}</span>
                      <button onClick={() => clearSlot(i)} className="p-1 rounded-md flex items-center shrink-0 text-white/35 transition-colors active:text-status-error active:bg-red-500/10"><IconX size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex-1 relative">
                      <input type="text" placeholder="Поиск игрока..." value={funkyPlayerInputs[i]}
                        onChange={e => searchPlayer(i, e.target.value)}
                        onFocus={() => setActiveSlot(i)}
                        onKeyDown={e => e.key === 'Enter' && setFunkyManualPlayer(i)}
                        className="input-field w-full" />
                      {activeSlot === i && searchResults.length > 0 && (
                        <div className="absolute z-30 top-[calc(100%+4px)] left-0 right-0 rounded-xl bg-[rgba(15,12,35,0.95)] backdrop-blur-xl border border-white/[0.12] shadow-glass-md max-h-[200px] overflow-y-auto">
                          {searchResults.slice(0, 8).map(r => (
                            <button key={r.login} onClick={() => selectPlayer(i, r)} className="w-full flex items-center gap-2 py-2.5 px-3 text-[0.88em] text-white bg-transparent border-none cursor-pointer text-left transition-colors hover:bg-accent-soft active:bg-accent-soft">
                              {r.avatar_link && <img src={r.avatar_link} className="w-[22px] h-[22px] rounded-full object-cover shrink-0" alt="" />}
                              <span className="truncate">{r.login}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={funkyShufflePlayers}
                disabled={funkyFilledCount < 10}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring disabled:opacity-30">
                <span className="inline-flex items-center gap-1.5">
                  <IconShuffle size={14} /> Рассадить
                </span>
              </button>
              <button onClick={confirmFunkyPlayers} disabled={funkyFilledCount < 10}
                className="flex-1 py-3.5 px-5 bg-accent text-white rounded-2xl font-bold text-[0.95em] cursor-pointer shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-transform duration-150 ease-spring active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed">
                <span className="inline-flex items-center gap-1.5">
                  <IconCheck size={16} /> Начать ({funkyFilledCount}/10)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===== City Mode — Step: roles_config (17+) ===== */}
        {step === 'city' && cityStep === 'roles_config' && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <p className="text-[0.8em] text-[var(--text-secondary)] m-0">
              Базовые: Дон, 3 Мафии, Маньяк, Шериф, Доктор, Камикадзе, Бессмертный, Красотка.<br/>
              Включите дополнительные. Остальные — мирные.
            </p>
            <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto native-scroll">
              {CITY_OPTIONAL_ROLES.map(rk => {
                const info = CITY_ROLES_ALL[rk];
                return (
                  <div key={rk} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[0.88em] font-bold ${info.team === 'black' ? 'text-white/70' : 'text-red-400'}`}>
                        {info.label}
                      </span>
                      <span className="text-[0.65em]">{info.team === 'black' ? '⚫' : '🔴'}</span>
                    </div>
                    <label className="relative inline-block w-[42px] h-[22px] cursor-pointer">
                      <input type="checkbox" checked={!!cityRoleToggles[rk]}
                        onChange={() => cityToggleRole(rk)} className="peer absolute opacity-0 w-0 h-0" />
                      <span className="absolute inset-0 rounded-[12px] bg-white/[0.08] transition-colors peer-checked:bg-accent" />
                      <span className="absolute left-0.5 top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 ease-spring peer-checked:translate-x-5 pointer-events-none" />
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-[0.8em] text-[var(--text-secondary)]">
              Ролей: {activeRolesPreview.filter(r => r !== 'peace').length} · Мирных: {activeRolesPreview.filter(r => r === 'peace').length} · Всего: {cityPlayers.length}
            </div>
            <button onClick={() => { setCityStep('players'); triggerHaptic('medium'); }}
              className="w-full py-3.5 px-5 bg-accent text-white rounded-2xl font-bold text-[0.95em] cursor-pointer shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-transform duration-150 ease-spring active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="inline-flex items-center gap-1.5">
                <IconArrowRight size={16} /> Дальше
              </span>
            </button>
          </div>
        )}

        {/* ===== City Mode — Step: players (with inline add/remove) ===== */}
        {step === 'city' && cityStep === 'players' && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[0.82em] font-bold text-[var(--text-secondary)]">
              <span>{cityPlayers.length} игроков</span>
              <span className="text-white/40 font-medium">от 8 до 30 · свайп влево для удаления</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {cityPlayers.map((player, i) => {
                const swipeOffset = citySwipeOffsets[i] || 0;
                const isDeleting = citySwipeDeleting === i;
                return (
                  <div key={`city-slot-${i}`}
                    className={`relative rounded-xl transition-all duration-300 ease-spring max-h-[70px] ${cityActiveInput === i ? '' : 'overflow-hidden'} ${cityDragIndex === i ? 'opacity-35 scale-[0.97]' : ''} ${cityDragOverIndex === i ? 'border-t-2 border-t-accent' : ''} ${isDeleting ? 'max-h-0 opacity-0 -mt-1.5 overflow-hidden' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); handleCityDragOver(i); }}
                    onDrop={() => handleCityDrop(i)}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[100px] flex items-center justify-center rounded-r-xl bg-gradient-to-l from-red-500/60 to-red-500/90">
                      <IconTrash size={16} color="#fff" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 relative z-[1] bg-[var(--maf-bg-main,#040410)] will-change-transform"
                      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.3s var(--ease-spring)' : 'none' }}
                      onTouchStart={(e) => handleCitySwipeStart(i, e)}
                      onTouchMove={(e) => handleCitySwipeMove(i, e)}
                      onTouchEnd={() => handleCitySwipeEnd(i)}
                    >
                      <span className="shrink-0 w-[22px] h-[22px] rounded-md bg-white/10 border border-white/[0.15] flex items-center justify-center text-[0.6rem] font-bold text-white/70">{i + 1}</span>
                      {player ? (
                        <div className="flex-1 flex items-center gap-2 py-2 px-2.5 rounded-xl bg-accent-soft border border-accent-soft">
                          <div
                            className="flex items-center justify-center w-7 h-7 rounded-lg cursor-grab touch-none shrink-0 active:cursor-grabbing active:bg-white/[0.08] transition-colors"
                            draggable
                            onDragStart={() => handleCityDragStart(i)}
                            onDragEnd={handleCityDragEnd}
                          >
                            <IconGripVertical size={16} color="rgba(255,255,255,0.25)" />
                          </div>
                          {player.avatar_link && <img src={player.avatar_link} className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] object-cover shrink-0" alt="" />}
                          <span className="flex-1 text-sm font-bold text-white truncate">{player.login}</span>
                          <button onClick={() => cityClearPlayer(i)} className="p-1 rounded-md flex items-center shrink-0 text-white/35 transition-colors active:text-status-error active:bg-red-500/10"><IconX size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex-1 relative">
                          <input type="text" placeholder={`Игрок ${i + 1}`} value={cityPlayerInputs[i] || ''}
                            onChange={e => citySearchPlayer(i, e.target.value)}
                            onFocus={() => setCityActiveInput(i)}
                            onKeyDown={e => e.key === 'Enter' && citySetManualPlayer(i)}
                            className="input-field w-full" />
                          {cityActiveInput === i && citySearchResults.length > 0 && (
                            <div className="absolute z-30 top-[calc(100%+4px)] left-0 right-0 rounded-xl bg-[rgba(15,12,35,0.95)] backdrop-blur-xl border border-white/[0.12] shadow-glass-md max-h-[200px] overflow-y-auto">
                              {citySearchResults.slice(0, 8).map(r => (
                                <button key={r.login} onClick={() => citySelectPlayer(i, r)} className="w-full flex items-center gap-2 py-2.5 px-3 text-[0.88em] text-white bg-transparent border-none cursor-pointer text-left transition-colors hover:bg-accent-soft active:bg-accent-soft">
                                  {r.avatar_link && <img src={r.avatar_link} className="w-[22px] h-[22px] rounded-full object-cover shrink-0" alt="" />}
                                  <span className="truncate">{r.login}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {cityPlayers.length < 30 && (
              <button onClick={cityAddPlayer} className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-transparent border-2 border-dashed border-accent/20 text-accent font-semibold text-[0.85em] cursor-pointer transition-all duration-200 hover:bg-accent/5 hover:border-accent/35 active:scale-[0.98] active:bg-accent/10">
                <IconPlus size={16} color="var(--accent-color, #a855f7)" />
                <span>Добавить игрока</span>
              </button>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={cityShufflePlayers} disabled={!cityAllFilled}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring disabled:opacity-30">
                <span className="inline-flex items-center gap-1.5">
                  <IconShuffle size={14} /> Рассадить
                </span>
              </button>
              <button onClick={cityGoToRolesAssign} disabled={!cityAllFilled}
                className="flex-1 py-3.5 px-5 bg-accent text-white rounded-2xl font-bold text-[0.95em] cursor-pointer shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-transform duration-150 ease-spring active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed">
                <span className="inline-flex items-center gap-1.5">
                  <IconArrowRight size={14} /> Продолжить ({cityPlayers.length})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===== City Mode — Step: roles_assign ===== */}
        {step === 'city' && cityStep === 'roles_assign' && (
          <div className="flex flex-col gap-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[0.9em] font-bold text-[var(--text-secondary)]">Раздача ролей</span>
              <button onClick={cityAutoAssignRoles} className="px-3.5 py-2 text-[0.8em] rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 font-bold active:scale-[0.97] transition-transform duration-150 ease-spring">
                <span className="inline-flex items-center gap-1">
                  <IconShuffle size={12} /> Раздать роли
                </span>
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-[55vh] overflow-y-auto native-scroll">
              {cityPlayers.map((player, i) => (
                <div key={i} className="flex items-center gap-2 py-2 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="w-6 min-w-6 text-center text-[0.8em] font-extrabold text-white/40">{i + 1}</span>
                  {player?.avatar_link && <img src={player.avatar_link} className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] object-cover shrink-0" alt="" />}
                  <span className="flex-1 text-[0.88em] font-semibold truncate">{player?.login || ''}</span>
                  <select value={cityAssignedRoles[i] || ''}
                    onChange={e => setCityAssignedRoles(prev => ({ ...prev, [i]: e.target.value }))}
                    className="input-field min-w-[100px] text-[0.8em] py-2 px-2.5">
                    <option value="">— Роль —</option>
                    {cityGetAvailableRoles(i).map(r => (
                      <option key={r.id} value={r.id}>{r.label} {r.team === 'black' ? '⚫' : '🔴'}</option>
                    ))}
                    {cityAssignedRoles[i] && !cityGetAvailableRoles(i).find(r => r.id === cityAssignedRoles[i]) && (
                      <option value={cityAssignedRoles[i]}>{CITY_ROLES_ALL[cityAssignedRoles[i]]?.label || cityAssignedRoles[i]}</option>
                    )}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={confirmCityPlayers} disabled={!cityValidateRoles()}
              className="w-full py-3.5 px-5 bg-accent text-white rounded-2xl font-bold text-[0.95em] cursor-pointer shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition-transform duration-150 ease-spring active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={16} /> Начать игру
              </span>
            </button>
          </div>
        )}

        {/* ===== Tournament Browser ===== */}
        {step === 'browser' && (
          <div className="flex flex-col gap-2.5 animate-fade-in">
            {/* Quick ID input */}
            <div className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="w-[30px] h-[30px] rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <IconTrophy size={14} color="#ffd700" />
              </div>
              <input type="text" inputMode="numeric" placeholder="ID турнира" value={tournamentInput}
                onChange={e => setTournamentInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && tournamentInput) selectTournamentFromBrowser(tournamentInput); }}
                className="flex-1 bg-transparent border-none text-white text-[0.88em] font-semibold outline-none py-1.5 px-1 min-w-0" />
              <button onClick={() => { if (tournamentInput) selectTournamentFromBrowser(tournamentInput); }}
                disabled={!tournamentInput || loading}
                className="w-8 h-8 rounded-xl bg-accent border-none text-white cursor-pointer flex items-center justify-center shrink-0 transition-all duration-150 ease-spring disabled:opacity-30 disabled:cursor-not-allowed active:scale-90">
                <IconArrowRight size={14} />
              </button>
            </div>
            {error && <div className="text-status-error text-[0.85em] py-2.5 px-3.5 rounded-xl bg-red-500/10 border border-red-500/20">{error}</div>}
            <div className="flex gap-1.5">
              <FilterChip active={!tournamentsFilters.period} onClick={() => applyFilter('period', '')} icon={<IconClock size={12} />} label="Ближайшие" />
              <FilterChip active={tournamentsFilters.period === 'past'} onClick={() => applyFilter('period', 'past')} icon={<IconScroll size={12} />} label="Прошедшие" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <FilterChip active={!tournamentsFilters.type} onClick={() => applyFilter('type', '')} label="Все" />
              <FilterChip active={tournamentsFilters.type === 'offline'} onClick={() => applyFilter('type', 'offline')} icon={<IconMapPin size={12} />} label="Офлайн" />
              <FilterChip active={tournamentsFilters.type === 'online'} onClick={() => applyFilter('type', 'online')} icon={<IconWifi size={12} />} label="Онлайн" />
              <FilterChip active={tournamentsFilters.fsm === 'fsm'} onClick={() => applyFilter('fsm', tournamentsFilters.fsm === 'fsm' ? '' : 'fsm')} icon={<IconStar size={12} />} label="ФСМ" />
            </div>
            <div className="relative mb-3">
              <IconSearch size={14} color="rgba(255,255,255,0.3)" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Поиск турнира..."
                value={tournamentsFilters.search || ''}
                onChange={e => onSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadTournamentsList(1)}
                className="input-field w-full pl-9"
              />
            </div>
            {tournamentsLoading && <div className="text-center text-[0.9em] text-[var(--text-secondary)] py-4">Загрузка...</div>}
            <div className="flex flex-col gap-1.5 animate-stagger">
              {(Array.isArray(tournamentsList) ? tournamentsList : []).map((t, i) => {
                const hasSeating = isTournamentSeatingReady(t);
                return (
                  <button key={t.id || i}
                    onClick={() => hasSeating ? selectTournamentFromBrowser(t.id || t.tournamentId) : null}
                    className={`w-full p-3.5 rounded-2xl border text-left text-white transition-all duration-200 text-sm ${hasSeating ? 'bg-white/[0.03] border-white/[0.08] cursor-pointer hover:border-white/[0.15] active:scale-[0.98]' : 'opacity-40 cursor-default bg-white/[0.03] border-white/[0.08]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-[0.9em] flex-1 truncate">{t.name || t.title || `Турнир ${t.id}`}</div>
                      {hasSeating ? (
                        <span className="shrink-0 text-[0.65em] font-bold py-0.5 px-2 rounded-full inline-flex items-center gap-1 bg-status-success/20 text-status-success border border-status-success/30">
                          <IconCheck size={10} color="#30d158" /> Рассадка
                        </span>
                      ) : (
                        <span className="shrink-0 text-[0.65em] font-bold py-0.5 px-2 rounded-full inline-flex items-center bg-white/[0.04] text-white/35 border border-white/[0.06]">
                          Нет рассадки
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {t.date && <span className="text-[0.7em] text-[var(--text-muted)]">{t.date}</span>}
                      {t.city && <span className="text-[0.7em] text-[var(--text-muted)]">{t.city}</span>}
                      {t.playersCount && <span className="text-[0.7em] text-[var(--text-muted)]">{t.playersCount} игроков</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {tournamentsHasMore && !tournamentsLoading && (
              <button onClick={() => loadTournamentsList(tournamentsPage + 1, true)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring opacity-60 text-[0.9em]">
                Загрузить ещё
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 py-1.5 px-3 rounded-full text-[0.78em] font-semibold cursor-pointer transition-all duration-200 active:scale-95 ${active ? 'bg-accent text-white border border-accent' : 'bg-white/[0.04] text-white/45 border border-white/[0.08]'}`}>
      {icon && <span className="inline-flex">{icon}</span>}
      {label}
    </button>
  );
}

