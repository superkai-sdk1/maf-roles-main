import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconMafBoard } from '../utils/icons';

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
    <div className="site-dropdown" ref={dropdownRef}>
      <div className="site-dropdown-user">
        <div className="site-dropdown-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="site-dropdown-user-info">
          <span className="site-dropdown-name">{displayName}</span>
          {user?.username && <span className="site-dropdown-username">@{user.username}</span>}
        </div>
      </div>
      <div className="site-dropdown-divider" />
      <button className="site-dropdown-item" onClick={() => { onNavigate('panel'); onClose(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
        <span>Панель</span>
      </button>
      <button className="site-dropdown-item site-dropdown-item--disabled" onClick={() => { onNavigate('overlay'); onClose(); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>Оверлей</span>
        <span className="site-dropdown-badge">скоро</span>
      </button>
      <button className="site-dropdown-item" onClick={() => { window.location.href = '/admin/'; }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>Админка</span>
      </button>
      <div className="site-dropdown-divider" />
      <button className="site-dropdown-item site-dropdown-item--danger" onClick={() => { logout(); onClose(); onNavigate('landing'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span>Выйти</span>
      </button>
    </div>
  );
}

export function Header({ onNavigate }) {
  const { isAuthenticated, isLoading, user, showAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName = user?.first_name || user?.username || 'U';

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="site-header-logo" onClick={() => onNavigate('landing')}>
          <IconMafBoard size={28} color="var(--accent-color, #a855f7)" />
          <span className="site-header-logo-text">MafBoard</span>
        </button>

        <div className="site-header-actions">
          {isLoading ? (
            <div className="site-header-skeleton" />
          ) : isAuthenticated ? (
            <div className="site-header-profile-wrap">
              <button
                className="site-header-avatar"
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
            <button className="site-header-login-btn" onClick={showAuthModal}>
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
