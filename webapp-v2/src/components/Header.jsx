import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MafBoardLogo } from './MafBoardLogo';

function ProfileDropdown({ onNavigate, onClose }) {
  const { user, logout } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  const displayName = user?.first_name || user?.username || 'User';

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-56 rounded-2xl glass-card-md animate-slide-down z-50"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-accent-soft border border-accent-soft flex items-center justify-center text-accent text-sm font-bold shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
          {user?.username && <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>@{user.username}</span>}
        </div>
      </div>

      <div className="h-px mx-3" style={{ background: 'var(--surface-divider)' }} />

      <div className="py-1.5">
        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors duration-150"
          style={{ color: 'var(--text-secondary)' }}
          onClick={() => { onNavigate('panel'); onClose(); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <span>Панель</span>
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold cursor-default"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => { onNavigate('overlay'); onClose(); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>Оверлей</span>
          <span className="ml-auto text-[0.6rem] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full text-accent" style={{ background: 'var(--accent-surface)' }}>скоро</span>
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors duration-150"
          style={{ color: 'var(--text-secondary)' }}
          onClick={() => { window.location.href = '/admin/'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Админка</span>
        </button>
      </div>

      <div className="h-px mx-3" style={{ background: 'var(--surface-divider)' }} />

      <div className="py-1.5">
        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400/80 text-sm font-semibold hover:text-red-400 hover:bg-red-500/[0.06] transition-colors duration-150"
          onClick={() => { logout(); onClose(); onNavigate('landing'); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}

export function Header({ onNavigate }) {
  const { isAuthenticated, isLoading, user, showAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName = user?.first_name || user?.username || 'U';

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-glass-heavy border-b"
      style={{ paddingTop: 'var(--safe-top, 0px)', borderColor: 'var(--surface-divider)', background: 'var(--glass-surface)' }}>
      <div className="flex items-center justify-between h-14 px-4 max-w-5xl mx-auto">
        <button
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer"
          onClick={() => onNavigate('landing')}
        >
          <MafBoardLogo size={28} />
          <span className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>MafBoard</span>
        </button>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse" />
          ) : isAuthenticated ? (
            <div className="relative">
              <button
                className="w-9 h-9 rounded-full bg-accent-soft border border-accent-soft flex items-center justify-center
                  text-accent text-sm font-bold active:scale-95 transition-transform duration-150 ease-spring"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Профиль"
              >
                {displayName.charAt(0).toUpperCase()}
              </button>
              {dropdownOpen && (
                <ProfileDropdown
                  onNavigate={onNavigate}
                  onClose={() => setDropdownOpen(false)}
                />
              )}
            </div>
          ) : (
            <button
              className="px-4 py-2 rounded-xl bg-accent text-sm font-bold
                active:scale-95 transition-transform duration-150 ease-spring"
              style={{ color: '#fff', boxShadow: '0 4px 20px rgba(var(--accent-rgb), 0.2)' }}
              onClick={showAuthModal}
            >
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
