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
    <div className="flex flex-col gap-[14px] animate-fade-in">
      {/* Room */}
      <div className="relative z-[1] p-4 rounded-2xl glass-surface shadow-glass-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          {roomId ? '📡' : '📴'} Комната трансляции
        </h3>
        {roomId ? (
          <div className="text-[0.85em] font-bold text-status-success py-1.5 px-3.5 rounded-[10px] inline-flex items-center gap-1.5 bg-status-success/10 border border-status-success/20">
            Подключена: {roomId}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ID комнаты"
              value={roomInput || ''}
              onChange={e => setRoomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              className="flex-1 input-field"
            />
            <button
              onClick={handleJoinRoom}
              className="px-[18px] py-2.5 rounded-xl bg-accent text-white text-[0.85em] font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
            >
              Войти
            </button>
          </div>
        )}
      </div>

      {/* Judge */}
      <div className="relative z-[1] p-4 rounded-2xl glass-surface shadow-glass-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          👨‍⚖️ Ведущий
        </h3>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-[0.7em] font-bold text-white/40 uppercase tracking-wider">Ник ведущего</label>
            <input
              type="text"
              placeholder="Ваш ник"
              value={judgeNickname || ''}
              onChange={e => { setJudgeNickname(e.target.value); syncState?.({ judgeNickname: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          <div>
            <label className="block text-[0.7em] font-bold text-white/40 uppercase tracking-wider">Аватар (URL)</label>
            <input
              type="text"
              placeholder="https://..."
              value={judgeAvatar || ''}
              onChange={e => { setJudgeAvatar(e.target.value); syncState?.({ judgeAvatar: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          {judgeAvatar && (
            <div className="flex items-center gap-2.5 mt-1">
              <img
                src={judgeAvatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-accent"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <span className="text-[0.8em] text-white/50">{judgeNickname || 'Ведущий'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast */}
      <div className="relative z-[1] p-4 rounded-2xl glass-surface shadow-glass-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          🖥 Трансляция
        </h3>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-[0.7em] font-bold text-white/40 uppercase tracking-wider">Основной текст</label>
            <input
              type="text"
              value={mainInfoText || ''}
              onChange={e => { setMainInfoText(e.target.value); syncState?.({ mainInfoText: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          <div>
            <label className="block text-[0.7em] font-bold text-white/40 uppercase tracking-wider">Дополнительный текст</label>
            <input
              type="text"
              value={additionalInfoText || ''}
              onChange={e => { setAdditionalInfoText(e.target.value); syncState?.({ additionalInfoText: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleBtn label="Рассадка" value={!hideSeating} onChange={() => setHideSeating(!hideSeating)} />
            <ToggleBtn label="Порядок вых." value={!hideLeaveOrder} onChange={() => setHideLeaveOrder(!hideLeaveOrder)} />
            <ToggleBtn label="Статус ролей" value={!hideRolesStatus} onChange={() => setHideRolesStatus(!hideRolesStatus)} />
            <ToggleBtn label="Лучший ход" value={!hideBestMove} onChange={() => setHideBestMove(!hideBestMove)} />
          </div>
        </div>
      </div>

      {/* Themes */}
      <div className="relative z-[1] p-4 rounded-2xl glass-surface shadow-glass-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3.5">
          🎨 Тема оформления
        </h3>

        {/* Current theme indicator */}
        <div
          className="flex items-center gap-2.5 mb-4 py-2.5 px-3.5 rounded-[14px]"
          style={{
            background: `linear-gradient(135deg, ${currentScheme.gradient[0]}12, ${currentScheme.gradient[1]}08)`,
            border: `1px solid ${currentScheme.accent}25`,
          }}
        >
          <div
            className="w-8 h-8 rounded-[10px] flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${currentScheme.gradient[0]}, ${currentScheme.gradient[1]})`,
              boxShadow: `0 4px 14px ${currentScheme.accent}40`,
            }}
          />
          <div>
            <div className="text-[0.85em] font-bold" style={{ color: currentScheme.accent }}>{currentScheme.name}</div>
            <div className="text-[0.7em] text-white/35 font-medium">Текущая тема</div>
          </div>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-5 gap-2">
          {COLOR_SCHEMES.map(c => {
            const isActive = selectedColorScheme === c.key;
            return (
              <button
                key={c.key}
                onClick={() => selectColor(c.key)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                  isActive
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.12]'
                }`}
              >
                <div className="relative w-6 h-6 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}>
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="drop-shadow-md">
                        <path d="M2 6.5L4.5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>
                <span className="text-[0.65em] font-bold text-center leading-tight">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game info */}
      <div className="relative z-[1] p-4 rounded-2xl glass-surface shadow-glass-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-2.5">
          ℹ Информация
        </h3>
        <div className="flex flex-col gap-1 text-[0.8em] text-white/40">
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
    <button
      onClick={() => { onChange(); triggerHaptic('selection'); }}
      className={`flex items-center justify-between py-2 px-3 rounded-[10px] text-[0.8em] font-bold cursor-pointer transition-all duration-150 ${
        value
          ? 'bg-accent/10 border border-accent/20 text-accent'
          : 'bg-white/[0.03] border border-white/[0.06] text-white/35'
      }`}
    >
      <span>{label}</span>
      <span>{value ? '✓' : '✕'}</span>
    </button>
  );
}
