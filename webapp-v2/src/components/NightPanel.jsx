import React from 'react';
import { useGame } from '../context/GameContext';
import { SlideConfirm } from './SlideConfirm';
import { triggerHaptic } from '../utils/haptics';
import { NightTimerBar } from './NightTimerBar';
import { DialerPad, dialerBtn } from './DialerPad';

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
    <div className="flex flex-col gap-3.5 animate-fade-in">
      {/* Step 1: Mafia Kill */}
      {(!nightPhase || nightPhase === 'kill') && (
        <div className="relative z-[1] p-4 rounded-2xl glass-card-md !border-red-500/20 animate-glass-reveal">
          {showTimer && <NightTimerBar duration={15} />}
          <h3 className="text-base font-extrabold text-red-400 text-center mb-1">
            Мафия убивает
          </h3>
          <p className="text-xs text-white/35 text-center mb-3.5">
            Выберите жертву
          </p>
          <DialerGrid allPlayers={allPlayers} isPlayerActive={isPlayerActive} onSelect={handleKill} borderColor="rgba(255,69,58,0.15)" />
          <button onClick={handleMiss}
            className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
              text-white/40 text-sm font-bold active:scale-[0.97] transition-transform duration-150 ease-spring">
            ✕ Промах
          </button>
        </div>
      )}

      {/* Step 2: Don Check */}
      {nightPhase === 'don' && (
        <NightCheckStep
          title="Проверка Дона" subtitle="Ищет Шерифа" icon="🔍"
          accentColor="rgba(155,89,182,0.8)" borderColor="rgba(155,89,182,0.3)" bgColor="rgba(155,89,182,0.05)"
          result={checkerResult} allPlayers={allPlayers}
          onCheck={(num) => { performNightCheck(donKey, num); triggerHaptic('medium'); }}
          onSkip={() => { advanceNightPhase(); triggerHaptic('light'); }}
          timerDuration={showTimer ? 10 : 0}
        />
      )}

      {/* Step 3: Sheriff Check */}
      {nightPhase === 'sheriff' && (
        <NightCheckStep
          title="Проверка Шерифа" subtitle="Ищет Мафию" icon="⭐"
          accentColor="rgba(255,213,79,0.8)" borderColor="rgba(255,213,79,0.3)" bgColor="rgba(255,213,79,0.05)"
          result={checkerResult} allPlayers={allPlayers}
          onCheck={(num) => { performNightCheck(sheriffKey, num); triggerHaptic('medium'); }}
          onSkip={() => { advanceNightPhase(); triggerHaptic('light'); }}
          timerDuration={showTimer ? 10 : 0}
        />
      )}

      {/* Doctor heal (City mode) */}
      {nightPhase === 'doctor' && cityMode && doctorKey && (
        <div className="relative z-[1] p-4 rounded-2xl glass-card-md animate-glass-reveal"
          style={{ borderColor: 'rgba(76,175,80,0.3)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9em] font-bold text-green-400 flex items-center gap-2">
              💊 Доктор лечит
            </h3>
            <button onClick={() => { advanceNightPhase(); triggerHaptic('light'); }}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                text-white/50 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring">
              Пропустить
            </button>
          </div>
          {doctorHeal ? (
            <div className="text-center py-5">
              <div className="text-lg font-bold text-green-400">Лечит #{doctorHeal.target}</div>
            </div>
          ) : (
            <>
              {doctorLastHealTarget && (
                <p className="text-[0.7em] text-white/40 mb-2">Нельзя лечить #{doctorLastHealTarget} (лечил прошлой ночью)</p>
              )}
              <DialerGrid allPlayers={allPlayers.filter(p => isPlayerActive(p.roleKey) && canDoctorHealTarget(p.num))}
                isPlayerActive={() => true} onSelect={handleDoctorHeal} borderColor="rgba(76,175,80,0.2)" />
            </>
          )}
        </div>
      )}

      {/* Step 4: Night Done */}
      {nightPhase === 'done' && (
        <div className="flex flex-col gap-3.5 animate-fade-in">
          <div className="relative z-[1] p-5 rounded-2xl glass-card-md text-center"
            style={{
              borderColor: killedThisNight.length > 0 ? 'rgba(255,69,58,0.3)' : 'rgba(255,255,255,0.1)',
              background: killedThisNight.length > 0 ? 'rgba(255,69,58,0.05)' : 'rgba(255,255,255,0.02)',
            }}>
            {killedThisNight.length > 0 ? (
              <>
                <div className="text-[0.7em] text-white/35 uppercase tracking-wider mb-1.5">Убили</div>
                <div className="text-[2em] font-extrabold text-red-400">
                  {killedThisNight.map(num => `#${num}`).join(', ')}
                </div>
                {killedThisNight.map(num => {
                  const p = tableOut[num - 1];
                  return p?.login ? (
                    <div key={num} className="text-sm text-white/40 mt-1">{p.login}</div>
                  ) : null;
                })}
              </>
            ) : (
              <>
                <div className="text-[0.7em] text-white/35 uppercase tracking-wider mb-1.5">Промах</div>
                <div className="text-xl font-bold text-white/30">Никто не убит</div>
              </>
            )}
          </div>

          {/* Best Move */}
          {firstKilledPlayer && !bestMoveAccepted && killedThisNight.length > 0 && (
            <div className="relative z-[1] p-4 rounded-2xl glass-card-md animate-fade-in"
              style={{ borderColor: 'rgba(255,214,10,0.3)' }}>
              {showTimer && <NightTimerBar duration={15} />}
              <h3 className="text-base font-extrabold text-yellow-400 text-center mb-1">Лучший ход</h3>
              <p className="text-xs text-white/35 text-center mb-3.5">Убитый называет 3 подозреваемых</p>
              <DialerPad items={allPlayers} className="mb-3" renderButton={(p) => {
                const selected = bestMove.includes(p.num);
                return (
                  <button
                    onClick={() => { toggleBestMove(p.num); triggerHaptic('selection'); }}
                    className={`${dialerBtn.base} ${selected ? dialerBtn.selected : dialerBtn.normal}`}>
                    {p.num}
                  </button>
                );
              }} />
              {bestMove.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-yellow-400">ЛХ: {bestMove.join(', ')}</span>
                  <button onClick={() => { acceptBestMove(firstKilledPlayer); triggerHaptic('success'); }}
                    className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold
                      active:scale-95 transition-transform duration-150 ease-spring">
                    ✓ Принять
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Morning slider */}
          {(bestMoveAccepted || !firstKilledPlayer || killedThisNight.length === 0) && (
            <div className="mt-1">
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
        <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
          <h4 className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider mb-2.5">История проверок</h4>
          <div className="flex flex-col gap-1.5">
            {nightCheckHistory.map((h, i) => (
              <div key={i} className="flex justify-between text-[0.8em]">
                <span style={{ color: h.checkerRole === 'sheriff' ? '#ffd54f' : '#ce93d8' }}>
                  Н{h.night} {h.checkerRole === 'sheriff' ? '★' : '◆'} → #{h.target} {h.targetLogin}
                </span>
                <span className="font-bold" style={{ color: h.found ? '#30d158' : 'rgba(255,255,255,0.35)' }}>{h.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor heal history */}
      {cityMode && doctorHealHistory.length > 0 && nightPhase === 'done' && (
        <div className="relative z-[1] p-4 rounded-2xl glass-card-md">
          <h4 className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider mb-2.5">История лечения</h4>
          <div className="flex flex-col gap-1">
            {doctorHealHistory.map((h, i) => (
              <div key={i} className="text-[0.8em] text-green-400">Н{h.night} → #{h.target}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function DialerGrid({ allPlayers, isPlayerActive, onSelect, borderColor }) {
  return (
    <DialerPad items={allPlayers} renderButton={(p) => {
      const alive = isPlayerActive(p.roleKey);
      return (
        <button
          onClick={() => alive && onSelect(p.num)}
          disabled={!alive}
          className={`${dialerBtn.base} ${!alive ? dialerBtn.disabled : dialerBtn.normal}`}
          style={{ borderColor: alive ? borderColor : undefined }}>
          {p.num}
        </button>
      );
    }} />
  );
}

function NightCheckStep({ title, subtitle, icon, accentColor, borderColor, bgColor, result, allPlayers, onCheck, onSkip, timerDuration }) {
  return (
    <div className="relative z-[1] p-4 rounded-2xl glass-card-md animate-glass-reveal"
      style={{ borderColor }}>
      {timerDuration > 0 && <NightTimerBar duration={timerDuration} />}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: accentColor }}>
            {icon} {title}
          </h3>
          {subtitle && <p className="text-[0.7em] text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onSkip}
          className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
            text-white/50 text-xs font-bold active:scale-95 transition-transform duration-150 ease-spring">
          Пропустить
        </button>
      </div>
      {result ? (
        <div className="text-center py-5 animate-scale-in">
          <div className="text-xl font-extrabold">{result.result}</div>
          <div className="text-sm text-white/40 mt-1">Игрок #{result.target}</div>
        </div>
      ) : (
        <DialerPad items={allPlayers} renderButton={(p) => (
          <button onClick={() => onCheck(p.num)}
            className={`${dialerBtn.base} ${dialerBtn.normal}`}
            style={{ borderColor }}>
            {p.num}
          </button>
        )} />
      )}
    </div>
  );
}
