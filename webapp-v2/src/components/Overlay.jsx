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

// ─── Loading ─────────────────────────────────────────────────────────────────

function OverlayLoading({ theme }) {
  return (
    <div className="ov-center">
      <div className="ov-pulse" style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
        Подключение...
      </div>
    </div>
  );
}

// ─── Waiting (code screen) ───────────────────────────────────────────────────

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

// ─── Game overlay ────────────────────────────────────────────────────────────

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
  const grad0 = theme.gradient[0];
  const grad1 = theme.gradient[1];

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
      {/* Top area: phase + info + voting + best move */}
      <div className="ov-top">
        {/* Phase banner */}
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

        {/* Voting */}
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

        {/* Best move */}
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

        {/* Winner */}
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
              grad0={grad0}
              grad1={grad1}
              showScore={gameFinished}
              score={playerScores[p.rk]}
            />
          ))}
        </div>
      )}

      {/* Judge */}
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

// ─── Player card (based on user's design) ────────────────────────────────────

function PlayerCard({ player, accent, grad0, grad1, showScore, score }) {
  const { num, login, avatar, action, role, isActive, isHighlighted, isFirstKilled, fouls: f, techFouls: tf } = player;
  const isOut = !isActive;
  const isBlack = role && isBlackRole(role);
  const isSheriff = role === 'sheriff' || role === 'detective';
  const roleColor = isSheriff ? '#3b82f6' : isBlack ? '#dc2626' : null;
  const roleName = role ? getRoleLabel(role) : null;

  return (
    <div
      className={`ov-card ${isHighlighted && !isOut ? 'ov-card-active' : ''} ${isOut ? 'ov-card-out' : ''}`}
      style={isHighlighted && !isOut ? { '--ov-accent': accent } : {}}
    >
      {/* Glow for highlighted */}
      {isHighlighted && !isOut && (
        <div className="ov-card-glow" style={{ background: `${accent}40` }} />
      )}

      {/* Card body */}
      <div className="ov-card-body">
        {/* Role indicator strip */}
        {!isOut && roleColor && (
          <div className="ov-card-role-strip" style={{ background: roleColor }} />
        )}

        {/* Avatar area */}
        <div className="ov-card-avatar-area">
          {avatar ? (
            <img src={avatar} alt="" className="ov-card-avatar-img" onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <svg className="ov-card-avatar-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>

        {/* Top indicators */}
        <div className="ov-card-top">
          <div className="ov-card-top-left">
            <span
              className="ov-card-num"
              style={isHighlighted && !isOut ? { color: accent } : {}}
            >
              {num}
            </span>
            {tf > 0 && !isOut && (
              <div className="ov-card-tf">
                {[...Array(tf)].map((_, i) => <div key={i} className="ov-card-tf-dot" />)}
              </div>
            )}
          </div>
          <div className="ov-card-top-right">
            {isOut && (
              <div className="ov-card-status-icon">
                {action === 'killed' && <SkullIcon />}
                {action === 'voted' && <BanIcon />}
                {(action === 'removed' || action === 'tech_fall_removed' || action === 'fall_removed') && <LogOutIcon />}
              </div>
            )}
            {!isOut && roleName && (
              <span className="ov-card-role-letter">{roleName[0]}</span>
            )}
          </div>
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

        {/* Bottom: name + fouls */}
        <div className="ov-card-bottom">
          <div
            className="ov-card-name"
            style={isHighlighted && !isOut ? { color: accent } : {}}
          >
            {login || `Игрок ${num}`}
          </div>
          <div className="ov-card-fouls">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`ov-card-foul-dot ${
                  i <= f
                    ? (i === 4 ? 'ov-card-foul-crit' : 'ov-card-foul-active')
                    : 'ov-card-foul-empty'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Active player pulse */}
        {isHighlighted && !isOut && (
          <div className="ov-card-pulse" style={{ background: accent }} />
        )}
      </div>
    </div>
  );
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function SkullIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1"/>
      <path d="M6 9a6 6 0 1 1 12 0c0 3.5-2 5-2 8H8c0-3-2-4.5-2-8z"/>
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── CSS (injected once) ─────────────────────────────────────────────────────

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

/* Game layout */
.ov-root {
  position: fixed; inset: 0; padding: 24px;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff;
  display: flex; flex-direction: column;
  overflow: hidden;
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

/* Section title */
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

/* ─── Player cards bottom bar ─── */
.ov-players {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 6px; padding-top: 12px; flex-shrink: 0;
}

/* Card wrapper */
.ov-card {
  position: relative; flex: 1; transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  min-width: 0;
}
.ov-card-active {
  transform: scale(1.08) translateY(-8px);
  z-index: 10;
}
.ov-card-out {
  opacity: 0.3; filter: grayscale(1);
}

/* Glow */
.ov-card-glow {
  position: absolute; inset: -2px; border-radius: 10px;
  filter: blur(8px); pointer-events: none;
}

/* Card body */
.ov-card-body {
  position: relative; aspect-ratio: 3/4; width: 100%;
  background: rgba(20,20,25,0.85); backdrop-filter: blur(8px);
  border-radius: 8px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.ov-card-active .ov-card-body {
  border-color: var(--ov-accent, rgba(255,255,255,0.15));
}

/* Role strip */
.ov-card-role-strip {
  position: absolute; top: 0; left: 0; right: 0; height: 2px; z-index: 30;
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
  width: 28px; height: 28px; opacity: 0.06;
}

/* Top indicators */
.ov-card-top {
  position: absolute; top: 4px; left: 5px; right: 5px;
  display: flex; justify-content: space-between; align-items: flex-start;
  z-index: 30;
}
.ov-card-top-left { display: flex; flex-direction: column; gap: 3px; }
.ov-card-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }

.ov-card-num {
  font-size: 10px; font-weight: 900; line-height: 1;
  color: rgba(255,255,255,0.4);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
.ov-card-tf { display: flex; gap: 2px; }
.ov-card-tf-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: #eab308; box-shadow: 0 0 4px rgba(234,179,8,0.5);
}

.ov-card-status-icon { opacity: 0.5; color: #fff; }
.ov-card-role-letter {
  font-size: 7px; font-weight: 900; opacity: 0.4; text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
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

/* Bottom: name + fouls */
.ov-card-bottom {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 4px 5px 5px;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%);
  z-index: 30;
}
.ov-card-name {
  font-size: 7px; font-weight: 700; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: rgba(255,255,255,0.65); margin-bottom: 3px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
.ov-card-fouls {
  display: flex; justify-content: center; gap: 2px;
}
.ov-card-foul-dot { width: 3px; height: 3px; border-radius: 50%; }
.ov-card-foul-active { background: rgba(234,179,8,0.8); }
.ov-card-foul-crit { background: #dc2626; box-shadow: 0 0 4px red; }
.ov-card-foul-empty { background: rgba(255,255,255,0.1); }

/* Active pulse */
.ov-card-pulse {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 2px; z-index: 40;
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
