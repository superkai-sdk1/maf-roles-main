import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { triggerHaptic } from '../utils/haptics';
import { DialerPad, dialerBtn } from './DialerPad';
import { Crosshair, Search, Star, SkipForward, XCircle, Heart } from 'lucide-react';

const PHASE_CONFIG = {
  kill: {
    subtitle: 'Мафия убивает',
    hint: 'Выберите жертву',
    accent: 'from-red-600/15 to-red-900/30',
    textColor: 'text-red-400',
    iconColor: 'text-red-500',
    Icon: Crosshair,
    actionText: 'Промах',
    ActionIcon: XCircle,
  },
  don: {
    subtitle: 'Проверка Дона',
    hint: 'Ищет Шерифа',
    accent: 'from-purple-600/15 to-purple-900/30',
    textColor: 'text-purple-400',
    iconColor: 'text-purple-500',
    Icon: Search,
    actionText: 'Пропуск',
    ActionIcon: SkipForward,
  },
  sheriff: {
    subtitle: 'Проверка Шерифа',
    hint: 'Ищет Мафию',
    accent: 'from-yellow-600/15 to-yellow-900/30',
    textColor: 'text-yellow-400',
    iconColor: 'text-yellow-500',
    Icon: Star,
    actionText: 'Пропуск',
    ActionIcon: SkipForward,
  },
  doctor: {
    subtitle: 'Доктор лечит',
    hint: 'Выберите пациента',
    accent: 'from-green-600/15 to-green-900/30',
    textColor: 'text-green-400',
    iconColor: 'text-green-500',
    Icon: Heart,
    actionText: 'Пропуск',
    ActionIcon: SkipForward,
  },
};

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
      {/* Mafia Kill */}
      {(!nightPhase || nightPhase === 'kill') && (
        <PhaseCard phase="kill" timerDuration={showTimer ? 15 : 0}>
          <NightGrid
            players={allPlayers}
            isDisabled={(p) => !isPlayerActive(p.roleKey)}
            onSelect={handleKill}
            onAction={handleMiss}
            config={PHASE_CONFIG.kill}
          />
        </PhaseCard>
      )}

      {/* Don Check */}
      {nightPhase === 'don' && (
        <PhaseCard phase="don" timerDuration={showTimer ? 10 : 0}>
          {checkerResult ? (
            <div className="text-center py-5 animate-scale-in">
              <div className="text-xl font-extrabold">{checkerResult.result}</div>
              <div className="text-sm text-white/40 mt-1">Игрок #{checkerResult.target}</div>
            </div>
          ) : (
            <NightGrid
              players={allPlayers}
              isDisabled={(p) => !isPlayerActive(p.roleKey)}
              onSelect={(num) => { performNightCheck(donKey, num); triggerHaptic('medium'); }}
              onAction={() => { advanceNightPhase(); triggerHaptic('light'); }}
              config={PHASE_CONFIG.don}
            />
          )}
        </PhaseCard>
      )}

      {/* Sheriff Check */}
      {nightPhase === 'sheriff' && (
        <PhaseCard phase="sheriff" timerDuration={showTimer ? 10 : 0}>
          {checkerResult ? (
            <div className="text-center py-5 animate-scale-in">
              <div className="text-xl font-extrabold">{checkerResult.result}</div>
              <div className="text-sm text-white/40 mt-1">Игрок #{checkerResult.target}</div>
            </div>
          ) : (
            <NightGrid
              players={allPlayers}
              isDisabled={(p) => !isPlayerActive(p.roleKey)}
              onSelect={(num) => { performNightCheck(sheriffKey, num); triggerHaptic('medium'); }}
              onAction={() => { advanceNightPhase(); triggerHaptic('light'); }}
              config={PHASE_CONFIG.sheriff}
            />
          )}
        </PhaseCard>
      )}

      {/* Doctor Heal (City mode) */}
      {nightPhase === 'doctor' && cityMode && doctorKey && (
        <PhaseCard phase="doctor" timerDuration={0}>
          {doctorHeal ? (
            <div className="text-center py-5 animate-scale-in">
              <div className="text-lg font-bold text-green-400">Лечит #{doctorHeal.target}</div>
            </div>
          ) : (
            <>
              {doctorLastHealTarget && (
                <p className="text-[0.7em] text-white/40 mb-3 text-center">
                  Нельзя лечить #{doctorLastHealTarget} (лечил прошлой ночью)
                </p>
              )}
              <NightGrid
                players={allPlayers}
                isDisabled={(p) => !isPlayerActive(p.roleKey) || !canDoctorHealTarget(p.num)}
                onSelect={handleDoctorHeal}
                onAction={() => { advanceNightPhase(); triggerHaptic('light'); }}
                config={PHASE_CONFIG.doctor}
              />
            </>
          )}
        </PhaseCard>
      )}

      {/* Night Done */}
      {nightPhase === 'done' && (
        <div className="flex flex-col gap-3.5 animate-fade-in">
          {/* Kill summary */}
          <div
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl"
            style={{
              borderColor: killedThisNight.length > 0 ? 'rgba(255,69,58,0.3)' : undefined,
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${
              killedThisNight.length > 0 ? 'from-red-600/15 to-red-900/30' : 'from-white/5 to-transparent'
            } opacity-30`} />
            <div className="relative p-6 text-center">
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
          </div>

          {/* Best Move */}
          {firstKilledPlayer && !bestMoveAccepted && killedThisNight.length > 0 && (
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl animate-fade-in"
              style={{ borderColor: 'rgba(255,214,10,0.3)' }}>
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-600/15 to-yellow-900/30 opacity-30" />
              <div className="relative p-6">
                {showTimer && <PhaseTimer duration={15} textColorClass="text-yellow-400" />}
                <div className="flex items-center gap-2 mb-0.5">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-xl font-bold tracking-tight text-yellow-400">Лучший ход</h2>
                </div>
                <p className="text-slate-400 text-[12px] font-medium ml-6 mb-4">
                  Убитый называет 3 подозреваемых
                </p>
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
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold text-yellow-400">ЛХ: {bestMove.join(', ')}</span>
                    <button onClick={() => { acceptBestMove(firstKilledPlayer); triggerHaptic('success'); }}
                      className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold
                        active:scale-95 transition-transform duration-150 ease-spring">
                      ✓ Принять
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Morning transition is handled by the control panel InertiaSlider below */}
        </div>
      )}

      {/* Check history */}
      {nightCheckHistory.length > 0 && nightPhase === 'done' && (
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
          <div className="relative p-6">
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
        </div>
      )}

      {/* Doctor heal history */}
      {cityMode && doctorHealHistory.length > 0 && nightPhase === 'done' && (
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
          <div className="relative p-6">
            <h4 className="text-[0.7em] font-bold text-white/40 uppercase tracking-wider mb-2.5">История лечения</h4>
            <div className="flex flex-col gap-1">
              {doctorHealHistory.map((h, i) => (
                <div key={i} className="text-[0.8em] text-green-400">Н{h.night} → #{h.target}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =================== Phase Card =================== */

function PhaseCard({ phase, timerDuration, children }) {
  const cfg = PHASE_CONFIG[phase];
  const PhaseIcon = cfg.Icon;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl animate-fade-in">
      <div className={`absolute inset-0 bg-gradient-to-b ${cfg.accent} opacity-30`} />
      <div className="relative p-6 flex flex-col items-center">
        {timerDuration > 0 && <PhaseTimer duration={timerDuration} textColorClass={cfg.textColor} />}
        <div className="w-full mb-6">
          <div className="flex items-center gap-2 mb-0.5">
            <PhaseIcon className={`w-4 h-4 ${cfg.iconColor}`} />
            <h2 className={`text-xl font-bold tracking-tight ${cfg.textColor}`}>{cfg.subtitle}</h2>
          </div>
          <p className="text-slate-400 text-[12px] font-medium ml-6">{cfg.hint}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =================== Phase Timer =================== */

function PhaseTimer({ duration, textColorClass }) {
  const startRef = useRef(Date.now());
  const rafRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    startRef.current = Date.now();
    setTimeLeft(duration);
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const secs = Math.ceil(timeLeft);

  return (
    <div className="w-full mb-6 mt-1">
      <div className="flex justify-between items-end mb-1.5 px-1">
        <span className={`text-[10px] font-bold uppercase tracking-widest opacity-40 ${textColorClass}`}>Таймер</span>
        <span className={`text-[11px] font-mono font-bold ${textColorClass} opacity-80`}>
          00:{secs < 10 ? `0${secs}` : secs}
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${textColorClass} bg-current shadow-[0_0_8px_rgba(255,255,255,0.2)]`}
          style={{ width: `${progress}%`, transition: 'none' }}
        />
      </div>
    </div>
  );
}

/* =================== Night Grid =================== */

function NightGrid({ players, isDisabled, onSelect, onAction, config }) {
  const first9 = players.slice(0, 9);
  const player10 = players.length >= 10 ? players[9] : null;

  const renderBtn = (p) => {
    const disabled = isDisabled(p);
    return (
      <button
        key={p.num}
        onClick={() => !disabled && onSelect(p.num)}
        disabled={disabled}
        className={`h-14 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-200 border ${
          disabled
            ? 'bg-slate-800/10 border-white/5 text-white/15 opacity-30 pointer-events-none'
            : 'bg-slate-800/30 border-white/5 text-slate-400 hover:border-white/20 hover:text-white active:scale-95'
        }`}
      >
        {p.num}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {first9.map(renderBtn)}
      {player10 && <div className="h-14" />}
      {player10 && renderBtn(player10)}
      <button
        onClick={onAction}
        className="h-14 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-slate-300 hover:bg-white/10 transition-colors group active:scale-95"
      >
        <div className="mb-0.5 opacity-70 group-hover:scale-110 transition-transform">
          <config.ActionIcon className="w-4 h-4" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-tighter opacity-60">
          {config.actionText}
        </span>
      </button>
    </div>
  );
}
