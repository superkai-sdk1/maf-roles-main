export const COLOR_SCHEMES = [
  { key: 'purple', name: 'TITAN', accent: '#a855f7', gradient: ['#a855f7', '#7c3aed'] },
  { key: 'ruby', name: 'Рубин', accent: '#e0115f', gradient: ['#e0115f', '#b91048'] },
  { key: 'fire', name: 'Огонь', accent: '#ff512f', gradient: ['#ff512f', '#dd2476'] },
  { key: 'gold', name: 'Золото', accent: '#ffd700', gradient: ['#ffd700', '#f59e0b'] },
  { key: 'orange', name: 'Мандарин', accent: '#ffb347', gradient: ['#ffb347', '#ff6723'] },
  { key: 'lime', name: 'Лайм', accent: '#cddc39', gradient: ['#cddc39', '#8bc34a'] },
  { key: 'green', name: 'Изумруд', accent: '#6fe7b7', gradient: ['#6fe7b7', '#10b981'] },
  { key: 'teal', name: 'Бирюза', accent: '#1de9b6', gradient: ['#1de9b6', '#00bfa5'] },
  { key: 'aqua', name: 'Аквамарин', accent: '#00eaff', gradient: ['#00eaff', '#0097a7'] },
  { key: 'blue', name: 'Голубой лёд', accent: '#4fc3f7', gradient: ['#4fc3f7', '#0288d1'] },
  { key: 'steel', name: 'Сталь', accent: '#4682b4', gradient: ['#4682b4', '#34568b'] },
  { key: 'violet', name: 'Фиалка', accent: '#9f5afd', gradient: ['#9f5afd', '#6d28d9'] },
  { key: 'rose', name: 'Роза', accent: '#ff007f', gradient: ['#ff007f', '#c2185b'] },
  { key: 'pink', name: 'Розовый кварц', accent: '#ff6fcb', gradient: ['#ff6fcb', '#d946ef'] },
  { key: 'silver', name: 'Серебро', accent: '#b0c4de', gradient: ['#b0c4de', '#8e99a4'] },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function applyTheme(colorKey) {
  const color = COLOR_SCHEMES.find(c => c.key === colorKey) || COLOR_SCHEMES[0];
  const rgb = hexToRgb(color.accent);

  document.documentElement.style.setProperty('--maf-accent', color.accent);
  document.documentElement.style.setProperty('--maf-accent-color', color.accent);
  document.documentElement.style.setProperty('--accent-color', color.accent);
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  document.documentElement.style.setProperty('--accent-glow', `0 0 24px rgba(${rgb}, 0.5)`);
  document.documentElement.style.setProperty('--nexus-glow', `0 0 10px rgba(${rgb}, 0.5)`);
  document.documentElement.style.setProperty('--nexus-glow-strong', `0 0 20px rgba(${rgb}, 0.6), 0 0 40px rgba(${rgb}, 0.2)`);

  try {
    localStorage.setItem('maf_color_scheme', colorKey);
  } catch (e) { /* ignore */ }
}

export function loadSavedTheme() {
  try {
    return localStorage.getItem('maf_color_scheme') || 'purple';
  } catch (e) {
    return 'purple';
  }
}
