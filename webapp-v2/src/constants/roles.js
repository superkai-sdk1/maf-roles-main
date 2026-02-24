// Role definitions for all game modes
export const STANDARD_ROLES = {
  don: { key: 'don', name: 'Дон', team: 'black', icon: '◆' },
  black: { key: 'black', name: 'Мафия', team: 'black', icon: '◆' },
  sheriff: { key: 'sheriff', name: 'Шериф', team: 'red', icon: '★' },
  peace: { key: 'peace', name: 'Мирный', team: 'red', icon: '●' },
};

export const CITY_ROLES_RED = {
  detective: { key: 'detective', name: 'Детектив', team: 'red' },
  jailer: { key: 'jailer', name: 'Тюремщик', team: 'red' },
  prostitute: { key: 'prostitute', name: 'Проститутка', team: 'red' },
  bodyguard: { key: 'bodyguard', name: 'Телохранитель', team: 'red' },
  sleepwalker: { key: 'sleepwalker', name: 'Лунатик', team: 'red' },
  journalist: { key: 'journalist', name: 'Журналист', team: 'red' },
  doctor: { key: 'doctor', name: 'Доктор', team: 'red' },
  priest: { key: 'priest', name: 'Священник', team: 'red' },
  judge: { key: 'judge', name: 'Судья', team: 'red' },
  kamikaze: { key: 'kamikaze', name: 'Камикадзе', team: 'red' },
  immortal: { key: 'immortal', name: 'Бессмертный', team: 'red' },
  beauty: { key: 'beauty', name: 'Красотка', team: 'red' },
};

export const CITY_ROLES_BLACK = {
  oyabun: { key: 'oyabun', name: 'Оябун', team: 'black' },
  yakuza: { key: 'yakuza', name: 'Якудза', team: 'black' },
  maniac: { key: 'maniac', name: 'Маньяк', team: 'black' },
  ripper: { key: 'ripper', name: 'Потрошитель', team: 'black' },
  swindler: { key: 'swindler', name: 'Аферист', team: 'black' },
  thief: { key: 'thief', name: 'Вор', team: 'black' },
  snitch: { key: 'snitch', name: 'Стукач', team: 'black' },
  fangirl: { key: 'fangirl', name: 'Поклонница', team: 'black' },
  lawyer: { key: 'lawyer', name: 'Адвокат', team: 'black' },
};

export const BLACK_ROLES_SET = new Set([
  'don', 'black', 'oyabun', 'yakuza', 'maniac', 'ripper',
  'swindler', 'thief', 'snitch', 'fangirl', 'lawyer', 'mafia'
]);

export function getRoleLabel(role) {
  const all = { ...STANDARD_ROLES, ...CITY_ROLES_RED, ...CITY_ROLES_BLACK };
  return all[role]?.name || 'Мирный';
}

export function getRoleTeam(role) {
  if (!role) return 'red';
  if (BLACK_ROLES_SET.has(role)) return 'black';
  return 'red';
}

export function isBlackRole(role) {
  return BLACK_ROLES_SET.has(role);
}

export const CITY_ROLES_ALL = {
  sheriff:      { label: 'Шериф',        team: 'red' },
  detective:    { label: 'Детектив',      team: 'red' },
  jailer:       { label: 'Тюремщик',     team: 'red' },
  prostitute:   { label: 'Проститутка',   team: 'red' },
  bodyguard:    { label: 'Телохранитель', team: 'red' },
  sleepwalker:  { label: 'Лунатик',       team: 'red' },
  journalist:   { label: 'Журналист',     team: 'red' },
  doctor:       { label: 'Доктор',        team: 'red' },
  priest:       { label: 'Священник',     team: 'red' },
  judge:        { label: 'Судья',         team: 'red' },
  kamikaze:     { label: 'Камикадзе',     team: 'red' },
  immortal:     { label: 'Бессмертный',   team: 'red' },
  beauty:       { label: 'Красотка',      team: 'red' },
  don:          { label: 'Дон',           team: 'black' },
  mafia:        { label: 'Мафия',         team: 'black' },
  oyabun:       { label: 'Оябун',         team: 'black' },
  yakuza:       { label: 'Якудза',        team: 'black' },
  maniac:       { label: 'Маньяк',        team: 'black' },
  ripper:       { label: 'Потрошитель',   team: 'black' },
  swindler:     { label: 'Аферист',       team: 'black' },
  thief:        { label: 'Вор',           team: 'black' },
  snitch:       { label: 'Стукач',        team: 'black' },
  fangirl:      { label: 'Поклонница',    team: 'black' },
  lawyer:       { label: 'Адвокат',       team: 'black' },
  peace:        { label: 'Мирный',        team: 'red' },
};

export const CITY_PLAYER_CONFIGS = {
  8:  { roles: ['don', 'mafia', 'sheriff'], peaceFill: 5 },
  9:  { roles: ['don', 'mafia', 'mafia', 'sheriff'], peaceFill: 5 },
  10: { roles: ['don', 'mafia', 'mafia', 'sheriff', 'doctor'], peaceFill: 5 },
  11: { roles: ['don', 'mafia', 'mafia', 'sheriff', 'doctor'], peaceFill: 6 },
  12: { roles: ['don', 'mafia', 'mafia', 'mafia', 'sheriff', 'doctor'], peaceFill: 6 },
  13: { roles: ['don', 'mafia', 'mafia', 'maniac', 'sheriff', 'doctor', 'kamikaze'], peaceFill: 6 },
  14: { roles: ['don', 'mafia', 'mafia', 'maniac', 'sheriff', 'doctor', 'kamikaze', 'immortal'], peaceFill: 6 },
  15: { roles: ['don', 'mafia', 'mafia', 'mafia', 'maniac', 'sheriff', 'doctor', 'kamikaze', 'immortal'], peaceFill: 6 },
  16: { roles: ['don', 'mafia', 'mafia', 'mafia', 'maniac', 'sheriff', 'doctor', 'kamikaze', 'immortal', 'beauty'], peaceFill: 6 },
};

export const CITY_BASE_ROLES_17 = ['don', 'mafia', 'mafia', 'mafia', 'maniac', 'sheriff', 'doctor', 'kamikaze', 'immortal', 'beauty'];

export const CITY_OPTIONAL_ROLES = [
  'detective', 'jailer', 'prostitute', 'bodyguard', 'sleepwalker',
  'journalist', 'priest', 'judge',
  'oyabun', 'yakuza', 'ripper', 'swindler', 'thief', 'snitch', 'fangirl', 'lawyer'
];

export const CITY_BEST_MOVE_CONFIG = { 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5 };

export function getCityBestMoveMax(playerCount) {
  return CITY_BEST_MOVE_CONFIG[playerCount] || 0;
}

export function getCityActiveRoles(count, roleToggles = {}) {
  const configs = CITY_PLAYER_CONFIGS;
  if (count <= 16 && configs[count]) {
    const cfg = configs[count];
    const r = [...cfg.roles];
    for (let i = 0; i < cfg.peaceFill; i++) r.push('peace');
    return r;
  }
  const base = [...CITY_BASE_ROLES_17];
  CITY_OPTIONAL_ROLES.forEach(rk => { if (roleToggles[rk]) base.push(rk); });
  const remaining = count - base.length;
  for (let i = 0; i < remaining; i++) base.push('peace');
  return base;
}

