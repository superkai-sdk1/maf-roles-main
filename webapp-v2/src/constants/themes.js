export const COLOR_SCHEMES = [
  { key: 'purple', name: 'TITAN', accent: '#a855f7', gradient: ['#a855f7', '#7c3aed'],
    darkBg: ['#040410', '#0d0a2a', '#1a0f4a'], lightBg: ['#f2f0f7', '#e8e4f0', '#ddd6ed'] },
  { key: 'ruby', name: 'Рубин', accent: '#e0115f', gradient: ['#e0115f', '#b91048'],
    darkBg: ['#0e0408', '#2a0a16', '#42102a'], lightBg: ['#f7f0f2', '#f0e4e8', '#edcdd6'] },
  { key: 'fire', name: 'Огонь', accent: '#ff512f', gradient: ['#ff512f', '#dd2476'],
    darkBg: ['#0e0604', '#2a120a', '#42180f'], lightBg: ['#f7f2f0', '#f0e6e2', '#edd6cc'] },
  { key: 'gold', name: 'Золото', accent: '#ffd700', gradient: ['#ffd700', '#f59e0b'],
    darkBg: ['#0e0c04', '#2a220a', '#42360f'], lightBg: ['#f7f5f0', '#f0ece2', '#ede4cc'] },
  { key: 'orange', name: 'Мандарин', accent: '#ffb347', gradient: ['#ffb347', '#ff6723'],
    darkBg: ['#0e0904', '#2a1a0a', '#42280f'], lightBg: ['#f7f3f0', '#f0e8e2', '#eddccc'] },
  { key: 'lime', name: 'Лайм', accent: '#cddc39', gradient: ['#cddc39', '#8bc34a'],
    darkBg: ['#080e04', '#162a0a', '#264210'], lightBg: ['#f3f7f0', '#eaf0e2', '#deedcc'] },
  { key: 'green', name: 'Изумруд', accent: '#6fe7b7', gradient: ['#6fe7b7', '#10b981'],
    darkBg: ['#040e08', '#0a2a18', '#104228'], lightBg: ['#f0f7f3', '#e2f0ea', '#ccedde'] },
  { key: 'teal', name: 'Бирюза', accent: '#1de9b6', gradient: ['#1de9b6', '#00bfa5'],
    darkBg: ['#040e0c', '#0a2a24', '#10423a'], lightBg: ['#f0f7f5', '#e2f0ec', '#ccede4'] },
  { key: 'aqua', name: 'Аквамарин', accent: '#00eaff', gradient: ['#00eaff', '#0097a7'],
    darkBg: ['#040c0e', '#0a242a', '#103a42'], lightBg: ['#f0f5f7', '#e2ecf0', '#cce4ed'] },
  { key: 'blue', name: 'Голубой лёд', accent: '#4fc3f7', gradient: ['#4fc3f7', '#0288d1'],
    darkBg: ['#04080e', '#0a162a', '#0f2442'], lightBg: ['#f0f2f7', '#e2e8f0', '#ccdaed'] },
  { key: 'steel', name: 'Сталь', accent: '#4682b4', gradient: ['#4682b4', '#34568b'],
    darkBg: ['#06080c', '#0e1624', '#16223a'], lightBg: ['#f0f2f5', '#e4e8ee', '#d4dae6'] },
  { key: 'violet', name: 'Фиалка', accent: '#9f5afd', gradient: ['#9f5afd', '#6d28d9'],
    darkBg: ['#06040e', '#120a2a', '#1e1042'], lightBg: ['#f3f0f7', '#e8e4f0', '#ddd0ed'] },
  { key: 'rose', name: 'Роза', accent: '#ff007f', gradient: ['#ff007f', '#c2185b'],
    darkBg: ['#0e0408', '#2a0a18', '#42102c'], lightBg: ['#f7f0f3', '#f0e4ea', '#edccdc'] },
  { key: 'pink', name: 'Розовый кварц', accent: '#ff6fcb', gradient: ['#ff6fcb', '#d946ef'],
    darkBg: ['#0e040a', '#2a0a1e', '#421034'], lightBg: ['#f7f0f4', '#f0e4ec', '#edcce2'] },
  { key: 'silver', name: 'Серебро', accent: '#b0c4de', gradient: ['#b0c4de', '#8e99a4'],
    darkBg: ['#08080a', '#161620', '#222236'], lightBg: ['#f3f3f5', '#eaeaee', '#dddde4'] },
];

const LIGHT_ACCENT_OVERRIDES = {
  gold: '#c9a800',
  lime: '#7cb305',
  silver: '#6b7b8d',
  orange: '#e08c00',
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function applyTheme(colorKey) {
  const color = COLOR_SCHEMES.find(c => c.key === colorKey) || COLOR_SCHEMES[0];
  const isLight = document.documentElement.classList.contains('light-mode');
  const effectiveAccent = isLight && LIGHT_ACCENT_OVERRIDES[colorKey]
    ? LIGHT_ACCENT_OVERRIDES[colorKey]
    : color.accent;
  const rgb = hexToRgb(effectiveAccent);
  const gradRgb0 = hexToRgb(color.gradient[0]);
  const gradRgb1 = hexToRgb(color.gradient[1]);

  const root = document.documentElement.style;
  root.setProperty('--maf-accent', effectiveAccent);
  root.setProperty('--maf-accent-color', effectiveAccent);
  root.setProperty('--accent-color', effectiveAccent);
  root.setProperty('--accent-rgb', rgb);
  root.setProperty('--accent-gradient', `linear-gradient(135deg, ${color.gradient[0]}, ${color.gradient[1]})`);
  root.setProperty('--accent-gradient-rgb-0', gradRgb0);
  root.setProperty('--accent-gradient-rgb-1', gradRgb1);

  const bg = isLight ? (color.lightBg || ['#f2f2f7', '#e5e5ea', '#e0dced']) : (color.darkBg || ['#040410', '#0d0a2a', '#1a0f4a']);
  root.setProperty('--maf-bg-main', bg[0]);
  root.setProperty('--maf-bg-secondary', bg[1]);
  root.setProperty('--maf-gradient-bg', `linear-gradient(135deg, ${bg[0]} 0%, ${bg[1]} 25%, ${bg[2]} 50%, ${bg[1]} 75%, ${bg[0]} 100%)`);

  if (isLight) {
    root.setProperty('--accent-glow', `0 0 16px rgba(${rgb}, 0.25)`);
    root.setProperty('--nexus-glow', `0 0 8px rgba(${rgb}, 0.2)`);
    root.setProperty('--nexus-glow-strong', `0 0 14px rgba(${rgb}, 0.3), 0 0 28px rgba(${rgb}, 0.1)`);
    root.setProperty('--accent-surface', `rgba(${rgb}, 0.06)`);
    root.setProperty('--accent-surface-hover', `rgba(${rgb}, 0.10)`);
    root.setProperty('--accent-border', `rgba(${rgb}, 0.12)`);
    root.setProperty('--accent-border-strong', `rgba(${rgb}, 0.22)`);
  } else {
    root.setProperty('--accent-glow', `0 0 24px rgba(${rgb}, 0.5)`);
    root.setProperty('--nexus-glow', `0 0 10px rgba(${rgb}, 0.5)`);
    root.setProperty('--nexus-glow-strong', `0 0 20px rgba(${rgb}, 0.6), 0 0 40px rgba(${rgb}, 0.2)`);
    root.setProperty('--accent-surface', `rgba(${rgb}, 0.1)`);
    root.setProperty('--accent-surface-hover', `rgba(${rgb}, 0.15)`);
    root.setProperty('--accent-border', `rgba(${rgb}, 0.15)`);
    root.setProperty('--accent-border-strong', `rgba(${rgb}, 0.3)`);
  }

  try {
    localStorage.setItem('maf_color_scheme', colorKey);
  } catch (e) { /* ignore */ }

  updateTelegramColors();
}

export function applyDarkMode(isDark) {
  const html = document.documentElement;
  if (isDark) {
    html.classList.remove('light-mode');
  } else {
    html.classList.add('light-mode');
  }

  try {
    localStorage.setItem('maf_dark_mode', isDark ? 'dark' : 'light');
  } catch (e) { /* ignore */ }

  const savedColor = loadSavedTheme();
  applyTheme(savedColor);
  updateTelegramColors();
}

export function loadSavedTheme() {
  try {
    return localStorage.getItem('maf_color_scheme') || 'purple';
  } catch (e) {
    return 'purple';
  }
}

export function loadSavedDarkMode() {
  try {
    const val = localStorage.getItem('maf_dark_mode');
    if (val === 'light') return false;
    return true;
  } catch (e) {
    return true;
  }
}

function updateTelegramColors() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--maf-bg-main').trim() || '#040410';
      tg.setHeaderColor?.(bg);
      tg.setBackgroundColor?.(bg);
      tg.setBottomBarColor?.(bg);
    }
  } catch (e) { /* ignore */ }
}
