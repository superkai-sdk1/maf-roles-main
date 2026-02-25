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
    <div className="min-h-screen bg-maf-bg text-white" style={{ background: 'var(--maf-gradient-bg)' }}>
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
        <div className="absolute w-64 h-64 rounded-full bg-[var(--accent-color)] opacity-[0.06] blur-[100px] top-0" />
        <div className="relative flex flex-col items-center gap-4 animate-float-up">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[rgba(168,85,247,0.15)] to-[rgba(99,102,241,0.08)]
            border border-purple-500/25 flex items-center justify-center
            shadow-[0_8px_32px_rgba(168,85,247,0.2),0_0_60px_rgba(168,85,247,0.06)]">
            <IconMafBoard size={56} color="var(--accent-color, #a855f7)" />
          </div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            MafBoard
          </h1>
          <p className="max-w-sm text-white/50 text-sm leading-relaxed font-medium">
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
        <h2 className="text-accent text-xs font-bold tracking-[0.15em] uppercase text-center mb-8">
          Возможности
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-stagger">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]
                hover:border-white/[0.12] transition-colors duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                {f.icon}
              </div>
              <h3 className="text-white text-sm font-bold mt-1">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center text-center px-6 pb-16">
        <h2 className="text-xl font-extrabold tracking-tight text-white mb-2">Готовы вести?</h2>
        <p className="text-white/40 text-sm mb-5">
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
      <footer className="flex items-center justify-center gap-2 py-8 text-white/20 text-xs font-medium">
        <span>MafBoard</span>
        <span>·</span>
        <span>Панель ведущего мафии</span>
      </footer>
    </div>
  );
}
