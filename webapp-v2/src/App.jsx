import React, { useEffect, useRef } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/MainMenu';
import { ModeSelector } from './components/ModeSelector';
import { GameScreen } from './components/GameScreen';
import { AuthGate } from './components/AuthGate';
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

function Router() {
  const { screen } = useGame();
  if (screen === 'menu') return <MainMenu />;
  if (screen === 'modes') return <ModeSelector />;
  if (screen === 'game') return <GameScreen />;
  return <MainMenu />;
}

export default function App() {
  const rootRef = useRef(null);

  useEffect(() => {
    rootRef.current = document.getElementById('root');
    initTelegramApp();
    const color = loadSavedTheme();
    applyTheme(color);
  }, []);

  useNativeScroll(rootRef);

  return (
    <ErrorBoundary>
      <AuthGate>
        <GameProvider>
          <Router />
        </GameProvider>
      </AuthGate>
    </ErrorBoundary>
  );
}
