import React from 'react';
import { useAuth } from '../context/AuthContext';
import { IconCards } from '../utils/icons';

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Таймеры и фазы',
    desc: 'Автоматическое управление днём, ночью, обсуждениями и голосованиями с гибкими таймерами.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Управление игроками',
    desc: 'Раздача ролей, фолы, удаления, ночные проверки — всё в одном интерфейсе.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Голосования',
    desc: 'Выставки, голосования с подсчётом, переголосования и подъём рук — по всем правилам.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    ),
    title: 'Турниры и серии',
    desc: 'Поддержка GoMafia турниров, серий игр и автоматический подсчёт результатов.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: 'OBS-оверлей',
    desc: 'Трансляция игровой информации через браузерный оверлей — скоро.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    ),
    title: 'Синхронизация',
    desc: 'Комнаты с мгновенной синхронизацией между ведущими и зрителями через WebSocket.',
  },
];

export function LandingPage({ onNavigate }) {
  const { isAuthenticated, showAuthModal } = useAuth();

  const handleCTA = () => {
    if (isAuthenticated) {
      onNavigate('panel');
    } else {
      showAuthModal();
    }
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content">
          <div className="landing-hero-icon">
            <IconCards size={56} color="var(--accent-color, #a855f7)" />
          </div>
          <h1 className="landing-hero-title">
            MafBoard
          </h1>
          <p className="landing-hero-subtitle">
            Панель ведущего для игры в мафию.
            Управляйте ролями, таймерами, голосованиями
            и турнирами — всё в одном месте.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn landing-btn--primary" onClick={handleCTA}>
              {isAuthenticated ? 'Открыть панель' : 'Начать'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-section-title">Возможности</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <div className="landing-feature-card" key={i}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="landing-cta">
        <h2 className="landing-cta-title">Готовы вести?</h2>
        <p className="landing-cta-desc">
          Авторизуйтесь через Telegram и начните первую игру за минуту.
        </p>
        <button className="landing-btn landing-btn--primary" onClick={handleCTA}>
          {isAuthenticated ? 'Перейти в панель' : 'Войти и начать'}
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>MafBoard</span>
        <span className="landing-footer-dot">·</span>
        <span>Панель ведущего мафии</span>
      </footer>
    </div>
  );
}
