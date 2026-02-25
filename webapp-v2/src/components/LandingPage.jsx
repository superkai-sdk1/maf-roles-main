import React from 'react';
import { useAuth } from '../context/AuthContext';
import { IconMafBoard } from '../utils/icons';

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
    <div className="min-h-screen bg-maf-bg" style={{ background: 'var(--maf-gradient-bg)', color: 'var(--text-primary)' }}>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
        <div className="absolute w-64 h-64 rounded-full bg-[var(--accent-color)] opacity-[0.06] blur-[100px] top-0" />
        <div className="relative flex flex-col items-center gap-4 animate-float-up">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, rgba(var(--accent-rgb), 0.15), rgba(var(--accent-rgb), 0.05))`,
              border: '1px solid rgba(var(--accent-rgb), 0.25)',
              boxShadow: `0 8px 32px rgba(var(--accent-rgb), 0.2), 0 0 60px rgba(var(--accent-rgb), 0.06)`,
            }}>
            <IconMafBoard size={56} color="var(--accent-color, #a855f7)" />
          </div>
          <h1 className="text-[3em] font-black tracking-[-1.5px] leading-[1.1]" style={{ background: `linear-gradient(to right, var(--text-primary), var(--text-secondary))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MafBoard
          </h1>
          <p className="max-w-sm text-sm leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
            Панель ведущего для игры в мафию.
            Управляйте ролями, таймерами, голосованиями
            и турнирами — всё в одном месте.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              className="flex items-center gap-2 px-6 py-3 rounded-2xl
                bg-accent text-white text-sm font-bold
                shadow-glow-accent active:scale-95 transition-transform duration-150 ease-spring"
              onClick={handleCTA}
            >
              {isAuthenticated ? 'Открыть панель' : 'Начать'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 pb-16 max-w-2xl mx-auto">
        <h2 className="text-[1.8em] font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Возможности
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="glass-card flex flex-col gap-2 p-5 rounded-2xl hover:!border-white/[0.18] hover:shadow-glass-md transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-accent-soft flex items-center justify-center text-accent relative z-[1]">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold mt-1 relative z-[1]" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-xs leading-relaxed relative z-[1]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center text-center px-6 pb-16">
        <h2 className="text-xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Готовы вести?</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          Авторизуйтесь через Telegram и начните первую игру за минуту.
        </p>
        <button
          className="px-6 py-3 rounded-2xl bg-accent text-white text-sm font-bold
            shadow-glow-accent active:scale-95 transition-transform duration-150 ease-spring"
          onClick={handleCTA}
        >
          {isAuthenticated ? 'Перейти в панель' : 'Войти и начать'}
        </button>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 py-8 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>MafBoard</span>
        <span>·</span>
        <span>Панель ведущего мафии</span>
      </footer>
    </div>
  );
}
