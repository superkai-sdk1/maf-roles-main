import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/auth';
import { IconCards } from '../utils/icons';

export function AuthGate({ children }) {
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
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

  useEffect(() => {
    (async () => {
      const result = await authService.tryAutoAuth();
      if (!mountedRef.current) return;
      if (result.authenticated) {
        setUser(result.user);
        setState('ready');
      } else {
        requestNewCode();
      }
    })();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const requestNewCode = useCallback(async () => {
    setError('');
    setState('requesting_code');

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
          setUser(check.user);
          setState('ready');
        } else if (check.expired) {
          stopPolling();
          setState('expired');
        }
      }, authService.POLL_INTERVAL);
    } else {
      setError(result.error || 'Не удалось получить код. Проверьте подключение к серверу.');
      setState('error');
    }
  }, [stopPolling]);

  if (state === 'ready') return children;

  if (state === 'loading' || state === 'requesting_code') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-logo">
            <IconCards size={40} color="var(--accent-color, #a855f7)" />
          </div>
          <div className="auth-title">MafBoard</div>
          <div className="auth-spinner" />
          <div className="auth-hint">
            {state === 'loading' ? 'Проверка авторизации...' : 'Получение кода...'}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'show_code') {
    const minutes = Math.floor(expiresIn / 60);
    const seconds = expiresIn % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const progress = Math.max(0, expiresIn / 300);

    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-logo">
            <IconCards size={40} color="var(--accent-color, #a855f7)" />
          </div>
          <div className="auth-title">MafBoard</div>
          <div className="auth-subtitle">Авторизация через Telegram</div>

          <div className="auth-code-display">{code}</div>

          <div className="auth-timer-bar">
            <div className="auth-timer-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="auth-timer-text">{timeStr}</div>

          <div className="auth-instructions">
            Отправьте этот код боту в Telegram
          </div>

          {botLink && (
            <a href={botLink} target="_blank" rel="noopener noreferrer" className="auth-bot-btn">
              Открыть @{botUsername || 'бота'}
            </a>
          )}

          <div className="auth-hint">
            Ожидание подтверждения...
          </div>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-logo">
            <IconCards size={40} color="var(--accent-color, #a855f7)" />
          </div>
          <div className="auth-title">MafBoard</div>
          <div className="auth-subtitle">Код истёк</div>
          <div className="auth-hint">Время действия кода вышло</div>
          <button className="auth-bot-btn" onClick={requestNewCode}>
            Получить новый код
          </button>
        </div>
      </div>
    );
  }

  // state === 'error'
  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">
          <IconCards size={40} color="var(--accent-color, #a855f7)" />
        </div>
        <div className="auth-title">MafBoard</div>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-bot-btn" onClick={requestNewCode}>
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
