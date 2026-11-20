import React, { useEffect, useState } from 'react';
import { Volume2, Monitor, Gamepad2, X, RotateCcw, Smartphone } from 'lucide-react';
import {
  applyPlatformPreset,
  createDefaultSettings,
  formatKeyCode,
  GRAPHICS_PRESETS,
} from '../data/defaultSettings';
import { audioEngine } from '../engine/audio';
import {
  AccelerationMode,
  AllSettings,
  CameraMode,
  GraphicsPreset,
  KeyBindings,
  PlatformMode,
  SteeringMode,
  TouchSize,
} from '../types/game';

interface SettingsModalProps {
  settings: AllSettings;
  onChange: (next: AllSettings) => void;
  onClose: () => void;
}

type SettingsTab = 'graphics' | 'audio' | 'controls';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const [tab, setTab] = useState<SettingsTab>('graphics');
  const [rebinding, setRebinding] = useState<{
    player: 'p1Keys' | 'p2Keys';
    action: keyof KeyBindings;
  } | null>(null);

  useEffect(() => {
    if (!rebinding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRebinding(null);
        return;
      }
      const next: AllSettings = {
        ...settings,
        controls: {
          ...settings.controls,
          [rebinding.player]: {
            ...settings.controls[rebinding.player],
            [rebinding.action]: e.code,
          },
        },
      };
      onChange(next);
      setRebinding(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [rebinding, settings, onChange]);

  const applyPreset = (preset: GraphicsPreset) => {
    const p = GRAPHICS_PRESETS[preset];
    onChange({
      ...settings,
      graphics: {
        ...settings.graphics,
        preset,
        pixelRatio: p.pixelRatio,
        shadows: p.shadows,
        viewDistance: p.viewDistance,
        particles: p.particles,
        raceAnimation: p.raceAnimation,
        brakingAnimation: p.brakingAnimation,
        targetFps: p.targetFps,
      },
    });
  };

  const resetAll = () => {
    const fresh = createDefaultSettings();
    fresh.playerName = settings.playerName;
    onChange(fresh);
  };

  const keyLabels: Array<{ key: keyof KeyBindings; label: string }> = [
    { key: 'accelerate', label: 'Accelerate' },
    { key: 'brake', label: 'Brake / Reverse' },
    { key: 'steerLeft', label: 'Steer Left' },
    { key: 'steerRight', label: 'Steer Right' },
    { key: 'drift', label: 'Drift / Boost' },
    { key: 'respawn', label: 'Respawn on Track' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              512MB RAM Performance Tuning · Procedural Audio · Custom Accessible Controls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              aria-label="Close Settings"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-950/60 border-b border-slate-800 overflow-x-auto touch-pan-x shrink-0">
          <button
            onClick={() => setTab('graphics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'graphics'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Graphics
          </button>
          <button
            onClick={() => setTab('audio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'audio'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Audio
          </button>
          <button
            onClick={() => setTab('controls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'controls'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Controls & Accessibility
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll touch-pan-y p-6 space-y-6">
          {tab === 'graphics' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm font-semibold text-white">
                    Performance Preset
                  </label>
                  <span className="text-xs text-slate-400 font-mono-tabular">
                    Asset Footprint &lt; 20 MB · Zero External Textures
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(
                    [
                      {
                        id: 'eco512',
                        title: '512MB Eco',
                        desc: 'Ultra-light shaders, 70% res, shadows off, smooth 60fps',
                      },
                      {
                        id: 'balanced',
                        title: 'Balanced',
                        desc: 'Standard PBR look, 100% res, medium shadows, 60fps',
                      },
                      {
                        id: 'high',
                        title: 'High Quality',
                        desc: '150% crisp res, soft shadows, far distance & smoke',
                      },
                      {
                        id: 'ultra',
                        title: 'Ultra Quality',
                        desc: '175% super-res, high 2048px shadows & full effects',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => applyPreset(item.id)}
                      className={`text-left p-3.5 rounded-lg border transition-colors ${
                        settings.graphics.preset === item.id
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-display font-bold text-sm">{item.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-200">Resolution Scale</span>
                    <span className="font-mono-tabular text-amber-400">
                      {Math.round(settings.graphics.pixelRatio * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[0.6, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() =>
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, pixelRatio: ratio },
                          })
                        }
                        className={`py-1.5 rounded text-xs font-mono-tabular font-semibold transition-colors ${
                          Math.abs(settings.graphics.pixelRatio - ratio) < 0.05
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {Math.round(ratio * 100)}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-slate-200">Dynamic Shadows</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['off', 'simple', 'medium', 'soft', 'high'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() =>
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, shadows: mode },
                          })
                        }
                        className={`py-1.5 rounded text-xs font-semibold capitalize transition-colors ${
                          settings.graphics.shadows === mode
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-slate-200">View Distance</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['short', 'medium', 'far'] as const).map((dist) => (
                      <button
                        key={dist}
                        onClick={() =>
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, viewDistance: dist },
                          })
                        }
                        className={`py-1.5 rounded text-xs font-semibold capitalize transition-colors ${
                          settings.graphics.viewDistance === dist
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {dist}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-slate-200">Default Camera</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'chase', label: 'Chase' },
                        { id: 'far', label: 'Far' },
                        { id: 'hood', label: 'Hood' },
                      ] as Array<{ id: CameraMode; label: string }>
                    ).map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() =>
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, cameraMode: cam.id },
                          })
                        }
                        className={`py-1.5 rounded text-xs font-semibold transition-colors ${
                          settings.graphics.cameraMode === cam.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {cam.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-3 sm:col-span-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">Target Frame Rate (Custom FPS)</span>
                    <span className="font-mono-tabular font-bold text-amber-400">
                      {(settings.graphics.targetFps ?? 60) === 0
                        ? 'Max / Unlimited'
                        : `${settings.graphics.targetFps} FPS`}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {(
                      [
                        { val: 10, label: '10' },
                        { val: 20, label: '20' },
                        { val: 30, label: '30' },
                        { val: 45, label: '45' },
                        { val: 60, label: '60' },
                        { val: 90, label: '90' },
                        { val: 120, label: '120' },
                        { val: 0, label: 'Max' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, targetFps: opt.val },
                          })
                        }
                        className={`py-1.5 px-2 rounded text-xs font-mono-tabular font-semibold transition-colors ${
                          (settings.graphics.targetFps ?? 60) === opt.val
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Custom Cap (1–240)</span>
                    <input
                      type="range"
                      min={1}
                      max={240}
                      step={1}
                      value={(settings.graphics.targetFps ?? 60) === 0 ? 60 : settings.graphics.targetFps}
                      onChange={(e) =>
                        onChange({
                          ...settings,
                          graphics: {
                            ...settings.graphics,
                            targetFps: Math.max(1, Math.min(240, Number(e.target.value) || 60)),
                          },
                        })
                      }
                      aria-label="Custom FPS Slider"
                      className="flex-1 accent-amber-500"
                    />
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={(settings.graphics.targetFps ?? 60) === 0 ? '' : settings.graphics.targetFps}
                      placeholder="Max"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          onChange({
                            ...settings,
                            graphics: { ...settings.graphics, targetFps: 0 },
                          });
                          return;
                        }
                        const num = Number(raw);
                        if (Number.isFinite(num)) {
                          onChange({
                            ...settings,
                            graphics: {
                              ...settings.graphics,
                              targetFps: Math.max(1, Math.min(240, Math.round(num))),
                            },
                          });
                        }
                      }}
                      aria-label="Custom FPS Number"
                      className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono-tabular text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between bg-slate-800/40 border border-slate-800 rounded-lg p-3.5">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Race Animation</div>
                    <div className="text-xs text-slate-400">
                      Body roll, throttle squat, wheel spin & speed FOV
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        graphics: {
                          ...settings.graphics,
                          raceAnimation: !(settings.graphics.raceAnimation ?? true),
                        },
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      (settings.graphics.raceAnimation ?? true)
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {(settings.graphics.raceAnimation ?? true) ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-800/40 border border-slate-800 rounded-lg p-3.5">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Braking Animation</div>
                    <div className="text-xs text-slate-400">
                      Nose-dive, brake lights, skid smoke &amp; car dirt
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        graphics: {
                          ...settings.graphics,
                          brakingAnimation: !(settings.graphics.brakingAnimation ?? true),
                        },
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      (settings.graphics.brakingAnimation ?? true)
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {(settings.graphics.brakingAnimation ?? true) ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-800/40 border border-slate-800 rounded-lg p-3.5">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Drift Smoke</div>
                    <div className="text-xs text-slate-400">
                      Rear tire smoke puffs during drifts
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        graphics: { ...settings.graphics, particles: !settings.graphics.particles },
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      settings.graphics.particles
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {settings.graphics.particles ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-800/40 border border-slate-800 rounded-lg p-3.5">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Live FPS & RAM</div>
                    <div className="text-xs text-slate-400">
                      Display frame rate & memory in HUD
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        graphics: { ...settings.graphics, showFps: !settings.graphics.showFps },
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      settings.graphics.showFps
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {settings.graphics.showFps ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-slate-800/40 border border-slate-800 rounded-lg p-4">
                <div>
                  <div className="font-semibold text-sm text-white">Mute All Audio</div>
                  <div className="text-xs text-slate-400">
                    Silence synthesized engine sound and race effects
                  </div>
                </div>
                <button
                  onClick={() =>
                    onChange({
                      ...settings,
                      audio: { ...settings.audio, muted: !settings.audio.muted },
                    })
                  }
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    settings.audio.muted
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {settings.audio.muted ? 'Muted' : 'Audio Active'}
                </button>
              </div>

              {(
                [
                  { key: 'masterVolume', label: 'Master Volume' },
                  { key: 'engineVolume', label: 'Engine Synthesizer' },
                  { key: 'sfxVolume', label: 'Race SFX & Drift' },
                ] as const
              ).map((slider) => (
                <div key={slider.key} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-200">{slider.label}</span>
                    <span className="font-mono-tabular text-amber-400">
                      {Math.round(settings.audio[slider.key] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.audio[slider.key]}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        audio: {
                          ...settings.audio,
                          [slider.key]: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              ))}

              <div className="pt-2">
                <button
                  onClick={() => audioEngine.playLapChime(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500 text-xs font-semibold text-white transition-colors"
                >
                  Test Audio Chime
                </button>
              </div>
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-6">
              {/* Driver Name & Platform Mode (PC vs Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white block">
                    Driver Display Name
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={settings.playerName}
                    onChange={(e) => onChange({ ...settings, playerName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Enter your driver name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white block">
                    Platform Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'pc', label: 'PC Mode', Icon: Monitor },
                        { id: 'mobile', label: 'Mobile Mode', Icon: Smartphone },
                      ] as Array<{ id: PlatformMode; label: string; Icon: typeof Monitor }>
                    ).map((pm) => (
                      <button
                        key={pm.id}
                        onClick={() => onChange(applyPlatformPreset(settings, pm.id))}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          settings.platformMode === pm.id
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <pm.Icon className="w-3.5 h-3.5" />
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Steering & Acceleration Accessibility Modes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2.5">
                  <div className="text-sm font-semibold text-white">Steering Input</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'keyboard', label: 'Keyboard' },
                        { id: 'mouse', label: 'Mouse Steer' },
                        { id: 'buttons', label: 'Touch Buttons' },
                        { id: 'joystick', label: 'Virtual Stick' },
                        { id: 'tilt', label: 'Tilt / Gyro' },
                      ] as Array<{ id: SteeringMode; label: string }>
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          onChange({
                            ...settings,
                            controls: { ...settings.controls, steeringMode: m.id },
                          })
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          settings.controls.steeringMode === m.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2.5">
                  <div className="text-sm font-semibold text-white">
                    Acceleration Mode
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(
                      [
                        {
                          id: 'manual',
                          label: 'Manual Gas & Brake Pedals',
                        },
                        {
                          id: 'auto',
                          label: 'Auto-Accelerate (Steer-Only Accessibility)',
                        },
                      ] as Array<{ id: AccelerationMode; label: string }>
                    ).map((a) => (
                      <button
                        key={a.id}
                        onClick={() =>
                          onChange({
                            ...settings,
                            controls: { ...settings.controls, accelerationMode: a.id },
                          })
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-semibold text-left transition-colors ${
                          settings.controls.accelerationMode === a.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sensitivity & Touch Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-200">Steering Sensitivity</span>
                    <span className="font-mono-tabular text-amber-400">
                      {settings.controls.steeringSensitivity.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={settings.controls.steeringSensitivity}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        controls: {
                          ...settings.controls,
                          steeringSensitivity: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-slate-200">Touch Button Size</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'standard', label: 'Standard' },
                        { id: 'large', label: 'Large' },
                        { id: 'xlarge', label: 'XL' },
                      ] as Array<{ id: TouchSize; label: string }>
                    ).map((sz) => (
                      <button
                        key={sz.id}
                        onClick={() =>
                          onChange({
                            ...settings,
                            controls: { ...settings.controls, touchSize: sz.id },
                          })
                        }
                        className={`py-1.5 rounded text-xs font-semibold transition-colors ${
                          settings.controls.touchSize === sz.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accessibility Toggles */}
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controls.swapSides}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        controls: { ...settings.controls, swapSides: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-amber-500"
                  />
                  Left-Handed Layout (Swap Steering & Pedals)
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controls.highContrastHud}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        controls: {
                          ...settings.controls,
                          highContrastHud: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-amber-500"
                  />
                  High-Contrast HUD
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controls.reducedShake}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        controls: { ...settings.controls, reducedShake: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-amber-500"
                  />
                  Reduced Camera Shake
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controls.gamepadEnabled}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        controls: { ...settings.controls, gamepadEnabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-amber-500"
                  />
                  USB / Bluetooth Gamepad Support
                </label>
              </div>

              {/* Custom Keybindings for P1 & P2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    { field: 'p1Keys', title: 'Player 1 Keybindings' },
                    { field: 'p2Keys', title: 'Player 2 Keybindings (Split-Screen)' },
                  ] as const
                ).map((group) => (
                  <div
                    key={group.field}
                    className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2.5"
                  >
                    <h4 className="font-display text-sm font-bold text-slate-200">
                      {group.title}
                    </h4>
                    <div className="space-y-1.5">
                      {keyLabels.map(({ key, label }) => {
                        const isListening =
                          rebinding?.player === group.field && rebinding?.action === key;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between text-xs py-1 border-b border-slate-800/70 last:border-0"
                          >
                            <span className="text-slate-300">{label}</span>
                            <button
                              onClick={() =>
                                setRebinding({ player: group.field, action: key })
                              }
                              className={`px-2.5 py-1 rounded font-mono-tabular font-semibold min-w-[76px] text-center transition-colors ${
                                isListening
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                              }`}
                            >
                              {isListening
                                ? 'Press Key...'
                                : formatKeyCode(settings.controls[group.field][key])}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
