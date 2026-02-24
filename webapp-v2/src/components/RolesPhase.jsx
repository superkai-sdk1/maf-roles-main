import React from 'react';
import { useGame } from '../context/GameContext';
import { triggerHaptic } from '../utils/haptics';

export function RolesPhase() {
  const { tableOut, roleSet, roles, editRoles, cityMode } = useGame();

  const donCount = Object.values(roles).filter(r => r === 'don').length;
  const blackCount = Object.values(roles).filter(r => r === 'black').length;
  const sheriffCount = Object.values(roles).filter(r => r === 'sheriff').length;
  const doctorCount = Object.values(roles).filter(r => r === 'doctor').length;

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Role indicator pills */}
      <div className="role-indicators-row">
        <RoleIndicator label="Дон" lit={donCount >= 1} color="#e1bee7" glowColor="rgba(206,147,216,0.5)" />
        <RoleIndicator label="Мафия" lit={blackCount >= 2} partial={blackCount >= 1 && blackCount < 2} color="#c084fc" glowColor="rgba(168,85,247,0.5)" />
        <RoleIndicator label="Шериф" lit={sheriffCount >= 1} color="#ffd54f" glowColor="rgba(255,213,79,0.5)" />
        {cityMode && <RoleIndicator label="Доктор" lit={doctorCount >= 1} color="#81c784" glowColor="rgba(76,175,80,0.5)" />}
      </div>

      {/* Player list */}
      <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tableOut.map(p => {
          const rk = p.roleKey;
          const role = roles[rk] || null;
          return (
            <div key={rk} className="player-row" style={{ '--i': p.num - 1 }}>
              <div className="player-row-content">
                <div className="player-avatar-wrap">
                  <div className="player-avatar"
                    style={p.avatar_link ? { backgroundImage: `url(${p.avatar_link})`, color: 'transparent' } : {}}>
                    {!p.avatar_link && (p.login?.[0]?.toUpperCase() || p.num)}
                  </div>
                  <span className="player-num-badge">{p.num}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="player-name">{p.login || `Игрок ${p.num}`}</div>
                </div>
                {editRoles && (
                  <div className="role-badges">
                    <RoleButton label="Д" active={role === 'don'} color="#e1bee7" bgActive="linear-gradient(135deg, rgba(206,147,216,0.6), rgba(171,71,188,0.6))"
                      onClick={() => { roleSet(rk, 'don'); triggerHaptic('selection'); }} />
                    <RoleButton label="М" active={role === 'black'} color="#c084fc" bgActive="linear-gradient(135deg, rgba(168,85,247,0.6), rgba(139,92,246,0.6))"
                      onClick={() => { roleSet(rk, 'black'); triggerHaptic('selection'); }} />
                    <RoleButton label="Ш" active={role === 'sheriff'} color="#ffd54f" bgActive="linear-gradient(135deg, rgba(255,213,79,0.5), rgba(255,183,77,0.5))"
                      onClick={() => { roleSet(rk, 'sheriff'); triggerHaptic('selection'); }} />
                    {cityMode && (
                      <RoleButton label="Вр" active={role === 'doctor'} color="#81c784" bgActive="linear-gradient(135deg, rgba(76,175,80,0.5), rgba(56,142,60,0.5))"
                        onClick={() => { roleSet(rk, 'doctor'); triggerHaptic('selection'); }} />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleIndicator({ label, lit, partial, color, glowColor }) {
  return (
    <div className={`role-indicator ${lit ? 'role-indicator--lit' : ''} ${partial ? 'role-indicator--partial' : ''}`}
      style={{
        '--ri-color': color,
        '--ri-glow': glowColor,
      }}>
      <span className="role-indicator-dot" />
      <span className="role-indicator-label">{label}</span>
    </div>
  );
}

function RoleButton({ label, active, color, bgActive, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 'var(--role-btn-size)', height: 'var(--role-btn-size)',
      minWidth: 'var(--role-btn-size)', maxWidth: 'var(--role-btn-size)',
      borderRadius: '50%',
      border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
      background: active ? bgActive : 'var(--glass-layer-1)',
      color: active ? '#fff' : 'var(--text-secondary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, cursor: 'pointer', fontSize: '0.9em',
      boxShadow: active ? `0 0 16px ${color}66` : 'var(--glass-shadow-sm)',
      transition: 'transform 0.1s var(--ease-spring), background 0.1s, color 0.1s, box-shadow 0.1s',
      touchAction: 'manipulation',
    }}>{label}</button>
  );
}
