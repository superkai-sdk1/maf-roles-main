const tg = window.Telegram?.WebApp;

function updateSafeAreaCSS() {
  if (!tg) return;
  const root = document.documentElement;

  const sa = tg.safeAreaInset || {};
  root.style.setProperty('--tg-safe-area-inset-top', `${sa.top || 0}px`);
  root.style.setProperty('--tg-safe-area-inset-bottom', `${sa.bottom || 0}px`);
  root.style.setProperty('--tg-safe-area-inset-left', `${sa.left || 0}px`);
  root.style.setProperty('--tg-safe-area-inset-right', `${sa.right || 0}px`);

  const csa = tg.contentSafeAreaInset || {};
  root.style.setProperty('--tg-content-safe-area-inset-top', `${csa.top || 0}px`);
  root.style.setProperty('--tg-content-safe-area-inset-bottom', `${csa.bottom || 0}px`);
  root.style.setProperty('--tg-content-safe-area-inset-left', `${csa.left || 0}px`);
  root.style.setProperty('--tg-content-safe-area-inset-right', `${csa.right || 0}px`);
}

function applyAppColors() {
  if (!tg) return;
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--maf-bg-main').trim() || '#040410';
  try {
    tg.setHeaderColor(bg);
    tg.setBackgroundColor(bg);
    tg.setBottomBarColor?.(bg);
  } catch (e) { /* older clients may not support all methods */ }
}

export function initTelegramApp() {
  if (!tg) return;

  tg.ready();
  tg.expand();

  if (typeof tg.disableVerticalSwipes === 'function') {
    tg.disableVerticalSwipes();
  }

  if (typeof tg.requestFullscreen === 'function') {
    try { tg.requestFullscreen(); } catch (e) { /* not supported or already fullscreen */ }
  }

  if (typeof tg.enableClosingConfirmation === 'function') {
    tg.enableClosingConfirmation();
  }

  if (typeof tg.lockOrientation === 'function') {
    try { tg.lockOrientation(); } catch (e) { /* ignore */ }
  }

  applyAppColors();
  updateSafeAreaCSS();

  tg.onEvent?.('safeAreaChanged', updateSafeAreaCSS);
  tg.onEvent?.('contentSafeAreaChanged', updateSafeAreaCSS);
  tg.onEvent?.('fullscreenChanged', () => {
    updateSafeAreaCSS();
    applyAppColors();
  });
  tg.onEvent?.('viewportChanged', () => {
    updateSafeAreaCSS();
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  initScrollEdgeHaptics();
}

function initScrollEdgeHaptics() {
  const EDGE = 2;
  const COOLDOWN = 400;
  let lastTime = 0;
  const state = new WeakMap();

  const fire = () => {
    const now = Date.now();
    if (now - lastTime < COOLDOWN) return;
    lastTime = now;
    try {
      if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('soft');
      else if (window.navigator.vibrate) window.navigator.vibrate(5);
    } catch (e) { /* ignore */ }
  };

  document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (el === document || el === document.documentElement) return;
    if (!el || !el.scrollHeight) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop <= EDGE;
    const atBottom = scrollTop + clientHeight >= scrollHeight - EDGE;

    let s = state.get(el);
    if (!s) { s = { top: true, bottom: false }; state.set(el, s); }

    if (atTop && !s.top) fire();
    if (atBottom && !s.bottom) fire();

    s.top = atTop;
    s.bottom = atBottom;
  }, true);
}

export function refreshTelegramColors() {
  applyAppColors();
}
