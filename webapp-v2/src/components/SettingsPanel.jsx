import React from 'react';
import { useGame } from '../context/GameContext';
import { COLOR_SCHEMES, applyTheme } from '../constants/themes';
import { triggerHaptic } from '../utils/haptics';

export function SettingsPanel() {
  const {
    roomId, roomInput, setRoomInput, joinRoom,
    selectedColorScheme, setSelectedColorScheme,
    mainInfoText, setMainInfoText,
    additionalInfoText, setAdditionalInfoText,
    hideSeating, setHideSeating,
    hideLeaveOrder, setHideLeaveOrder,
    hideRolesStatus, setHideRolesStatus,
    hideBestMove, setHideBestMove,
    tournamentId, tournamentName, gameMode,
    syncState,
    gameSelected, tableSelected,
    dayNumber, nightNumber, gamePhase,
    tableOut,
    judgeNickname, setJudgeNickname,
    judgeAvatar, setJudgeAvatar,
  } = useGame();

  const handleJoinRoom = () => {
    if (!roomInput?.trim()) return;
    joinRoom(roomInput.trim());
    triggerHaptic('success');
  };

  const selectColor = (key) => {
    setSelectedColorScheme(key);
    applyTheme(key);
    triggerHaptic('selection');
  };

  const currentScheme = COLOR_SCHEMES.find(s => s.key === selectedColorScheme) || COLOR_SCHEMES[0];

  const aliveCount = tableOut.filter(p => {
    const a = p.action;
    return !a || !['killed', 'voted', 'removed', 'tech_fall_removed', 'fall_removed'].includes(a);
  }).length;

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Room */}
      <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {roomId ? '📡' : '📴'} Комната трансляции
        </h3>
        {roomId ? (
          <div style={{
            fontSize: '0.85em', fontWeight: 700, color: '#30d158', padding: '6px 14px',
            background: 'rgba(48,209,88,0.1)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(48,209,88,0.2)',
          }}>
            Подключена: {roomId}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="ID комнаты" value={roomInput || ''} onChange={e => setRoomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              style={{
                flex: 1, background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: '0.9em', outline: 'none',
              }} />
            <button onClick={handleJoinRoom} className="glass-btn btn-primary" style={{ padding: '10px 18px', fontSize: '0.85em' }}>
              Войти
            </button>
          </div>
        )}
      </div>

      {/* Judge */}
      <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          👨‍⚖️ Ведущий
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Ник ведущего</label>
            <input type="text" placeholder="Ваш ник" value={judgeNickname || ''} onChange={e => { setJudgeNickname(e.target.value); syncState?.({ judgeNickname: e.target.value }); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: '0.9em', outline: 'none', marginTop: 6,
              }} />
          </div>
          <div>
            <label style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Аватар (URL)</label>
            <input type="text" placeholder="https://..." value={judgeAvatar || ''} onChange={e => { setJudgeAvatar(e.target.value); syncState?.({ judgeAvatar: e.target.value }); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: '0.9em', outline: 'none', marginTop: 6,
              }} />
          </div>
          {judgeAvatar && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <img src={judgeAvatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.5)' }}>{judgeNickname || 'Ведущий'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast */}
      <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          🖥 Трансляция
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Основной текст</label>
            <input type="text" value={mainInfoText || ''} onChange={e => { setMainInfoText(e.target.value); syncState?.({ mainInfoText: e.target.value }); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: '0.9em', outline: 'none', marginTop: 6,
              }} />
          </div>
          <div>
            <label style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Дополнительный текст</label>
            <input type="text" value={additionalInfoText || ''} onChange={e => { setAdditionalInfoText(e.target.value); syncState?.({ additionalInfoText: e.target.value }); }}
              style={{
                width: '100%', background: 'var(--input-bg)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: '0.9em', outline: 'none', marginTop: 6,
              }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ToggleBtn label="Рассадка" value={!hideSeating} onChange={() => setHideSeating(!hideSeating)} />
            <ToggleBtn label="Порядок вых." value={!hideLeaveOrder} onChange={() => setHideLeaveOrder(!hideLeaveOrder)} />
            <ToggleBtn label="Статус ролей" value={!hideRolesStatus} onChange={() => setHideRolesStatus(!hideRolesStatus)} />
            <ToggleBtn label="Лучший ход" value={!hideBestMove} onChange={() => setHideBestMove(!hideBestMove)} />
          </div>
        </div>
      </div>

      {/* Themes */}
      <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          🎨 Тема оформления
        </h3>

        {/* Current theme indicator */}
        <div className="theme-current-indicator" style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 14px', borderRadius: 14,
          background: `linear-gradient(135deg, ${currentScheme.gradient[0]}12, ${currentScheme.gradient[1]}08)`,
          border: `1px solid ${currentScheme.accent}25`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${currentScheme.gradient[0]}, ${currentScheme.gradient[1]})`,
            boxShadow: `0 4px 14px ${currentScheme.accent}40`,
          }} />
          <div>
            <div style={{ fontSize: '0.85em', fontWeight: 700, color: currentScheme.accent }}>{currentScheme.name}</div>
            <div style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Текущая тема</div>
          </div>
        </div>

        {/* Theme grid */}
        <div className="theme-selector-grid">
          {COLOR_SCHEMES.map(c => {
            const isActive = selectedColorScheme === c.key;
            return (
              <button
                key={c.key}
                onClick={() => selectColor(c.key)}
                className={`theme-selector-item ${isActive ? 'theme-selector-item--active' : ''}`}
                style={{
                  '--ts-color': c.accent,
                  '--ts-g1': c.gradient[0],
                  '--ts-g2': c.gradient[1],
                }}
              >
                <div className="theme-selector-swatch" />
                <span className="theme-selector-name">{c.name}</span>
                {isActive && (
                  <span className="theme-selector-check">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Game info */}
      <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
        <h3 style={{ fontSize: '0.9em', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          ℹ Информация
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8em', color: 'rgba(255,255,255,0.4)' }}>
          {judgeNickname && <div>Ведущий: {judgeNickname}</div>}
          {tournamentName && <div>Турнир: {tournamentName}</div>}
          {tournamentId && <div>ID: {tournamentId}</div>}
          <div>Режим: {gameMode === 'gomafia' ? 'GoMafia' : gameMode === 'funky' ? 'Фанки' : gameMode === 'city' ? 'Городская' : 'Ручной'}</div>
          {gameSelected && <div>Игра: {gameSelected}, Стол: {tableSelected}</div>}
          <div>Фаза: {gamePhase} | День: {dayNumber} | Ночь: {nightNumber}</div>
          <div>Игроков: {tableOut.length} (живых: {aliveCount})</div>
          {roomId && <div>Комната: {roomId}</div>}
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({ label, value, onChange }) {
  return (
    <button onClick={() => { onChange(); triggerHaptic('selection'); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 10, fontSize: '0.8em', fontWeight: 700,
        background: value ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.03)',
        border: value ? '1px solid rgba(168,85,247,0.2)' : '1px solid rgba(255,255,255,0.06)',
        color: value ? 'var(--accent-color)' : 'rgba(255,255,255,0.35)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
      <span>{label}</span>
      <span>{value ? '✓' : '✕'}</span>
    </button>
  );
}
