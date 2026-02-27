import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/MainMenu';
import { ModeSelector } from './components/ModeSelector';
import { GameScreen } from './components/GameScreen';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { Overlay } from './components/Overlay';
import { SharedResults } from './components/SharedResults';
import { ToastProvider } from './components/Toast';
import { ModalProvider } from './components/Modal';
import { loadSavedTheme, applyTheme, loadSavedDarkMode, applyDarkMode } from './constants/themes';
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


const ROUTES = { '/': 'landing', '/panel': 'panel', '/overlay': 'overlay' };
const PATHS = { landing: '/', panel: '/panel', overlay: '/overlay' };

function pageFromPath() {
  if (window.location.pathname.startsWith('/share/')) return 'share';
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
    if (isTelegramWebView && isAuthenticated && page !== 'share') {
      setPage('panel');
    }
  }, [isLoading, isTelegramWebView, isAuthenticated, page]);

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
    if (page === 'share') return;
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
        <ToastProvider>
          <ModalProvider>
            <GameRouter />
            <AuthModal />
          </ModalProvider>
        </ToastProvider>
      </GameProvider>
    );
  }

  if (page === 'share') {
    return <SharedResults />;
  }

  if (page === 'overlay') {
    return <Overlay />;
  }

  return (
    <>
      <Header onNavigate={handleNavigate} />
      <LandingPage onNavigate={handleNavigate} />
      <AuthModal />
    </>
  );
}

// Apply theme synchronously before first render to prevent FOUC
try {
  const _initDark = loadSavedDarkMode();
  applyDarkMode(_initDark);
  applyTheme(loadSavedTheme());
} catch (e) { /* theme will use CSS defaults */ }

export default function App() {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
