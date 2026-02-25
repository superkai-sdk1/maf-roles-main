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
      <div className="w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-purple-500/15 to-indigo-500/[0.08]
        border border-purple-500/25 flex items-center justify-center
        shadow-[0_8px_32px_rgba(168,85,247,0.2),0_0_60px_rgba(168,85,247,0.06)] mb-2">
        <IconMafBoard size={40} color="var(--accent-color, #a855f7)" />
      </div>
      <div className="text-[1.6em] font-black tracking-tight text-white">MafBoard</div>
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
      <div className="flex flex-col items-center gap-1.5 py-2">
        <div className="w-8 h-8 border-[3px] border-white/[0.08] border-t-[var(--accent-color)] rounded-full animate-auth-spin my-3" />
        <div className="text-[0.8em] text-white/30 font-medium">Получение кода...</div>
      </div>
    );
  }

  if (state === 'show_code') {
    const minutes = Math.floor(expiresIn / 60);
    const seconds = expiresIn % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const progress = Math.max(0, expiresIn / 300);

    return (
      <div className="flex flex-col items-center gap-1.5 pt-2 pb-1 w-full">
        <div className="text-[0.85em] font-semibold text-white/50 mb-0.5">Отправьте код боту в Telegram</div>
        <div className="text-3xl font-black tracking-[0.3em] text-white font-mono py-3">{code}</div>
        <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-color)] to-indigo-500/80 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-xs text-white/30 tabular-nums font-medium">{timeStr}</div>
        {botLink && (
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-2 px-4 py-3 rounded-2xl
              bg-accent text-white text-sm font-bold no-underline
              active:scale-[0.97] transition-transform duration-150 ease-spring"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.2 4.6 2.4 11.2c-.7.3-.7.8 0 1l4.3 1.6 1.7 5.2c.2.5.7.5 1 .2l2.4-2 5 3.6c.5.3 1 .1 1.1-.5L21.9 5.5c.2-.7-.3-1.2-.7-.9z"/></svg>
            Открыть @{botUsername || 'бота'}
          </a>
        )}
        <div className="text-[0.8em] text-white/30 font-medium mt-1">Ожидание подтверждения...</div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2 w-full">
        <div className="text-[0.8em] text-white/30 font-medium">Код истёк</div>
        <button
          className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
            text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
          onClick={requestNewCode}
        >
          Получить новый код
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 py-2 w-full">
      {error && <div className="text-red-400 text-sm font-medium text-center">{error}</div>}
      <button
        className="w-full mt-2 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]
          text-white/70 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
        onClick={requestNewCode}
      >
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
    <form className="flex flex-col gap-2 px-3.5 pb-3.5 animate-slide-down" onSubmit={handleSubmit}>
      <div className="text-[0.8em] text-white/30 font-medium">
        Для ранее привязанных аккаунтов GoMafia
      </div>
      <input
        type="text"
        className="input-field"
        placeholder="Никнейм GoMafia"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        disabled={loading}
        autoComplete="username"
        autoCapitalize="off"
      />
      <input
        type="password"
        className="input-field"
        placeholder="Пароль"
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={loading}
        autoComplete="current-password"
      />
      {error && <div className="text-red-400 text-sm font-medium text-center">{error}</div>}
      <button
        type="submit"
        className="w-full px-4 py-3 rounded-2xl bg-accent text-white text-sm font-bold
          disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-spring"
        disabled={loading || !nickname.trim() || !password}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-auth-spin" />
            Вход...
          </span>
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
    <div className="flex flex-col gap-2 px-3.5 pb-3.5 animate-slide-down">
      <div className="text-[0.8em] text-white/30 font-medium">
        Для ранее настроенных PassKey (Face ID, Touch ID, PIN)
      </div>
      {error && <div className="text-red-400 text-sm font-medium text-center">{error}</div>}
      <button
        className="w-full px-4 py-3 rounded-2xl bg-accent text-white text-sm font-bold
          disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-spring"
        onClick={handleAuth}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-auth-spin" />
            Проверка...
          </span>
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
    <div className="w-full mt-4 border-t border-white/[0.06] pt-3">
      <button
        className="flex items-center justify-center gap-1.5 w-full py-2 bg-transparent border-none
          text-white/30 text-[0.78em] font-semibold cursor-pointer hover:text-white/50 transition-colors duration-200"
        onClick={() => { setOpen(!open); if (open) setExpanded(null); }}
      >
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
        <div className="flex flex-col gap-1.5 mt-2 animate-slide-down">
          {/* GoMafia */}
          <div className={`rounded-xl border overflow-hidden transition-colors duration-200
            ${expanded === 'gomafia' ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            <button
              className={`flex items-center gap-2.5 w-full px-3.5 py-3 bg-transparent border-none
                text-[0.88em] font-semibold cursor-pointer transition-colors duration-150
                ${expanded === 'gomafia' ? 'text-white' : 'text-white/60 hover:text-white/85'}`}
              onClick={() => toggle('gomafia')}
            >
              <span className="w-8 h-8 rounded-[9px] bg-purple-500/[0.12] text-purple-400 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 12.5c0-2.5 2-4.5 4.5-4.5a4.5 4.5 0 0 1 3 1.1A4.5 4.5 0 0 1 14 8c2.5 0 4.5 2 4.5 4.5v0"/>
                  <circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/>
                  <path d="M5 16c0 2.2 3.1 4 7 4s7-1.8 7-4"/>
                </svg>
              </span>
              <span className="flex-1 text-left">GoMafia ID</span>
              <svg
                className={`shrink-0 transition-transform duration-200 ${expanded === 'gomafia' ? 'rotate-180 opacity-70' : 'opacity-40'}`}
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expanded === 'gomafia' && <GomafiaSection onSuccess={onSuccess} />}
          </div>

          {/* PassKey */}
          <div className={`rounded-xl border overflow-hidden transition-colors duration-200
            ${expanded === 'passkey' ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            <button
              className={`flex items-center gap-2.5 w-full px-3.5 py-3 bg-transparent border-none
                text-[0.88em] font-semibold cursor-pointer transition-colors duration-150
                ${expanded === 'passkey' ? 'text-white' : 'text-white/60 hover:text-white/85'}`}
              onClick={() => toggle('passkey')}
            >
              <span className="w-8 h-8 rounded-[9px] bg-emerald-500/[0.12] text-emerald-400 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 7a4 4 0 1 0-4 4h4V7z"/>
                  <path d="M15 11h-1v8l2 2 2-2-2-2 2-2-3-1V11z"/>
                </svg>
              </span>
              <span className="flex-1 text-left">PassKey</span>
              <svg
                className={`shrink-0 transition-transform duration-200 ${expanded === 'passkey' ? 'rotate-180 opacity-70' : 'opacity-40'}`}
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
      <div className="fixed inset-0 z-[100000] bg-maf-bg flex items-center justify-center p-6 overflow-y-auto"
        style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
        <div className="w-full max-w-[360px] flex flex-col items-center text-center gap-2 animate-scale-in">
          <div className="text-[2.5em]">&#x2705;</div>
          <div className="text-[1.15em] font-black tracking-tight text-white mt-2">PassKey создан!</div>
          <div className="text-[0.8em] text-white/30 font-medium mb-4">
            Теперь вы можете входить с помощью биометрии (Face ID, Touch ID, PIN).
          </div>
          <button
            className="w-full px-4 py-3 rounded-2xl bg-accent text-white text-sm font-bold
              active:scale-[0.97] transition-transform duration-150 ease-spring"
            onClick={onDone}
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-maf-bg flex items-center justify-center p-6 overflow-y-auto"
      style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <div className="w-full max-w-[360px] flex flex-col items-center text-center gap-2 animate-scale-in">
        <div className="text-[2.5em]">🔐</div>
        <div className="text-[1.15em] font-black tracking-tight text-white mt-2">Быстрый вход</div>
        <div className="text-[0.8em] text-white/30 font-medium leading-relaxed mb-1">
          Настройте вход по биометрии, чтобы в следующий раз
          входить через Face ID, Touch ID или PIN-код.
        </div>
        {error && <div className="text-red-400 text-sm font-medium my-2">{error}</div>}
        <button
          className="w-full px-4 py-3 rounded-2xl bg-accent text-white text-sm font-bold
            disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-spring mt-3"
          onClick={handleCreate}
          disabled={state === 'creating'}
        >
          {state === 'creating' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-auth-spin" />
              Настройка...
            </span>
          ) : (
            'Настроить PassKey'
          )}
        </button>
        <button
          className="w-full px-4 py-3 rounded-2xl bg-transparent text-white/30 text-sm font-bold mt-1.5
            active:scale-[0.97] transition-transform duration-150 ease-spring"
          onClick={() => {
            try { localStorage.setItem(PASSKEY_DISMISSED_KEY, String(Date.now())); } catch {}
            onDone();
          }}
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
      <div className="fixed inset-0 z-[100000] bg-maf-bg flex items-center justify-center p-6 overflow-y-auto"
        style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
        <div className="w-full max-w-[360px] flex flex-col items-center text-center gap-2 animate-fade-in">
          <AuthHeader />
          <div className="w-8 h-8 border-[3px] border-white/[0.08] border-t-[var(--accent-color)] rounded-full animate-auth-spin my-3" />
          <div className="text-[0.8em] text-white/30 font-medium">Проверка авторизации...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-maf-bg flex items-center justify-center p-6 overflow-y-auto"
      style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <div className="w-full max-w-[360px] flex flex-col items-center text-center gap-2 animate-fade-in">
        <AuthHeader />
        <TelegramSection onSuccess={handleSuccess} />
        <AltMethods onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
