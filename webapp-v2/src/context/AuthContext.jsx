import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/auth';

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

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [needsPasskeySuggest, setNeedsPasskeySuggest] = useState(false);
  const [subscriptions, setSubscriptions] = useState({});
  const [isTelegramWebView, setIsTelegramWebView] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setIsTelegramWebView(authService.isTelegramWebView());

    (async () => {
      const result = await authService.tryAutoAuth();
      if (!mountedRef.current) return;

      if (result.authenticated) {
        setUser(result.user);
        setIsAuthenticated(true);
        if (result.user && result.user.subscriptions) {
          setSubscriptions(result.user.subscriptions);
        }
        if (shouldSuggestPasskey(result.user)) {
          setNeedsPasskeySuggest(true);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const showAuthModal = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const hideAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const handleAuthSuccess = useCallback((userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setAuthModalOpen(false);
    if (userData && userData.subscriptions) {
      setSubscriptions(userData.subscriptions);
    }
    if (shouldSuggestPasskey(userData)) {
      setNeedsPasskeySuggest(true);
    }
  }, []);

  const dismissPasskeySuggest = useCallback(() => {
    setNeedsPasskeySuggest(false);
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    const token = authService.getStoredToken();
    if (!token) return;
    try {
      const resp = await fetch(`/api/subscription-check.php?token=${encodeURIComponent(token)}`);
      const data = await resp.json();
      if (data.subscriptions) {
        const active = {};
        for (const [slug, info] of Object.entries(data.subscriptions)) {
          if (info.has_access) active[slug] = info;
        }
        setSubscriptions(active);
      }
    } catch {}
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setSubscriptions({});
    setNeedsPasskeySuggest(false);
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    authModalOpen,
    needsPasskeySuggest,
    isTelegramWebView,
    subscriptions,
    showAuthModal,
    hideAuthModal,
    handleAuthSuccess,
    dismissPasskeySuggest,
    refreshSubscriptions,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
