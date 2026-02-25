import React from 'react';
import { useGame } from '../context/GameContext';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { NightTimerBar } from './NightTimerBar';

export const NightPanel = () => {
  const {
    tableOut, isPlayerActive, nightNumber,
    nightPhase, nightChecks, nightCheckHistory,
    killPlayer, setNightMiss,
    startNightSequence, advanceNightPhase, performNightCheck,
    findRoleKey, cityMode, gameMode,
    bestMove, toggleBestMove, acceptBestMove, bestMoveAccepted,
    firstKilledPlayer, firstKilledEver,
    killedOnNight,
    doctorHeal, performDoctorHeal, canDoctorHealTarget, doctorLastHealTarget, doctorHealHistory,
    wasKilledBeforeThisNight,
    setMode,
  } = useGame();

  const showTimer = gameMode === 'gomafia' || gameMode === 'funky';

  const donKey = findRoleKey('don');
  const sheriffKey = findRoleKey('sheriff');
  const doctorKey = cityMode ? findRoleKey('doctor') : null;
  const allPlayers = tableOut;

  const checkerKey = nightPhase === 'don' ? donKey : nightPhase === 'sheriff' ? sheriffKey : null;
  const checkerResult = checkerKey ? nightChecks[checkerKey] : null;

  const killedThisNight = Object.entries(killedOnNight)
    .filter(([, n]) => n === (nightNumber || 1))
    .map(([rk]) => {
      const p = tableOut.find(x => x.roleKey === rk);
      return p ? p.num : null;
    })
    .filter(Boolean);

  const handleKill = (num) => {
    killPlayer(num);
    triggerHaptic('heavy');
    advanceNightPhase();
  };

  const handleMiss = () => {
    setNightMiss();
    triggerHaptic('medium');
    advanceNightPhase();
  };

  const handleDoctorHeal = (num) => {
    performDoctorHeal(num);
    triggerHaptic('success');
    setTimeout(() => advanceNightPhase(), 1500);
  };

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Step 1: Mafia Kill */}
      {(!nightPhase || nightPhase === 'kill') && (
        <div className="glass-card animate-glassReveal" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
          {showTimer && <NightTimerBar duration={15} />}
          <h3 style={{ fontSize: '1em', fontWeight: 800, color: '#ff453a', marginBottom: 4, textAlign: 'center' }}>
            Мафия убивает
          </h3>
          <p style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>
            Выберите жертву
          </p>
          <div className="dialer-grid" style={{ marginBottom: 12 }}>
            {allPlayers.map(p => {
              const alive = isPlayerActive(p.roleKey);
              return (
                <button key={p.num}
                  onClick={() => alive && handleKill(p.num)}
                  className={`dialer-btn ${!alive ? 'voted-elsewhere' : ''}`}
                  disabled={!alive}>
                  {p.num}
                </button>
              );
            })}
          </div>
          <button onClick={handleMiss} className="glass-btn"
            style={{ width: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '0.85em' }}>
            ✕ Промах
          </button>
        </div>
      )}

      {/* Step 2: Don Check */}
      {nightPhase === 'don' && (
        <NightCheckStep
          title="Проверка Дона"
          subtitle="Ищет Шерифа"
          icon="🔍"
          accentColor="rgba(155,89,182,0.8)"
          borderColor="rgba(155,89,182,0.3)"
          bgColor="rgba(155,89,182,0.05)"
          result={checkerResult}
          allPlayers={allPlayers}
          onCheck={(num) => { performNightCheck(donKey, num); triggerHaptic('medium'); }}
          onSkip={() => { advanceNightPhase(); triggerHaptic('light'); }}
          timerDuration={showTimer ? 10 : 0}
        />
      )}

      {/* Step 3: Sheriff Check */}
      {nightPhase === 'sheriff' && (
        <NightCheckStep
          title="Проверка Шерифа"
          subtitle="Ищет Мафию"
          icon="⭐"
          accentColor="rgba(255,213,79,0.8)"
          borderColor="rgba(255,213,79,0.3)"
          bgColor="rgba(255,213,79,0.05)"
          result={checkerResult}
          allPlayers={allPlayers}
          onCheck={(num) => { performNightCheck(sheriffKey, num); triggerHaptic('medium'); }}
          onSkip={() => { advanceNightPhase(); triggerHaptic('light'); }}
          timerDuration={showTimer ? 10 : 0}
        />
      )}

      {/* Doctor heal (City mode) */}
      {nightPhase === 'doctor' && cityMode && doctorKey && (
        <div className="glass-card animate-glassReveal" style={{
          padding: 16, position: 'relative', zIndex: 1,
          borderColor: 'rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9em', fontWeight: 700, color: '#81c784', display: 'flex', alignItems: 'center', gap: 8 }}>
              💊 Доктор лечит
            </h3>
            <button onClick={() => { advanceNightPhase(); triggerHaptic('light'); }}
              className="glass-btn" style={{ padding: '6px 14px', fontSize: '0.75em', opacity: 0.7 }}>
              Пропустить
            </button>
          </div>
          {doctorHeal ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#81c784' }}>Лечит #{doctorHeal.target}</div>
            </div>
          ) : (
            <>
              {doctorLastHealTarget && (
                <p style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Нельзя лечить #{doctorLastHealTarget} (лечил прошлой ночью)</p>
              )}
              <div className="dialer-grid">
                {allPlayers.filter(p => isPlayerActive(p.roleKey) && canDoctorHealTarget(p.num)).map(p => (
                  <button key={p.num} onClick={() => handleDoctorHeal(p.num)}
                    className="dialer-btn"
                    style={{ borderColor: 'rgba(76,175,80,0.2)' }}>
                    {p.num}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Night Done — Kill Result + Best Move + Morning Slider */}
      {nightPhase === 'done' && (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Kill result */}
          <div className="glass-card" style={{
            padding: 20, textAlign: 'center', position: 'relative', zIndex: 1,
            borderColor: killedThisNight.length > 0 ? 'rgba(255,69,58,0.3)' : 'rgba(255,255,255,0.1)',
            background: killedThisNight.length > 0 ? 'rgba(255,69,58,0.05)' : 'rgba(255,255,255,0.02)',
          }}>
            {killedThisNight.length > 0 ? (
              <>
                <div style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Убили
                </div>
                <div style={{ fontSize: '2em', fontWeight: 800, color: '#ff453a' }}>
                  {killedThisNight.map(num => `#${num}`).join(', ')}
                </div>
                {killedThisNight.map(num => {
                  const p = tableOut[num - 1];
                  return p?.login ? (
                    <div key={num} style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{p.login}</div>
                  ) : null;
                })}
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Промах
                </div>
                <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
                  Никто не убит
                </div>
              </>
            )}
          </div>

          {/* Best Move (only for first killed player, not yet accepted) */}
          {firstKilledPlayer && !bestMoveAccepted && killedThisNight.length > 0 && (
            <div className="glass-card animate-fadeIn" style={{
              padding: 16, position: 'relative', zIndex: 1,
              borderColor: 'rgba(255,214,10,0.3)', background: 'rgba(255,214,10,0.05)',
            }}>
              {showTimer && <NightTimerBar duration={15} />}
              <h3 style={{ fontSize: '1em', fontWeight: 800, color: '#ffd60a', marginBottom: 4, textAlign: 'center' }}>
                Лучший ход
              </h3>
              <p style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.35)', marginBottom: 14, textAlign: 'center' }}>
                Убитый называет 3 подозреваемых
              </p>
              <div className="dialer-grid" style={{ marginBottom: 12 }}>
                {allPlayers.map(p => {
                  const selected = bestMove.includes(p.num);
                  return (
                    <button key={p.num}
                      onClick={() => { toggleBestMove(p.num); triggerHaptic('selection'); }}
                      className={`dialer-btn ${selected ? 'selected' : ''}`}>
                      {p.num}
                    </button>
                  );
                })}
              </div>
              {bestMove.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85em', fontWeight: 700, color: '#ffd60a' }}>ЛХ: {bestMove.join(', ')}</span>
                  <button onClick={() => { acceptBestMove(firstKilledPlayer); triggerHaptic('success'); }}
                    className="glass-btn btn-primary"
                    style={{ padding: '8px 18px', fontSize: '0.85em' }}>
                    ✓ Принять
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Morning slider */}
          {(bestMoveAccepted || !firstKilledPlayer || killedThisNight.length === 0) && (
            <div style={{ marginTop: 4 }}>
              <SlideConfirm
                label="В городе утро"
                onConfirm={() => { setMode('day'); triggerHaptic('success'); }}
                color="morning"
                compact
              />
            </div>
          )}
        </div>
      )}

      {/* Check history */}
      {nightCheckHistory.length > 0 && nightPhase === 'done' && (
        <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
          <h4 style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            История проверок
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nightCheckHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em' }}>
                <span style={{ color: h.checkerRole === 'sheriff' ? '#ffd54f' : '#ce93d8' }}>
                  Н{h.night} {h.checkerRole === 'sheriff' ? '★' : '◆'} → #{h.target} {h.targetLogin}
                </span>
                <span style={{ fontWeight: 700, color: h.found ? '#30d158' : 'rgba(255,255,255,0.35)' }}>{h.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor heal history */}
      {cityMode && doctorHealHistory.length > 0 && nightPhase === 'done' && (
        <div className="glass-card" style={{ padding: 16, position: 'relative', zIndex: 1 }}>
          <h4 style={{ fontSize: '0.7em', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            История лечения
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {doctorHealHistory.map((h, i) => (
              <div key={i} style={{ fontSize: '0.8em', color: '#81c784' }}>
                Н{h.night} → #{h.target}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function NightCheckStep({ title, subtitle, icon, accentColor, borderColor, bgColor, result, allPlayers, onCheck, onSkip, timerDuration }) {
  return (
    <div className="glass-card animate-glassReveal" style={{
      padding: 16, position: 'relative', zIndex: 1,
      borderColor, background: bgColor,
    }}>
      {timerDuration > 0 && <NightTimerBar duration={timerDuration} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: '1em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: accentColor }}>
            {icon} {title}
          </h3>
          {subtitle && <p style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        <button onClick={onSkip} className="glass-btn" style={{ padding: '6px 14px', fontSize: '0.75em', opacity: 0.7 }}>
          Пропустить
        </button>
      </div>
      {result ? (
        <div className="animate-scaleIn" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: '1.4em', fontWeight: 800 }}>{result.result}</div>
          <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Игрок #{result.target}</div>
        </div>
      ) : (
        <div className="dialer-grid">
          {allPlayers.map(p => (
            <button key={p.num} onClick={() => onCheck(p.num)}
              className="dialer-btn"
              style={{ borderColor }}>
              {p.num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
