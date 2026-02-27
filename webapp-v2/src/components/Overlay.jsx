import React, { useState, useEffect, useRef } from 'react';
import { createOverlayConnection } from '../services/socket';
import { COLOR_SCHEMES } from '../constants/themes';
import { getRoleLabel, isBlackRole } from '../constants/roles';

const INACTIVE = ['killed', 'voted', 'removed', 'tech_fall_removed', 'fall_removed'];

function mergeState(prev, update) {
  const next = { ...prev };
  for (const [key, val] of Object.entries(update)) {
    if (key === 'avatars') {
      next.avatars = { ...(prev.avatars || {}), ...val };
    } else {
      next[key] = val;
    }
  }
  return next;
}

function getTheme(key) {
  return COLOR_SCHEMES.find(c => c.key === key) || COLOR_SCHEMES[0];
}

export function Overlay() {
  const [roomCode, setRoomCode] = useState(null);
  const [hostConnected, setHostConnected] = useState(false);
  const [gameState, setGameState] = useState({});
  const connRef = useRef(null);

  useEffect(() => {
    const conn = createOverlayConnection({
      onRoomCode: (code) => setRoomCode(code),
      onHostConnected: () => setHostConnected(true),
      onHostDisconnected: () => { setHostConnected(false); setGameState({}); },
      onOverlayClosed: () => {},
      onStateUpdate: (data) => setGameState(prev => mergeState(prev, data)),
    });
    connRef.current = conn;
    return () => conn.close();
  }, []);

  const theme = getTheme(gameState.selectedColorScheme);

  if (!roomCode) return <OverlayLoading theme={theme} />;
  if (!hostConnected) return <OverlayWaiting code={roomCode} status="waiting" theme={theme} />;
  if (!gameState.players?.length) return <OverlayWaiting code={roomCode} status="connected" theme={theme} />;

  return <OverlayGame state={gameState} theme={theme} />;
}

function OverlayLoading() {
  return (
    <div className="ov-center">
      <div className="ov-pulse" style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
        Подключение...
      </div>
    </div>
  );
}

function OverlayWaiting({ code, status, theme }) {
  return (
    <div className="ov-center">
      <div className="ov-code-card">
        <div className="ov-code-label">Код комнаты</div>
        <div className="ov-code-digits">
          {code.split('').map((d, i) => (
            <span
              key={i}
              className="ov-code-digit"
              style={{ animationDelay: `${i * 0.1}s`, borderColor: `${theme.accent}30` }}
            >
              {d}
            </span>
          ))}
        </div>
        {status === 'connected' ? (
          <div className="ov-code-hint" style={{ color: 'rgba(52,211,153,0.8)' }}>
            Панель подключена, ожидание данных...
          </div>
        ) : (
          <div className="ov-code-hint">Введите этот код в настройках панели</div>
        )}
      </div>
    </div>
  );
}

function OverlayGame({ state, theme }) {
  const {
    players = [], roles = {}, playersActions = {}, fouls = {}, techFouls = {},
    removed = {}, avatars = {},
    gamePhase = 'roles', dayNumber = 0, nightNumber = 0, nightPhase,
    highlightedPlayer, firstKilledPlayer,
    bestMove = [], bestMoveAccepted,
    nominations = {}, votingOrder = [], votingResults = {},
    votingFinished, votingWinners = [], votingStage,
    winnerTeam, playerScores = {}, gameFinished,
    mainInfoText, additionalInfoText,
    judgeNickname, judgeAvatar,
    hideSeating, hideBestMove,
    cityMode, gameMode,
  } = state;

  const accent = theme.accent;

  const phaseLabel = getPhaseLabel(gamePhase, dayNumber, nightNumber, cityMode);
  const nightLabel = nightPhase ? getNightPhaseLabel(nightPhase) : null;

  const tableOut = players.map((p, i) => {
    const rk = p.roleKey || `1-1-${i + 1}`;
    const action = playersActions[rk] || null;
    const role = roles[rk] || null;
    const isActive = !action || !INACTIVE.includes(action);
    const isHighlighted = highlightedPlayer === rk;
    const isFirstKilled = firstKilledPlayer === rk;
    return {
      ...p, num: i + 1, rk, action, role, isActive, isHighlighted, isFirstKilled,
      fouls: fouls[rk] || 0, techFouls: techFouls[rk] || 0,
      avatar: avatars[p.login] || p.avatar_link,
    };
  });

  const aliveCount = tableOut.filter(p => p.isActive).length;
  const showVoting = votingOrder.length > 0;
  const showBestMove = !hideBestMove && bestMove.length > 0 && firstKilledPlayer;

  return (
    <div className="ov-root">
      {/* Top area */}
      <div className="ov-top">
        <div className="ov-phase" style={{ borderColor: `${accent}20` }}>
          <div className="ov-phase-dot" style={{ background: accent }} />
          <div className="ov-phase-text">{phaseLabel}</div>
          {nightLabel && <div className="ov-phase-sub">{nightLabel}</div>}
          <div className="ov-phase-alive">{aliveCount}/{players.length}</div>
        </div>

        {mainInfoText && (
          <div className="ov-info" style={{ borderColor: `${accent}15` }}>{mainInfoText}</div>
        )}
        {additionalInfoText && (
          <div className="ov-info-sm">{additionalInfoText}</div>
        )}

        {showVoting && (
          <div className="ov-voting">
            <div className="ov-section-title">
              {votingFinished ? 'Итоги голосования' : `Голосование${votingStage === 'tie' ? ' (ничья)' : votingStage === 'lift' ? ' (подъём)' : ''}`}
            </div>
            <div className="ov-voting-list">
              {votingOrder.map(num => {
                const p = tableOut[num - 1];
                if (!p) return null;
                const votes = votingResults[String(num)];
                const voteCount = Array.isArray(votes) ? votes.length : (typeof votes === 'number' ? votes : 0);
                const isWinner = votingWinners.includes(num);
                return (
                  <div
                    key={num}
                    className="ov-voting-row"
                    style={isWinner ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' } : {}}
                  >
                    <span className="ov-voting-num" style={{ color: accent }}>{num}</span>
                    <span className="ov-voting-name">{p.login || `Игрок ${num}`}</span>
                    <span className="ov-voting-votes">{voteCount}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showBestMove && (
          <div className="ov-bestmove">
            <div className="ov-section-title">Лучший ход{bestMoveAccepted ? ' (принят)' : ''}</div>
            <div className="ov-bestmove-nums">
              {bestMove.map(n => (
                <span key={n} className="ov-bestmove-num" style={{ borderColor: `${accent}30` }}>{n}</span>
              ))}
            </div>
          </div>
        )}

        {winnerTeam && (
          <div
            className="ov-winner"
            style={{ background: winnerTeam === 'mafia' ? 'rgba(220,38,38,0.85)' : 'rgba(34,197,94,0.85)' }}
          >
            {winnerTeam === 'mafia' ? 'Победа мафии' : 'Победа мирных'}
          </div>
        )}
      </div>

      {/* Bottom: player cards */}
      {!hideSeating && (
        <div className="ov-players">
          {tableOut.map(p => (
            <PlayerCard
              key={p.rk}
              player={p}
              accent={accent}
              showScore={gameFinished}
              score={playerScores[p.rk]}
            />
          ))}
        </div>
      )}

      {judgeNickname && (
        <div className="ov-judge">
          {judgeAvatar && (
            <img src={judgeAvatar} alt="" className="ov-judge-avatar" onError={e => { e.target.style.display = 'none'; }} />
          )}
          <span>{judgeNickname}</span>
        </div>
      )}
    </div>
  );
}

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, accent, showScore, score }) {
  const { num, login, avatar, action, role, isActive, isHighlighted, isFirstKilled, fouls: f, techFouls: tf } = player;
  const isOut = !isActive;
  const isBlack = role && isBlackRole(role);
  const isSheriff = role === 'sheriff' || role === 'detective';
  const roleColor = isSheriff ? '#3b82f6' : isBlack ? '#dc2626' : null;
  const roleLabel = isSheriff ? 'Ш' : role === 'don' ? 'Д' : isBlack ? 'М' : null;

  return (
    <div className={`ov-card ${isOut ? 'ov-card-out' : ''}`}>
      {/* Glow behind active card */}
      {isHighlighted && !isOut && (
        <div className="ov-card-glow" style={{ background: `${accent}40` }} />
      )}

      <div
        className="ov-card-body"
        style={isHighlighted && !isOut ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}50` } : {}}
      >
        {/* Role strip at top */}
        {!isOut && roleColor && (
          <div className="ov-card-role-strip" style={{ background: roleColor }} />
        )}

        {/* Avatar */}
        <div className="ov-card-avatar-area">
          {avatar ? (
            <img src={avatar} alt="" className="ov-card-avatar-img" onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <svg className="ov-card-avatar-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>

        {/* LEFT: Number + foul dots (vertical) */}
        <div className="ov-card-left-panel">
          <span className="ov-card-num" style={isHighlighted && !isOut ? { color: accent } : {}}>
            {num}
          </span>
          <div className="ov-card-dots">
            {[1, 2, 3, 4].map(i => (
              <div
                key={`f${i}`}
                className={`ov-card-dot ${i <= f ? 'ov-card-dot-foul' : 'ov-card-dot-empty'}`}
              />
            ))}
            {[1, 2].map(i => (
              <div
                key={`t${i}`}
                className={`ov-card-dot ${i <= tf ? 'ov-card-dot-tech' : 'ov-card-dot-empty'}`}
                style={{ marginTop: i === 1 ? 3 : 0 }}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Status icon or role letter */}
        <div className="ov-card-right-panel">
          {isOut && (
            <div className="ov-card-status-icon">
              {action === 'killed' && <SkullIcon />}
              {action === 'voted' && <BanIcon />}
              {(action === 'removed' || action === 'tech_fall_removed' || action === 'fall_removed') && <LogOutIcon />}
            </div>
          )}
          {!isOut && roleLabel && (
            <span className="ov-card-role-letter" style={roleColor ? { color: roleColor } : {}}>
              {roleLabel}
            </span>
          )}
        </div>

        {/* Score badge */}
        {showScore && score && (
          <div className="ov-card-score" style={{ background: `${accent}cc` }}>
            {((score.bonus || 0) - (score.penalty || 0)).toFixed(1)}
          </div>
        )}

        {/* First killed badge */}
        {isFirstKilled && !isOut && (
          <div className="ov-card-fk">1</div>
        )}

        {/* BOTTOM: nickname gradient */}
        <div className="ov-card-bottom">
          <div className="ov-card-name" style={isHighlighted && !isOut ? { color: accent } : {}}>
            {login || `Игрок ${num}`}
          </div>
        </div>

        {/* Active pulse bar */}
        {isHighlighted && !isOut && (
          <div className="ov-card-pulse" style={{ background: accent }} />
        )}
      </div>
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function SkullIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1"/>
      <path d="M6 9a6 6 0 1 1 12 0c0 3.5-2 5-2 8H8c0-3-2-4.5-2-8z"/>
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPhaseLabel(phase, day, night, city) {
  if (phase === 'roles') return 'Раздача ролей';
  if (phase === 'discussion') return city ? 'Знакомство' : 'Договорка';
  if (phase === 'freeSeating') return 'Свободная посадка';
  if (phase === 'day') return day === 0 ? 'День 0' : `День ${day}`;
  if (phase === 'night') return `Ночь ${night}`;
  if (phase === 'results') return 'Итоги';
  return '';
}

function getNightPhaseLabel(np) {
  const map = { kill: 'Мафия стреляет', don: 'Проверка дона', sheriff: 'Проверка шерифа', doctor: 'Ход доктора', done: 'Ночь завершена' };
  return map[np] || '';
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const OVERLAY_CSS = `
@keyframes overlayFadeIn {
  from { opacity: 0; transform: translateY(12px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes overlayPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
@keyframes ovCardPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
html, body { background: transparent !important; margin: 0; overflow: hidden; }
*, *::before, *::after { box-sizing: border-box; }

.ov-center {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff;
}
.ov-pulse { animation: overlayPulse 2s ease-in-out infinite; }

/* Code screen */
.ov-code-card {
  text-align: center; padding: 48px 64px;
  background: rgba(0,0,0,0.75); backdrop-filter: blur(20px);
  border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);
}
.ov-code-label {
  font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.5);
  text-transform: uppercase; letter-spacing: 3px; margin-bottom: 16px;
}
.ov-code-digits { display: flex; gap: 16px; justify-content: center; }
.ov-code-digit {
  font-size: 72px; font-weight: 800; color: #fff;
  width: 80px; height: 96px; line-height: 96px; text-align: center;
  background: rgba(255,255,255,0.08); border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.15);
  animation: overlayFadeIn 0.5s ease both;
}
.ov-code-hint { font-size: 14px; color: rgba(255,255,255,0.35); margin-top: 20px; }

/* Game layout — fixed 1920x1080 canvas */
.ov-root {
  position: fixed; inset: 0;
  width: 1920px; height: 1080px;
  padding: 24px;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff;
  display: flex; flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.ov-top {
  flex: 1; display: flex; flex-direction: column; gap: 10px;
  min-height: 0;
}

/* Phase banner */
.ov-phase {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-radius: 14px;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  align-self: flex-start;
}
.ov-phase-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ov-phase-text { font-size: 20px; font-weight: 800; }
.ov-phase-sub { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); }
.ov-phase-alive { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.4); margin-left: auto; }

/* Info texts */
.ov-info {
  font-size: 16px; font-weight: 700;
  padding: 8px 14px; border-radius: 12px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.06); align-self: flex-start;
}
.ov-info-sm {
  font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6);
  padding: 5px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.4); align-self: flex-start;
}

.ov-section-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1.5px; color: rgba(255,255,255,0.5); margin-bottom: 8px;
}

/* Voting */
.ov-voting {
  padding: 10px 14px; border-radius: 14px;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.06); align-self: flex-start;
}
.ov-voting-list { display: flex; flex-direction: column; gap: 4px; }
.ov-voting-row {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.05);
}
.ov-voting-num { font-size: 15px; font-weight: 800; min-width: 22px; text-align: center; }
.ov-voting-name { flex: 1; font-size: 13px; font-weight: 600; }
.ov-voting-votes { font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.7); }

/* Best move */
.ov-bestmove {
  padding: 8px 14px; border-radius: 14px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.06); align-self: flex-start;
}
.ov-bestmove-nums { display: flex; gap: 6px; }
.ov-bestmove-num {
  width: 32px; height: 32px; border-radius: 8px; font-size: 14px; font-weight: 800;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
}

/* Winner */
.ov-winner {
  padding: 14px 24px; border-radius: 16px;
  font-size: 26px; font-weight: 800; text-align: center;
  text-transform: uppercase; letter-spacing: 2px;
  align-self: flex-start;
}

/* Judge */
.ov-judge {
  position: absolute; top: 24px; right: 24px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6);
}
.ov-judge-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }

/* ─── Player cards bar (centered, 1400px) ─── */
.ov-players {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 1400px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2px;
}

/* Card wrapper */
.ov-card {
  position: relative;
  flex: 1;
  min-width: 0;
  transition: all 0.3s ease;
}
.ov-card-out {
  opacity: 0.3;
  filter: grayscale(1);
}

/* Glow */
.ov-card-glow {
  position: absolute; inset: -1px;
  border-radius: 8px;
  filter: blur(8px);
  pointer-events: none;
  animation: overlayPulse 2s ease-in-out infinite;
}

/* Card body — 3:4 aspect ratio */
.ov-card-body {
  position: relative;
  aspect-ratio: 3/4;
  width: 100%;
  background: rgba(9,9,11,0.95);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  transition: border-color 0.3s, box-shadow 0.3s;
}

/* Role strip */
.ov-card-role-strip {
  position: absolute; top: 0; left: 0; right: 0;
  height: 2px; z-index: 30;
}

/* Avatar */
.ov-card-avatar-area {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ov-card-avatar-img {
  width: 100%; height: 100%; object-fit: cover;
}
.ov-card-avatar-placeholder {
  width: 24px; height: 24px; opacity: 0.05;
}

/* LEFT PANEL: number + dots */
.ov-card-left-panel {
  position: absolute; top: 6px; left: 6px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  z-index: 30;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.9));
}
.ov-card-num {
  font-size: 14px; font-weight: 900; line-height: 1;
  color: rgba(255,255,255,0.7);
}
.ov-card-dots {
  display: flex; flex-direction: column; gap: 2px;
}
.ov-card-dot {
  width: 5px; height: 5px; border-radius: 50%;
  transition: background 0.2s;
}
.ov-card-dot-foul {
  background: #dc2626;
  box-shadow: 0 0 4px rgba(220,38,38,0.7);
}
.ov-card-dot-tech {
  background: #eab308;
  box-shadow: 0 0 4px rgba(234,179,8,0.5);
}
.ov-card-dot-empty {
  background: rgba(255,255,255,0.1);
}

/* RIGHT PANEL: status / role */
.ov-card-right-panel {
  position: absolute; top: 6px; right: 6px;
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
  z-index: 30;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.9));
}
.ov-card-status-icon {
  opacity: 0.6;
  color: #fff;
  transform: scale(1.1);
  transform-origin: right;
}
.ov-card-role-letter {
  font-size: 10px; font-weight: 900;
  text-transform: uppercase; line-height: 1;
}

/* Score */
.ov-card-score {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 14px; font-weight: 800; padding: 3px 8px; border-radius: 6px;
  z-index: 35; color: #fff;
}

/* First killed */
.ov-card-fk {
  position: absolute; top: -3px; right: -3px;
  width: 16px; height: 16px; border-radius: 50%;
  font-size: 9px; font-weight: 900;
  background: #ef4444; color: #fff;
  display: flex; align-items: center; justify-content: center;
  z-index: 35; box-shadow: 0 2px 6px rgba(239,68,68,0.5);
}

/* BOTTOM: nickname */
.ov-card-bottom {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 6px 6px 8px;
  padding-top: 20px;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%);
  z-index: 30;
}
.ov-card-name {
  font-size: 9px; font-weight: 900;
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,0.9);
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}

/* Active pulse bar */
.ov-card-pulse {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 3px; z-index: 40;
  box-shadow: 0 0 8px currentColor;
  animation: ovCardPulse 1.5s ease-in-out infinite;
}
`;

if (typeof document !== 'undefined') {
  const id = 'mafboard-overlay-css';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = OVERLAY_CSS;
    document.head.appendChild(el);
  }
}
