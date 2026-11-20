import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Coins,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  LogOut,
  Zap,
} from 'lucide-react';
import { CAR_MAP } from '../data/cars';
import { formatKeyCode } from '../data/defaultSettings';
import { TRACK_MAP } from '../data/tracks';
import { TouchControlState } from '../engine/GameViewport';
import {
  AllSettings,
  RaceMode,
  RaceResultItem,
  RaceTelemetry,
  TrackId,
} from '../types/game';
import { formatRaceTime } from './LeaderboardModal';
import { Minimap } from './Minimap';

interface RaceHUDProps {
  mode: RaceMode;
  trackId: TrackId;
  settings: AllSettings;
  p1Tel: RaceTelemetry;
  p2Tel?: RaceTelemetry;
  countdownLabel: string | null;
  paused: boolean;
  results: RaceResultItem[] | null;
  lastEarnedCoins: number;
  leaderboardSubmitted: boolean;
  touchP1Ref: React.MutableRefObject<TouchControlState>;
  touchP2Ref: React.MutableRefObject<TouchControlState>;
  onTogglePause: () => void;
  onCycleCamera: () => void;
  onOpenSettings: () => void;
  onSubmitLeaderboard: () => void;
  onRestartRace: () => void;
  onExitToMenu: () => void;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  mode,
  trackId,
  settings,
  p1Tel,
  p2Tel,
  countdownLabel,
  paused,
  results,
  lastEarnedCoins,
  leaderboardSubmitted,
  touchP1Ref,
  touchP2Ref,
  onTogglePause,
  onCycleCamera,
  onOpenSettings,
  onSubmitLeaderboard,
  onRestartRace,
  onExitToMenu,
}) => {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);

  const { controls, graphics } = settings;
  const hc = controls.highContrastHud;
  const panelBg = hc
    ? 'bg-black border-white text-white'
    : 'bg-slate-950/88 border-white/15 text-white';

  const btnSizeClass =
    controls.touchSize === 'xlarge'
      ? 'w-20 h-20 text-base'
      : controls.touchSize === 'large'
        ? 'w-16 h-16 text-sm'
        : 'w-13 h-13 text-xs';

  const handleJoystickMove = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxR ? maxR / dist : 1;
    const clampedX = dx * scale;
    const clampedY = dy * scale;
    setJoyOffset({ x: clampedX, y: clampedY });

    touchP1Ref.current.steer = Math.max(-1, Math.min(1, -clampedX / maxR));
    if (controls.accelerationMode === 'manual') {
      touchP1Ref.current.throttle = clampedY < -maxR * 0.2 ? Math.min(1, -clampedY / maxR) : 0;
      touchP1Ref.current.brake = clampedY > maxR * 0.25 ? Math.min(1, clampedY / maxR) : 0;
    }
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setJoyOffset({ x: 0, y: 0 });
    touchP1Ref.current.steer = 0;
    if (controls.accelerationMode === 'manual') {
      touchP1Ref.current.throttle = 0;
      touchP1Ref.current.brake = 0;
    }
  };

  const SteeringBlock = (
    <div className="pointer-events-auto touch-none flex items-center gap-2.5">
      {controls.steeringMode === 'joystick' ? (
        <div
          ref={joyBaseRef}
          onPointerDown={(e) => {
            joyPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            handleJoystickMove(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (joyPointerId.current === e.pointerId) {
              handleJoystickMove(e.clientX, e.clientY);
            }
          }}
          onPointerUp={resetJoystick}
          onPointerCancel={resetJoystick}
          className={`relative w-32 h-32 rounded-full border-2 flex items-center justify-center touch-none ${panelBg}`}
          aria-label="Virtual Steering Joystick"
        >
          <div
            style={{
              transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
            }}
            className="w-12 h-12 rounded-full bg-amber-500 border-2 border-white shadow-lg pointer-events-none"
          />
        </div>
      ) : controls.steeringMode === 'tilt' ? (
        <div className={`px-3 py-2 rounded-lg border text-xs ${panelBg}`}>
          Tilt Device to Steer
        </div>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={() => (touchP1Ref.current.steer = 1)}
            onPointerUp={() => {
              if (touchP1Ref.current.steer > 0) touchP1Ref.current.steer = 0;
            }}
            onPointerLeave={() => {
              if (touchP1Ref.current.steer > 0) touchP1Ref.current.steer = 0;
            }}
            onPointerCancel={() => (touchP1Ref.current.steer = 0)}
            aria-label="Steer Left"
            className={`${btnSizeClass} rounded-xl border flex items-center justify-center active:scale-95 transition-transform ${panelBg}`}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            onPointerDown={() => (touchP1Ref.current.steer = -1)}
            onPointerUp={() => {
              if (touchP1Ref.current.steer < 0) touchP1Ref.current.steer = 0;
            }}
            onPointerLeave={() => {
              if (touchP1Ref.current.steer < 0) touchP1Ref.current.steer = 0;
            }}
            onPointerCancel={() => (touchP1Ref.current.steer = 0)}
            aria-label="Steer Right"
            className={`${btnSizeClass} rounded-xl border flex items-center justify-center active:scale-95 transition-transform ${panelBg}`}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
    </div>
  );

  const PedalsBlock = (
    <div className="pointer-events-auto touch-none flex items-center gap-2.5">
      <button
        type="button"
        onPointerDown={() => (touchP1Ref.current.drift = true)}
        onPointerUp={() => (touchP1Ref.current.drift = false)}
        onPointerLeave={() => (touchP1Ref.current.drift = false)}
        onPointerCancel={() => (touchP1Ref.current.drift = false)}
        className={`${btnSizeClass} rounded-xl border flex flex-col items-center justify-center font-display font-bold active:scale-95 transition-transform ${panelBg}`}
      >
        <Zap className="w-5 h-5 text-cyan-400" />
        <span className="text-[11px] mt-0.5">Drift</span>
      </button>

      <button
        type="button"
        onPointerDown={() => (touchP1Ref.current.brake = 1)}
        onPointerUp={() => (touchP1Ref.current.brake = 0)}
        onPointerLeave={() => (touchP1Ref.current.brake = 0)}
        onPointerCancel={() => (touchP1Ref.current.brake = 0)}
        className={`${btnSizeClass} rounded-xl border border-rose-500/60 bg-rose-950/85 text-rose-100 flex items-center justify-center font-display font-bold active:scale-95 transition-transform`}
      >
        Brake
      </button>

      {controls.accelerationMode === 'manual' && (
        <button
          type="button"
          onPointerDown={() => (touchP1Ref.current.throttle = 1)}
          onPointerUp={() => (touchP1Ref.current.throttle = 0)}
          onPointerLeave={() => (touchP1Ref.current.throttle = 0)}
          onPointerCancel={() => (touchP1Ref.current.throttle = 0)}
          className={`${btnSizeClass} rounded-xl border border-emerald-400 bg-emerald-600/90 text-white flex items-center justify-center font-display font-bold active:scale-95 transition-transform`}
        >
          Gas
        </button>
      )}
    </div>
  );

  const hullColor =
    p1Tel.hullHealth > 60
      ? 'bg-emerald-400'
      : p1Tel.hullHealth > 35
        ? 'bg-amber-400'
        : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Edge HUD Bar + Low-Poly 2D Minimap */}
      <div className="flex items-start justify-between gap-3">
        {/* P1 Race Status */}
        <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-4 sm:gap-5 ${panelBg}`}>
          <div>
            <div className="text-[11px] text-slate-400">Position</div>
            <div className="font-display text-2xl font-bold leading-none text-amber-400 font-mono-tabular">
              {p1Tel.position}
              <span className="text-sm text-slate-400">/{p1Tel.totalRacers}</span>
            </div>
          </div>
          <div className="h-7 w-px bg-white/15" />
          <div>
            <div className="text-[11px] text-slate-400">Lap</div>
            <div className="font-display text-2xl font-bold leading-none font-mono-tabular">
              {p1Tel.lap}
              <span className="text-sm text-slate-400">/{p1Tel.totalLaps}</span>
            </div>
          </div>
          <div className="h-7 w-px bg-white/15 hidden sm:block" />
          <div className="hidden sm:block">
            <div className="text-[11px] text-slate-400">Time</div>
            <div className="font-mono-tabular text-lg font-bold leading-none">
              {formatRaceTime(p1Tel.elapsedMs)}
            </div>
          </div>
          <div className="h-7 w-px bg-white/15 hidden sm:block" />
          <div className="hidden sm:block min-w-[74px]">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" /> Hull
              </span>
              <span className="font-mono-tabular text-slate-200">{p1Tel.hullHealth}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${p1Tel.hullHealth}%` }}
                className={`h-full ${hullColor} transition-[width] duration-150`}
              />
            </div>
          </div>
          {graphics.showFps && (
            <>
              <div className="h-7 w-px bg-white/15" />
              <div className="text-xs font-mono-tabular text-slate-300 leading-tight">
                <div className="text-emerald-400 font-bold">{p1Tel.fps} FPS</div>
                <div className="text-[11px] text-slate-400">{p1Tel.estimatedRamMb} MB</div>
              </div>
            </>
          )}
        </div>

        {/* Split-Screen P2 Summary (if active) */}
        {mode === 'split-screen' && p2Tel && (
          <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-4 ${panelBg}`}>
            <span className="font-display text-xs font-bold text-cyan-400">P2</span>
            <span className="font-mono-tabular font-bold text-sm">
              Pos {p2Tel.position}/{p2Tel.totalRacers} · Lap {p2Tel.lap}/{p2Tel.totalLaps} ·{' '}
              {p2Tel.speedKmh} km/h
            </span>
          </div>
        )}

        {/* Top-Right: Utility Action Buttons + Low-Poly 2D Minimap */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => (touchP1Ref.current.respawnPressed = true)}
              title="Respawn on Track"
              aria-label="Respawn on Track"
              className={`p-2.5 rounded-xl border hover:border-amber-400 transition-colors ${panelBg}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onCycleCamera}
              title="Switch Camera View"
              aria-label="Switch Camera View"
              className={`p-2.5 rounded-xl border hover:border-amber-400 transition-colors ${panelBg}`}
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePause}
              title="Pause Race"
              aria-label="Pause Race"
              className={`p-2.5 rounded-xl border hover:border-amber-400 transition-colors ${panelBg}`}
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          <Minimap trackId={trackId} dots={p1Tel.minimapDots} highContrast={hc} />
        </div>
      </div>

      {/* Center Countdown / Wrong-Way Alerts */}
      <div className="flex flex-col items-center justify-center pointer-events-none">
        {countdownLabel && (
          <div className="font-display text-7xl sm:text-8xl font-bold text-amber-400 drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]">
            {countdownLabel}
          </div>
        )}
        {p1Tel.wrongWay && !countdownLabel && (
          <div className="px-5 py-2 rounded-lg bg-rose-600 text-white font-display font-bold text-lg shadow-lg">
            Wrong Way — Turn Around
          </div>
        )}
      </div>

      {/* Bottom HUD: Controls + Speedometer */}
      <div className="space-y-3">
        {/* Speedometer Strip */}
        <div className="flex items-end justify-between gap-4">
          {controls.swapSides ? PedalsBlock : SteeringBlock}

          <div className={`px-4 py-2.5 rounded-xl border text-center min-w-[140px] ${panelBg}`}>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="font-display text-3xl sm:text-4xl font-bold font-mono-tabular leading-none">
                {p1Tel.speedKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
              <span className="ml-1.5 font-mono-tabular text-xs font-bold text-amber-400">
                G{p1Tel.gear}
              </span>
            </div>
            {/* Drift Boost Charge Bar */}
            <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.round(p1Tel.boostCharge * 100)}%` }}
                className="h-full bg-cyan-400 transition-[width] duration-75"
              />
            </div>
          </div>

          {controls.swapSides ? SteeringBlock : PedalsBlock}
        </div>

        {/* Keyboard Controls Whisper Footer (desktop reference) */}
        <div className="hidden md:flex items-center justify-center gap-4 text-[11px] text-slate-300/80">
          <span>
            P1: {formatKeyCode(controls.p1Keys.accelerate)}/{formatKeyCode(controls.p1Keys.brake)} Gas/Brake ·{' '}
            {formatKeyCode(controls.p1Keys.steerLeft)}/{formatKeyCode(controls.p1Keys.steerRight)} Steer ·{' '}
            {formatKeyCode(controls.p1Keys.drift)} Drift · {formatKeyCode(controls.p1Keys.respawn)} Respawn
          </span>
          {mode === 'split-screen' && (
            <span>
              · P2: {formatKeyCode(controls.p2Keys.accelerate)}/{formatKeyCode(controls.p2Keys.brake)}/
              {formatKeyCode(controls.p2Keys.steerLeft)}/{formatKeyCode(controls.p2Keys.steerRight)}
            </span>
          )}
        </div>
      </div>

      {/* Pause Modal */}
      {paused && !results && (
        <div className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scroll touch-pan-y bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4 text-center">
            <h2 className="font-display text-2xl font-bold text-white">Race Paused</h2>
            <p className="text-xs text-slate-400">
              {TRACK_MAP[trackId]?.name} · Lap {p1Tel.lap}/{p1Tel.totalLaps}
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={onTogglePause}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume Race
              </button>
              <button
                onClick={onOpenSettings}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm"
              >
                Graphics, Audio & Controls
              </button>
              {mode !== 'multiplayer' && (
                <button
                  onClick={onRestartRace}
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm"
                >
                  Restart Race
                </button>
              )}
              <button
                onClick={onExitToMenu}
                className="w-full py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500 text-rose-300 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Exit to Garage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Race Results Podium Modal */}
      {results && (
        <div className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scroll touch-pan-y bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {results.find((r) => r.isLocalP1)?.position === 1
                      ? 'Victory!'
                      : 'Race Complete'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {TRACK_MAP[trackId]?.name} · Final Standings
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="font-display text-xl font-bold text-amber-400">
                  P{results.find((r) => r.isLocalP1)?.position ?? 1}
                </div>
                <div className="flex items-center justify-end gap-1 text-xs font-mono-tabular font-bold text-emerald-400">
                  <Coins className="w-3.5 h-3.5" />+{lastEarnedCoins} Coins
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800 bg-slate-950/60 border border-slate-800 rounded-lg overflow-hidden">
              {results.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    r.isLocalP1 || r.isLocalP2 ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular font-bold text-amber-400 w-6">
                      #{r.position}
                    </span>
                    <div>
                      <div className="font-semibold text-white">{r.name}</div>
                      <div className="text-xs text-slate-400">
                        {CAR_MAP[r.carId]?.name ?? r.carId}
                        {r.isLocalP1 ? ` · Hull ${r.hullHealthRemaining}%` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular">
                    <div className="font-bold text-white">
                      {formatRaceTime(r.finishTimeMs)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Best Lap {formatRaceTime(r.bestLapMs)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={onSubmitLeaderboard}
                disabled={leaderboardSubmitted}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                  leaderboardSubmitted
                    ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 cursor-default'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                {leaderboardSubmitted
                  ? 'Saved to Global Leaderboard'
                  : 'Post Score to Global Leaderboard'}
              </button>

              <div className="flex items-center gap-2.5">
                {mode !== 'multiplayer' && (
                  <button
                    onClick={onRestartRace}
                    className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
                  >
                    Race Again
                  </button>
                )}
                <button
                  onClick={onExitToMenu}
                  className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold"
                >
                  Back to Garage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

