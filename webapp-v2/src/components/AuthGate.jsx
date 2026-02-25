import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/auth';
import { IconMafBoard } from '../utils/icons';

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
        <IconMafBoard size={40} color="var(--accent-color, #a855f7)" />
      </div>
      <div className="auth-title">MafBoard</div>
    </>
  );
}

function TelegramSection({ onSuccess }) {
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
      <div className="auth-tg-section">
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
      <div className="auth-tg-section">
        <div className="auth-tg-label">Отправьте код боту в Telegram</div>
        <div className="auth-code-display">{code}</div>
        <div className="auth-timer-bar">
          <div className="auth-timer-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="auth-timer-text">{timeStr}</div>
        {botLink && (
          <a href={botLink} target="_blank" rel="noopener noreferrer" className="auth-action-btn auth-action-btn--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.2 4.6 2.4 11.2c-.7.3-.7.8 0 1l4.3 1.6 1.7 5.2c.2.5.7.5 1 .2l2.4-2 5 3.6c.5.3 1 .1 1.1-.5L21.9 5.5c.2-.7-.3-1.2-.7-.9z"/></svg>
            Открыть @{botUsername || 'бота'}
          </a>
        )}
        <div className="auth-hint" style={{ marginTop: 4 }}>Ожидание подтверждения...</div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="auth-tg-section">
        <div className="auth-hint">Код истёк</div>
        <button className="auth-action-btn" onClick={requestNewCode}>
          Получить новый код
        </button>
      </div>
    );
  }

  return (
    <div className="auth-tg-section">
      {error && <div className="auth-error">{error}</div>}
      <button className="auth-action-btn" onClick={requestNewCode}>
        Попробовать снова
      </button>
    </div>
  );
}

function GomafiaSection({ onSuccess }) {
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
    <form className="auth-alt-body" onSubmit={handleSubmit}>
      <div className="auth-hint" style={{ margin: 0 }}>
        Для ранее привязанных аккаунтов GoMafia
      </div>
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
          'Войти'
        )}
      </button>
    </form>
  );
}

function PasskeySection({ onSuccess }) {
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
    <div className="auth-alt-body">
      <div className="auth-hint" style={{ margin: 0 }}>
        Для ранее настроенных PassKey (Face ID, Touch ID, PIN)
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
    </div>
  );
}

function AltMethods({ onSuccess }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const toggle = (method) => {
    if (expanded === method) {
      setExpanded(null);
    } else {
      setExpanded(method);
      setOpen(true);
    }
  };

  return (
    <div className="auth-alt">
      <button className="auth-alt-toggle" onClick={() => { setOpen(!open); if (open) setExpanded(null); }}>
        <span>Другие способы входа</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="auth-alt-list">
          {/* GoMafia */}
          <div className={`auth-alt-item ${expanded === 'gomafia' ? 'auth-alt-item--open' : ''}`}>
            <button className="auth-alt-item-header" onClick={() => toggle('gomafia')}>
              <span className="auth-alt-item-icon auth-alt-item-icon--gomafia">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 12.5c0-2.5 2-4.5 4.5-4.5a4.5 4.5 0 0 1 3 1.1A4.5 4.5 0 0 1 14 8c2.5 0 4.5 2 4.5 4.5v0"/>
                  <circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/>
                  <path d="M5 16c0 2.2 3.1 4 7 4s7-1.8 7-4"/>
                </svg>
              </span>
              <span className="auth-alt-item-label">GoMafia ID</span>
              <svg
                className="auth-alt-item-chevron"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expanded === 'gomafia' && <GomafiaSection onSuccess={onSuccess} />}
          </div>

          {/* PassKey */}
          <div className={`auth-alt-item ${expanded === 'passkey' ? 'auth-alt-item--open' : ''}`}>
            <button className="auth-alt-item-header" onClick={() => toggle('passkey')}>
              <span className="auth-alt-item-icon auth-alt-item-icon--passkey">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 7a4 4 0 1 0-4 4h4V7z"/>
                  <path d="M15 11h-1v8l2 2 2-2-2-2 2-2-3-1V11z"/>
                </svg>
              </span>
              <span className="auth-alt-item-label">PassKey</span>
              <svg
                className="auth-alt-item-chevron"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expanded === 'passkey' && <PasskeySection onSuccess={onSuccess} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PasskeySuggest({ onDone }) {
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
    return <PasskeySuggest onDone={handlePasskeySuggestDone} />;
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

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <AuthHeader />

        <TelegramSection onSuccess={handleSuccess} />

        <AltMethods onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
