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
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-center gap-2 py-1">
        <RoleIndicator label="Дон" lit={donCount >= 1} color="#e1bee7" glowColor="rgba(206,147,216,0.5)" />
        <RoleIndicator label="Мафия" lit={blackCount >= 2} partial={blackCount >= 1 && blackCount < 2} color="#c084fc" glowColor="rgba(168,85,247,0.5)" />
        <RoleIndicator label="Шериф" lit={sheriffCount >= 1} color="#ffd54f" glowColor="rgba(255,213,79,0.5)" />
        {cityMode && <RoleIndicator label="Доктор" lit={doctorCount >= 1} color="#81c784" glowColor="rgba(76,175,80,0.5)" />}
      </div>

      <div className="flex flex-col gap-2.5 animate-stagger">
        {tableOut.map(p => {
          const rk = p.roleKey;
          const role = roles[rk] || null;
          return (
            <div key={rk} className="rounded-2xl bg-white/[0.03] border border-white/[0.08] transition-all duration-200 ease-spring"
              style={{ animationDelay: `${(p.num - 1) * 30}ms` }}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08]
                    flex items-center justify-center text-white/60 text-sm font-bold overflow-hidden"
                    style={p.avatar_link ? { backgroundImage: `url(${p.avatar_link})`, backgroundSize: 'cover', color: 'transparent' } : {}}>
                    {!p.avatar_link && (p.login?.[0]?.toUpperCase() || p.num)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] rounded-md
                    bg-white/10 border border-white/[0.15] flex items-center justify-center
                    text-[0.6rem] font-bold text-white/70 px-0.5">{p.num}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.login || `Игрок ${p.num}`}</div>
                </div>
                {editRoles && (
                  <div className="flex items-center gap-1.5">
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
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200
      ${lit ? 'border-transparent' : partial ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}
      style={lit ? { borderColor: `${color}44`, background: `${color}15`, boxShadow: `0 0 12px ${glowColor}` } : {}}>
      <span className={`w-2 h-2 rounded-full transition-all duration-200
        ${lit ? 'animate-role-dot' : ''}`}
        style={{ background: lit ? color : partial ? `${color}66` : 'rgba(255,255,255,0.15)',
          boxShadow: lit ? `0 0 6px ${glowColor}` : 'none' }} />
      <span className="text-[0.7rem] font-bold tracking-wider uppercase"
        style={{ color: lit ? color : partial ? `${color}88` : 'rgba(255,255,255,0.3)' }}>
        {label}
      </span>
    </div>
  );
}

function RoleButton({ label, active, color, bgActive, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center rounded-full font-bold text-[0.9em] cursor-pointer touch-manipulation
        transition-all duration-100 ease-spring active:scale-90"
      style={{
        width: 'var(--role-btn-size)', height: 'var(--role-btn-size)',
        minWidth: 'var(--role-btn-size)', maxWidth: 'var(--role-btn-size)',
        border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
        background: active ? bgActive : 'rgba(255,255,255,0.03)',
        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
        boxShadow: active ? `0 0 16px ${color}66` : 'var(--glass-shadow-sm)',
      }}>{label}</button>
  );
}
