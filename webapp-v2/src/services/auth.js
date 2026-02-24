const AUTH_BASE = '/login/';
const TOKEN_KEY = 'maf_auth_token';
const USER_KEY = 'maf_auth_user';
const POLL_INTERVAL = 2500;

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function storeAuth(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* ignore */ }
}

function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

async function validateToken(token) {
  try {
    const res = await fetch(`${AUTH_BASE}session-validate.php?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.valid && data.user) {
      storeAuth(token, data.user);
      return { valid: true, user: data.user };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function telegramAuth() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return { success: false };

  try {
    const res = await fetch(`${AUTH_BASE}tg-auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const data = await res.json();
    if (data.token && data.user) {
      storeAuth(data.token, data.user);
      return { success: true, token: data.token, user: data.user };
    }
    return { success: false, error: data.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function requestCode() {
  try {
    const res = await fetch(`${AUTH_BASE}code-generate.php`, { method: 'POST' });
    const data = await res.json();
    if (data.code) {
      return {
        success: true,
        code: data.code,
        expiresIn: data.expires_in || 300,
        botUsername: data.bot_username || null,
        botLink: data.bot_link || null,
      };
    }
    return { success: false, error: data.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function checkCode(code) {
  try {
    const res = await fetch(`${AUTH_BASE}code-check.php?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (data.confirmed && data.token) {
      const user = data.user || {};
      storeAuth(data.token, user);
      return { confirmed: true, token: data.token, user };
    }
    if (data.expired) return { expired: true };
    return { confirmed: false };
  } catch {
    return { confirmed: false };
  }
}

export const authService = {
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
  validateToken,
  telegramAuth,
  requestCode,
  checkCode,
  POLL_INTERVAL,

  async tryAutoAuth() {
    const token = getStoredToken();
    if (token) {
      const result = await validateToken(token);
      if (result.valid) return { authenticated: true, user: result.user, method: 'token' };
      clearAuth();
    }

    if (window.Telegram?.WebApp?.initData) {
      const result = await telegramAuth();
      if (result.success) return { authenticated: true, user: result.user, method: 'telegram' };
    }

    return { authenticated: false };
  },

  logout() {
    clearAuth();
  },
};
