import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/MainMenu';
import { ModeSelector } from './components/ModeSelector';
import { GameScreen } from './components/GameScreen';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { loadSavedTheme, applyTheme } from './constants/themes';
import { initTelegramApp } from './utils/telegram';
import { useNativeScroll } from './hooks/useNativeScroll';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff453a', fontFamily: 'monospace', fontSize: 14, maxWidth: 600, margin: '40px auto', background: 'rgba(255,0,0,0.05)', borderRadius: 16, border: '1px solid rgba(255,69,58,0.3)' }}>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, marginTop: 12, color: '#999' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameRouter() {
  const { screen } = useGame();
  if (screen === 'menu') return <MainMenu />;
  if (screen === 'modes') return <ModeSelector />;
  if (screen === 'game') return <GameScreen />;
  return <MainMenu />;
}

function OverlayPlaceholder({ onNavigate }) {
  return (
    <>
      <Header onNavigate={onNavigate} />
      <div className="landing" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3em', marginBottom: 16, opacity: 0.3 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.5em', fontWeight: 800, marginBottom: 8 }}>OBS-оверлей</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95em', maxWidth: 360, margin: '0 auto' }}>
            Трансляция игровой информации через браузерный оверлей. Этот раздел скоро будет доступен.
          </p>
        </div>
      </div>
    </>
  );
}

const ROUTES = { '/': 'landing', '/panel': 'panel', '/overlay': 'overlay' };
const PATHS = { landing: '/', panel: '/panel', overlay: '/overlay' };

function pageFromPath() {
  return ROUTES[window.location.pathname] || 'landing';
}

function AppShell() {
  const { isAuthenticated, isLoading, isTelegramWebView, showAuthModal } = useAuth();
  const [page, setPage] = useState(pageFromPath);
  const rootRef = useRef(null);

  useEffect(() => {
    rootRef.current = document.getElementById('root');
  }, []);

  useNativeScroll(rootRef);

  useEffect(() => {
    const onPop = () => setPage(pageFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isTelegramWebView && isAuthenticated) {
      setPage('panel');
    }
  }, [isLoading, isTelegramWebView, isAuthenticated]);

  useEffect(() => {
    if (!isLoading && page === 'panel' && !isAuthenticated) {
      setPage('landing');
    }
  }, [isLoading, isAuthenticated, page]);

  useEffect(() => {
    const html = document.documentElement;
    if (page === 'panel' && isAuthenticated) {
      html.classList.add('app-mode');
    } else {
      html.classList.remove('app-mode');
    }
    return () => html.classList.remove('app-mode');
  }, [page, isAuthenticated]);

  useEffect(() => {
    const target = PATHS[page] || '/';
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, [page]);

  const handleNavigate = useCallback((target) => {
    if (target === 'panel' && !isAuthenticated) {
      showAuthModal();
      return;
    }
    setPage(target);
  }, [isAuthenticated, showAuthModal]);

  if (page === 'panel' && isAuthenticated) {
    return (
      <GameProvider>
        <GameRouter />
        <AuthModal />
      </GameProvider>
    );
  }

  if (page === 'overlay') {
    return (
      <>
        <OverlayPlaceholder onNavigate={handleNavigate} />
        <AuthModal />
      </>
    );
  }

  return (
    <>
      <Header onNavigate={handleNavigate} />
      <LandingPage onNavigate={handleNavigate} />
      <AuthModal />
    </>
  );
}

export default function App() {
  useEffect(() => {
    initTelegramApp();
    const color = loadSavedTheme();
    applyTheme(color);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
