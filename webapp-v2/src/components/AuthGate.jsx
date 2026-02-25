import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/auth';
import { IconCards } from '../utils/icons';

const TAB_TELEGRAM = 'telegram';
const TAB_GOMAFIA = 'gomafia';
const TAB_PASSKEY = 'passkey';
const PASSKEY_DISMISSED_KEY = 'maf_passkey_dismissed';

function shouldSuggestPasskey(userData) {
  if (!userData || userData.passkey_linked) return false;
  if (authService.isTelegramWebView()) return false;
  if (!authService.isPasskeySupported()) return false;
  try {
    const dismissed = localStorage.getItem(PASSKEY_DISMISSED_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return false;
    }
  } catch { /* ignore */ }
  return true;
}

function AuthHeader() {
  return (
    <>
      <div className="auth-logo">
        <IconCards size={40} color="var(--accent-color, #a855f7)" />
      </div>
      <div className="auth-title">MafBoard</div>
    </>
  );
}

function TelegramTab({ onSuccess }) {
  const [state, setState] = useState('idle');
  const [code, setCode] = useState(null);
  const [botLink, setBotLink] = useState(null);
  const [botUsername, setBotUsername] = useState(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const requestNewCode = useCallback(async () => {
    setError('');
    setState('requesting');

    const result = await authService.requestCode();
    if (!mountedRef.current) return;

    if (result.success) {
      setCode(result.code);
      setBotLink(result.botLink);
      setBotUsername(result.botUsername);
      setExpiresIn(result.expiresIn);
      setState('show_code');

      stopPolling();
      let remaining = result.expiresIn;

      timerRef.current = setInterval(() => {
        remaining--;
        if (!mountedRef.current) return;
        setExpiresIn(remaining);
        if (remaining <= 0) {
          stopPolling();
          setState('expired');
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        const check = await authService.checkCode(result.code);
        if (!mountedRef.current) return;
        if (check.confirmed) {
          stopPolling();
          onSuccess(check.user);
        } else if (check.expired) {
          stopPolling();
          setState('expired');
        }
      }, authService.POLL_INTERVAL);
    } else {
      setError(result.error || 'Не удалось получить код');
      setState('error');
    }
  }, [stopPolling, onSuccess]);

  useEffect(() => {
    requestNewCode();
  }, [requestNewCode]);

  if (state === 'requesting' || state === 'idle') {
    return (
      <div className="auth-tab-content">
        <div className="auth-spinner" />
        <div className="auth-hint">Получение кода...</div>
      </div>
    );
  }

  if (state === 'show_code') {
    const minutes = Math.floor(expiresIn / 60);
    const seconds = expiresIn % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const progress = Math.max(0, expiresIn / 300);

    return (
      <div className="auth-tab-content">
        <div className="auth-code-display">{code}</div>
        <div className="auth-timer-bar">
          <div className="auth-timer-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="auth-timer-text">{timeStr}</div>
        <div className="auth-instructions">
          Отправьте этот код боту в Telegram
        </div>
        {botLink && (
          <a href={botLink} target="_blank" rel="noopener noreferrer" className="auth-action-btn auth-action-btn--primary">
            Открыть @{botUsername || 'бота'}
          </a>
        )}
        <div className="auth-hint">Ожидание подтверждения...</div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="auth-tab-content">
        <div className="auth-hint">Код истёк</div>
        <button className="auth-action-btn" onClick={requestNewCode}>
          Получить новый код
        </button>
      </div>
    );
  }

  return (
    <div className="auth-tab-content">
      {error && <div className="auth-error">{error}</div>}
      <button className="auth-action-btn" onClick={requestNewCode}>
        Попробовать снова
      </button>
    </div>
  );
}

function GomafiaTab({ onSuccess }) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !password) return;

    setError('');
    setLoading(true);

    const result = await authService.gomafiaLogin(nickname.trim(), password);

    if (result.success) {
      onSuccess(result.user);
    } else {
      setError(result.error || 'Не удалось войти');
      setLoading(false);
    }
  };

  return (
    <div className="auth-tab-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="auth-input"
          placeholder="Никнейм GoMafia"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          disabled={loading}
          autoComplete="username"
          autoCapitalize="off"
        />
        <input
          type="password"
          className="auth-input"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
        />
        {error && <div className="auth-error">{error}</div>}
        <button
          type="submit"
          className="auth-action-btn auth-action-btn--primary"
          disabled={loading || !nickname.trim() || !password}
        >
          {loading ? (
            <><span className="auth-btn-spinner" /> Вход...</>
          ) : (
            'Войти через GoMafia'
          )}
        </button>
      </form>
    </div>
  );
}

function PasskeyTab({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setError('');
    setLoading(true);

    const result = await authService.passkeyAuth();

    if (result.success) {
      onSuccess(result.user);
    } else {
      setError(result.error || 'Ошибка PassKey');
      setLoading(false);
    }
  };

  return (
    <div className="auth-tab-content">
      <div className="auth-passkey-icon">🔐</div>
      <div className="auth-instructions">
        Войдите с помощью биометрии
      </div>
      <div className="auth-hint" style={{ marginBottom: 8 }}>
        Face ID, Touch ID или PIN-код устройства
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button
        className="auth-action-btn auth-action-btn--primary"
        onClick={handleAuth}
        disabled={loading}
      >
        {loading ? (
          <><span className="auth-btn-spinner" /> Проверка...</>
        ) : (
          'Войти с PassKey'
        )}
      </button>
      <div className="auth-hint" style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, lineHeight: 1.5 }}>
        PassKey создаётся автоматически при первом входе через Telegram или GoMafia.
      </div>
    </div>
  );
}

function PasskeySuggest({ user, onDone }) {
  const [state, setState] = useState('prompt');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setState('creating');
    setError('');
    const token = authService.getStoredToken();
    const result = await authService.passkeyRegister(token);
    if (result.success) {
      setState('done');
    } else {
      setError(result.error || 'Не удалось создать PassKey');
      setState('prompt');
    }
  };

  if (state === 'done') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-passkey-icon" style={{ fontSize: '2.5em' }}>&#x2705;</div>
          <div className="auth-title" style={{ fontSize: '1.15em', marginTop: 8 }}>PassKey создан!</div>
          <div className="auth-hint" style={{ marginBottom: 16 }}>
            Теперь вы можете входить с помощью биометрии (Face ID, Touch ID, PIN).
          </div>
          <button className="auth-action-btn auth-action-btn--primary" onClick={onDone}>
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-passkey-icon" style={{ fontSize: '2.5em' }}>🔐</div>
        <div className="auth-title" style={{ fontSize: '1.15em', marginTop: 8 }}>Быстрый вход</div>
        <div className="auth-hint" style={{ marginBottom: 4, lineHeight: 1.6 }}>
          Настройте вход по биометрии, чтобы в следующий раз
          входить через Face ID, Touch ID или PIN-код.
        </div>
        {error && <div className="auth-error" style={{ margin: '8px 0' }}>{error}</div>}
        <button
          className="auth-action-btn auth-action-btn--primary"
          onClick={handleCreate}
          disabled={state === 'creating'}
          style={{ marginTop: 12 }}
        >
          {state === 'creating' ? (
            <><span className="auth-btn-spinner" /> Настройка...</>
          ) : (
            'Настроить PassKey'
          )}
        </button>
        <button
          className="auth-action-btn"
          onClick={() => {
            try { localStorage.setItem(PASSKEY_DISMISSED_KEY, String(Date.now())); } catch {}
            onDone();
          }}
          style={{ marginTop: 6, opacity: 0.5 }}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}

export function AuthGate({ children }) {
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(TAB_TELEGRAM);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      const result = await authService.tryAutoAuth();
      if (!mountedRef.current) return;
      if (result.authenticated) {
        setUser(result.user);
        if (shouldSuggestPasskey(result.user)) {
          setState('suggest_passkey');
        } else {
          setState('ready');
        }
      } else {
        setState('choose_method');
      }
    })();
  }, []);

  const handleSuccess = useCallback((userData) => {
    setUser(userData);
    if (shouldSuggestPasskey(userData)) {
      setState('suggest_passkey');
    } else {
      setState('ready');
    }
  }, []);

  const handlePasskeySuggestDone = useCallback(() => {
    setState('ready');
  }, []);

  if (state === 'ready') return children;

  if (state === 'suggest_passkey') {
    return <PasskeySuggest user={user} onDone={handlePasskeySuggestDone} />;
  }

  if (state === 'loading') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <AuthHeader />
          <div className="auth-spinner" />
          <div className="auth-hint">Проверка авторизации...</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: TAB_TELEGRAM, label: 'Telegram', icon: '✈️' },
    { id: TAB_GOMAFIA, label: 'GoMafia', icon: '🎭' },
    { id: TAB_PASSKEY, label: 'PassKey', icon: '🔐' },
  ];

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <AuthHeader />
        <div className="auth-subtitle">Выберите способ входа</div>

        <div className="auth-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`auth-tab ${activeTab === tab.id ? 'auth-tab--active' : ''} ${tab.id === TAB_TELEGRAM ? 'auth-tab--primary' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="auth-tab-icon">{tab.icon}</span>
              <span className="auth-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="auth-tab-body">
          {activeTab === TAB_TELEGRAM && <TelegramTab onSuccess={handleSuccess} />}
          {activeTab === TAB_GOMAFIA && <GomafiaTab onSuccess={handleSuccess} />}
          {activeTab === TAB_PASSKEY && <PasskeyTab onSuccess={handleSuccess} />}
        </div>
      </div>
    </div>
  );
}
