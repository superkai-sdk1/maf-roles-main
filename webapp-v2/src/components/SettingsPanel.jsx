import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { COLOR_SCHEMES, applyTheme, applyDarkMode } from '../constants/themes';
import { triggerHaptic } from '../utils/haptics';
import { useToast } from './Toast';
import { useModal } from './Modal';

export function SettingsPanel() {
  const {
    roomId, setRoomId, roomInput, setRoomInput, joinRoom, syncState, disconnectRoom, roomError, setRoomError, endSession,
    selectedColorScheme, setSelectedColorScheme,
    darkMode, setDarkMode,
    mainInfoText, setMainInfoText,
    additionalInfoText, setAdditionalInfoText,
    hideSeating, setHideSeating,
    hideLeaveOrder, setHideLeaveOrder,
    hideRolesStatus, setHideRolesStatus,
    hideBestMove, setHideBestMove,
    tournamentId, tournamentName, gameMode,
    gameSelected, tableSelected,
    dayNumber, nightNumber, gamePhase,
    tableOut,
    judgeNickname, setJudgeNickname,
    judgeAvatar, setJudgeAvatar,
    winnerTeam, gameFinished, viewOnly,
  } = useGame();
  const { showToast } = useToast();
  const { showModal } = useModal();

  const handleJoinRoom = () => {
    const code = (roomInput || '').trim();
    if (!code || code.length !== 4) return;
    setRoomError(null);
    joinRoom(code);
    triggerHaptic('success');
  };

  const selectColor = (key) => {
    setSelectedColorScheme(key);
    applyTheme(key);
    syncState({ selectedColorScheme: key });
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
      <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          {roomId ? '\uD83D\uDCE1' : '\uD83D\uDCF4'} Комната трансляции
        </h3>
        {roomId ? (
          <div className="flex items-center gap-2.5">
            <div className="text-[0.85em] font-bold text-status-success py-1.5 px-3.5 rounded-[10px] inline-flex items-center gap-1.5 bg-status-success/10 border border-status-success/20">
              Подключена: {roomId}
            </div>
            <button
              onClick={() => { disconnectRoom(); triggerHaptic('medium'); }}
              className="text-[0.75em] font-bold py-1.5 px-3 rounded-[10px] border active:scale-[0.97] transition-transform duration-150"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--surface-border)', background: 'var(--surface-primary)' }}
            >
              Отключить
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[0.75em] mb-2" style={{ color: 'var(--text-muted)' }}>
              Введите код с OBS-оверлея для синхронизации
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="4-значный код"
                maxLength={4}
                value={roomInput || ''}
                onChange={e => { setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setRoomError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                className="flex-1 input-field text-center text-lg tracking-[0.3em] font-bold"
              />
              <button
                onClick={handleJoinRoom}
                className="px-[18px] py-2.5 rounded-xl bg-accent text-white text-[0.85em] font-bold active:scale-[0.97] transition-transform duration-150 ease-spring"
              >
                Подключить
              </button>
            </div>
            {roomError && (
              <div className="text-[0.75em] font-bold mt-2 py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                {roomError === 'Invalid room code' ? 'Неверный код комнаты' : roomError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Judge */}
      <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          👨‍⚖️ Ведущий
        </h3>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-[0.7em] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ник ведущего</label>
            <input
              type="text"
              placeholder="Ваш ник"
              value={judgeNickname || ''}
              onChange={e => { setJudgeNickname(e.target.value); syncState({ judgeNickname: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          <div>
            <label className="block text-[0.7em] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Аватар (URL)</label>
            <input
              type="text"
              placeholder="https://..."
              value={judgeAvatar || ''}
              onChange={e => { setJudgeAvatar(e.target.value); syncState({ judgeAvatar: e.target.value }); }}
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
              <span className="text-[0.8em]" style={{ color: 'var(--text-secondary)' }}>{judgeNickname || 'Ведущий'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast */}
      <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3">
          🖥 Трансляция
        </h3>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-[0.7em] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Основной текст</label>
            <input
              type="text"
              value={mainInfoText || ''}
              onChange={e => { setMainInfoText(e.target.value); syncState({ mainInfoText: e.target.value }); }}
              className="w-full input-field mt-1.5"
            />
          </div>
          <div>
            <label className="block text-[0.7em] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Дополнительный текст</label>
            <input
              type="text"
              value={additionalInfoText || ''}
              onChange={e => { setAdditionalInfoText(e.target.value); syncState({ additionalInfoText: e.target.value }); }}
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
      <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-3.5">
          🎨 Тема оформления
        </h3>

        {/* Dark / Light mode toggle */}
        <DarkModeToggle darkMode={darkMode} onChange={(val) => { setDarkMode(val); applyDarkMode(val); triggerHaptic('medium'); }} />

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
            <div className="text-[0.7em] font-medium" style={{ color: 'var(--text-muted)' }}>Текущая тема</div>
          </div>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-3 gap-2">
          {COLOR_SCHEMES.map(c => {
            const isActive = selectedColorScheme === c.key;
            return (
              <button
                key={c.key}
                onClick={() => selectColor(c.key)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                  isActive
                    ? 'border-accent/30'
                    : 'border-transparent hover:border-[var(--surface-border-hover)]'
                }`}
                style={isActive ? { background: 'var(--accent-surface)' } : { background: 'var(--surface-primary)' }}
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
      <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
        <h3 className="text-[0.9em] font-bold flex items-center gap-2 mb-2.5">
          ℹ Информация
        </h3>
        <div className="flex flex-col gap-1 text-[0.8em]" style={{ color: 'var(--text-muted)' }}>
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

      {/* End session */}
      {!viewOnly && (
        <button
          className={`relative z-[1] w-full py-3 px-4 rounded-2xl font-bold text-[0.85em] border border-status-error/15 bg-status-error/5 text-status-error/70 active:scale-[0.98] transition-all duration-150 active:bg-status-error/10 ${!(winnerTeam && gameFinished) ? 'opacity-40' : ''}`}
          onClick={() => {
            if (!(winnerTeam && gameFinished)) {
              showToast('В сессии остались незавершенные игры. Доиграйте текущую партию, чтобы завершить сессию', { type: 'error', title: 'Нельзя завершить сессию' });
              triggerHaptic('warning');
              return;
            }
            showModal({
              icon: '⚠️',
              title: 'Завершить сессию?',
              message: 'После завершения серия будет перенесена в Историю, и её игры станут недоступны для редактирования. Оверлей будет отключен.',
              buttons: [
                { label: 'Отмена' },
                { label: 'Да, завершить', primary: true, danger: true, action: () => { endSession(); triggerHaptic('success'); } },
              ],
            });
          }}
        >
          Завершить сессию
        </button>
      )}
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
          : 'border'
      }`}
      style={value ? {} : { background: 'var(--surface-primary)', borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}
    >
      <span>{label}</span>
      <span>{value ? '✓' : '✕'}</span>
    </button>
  );
}

function DarkModeToggle({ darkMode, onChange }) {
  return (
    <div className="flex items-center gap-2 mb-4 p-1 rounded-[14px]" style={{ background: 'var(--surface-primary)', border: '1px solid var(--surface-border)' }}>
      <button
        onClick={() => onChange(true)}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[0.8em] font-bold transition-all duration-200 ${
          darkMode ? 'text-white shadow-glass-sm' : ''
        }`}
        style={darkMode ? { background: 'var(--accent-color)', color: '#fff' } : { color: 'var(--text-secondary)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        Тёмная
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[0.8em] font-bold transition-all duration-200 ${
          !darkMode ? 'shadow-glass-sm' : ''
        }`}
        style={!darkMode ? { background: 'var(--accent-color)', color: '#fff' } : { color: 'var(--text-secondary)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        Светлая
      </button>
    </div>
  );
}
