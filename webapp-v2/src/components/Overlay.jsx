import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createOverlayConnection } from '../services/socket';

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

export function Overlay() {
  const [roomCode, setRoomCode] = useState(null);
  const [hostConnected, setHostConnected] = useState(false);
  const [gameState, setGameState] = useState({});
  const connRef = useRef(null);

  useEffect(() => {
    const conn = createOverlayConnection({
      onRoomCode: (code) => setRoomCode(code),
      onHostConnected: () => setHostConnected(true),
      onHostDisconnected: () => setHostConnected(false),
      onOverlayClosed: () => {},
      onStateUpdate: (data) => setGameState(prev => mergeState(prev, data)),
    });
    connRef.current = conn;
    return () => conn.close();
  }, []);

  if (!roomCode) {
    return <OverlayLoading />;
  }

  if (!hostConnected) {
    return <OverlayWaiting code={roomCode} status="waiting" />;
  }

  if (!gameState.players?.length) {
    return <OverlayWaiting code={roomCode} status="connected" />;
  }

  return <OverlayGame state={gameState} />;
}

// ─── Loading screen ──────────────────────────────────────────────────────────

function OverlayLoading() {
  return (
    <div style={styles.center}>
      <div style={{ ...styles.pulse, fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
        Подключение...
      </div>
    </div>
  );
}

// ─── Waiting for host (shows code) ──────────────────────────────────────────

function OverlayWaiting({ code, status }) {
  return (
    <div style={styles.center}>
      <div style={styles.codeCard}>
        <div style={styles.codeLabel}>Код комнаты</div>
        <div style={styles.codeDigits}>
          {code.split('').map((d, i) => (
            <span key={i} style={{ ...styles.codeDigit, animationDelay: `${i * 0.1}s` }}>{d}</span>
          ))}
        </div>
        {status === 'connected' ? (
          <div style={{ ...styles.codeHint, color: 'rgba(52,211,153,0.8)' }}>Панель подключена, ожидание данных...</div>
        ) : (
          <div style={styles.codeHint}>Введите этот код в настройках панели</div>
        )}
      </div>
    </div>
  );
}

// ─── Game overlay ────────────────────────────────────────────────────────────

function OverlayGame({ state }) {
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

  const phaseLabel = getPhaseLabel(gamePhase, dayNumber, nightNumber, cityMode);
  const nightLabel = nightPhase ? getNightPhaseLabel(nightPhase) : null;

  const tableOut = players.map((p, i) => {
    const rk = p.roleKey || `1-1-${i + 1}`;
    const action = playersActions[rk] || null;
    const isActive = !action || !INACTIVE.includes(action);
    const isHighlighted = highlightedPlayer === rk;
    const isFirstKilled = firstKilledPlayer === rk;
    return { ...p, num: i + 1, rk, action, isActive, isHighlighted, isFirstKilled, fouls: fouls[rk] || 0, techFouls: techFouls[rk] || 0, avatar: avatars[p.login] || p.avatar_link };
  });

  const aliveCount = tableOut.filter(p => p.isActive).length;
  const showVoting = votingOrder.length > 0;
  const showBestMove = !hideBestMove && bestMove.length > 0 && firstKilledPlayer;

  return (
    <div style={styles.overlayRoot}>
      {/* Phase banner */}
      <div style={styles.phaseBanner}>
        <div style={styles.phaseText}>{phaseLabel}</div>
        {nightLabel && <div style={styles.nightPhaseText}>{nightLabel}</div>}
        <div style={styles.aliveText}>{aliveCount} / {players.length}</div>
      </div>

      {/* Main info text */}
      {mainInfoText && <div style={styles.infoText}>{mainInfoText}</div>}
      {additionalInfoText && <div style={styles.infoTextSm}>{additionalInfoText}</div>}

      {/* Player table */}
      {!hideSeating && (
        <div style={styles.playersGrid}>
          {tableOut.map(p => (
            <PlayerCard key={p.rk} player={p} showScore={gameFinished} score={playerScores[p.rk]} />
          ))}
        </div>
      )}

      {/* Voting */}
      {showVoting && (
        <div style={styles.votingSection}>
          <div style={styles.sectionTitle}>
            {votingFinished ? 'Итоги голосования' : `Голосование${votingStage === 'tie' ? ' (ничья)' : votingStage === 'lift' ? ' (подъём)' : ''}`}
          </div>
          <div style={styles.votingCandidates}>
            {votingOrder.map(num => {
              const p = tableOut[num - 1];
              if (!p) return null;
              const votes = votingResults[String(num)];
              const voteCount = Array.isArray(votes) ? votes.length : (typeof votes === 'number' ? votes : 0);
              const isWinner = votingWinners.includes(num);
              return (
                <div key={num} style={{ ...styles.votingCandidate, ...(isWinner ? styles.votingWinner : {}) }}>
                  <span style={styles.votingNum}>{num}</span>
                  <span style={styles.votingName}>{p.login || `Игрок ${num}`}</span>
                  <span style={styles.votingVotes}>{voteCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Best move */}
      {showBestMove && (
        <div style={styles.bestMoveSection}>
          <div style={styles.sectionTitle}>Лучший ход{bestMoveAccepted ? ' (принят)' : ''}</div>
          <div style={styles.bestMoveNums}>
            {bestMove.map(n => <span key={n} style={styles.bestMoveNum}>{n}</span>)}
          </div>
        </div>
      )}

      {/* Winner */}
      {winnerTeam && (
        <div style={{ ...styles.winnerBanner, background: winnerTeam === 'mafia' ? 'rgba(220,38,38,0.85)' : 'rgba(34,197,94,0.85)' }}>
          {winnerTeam === 'mafia' ? 'Победа мафии' : 'Победа мирных'}
        </div>
      )}

      {/* Judge */}
      {judgeNickname && (
        <div style={styles.judgeBar}>
          {judgeAvatar && <img src={judgeAvatar} alt="" style={styles.judgeAvatar} onError={e => { e.target.style.display = 'none'; }} />}
          <span>{judgeNickname}</span>
        </div>
      )}
    </div>
  );
}

// ─── Player card ─────────────────────────────────────────────────────────────

function PlayerCard({ player, showScore, score }) {
  const { num, login, avatar, action, isActive, isHighlighted, isFirstKilled, fouls: f } = player;
  const bg = isHighlighted
    ? 'rgba(139,92,246,0.5)'
    : !isActive
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(255,255,255,0.08)';
  const opacity = isActive ? 1 : 0.4;

  return (
    <div style={{ ...styles.playerCard, background: bg, opacity, border: isHighlighted ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.08)' }}>
      <div style={styles.playerNum}>{num}</div>
      {avatar
        ? <img src={avatar} alt="" style={styles.playerAvatar} onError={e => { e.target.style.display = 'none'; }} />
        : <div style={styles.playerAvatarPlaceholder} />
      }
      <div style={styles.playerInfo}>
        <div style={styles.playerName}>{login || `Игрок ${num}`}</div>
        {action && <div style={styles.playerAction}>{actionLabel(action)}</div>}
        {f > 0 && isActive && <div style={styles.playerFouls}>{'!'.repeat(f)}</div>}
      </div>
      {showScore && score && (
        <div style={styles.playerScore}>
          {((score.bonus || 0) - (score.penalty || 0)).toFixed(1)}
        </div>
      )}
      {isFirstKilled && isActive && <div style={styles.firstKilledBadge}>1</div>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionLabel(a) {
  const map = { killed: 'Убит', voted: 'Выведен', removed: 'Удалён', tech_fall_removed: 'Тех. удалён', fall_removed: 'Удалён (фолы)' };
  return map[a] || a;
}

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

// ─── Styles (inline for OBS browser source compatibility) ────────────────────

const styles = {
  center: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  codeCard: {
    textAlign: 'center', padding: '48px 64px',
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)',
    borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
  },
  codeLabel: {
    fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 3, marginBottom: 16,
  },
  codeDigits: { display: 'flex', gap: 16, justifyContent: 'center' },
  codeDigit: {
    fontSize: 72, fontWeight: 800, color: '#fff',
    width: 80, height: 96, lineHeight: '96px', textAlign: 'center',
    background: 'rgba(255,255,255,0.08)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.15)',
    animation: 'overlayFadeIn 0.5s ease both',
  },
  codeHint: {
    fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 20,
  },
  pulse: { animation: 'overlayPulse 2s ease-in-out infinite' },

  overlayRoot: {
    position: 'fixed', inset: 0, padding: 24,
    background: 'transparent',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#fff', display: 'flex', flexDirection: 'column', gap: 12,
    overflow: 'hidden',
  },

  phaseBanner: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 20px', borderRadius: 16,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  phaseText: { fontSize: 22, fontWeight: 800 },
  nightPhaseText: { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)' },
  aliveText: { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' },

  infoText: {
    fontSize: 18, fontWeight: 700,
    padding: '10px 16px', borderRadius: 12,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.06)', alignSelf: 'flex-start',
  },
  infoTextSm: {
    fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
    padding: '6px 14px', borderRadius: 10,
    background: 'rgba(0,0,0,0.4)', alignSelf: 'flex-start',
  },

  playersGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flex: 1,
    alignContent: 'start',
  },
  playerCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 12,
    backdropFilter: 'blur(8px)', position: 'relative', transition: 'all 0.3s',
  },
  playerNum: { fontSize: 16, fontWeight: 800, minWidth: 22, textAlign: 'center', color: 'rgba(255,255,255,0.5)' },
  playerAvatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  playerAvatarPlaceholder: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0 },
  playerInfo: { flex: 1, minWidth: 0 },
  playerName: { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  playerAction: { fontSize: 10, fontWeight: 600, color: 'rgba(239,68,68,0.9)', marginTop: 1 },
  playerFouls: { fontSize: 10, color: '#f59e0b', fontWeight: 700, marginTop: 1 },
  playerScore: { fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.7)' },
  firstKilledBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 800,
    background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)', marginBottom: 8,
  },

  votingSection: {
    padding: '12px 16px', borderRadius: 14,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  votingCandidates: { display: 'flex', flexDirection: 'column', gap: 4 },
  votingCandidate: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  votingWinner: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' },
  votingNum: { fontSize: 16, fontWeight: 800, minWidth: 24, textAlign: 'center' },
  votingName: { flex: 1, fontSize: 14, fontWeight: 600 },
  votingVotes: { fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.7)' },

  bestMoveSection: {
    padding: '10px 16px', borderRadius: 14,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.06)', alignSelf: 'flex-start',
  },
  bestMoveNums: { display: 'flex', gap: 8 },
  bestMoveNum: {
    width: 36, height: 36, borderRadius: 10, fontSize: 16, fontWeight: 800,
    background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  winnerBanner: {
    padding: '16px 24px', borderRadius: 16,
    fontSize: 28, fontWeight: 800, textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 2,
  },

  judgeBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 12,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
    alignSelf: 'flex-end', marginTop: 'auto',
  },
  judgeAvatar: { width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' },
};

// ─── CSS animations (injected once) ─────────────────────────────────────────

const OVERLAY_CSS = `
@keyframes overlayFadeIn {
  from { opacity: 0; transform: translateY(12px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes overlayPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
body { background: transparent !important; margin: 0; overflow: hidden; }
`;

if (typeof document !== 'undefined') {
  const id = 'mafboard-overlay-css';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = OVERLAY_CSS;
    document.head.appendChild(style);
  }
}
