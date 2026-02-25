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

// =====================================================
// GoMafia authentication
// =====================================================

async function gomafiaLogin(nickname, password) {
  try {
    const res = await fetch(`${AUTH_BASE}gomafia-login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password }),
    });
    const data = await res.json();
    if (data.token && data.user) {
      storeAuth(data.token, data.user);
      return { success: true, token: data.token, user: data.user };
    }
    return { success: false, error: data.error || 'Ошибка авторизации' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// =====================================================
// PassKey (WebAuthn) authentication
// =====================================================

function isPasskeySupported() {
  return !!(window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function');
}

async function isPasskeyAvailable() {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function passkeyAuth() {
  if (!isPasskeySupported()) {
    return { success: false, error: 'Ваш браузер не поддерживает PassKey' };
  }

  try {
    const optRes = await fetch(`${AUTH_BASE}passkey-auth-options.php`);
    const options = await optRes.json();
    if (options.error) return { success: false, error: options.error };

    const publicKey = options.publicKey;
    publicKey.challenge = base64urlToBuffer(publicKey.challenge);
    if (publicKey.allowCredentials) {
      publicKey.allowCredentials = publicKey.allowCredentials.map(c => ({
        ...c,
        id: base64urlToBuffer(c.id),
      }));
    }

    const credential = await navigator.credentials.get({ publicKey });

    const res = await fetch(`${AUTH_BASE}passkey-auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: bufferToBase64url(credential.rawId),
        authenticatorData: bufferToBase64url(credential.response.authenticatorData),
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
        signature: bufferToBase64url(credential.response.signature),
        userHandle: credential.response.userHandle
          ? bufferToBase64url(credential.response.userHandle) : null,
      }),
    });
    const data = await res.json();
    if (data.token && data.user) {
      storeAuth(data.token, data.user);
      return { success: true, token: data.token, user: data.user };
    }
    return { success: false, error: data.error || 'Ошибка PassKey' };
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      return { success: false, error: 'Операция отменена' };
    }
    return { success: false, error: e.message };
  }
}

async function passkeyRegister(token, deviceName) {
  if (!isPasskeySupported()) {
    return { success: false, error: 'Ваш браузер не поддерживает PassKey' };
  }

  try {
    const optRes = await fetch(`${AUTH_BASE}passkey-register-options.php?token=${encodeURIComponent(token)}`);
    const options = await optRes.json();
    if (options.error) return { success: false, error: options.error };

    const publicKey = options.publicKey;
    publicKey.challenge = base64urlToBuffer(publicKey.challenge);
    publicKey.user.id = base64urlToBuffer(publicKey.user.id);
    if (publicKey.excludeCredentials) {
      publicKey.excludeCredentials = publicKey.excludeCredentials.map(c => ({
        ...c,
        id: base64urlToBuffer(c.id),
      }));
    }

    const credential = await navigator.credentials.create({ publicKey });

    const response = credential.response;
    const publicKeyBytes = response.getPublicKey();
    const algorithm = response.getPublicKeyAlgorithm();
    const authData = response.getAuthenticatorData();
    const transports = response.getTransports ? response.getTransports() : [];

    const res = await fetch(`${AUTH_BASE}passkey-register.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        credentialId: bufferToBase64url(credential.rawId),
        publicKey: bufferToBase64(publicKeyBytes),
        publicKeyAlgorithm: algorithm,
        authenticatorData: bufferToBase64url(authData),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        transports,
        deviceName: deviceName || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      return { success: true, passkeyId: data.passkey_id };
    }
    return { success: false, error: data.error || 'Ошибка регистрации PassKey' };
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      return { success: false, error: 'Операция отменена' };
    }
    if (e.name === 'InvalidStateError') {
      return { success: false, error: 'Этот ключ уже зарегистрирован' };
    }
    return { success: false, error: e.message };
  }
}

// =====================================================
// Account linking
// =====================================================

async function getLinkedAccounts(token) {
  try {
    const res = await fetch(`${AUTH_BASE}link-account.php?token=${encodeURIComponent(token)}`);
    return await res.json();
  } catch {
    return null;
  }
}

async function linkGomafia(token, nickname, password) {
  try {
    const res = await fetch(`${AUTH_BASE}link-account.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, method: 'gomafia', nickname, password }),
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function unlinkMethod(token, method, passkeyId) {
  try {
    let url = `${AUTH_BASE}link-account.php?token=${encodeURIComponent(token)}&method=${method}`;
    if (passkeyId) url += `&passkey_id=${passkeyId}`;
    const res = await fetch(url, { method: 'DELETE' });
    return await res.json();
  } catch (e) {
    return { error: e.message };
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
  gomafiaLogin,
  passkeyAuth,
  passkeyRegister,
  isPasskeySupported,
  isPasskeyAvailable,
  getLinkedAccounts,
  linkGomafia,
  unlinkMethod,
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
