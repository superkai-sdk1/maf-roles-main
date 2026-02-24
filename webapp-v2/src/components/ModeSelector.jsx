import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { goMafiaApi } from '../services/api';
import { sessionManager } from '../services/sessionManager';
import { triggerHaptic } from '../utils/haptics';
import { useSwipeBack } from '../hooks/useSwipeBack';
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
    setGameSelected, setTableSelected, joinRoom, setCityMode, setFunkyMode, setManualMode,
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
    setTournamentId('city_' + Date.now());
    setTournamentName('Городская мафия ' + new Date().toLocaleDateString('ru-RU'));
    setCurrentSessionId(sessionManager.generateSessionId());
    setRolesDistributed(true);
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

    joinRoom(tournamentInput.trim());
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
    else if (step === 'gomafia') setStep('browser');
    else if (step === 'browser' || step === 'browser_loading') setStep('modes');
    else if (step === 'city') {
      if (cityStep === 'roles_assign') setCityStep('players');
      else if (cityStep === 'players') setStep('modes');
      else if (cityStep === 'roles_config') setCityStep('players');
      else setStep('modes');
    }
    else setStep('modes');
  }, [step, cityStep, returnToMainMenu, funkyEditSessionId, setFunkyEditSessionId]);

  useSwipeBack(goBack);

  const getTitle = () => {
    if (step === 'modes') return 'Новая игра';
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
    <div className="mode-selector-overlay">
      <div className="mode-selector-container">
        {/* Header */}
        <div className="mode-selector-header">
          <button onClick={goBack} className="mode-selector-back">
            <IconArrowLeft size={18} />
          </button>
          <div className="mode-selector-header-info">
            {getIcon()}
            <div>
              <h2 className="mode-selector-title">{getTitle()}</h2>
              {getSubtitle() && <div className="mode-selector-subtitle">{getSubtitle()}</div>}
            </div>
          </div>
        </div>

        {/* ===== Mode Selection ===== */}
        {step === 'modes' && (
          <div className="mode-grid animate-stagger">
            <GameModeCard
              icon={<IconGoMafia size={30} />}
              title="GoMafia"
              desc="Если ваш турнир или миникап есть на gomafia.pro"
              accentColor="var(--accent-color, #a855f7)"
              onClick={() => { openBrowser(); triggerHaptic('selection'); }}
            />
            <GameModeCard
              icon={<IconCrown size={26} color="rgba(255,255,255,0.25)" />}
              title="Миникап"
              desc="Скоро"
              disabled
              accentColor="rgba(255,255,255,0.15)"
            />
            <GameModeCard
              icon={<IconDice size={26} color="var(--accent-color, #a855f7)" />}
              title="Фанки"
              desc="Для регулярных фановых игр"
              accentColor="var(--accent-color, #a855f7)"
              onClick={() => { initFunky(); triggerHaptic('selection'); }}
            />
            <GameModeCard
              icon={<IconGlobe size={26} color="rgba(255,255,255,0.25)" />}
              title="Клубный рейтинг"
              desc="Скоро"
              disabled
              accentColor="rgba(255,255,255,0.15)"
            />
            <GameModeCard
              icon={<IconCity size={26} color="#4fc3f7" />}
              title="Городская мафия"
              desc="С доктором, камикадзе и блэкджеком"
              accentColor="#4fc3f7"
              onClick={() => { initCity(); triggerHaptic('selection'); }}
            />
          </div>
        )}

        {/* ===== GoMafia Loading (after selecting from browser) ===== */}
        {step === 'browser_loading' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <div className="newgame-modal-spinner" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Загрузка турнира...</span>
          </div>
        )}

        {/* ===== GoMafia manual ID (fallback from browser) ===== */}
        {step === 'gomafia' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="gomafia-input-card">
              <div className="gomafia-input-row">
                <div className="gomafia-input-icon">
                  <IconTrophy size={20} color="#ffd700" />
                </div>
                <input type="text" inputMode="numeric" placeholder="Номер турнира" value={tournamentInput}
                  onChange={e => setTournamentInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && loadTournament()}
                  className="gomafia-input" />
              </div>
              <button onClick={loadTournament} disabled={loading || !tournamentInput}
                className="glass-btn btn-primary" style={{ width: '100%', opacity: !tournamentInput ? 0.4 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconDownload size={16} /> {loading ? 'Загрузка...' : 'Загрузить турнир'}
                </span>
              </button>
            </div>
            {error && <div className="mode-error">{error}</div>}
          </div>
        )}

        {/* ===== Game/Table select (sequential dropdowns) ===== */}
        {step === 'game_select' && tournamentData && (() => {
          const tables = getUniqueTables(tournamentData);
          const availableGames = gmSelectedTable !== null ? getGamesForTable(tournamentData, gmSelectedTable) : [];
          const canConfirm = gmSelectedTable !== null && gmSelectedGame !== null;
          return (
            <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="gm-tournament-name">
                <IconTrophy size={16} color="#ffd700" />
                <span>{tournamentData._pageTitle || `Турнир ${tournamentInput}`}</span>
              </div>

              {/* Table dropdown */}
              <div className="gm-select-group">
                <label className="gm-select-label">Стол</label>
                <div className="gm-dropdown-wrapper">
                  <button
                    className={`gm-dropdown-trigger ${gmTableOpen ? 'gm-dropdown-trigger--open' : ''} ${gmSelectedTable !== null ? 'gm-dropdown-trigger--selected' : ''}`}
                    onClick={() => { setGmTableOpen(!gmTableOpen); setGmGameOpen(false); }}
                  >
                    <span>{gmSelectedTable !== null ? `Стол ${gmSelectedTable}` : 'Выберите стол'}</span>
                    <IconChevronRight size={16} color="rgba(255,255,255,0.4)" className="gm-dropdown-chevron" />
                  </button>
                  {gmTableOpen && (
                    <div className="gm-dropdown-list animate-fadeIn">
                      {tables.map(tNum => (
                        <button key={tNum}
                          className={`gm-dropdown-item ${gmSelectedTable === tNum ? 'gm-dropdown-item--active' : ''}`}
                          onClick={() => onSelectTable(tNum)}>
                          <span className="gm-dropdown-item-label">Стол {tNum}</span>
                          {gmSelectedTable === tNum && <IconCheck size={14} color="var(--accent-color, #a855f7)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Game dropdown (shown after table selected) */}
              {gmSelectedTable !== null && availableGames.length > 0 && (
                <div className="gm-select-group animate-fadeIn">
                  <label className="gm-select-label">Игра</label>
                  <div className="gm-dropdown-wrapper">
                    <button
                      className={`gm-dropdown-trigger ${gmGameOpen ? 'gm-dropdown-trigger--open' : ''} ${gmSelectedGame !== null ? 'gm-dropdown-trigger--selected' : ''}`}
                      onClick={() => { setGmGameOpen(!gmGameOpen); setGmTableOpen(false); }}
                    >
                      <span>{gmSelectedGame !== null ? `Игра ${gmSelectedGame}` : 'Выберите игру'}</span>
                      <IconChevronRight size={16} color="rgba(255,255,255,0.4)" className="gm-dropdown-chevron" />
                    </button>
                    {gmGameOpen && (
                      <div className="gm-dropdown-list animate-fadeIn">
                        {availableGames.map(gNum => (
                          <button key={gNum}
                            className={`gm-dropdown-item ${gmSelectedGame === gNum ? 'gm-dropdown-item--active' : ''}`}
                            onClick={() => onSelectGame(gNum)}>
                            <span className="gm-dropdown-item-label">Игра {gNum}</span>
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
                className="mode-action-btn-primary" style={{ width: '100%', marginTop: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={16} /> Начать
                </span>
              </button>
            </div>
          );
        })()}

        {/* ===== Funky Mode ===== */}
        {step === 'funky' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="funky-meta-row">
              <span className="funky-game-label">Игра #{funkyGameNumber}</span>
              <div className="funky-game-controls">
                <button onClick={() => setFunkyGameNumber(n => Math.max(1, n - 1))} className="funky-counter-btn">-</button>
                <button onClick={() => setFunkyGameNumber(n => n + 1)} className="funky-counter-btn">+</button>
              </div>
            </div>
            <div ref={playerListRef} className="player-slots-list">
              {funkyPlayers.map((player, i) => (
                <div key={i}
                  className={`player-slot ${dragIndex === i ? 'player-slot--dragging' : ''} ${dragOverIndex === i ? 'player-slot--drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); handleFunkyDragOver(i); }}
                  onDrop={() => handleFunkyDrop(i)}
                >
                  <span className="player-slot-num">{i + 1}</span>
                  {player ? (
                    <div className="player-slot-filled">
                      <div
                        className="player-slot-drag-handle"
                        draggable
                        onDragStart={(e) => handleFunkyDragStart(i, e)}
                        onDragEnd={handleFunkyDragEnd}
                        onTouchStart={(e) => handleFunkyDragStart(i, e)}
                      >
                        <IconGripVertical size={16} color="rgba(255,255,255,0.25)" />
                      </div>
                      {player.avatar_link && <img src={player.avatar_link} className="player-slot-avatar" alt="" />}
                      <span className="player-slot-name">{player.login}</span>
                      <button onClick={() => clearSlot(i)} className="player-slot-clear"><IconX size={14} /></button>
                    </div>
                  ) : (
                    <div className="player-slot-empty">
                      <input type="text" placeholder="Поиск игрока..." value={funkyPlayerInputs[i]}
                        onChange={e => searchPlayer(i, e.target.value)}
                        onFocus={() => setActiveSlot(i)}
                        onKeyDown={e => e.key === 'Enter' && setFunkyManualPlayer(i)}
                        className="player-slot-input" />
                      {activeSlot === i && searchResults.length > 0 && (
                        <div className="player-search-dropdown">
                          {searchResults.slice(0, 8).map(r => (
                            <button key={r.login} onClick={() => selectPlayer(i, r)} className="player-search-item">
                              {r.avatar_link && <img src={r.avatar_link} className="player-search-avatar" alt="" />}
                              <span className="player-search-name">{r.login}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mode-action-row">
              <button onClick={funkyShufflePlayers}
                disabled={funkyFilledCount < 10}
                className="glass-btn mode-action-btn-secondary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconShuffle size={14} /> Рассадить
                </span>
              </button>
              <button onClick={confirmFunkyPlayers} disabled={funkyFilledCount < 10}
                className="mode-action-btn-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={16} /> Начать ({funkyFilledCount}/10)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===== City Mode — Step: roles_config (17+) ===== */}
        {step === 'city' && cityStep === 'roles_config' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', margin: 0 }}>
              Базовые: Дон, 3 Мафии, Маньяк, Шериф, Доктор, Камикадзе, Бессмертный, Красотка.<br/>
              Включите дополнительные. Остальные — мирные.
            </p>
            <div className="city-roles-list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {CITY_OPTIONAL_ROLES.map(rk => {
                const info = CITY_ROLES_ALL[rk];
                return (
                  <div key={rk} className="city-role-toggle-row">
                    <div className="city-role-toggle-info">
                      <span className={`city-role-label ${info.team === 'black' ? 'city-role-label--black' : 'city-role-label--red'}`}>
                        {info.label}
                      </span>
                      <span className="city-role-team-dot">{info.team === 'black' ? '⚫' : '🔴'}</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={!!cityRoleToggles[rk]}
                        onChange={() => cityToggleRole(rk)} />
                      <span className="toggle-switch-track" />
                      <span className="toggle-switch-thumb" />
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.8em', color: 'var(--text-secondary)' }}>
              Ролей: {activeRolesPreview.filter(r => r !== 'peace').length} · Мирных: {activeRolesPreview.filter(r => r === 'peace').length} · Всего: {cityPlayers.length}
            </div>
            <button onClick={() => { setCityStep('players'); triggerHaptic('medium'); }}
              className="mode-action-btn-primary" style={{ width: '100%' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconArrowRight size={16} /> Дальше
              </span>
            </button>
          </div>
        )}

        {/* ===== City Mode — Step: players (with inline add/remove) ===== */}
        {step === 'city' && cityStep === 'players' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="city-players-count-badge">
              <span>{cityPlayers.length} игроков</span>
              <span className="city-players-count-hint">от 8 до 30 · свайп влево для удаления</span>
            </div>
            <div className="player-slots-list">
              {cityPlayers.map((player, i) => {
                const swipeOffset = citySwipeOffsets[i] || 0;
                const isDeleting = citySwipeDeleting === i;
                return (
                  <div key={`city-slot-${i}`}
                    className={`city-swipe-row ${cityDragIndex === i ? 'player-slot--dragging' : ''} ${cityDragOverIndex === i ? 'player-slot--drag-over' : ''} ${isDeleting ? 'city-swipe-row--deleting' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); handleCityDragOver(i); }}
                    onDrop={() => handleCityDrop(i)}
                  >
                    <div className="city-swipe-delete-bg">
                      <IconTrash size={16} color="#fff" />
                    </div>
                    <div className="city-swipe-content"
                      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.3s var(--ease-spring)' : 'none' }}
                      onTouchStart={(e) => handleCitySwipeStart(i, e)}
                      onTouchMove={(e) => handleCitySwipeMove(i, e)}
                      onTouchEnd={() => handleCitySwipeEnd(i)}
                    >
                      <span className="player-slot-num">{i + 1}</span>
                      {player ? (
                        <div className="player-slot-filled">
                          <div
                            className="player-slot-drag-handle"
                            draggable
                            onDragStart={() => handleCityDragStart(i)}
                            onDragEnd={handleCityDragEnd}
                          >
                            <IconGripVertical size={16} color="rgba(255,255,255,0.25)" />
                          </div>
                          {player.avatar_link && <img src={player.avatar_link} className="player-slot-avatar" alt="" />}
                          <span className="player-slot-name">{player.login}</span>
                          <button onClick={() => cityClearPlayer(i)} className="player-slot-clear"><IconX size={14} /></button>
                        </div>
                      ) : (
                        <div className="player-slot-empty">
                          <input type="text" placeholder={`Игрок ${i + 1}`} value={cityPlayerInputs[i] || ''}
                            onChange={e => citySearchPlayer(i, e.target.value)}
                            onFocus={() => setCityActiveInput(i)}
                            onKeyDown={e => e.key === 'Enter' && citySetManualPlayer(i)}
                            className="player-slot-input" />
                          {cityActiveInput === i && citySearchResults.length > 0 && (
                            <div className="player-search-dropdown">
                              {citySearchResults.slice(0, 8).map(r => (
                                <button key={r.login} onClick={() => citySelectPlayer(i, r)} className="player-search-item">
                                  {r.avatar_link && <img src={r.avatar_link} className="player-search-avatar" alt="" />}
                                  <span className="player-search-name">{r.login}</span>
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
              <button onClick={cityAddPlayer} className="city-add-player-btn">
                <IconPlus size={16} color="var(--accent-color, #a855f7)" />
                <span>Добавить игрока</span>
              </button>
            )}
            <div className="mode-action-row">
              <button onClick={cityShufflePlayers} disabled={!cityAllFilled}
                className="glass-btn mode-action-btn-secondary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconShuffle size={14} /> Рассадить
                </span>
              </button>
              <button onClick={cityGoToRolesAssign} disabled={!cityAllFilled}
                className="mode-action-btn-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconArrowRight size={14} /> Продолжить ({cityPlayers.length})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ===== City Mode — Step: roles_assign ===== */}
        {step === 'city' && cityStep === 'roles_assign' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9em', fontWeight: 700, color: 'var(--text-secondary)' }}>Раздача ролей</span>
              <button onClick={cityAutoAssignRoles} className="glass-btn" style={{ padding: '8px 14px', fontSize: '0.8em' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconShuffle size={12} /> Раздать роли
                </span>
              </button>
            </div>
            <div className="city-roles-assign-list" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {cityPlayers.map((player, i) => (
                <div key={i} className="city-role-assign-row">
                  <span className="city-role-assign-num">{i + 1}</span>
                  {player?.avatar_link && <img src={player.avatar_link} className="player-slot-avatar" alt="" />}
                  <span className="city-role-assign-name">{player?.login || ''}</span>
                  <select value={cityAssignedRoles[i] || ''}
                    onChange={e => setCityAssignedRoles(prev => ({ ...prev, [i]: e.target.value }))}
                    className="city-role-select">
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
              className="mode-action-btn-primary" style={{ width: '100%' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCheck size={16} /> Начать игру
              </span>
            </button>
          </div>
        )}

        {/* ===== Tournament Browser ===== */}
        {step === 'browser' && (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Quick ID input */}
            <div className="gomafia-quick-id">
              <div className="gomafia-input-icon-sm">
                <IconTrophy size={14} color="#ffd700" />
              </div>
              <input type="text" inputMode="numeric" placeholder="ID турнира" value={tournamentInput}
                onChange={e => setTournamentInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && tournamentInput) selectTournamentFromBrowser(tournamentInput); }}
                className="gomafia-quick-input" />
              <button onClick={() => { if (tournamentInput) selectTournamentFromBrowser(tournamentInput); }}
                disabled={!tournamentInput || loading}
                className="gomafia-quick-go">
                <IconArrowRight size={14} />
              </button>
            </div>
            {error && <div className="mode-error">{error}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <FilterChip active={!tournamentsFilters.period} onClick={() => applyFilter('period', '')} icon={<IconClock size={12} />} label="Ближайшие" />
              <FilterChip active={tournamentsFilters.period === 'past'} onClick={() => applyFilter('period', 'past')} icon={<IconScroll size={12} />} label="Прошедшие" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip active={!tournamentsFilters.type} onClick={() => applyFilter('type', '')} label="Все" />
              <FilterChip active={tournamentsFilters.type === 'offline'} onClick={() => applyFilter('type', 'offline')} icon={<IconMapPin size={12} />} label="Офлайн" />
              <FilterChip active={tournamentsFilters.type === 'online'} onClick={() => applyFilter('type', 'online')} icon={<IconWifi size={12} />} label="Онлайн" />
              <FilterChip active={tournamentsFilters.fsm === 'fsm'} onClick={() => applyFilter('fsm', tournamentsFilters.fsm === 'fsm' ? '' : 'fsm')} icon={<IconStar size={12} />} label="ФСМ" />
            </div>
            <div style={{ position: 'relative' }}>
              <IconSearch size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Поиск турнира..."
                value={tournamentsFilters.search || ''}
                onChange={e => onSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadTournamentsList(1)}
                className="player-slot-input"
                style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
            </div>
            {tournamentsLoading && <div style={{ textAlign: 'center', fontSize: '0.9em', color: 'var(--text-secondary)', padding: '16px 0' }}>Загрузка...</div>}
            <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Array.isArray(tournamentsList) ? tournamentsList : []).map((t, i) => {
                const hasSeating = isTournamentSeatingReady(t);
                return (
                  <button key={t.id || i}
                    onClick={() => hasSeating ? selectTournamentFromBrowser(t.id || t.tournamentId) : null}
                    className={`tournament-browser-card ${hasSeating ? '' : 'tournament-browser-card--disabled'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9em', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.name || t.title || `Турнир ${t.id}`}</div>
                      {hasSeating ? (
                        <span className="tournament-status-badge tournament-status-badge--ready">
                          <IconCheck size={10} color="#30d158" /> Рассадка
                        </span>
                      ) : (
                        <span className="tournament-status-badge tournament-status-badge--none">
                          Нет рассадки
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {t.date && <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>{t.date}</span>}
                      {t.city && <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>{t.city}</span>}
                      {t.playersCount && <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>{t.playersCount} игроков</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {tournamentsHasMore && !tournamentsLoading && (
              <button onClick={() => loadTournamentsList(tournamentsPage + 1, true)}
                className="glass-btn" style={{ width: '100%', opacity: 0.6, fontSize: '0.9em' }}>
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
    <button onClick={onClick} className={`filter-chip ${active ? 'filter-chip--active' : ''}`}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {label}
    </button>
  );
}

function GameModeCard({ icon, title, desc, accentColor, onClick, disabled }) {
  return (
    <button
      onClick={() => { if (!disabled && onClick) onClick(); }}
      className={`game-mode-card ${disabled ? 'game-mode-card--disabled' : ''}`}
      disabled={disabled}
    >
      <div className="game-mode-card-icon" style={{
        borderColor: disabled ? 'rgba(255,255,255,0.06)' : `${accentColor}33`,
        background: disabled ? 'rgba(255,255,255,0.02)' : undefined,
        ...(disabled ? {} : { background: `linear-gradient(135deg, ${accentColor}14, ${accentColor}08)` }),
      }}>
        {icon}
      </div>
      <div className="game-mode-card-text">
        <div className="game-mode-card-title">
          {title}
          {disabled && <span className="game-mode-card-badge"><IconLock size={10} /> Скоро</span>}
        </div>
        <div className="game-mode-card-desc">{desc}</div>
      </div>
      {!disabled && <IconChevronRight size={18} color="rgba(255,255,255,0.2)" />}
    </button>
  );
}
