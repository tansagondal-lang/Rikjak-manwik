import { AllSettings, GraphicsPreset, GraphicsSettings, PlatformMode } from '../types/game';

export const GRAPHICS_PRESETS: Record<GraphicsPreset, Omit<GraphicsSettings, 'preset' | 'cameraMode' | 'showFps'>> = {
  eco512: {
    pixelRatio: 0.7,
    shadows: 'off',
    viewDistance: 'short',
    particles: false,
    raceAnimation: true,
    brakingAnimation: true,
    targetFps: 60,
  },
  balanced: {
    pixelRatio: 1.0,
    shadows: 'medium',
    viewDistance: 'medium',
    particles: true,
    raceAnimation: true,
    brakingAnimation: true,
    targetFps: 60,
  },
  high: {
    pixelRatio: 1.5,
    shadows: 'soft',
    viewDistance: 'far',
    particles: true,
    raceAnimation: true,
    brakingAnimation: true,
    targetFps: 0,
  },
  ultra: {
    pixelRatio: 1.75,
    shadows: 'high',
    viewDistance: 'far',
    particles: true,
    raceAnimation: true,
    brakingAnimation: true,
    targetFps: 0,
  },
};

function detectInitialPreset(): GraphicsPreset {
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 1) {
      return 'eco512';
    }
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      return 'balanced';
    }
  }
  return 'balanced';
}

export function detectInitialPlatform(): PlatformMode {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const isMobileUa = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobileUa && hasTouch) return 'mobile';
  }
  return 'pc';
}

export function createDefaultSettings(): AllSettings {
  const platformMode = detectInitialPlatform();
  const preset = platformMode === 'pc' ? 'balanced' : detectInitialPreset();
  const presetVals = GRAPHICS_PRESETS[preset];

  return {
    playerName: `Racer-${Math.floor(100 + Math.random() * 899)}`,
    platformMode,
    graphics: {
      preset,
      pixelRatio: presetVals.pixelRatio,
      shadows: presetVals.shadows,
      viewDistance: presetVals.viewDistance,
      particles: presetVals.particles,
      raceAnimation: presetVals.raceAnimation,
      brakingAnimation: presetVals.brakingAnimation,
      cameraMode: 'chase',
      showFps: true,
      targetFps: presetVals.targetFps,
    },
    audio: {
      muted: false,
      masterVolume: 0.75,
      engineVolume: 0.55,
      sfxVolume: 0.8,
    },
    controls: {
      steeringMode: platformMode === 'mobile' ? 'buttons' : 'keyboard',
      accelerationMode: platformMode === 'mobile' ? 'auto' : 'manual',
      steeringSensitivity: 1.0,
      tiltDeadzone: 0.06,
      touchSize: 'large',
      swapSides: false,
      reducedShake: false,
      highContrastHud: false,
      gamepadEnabled: true,
      p1Keys: {
        accelerate: 'KeyW',
        brake: 'KeyS',
        steerLeft: 'KeyA',
        steerRight: 'KeyD',
        drift: 'Space',
        respawn: 'KeyR',
      },
      p2Keys: {
        accelerate: 'ArrowUp',
        brake: 'ArrowDown',
        steerLeft: 'ArrowLeft',
        steerRight: 'ArrowRight',
        drift: 'ShiftRight',
        respawn: 'Backspace',
      },
    },
  };
}

export function applyPlatformPreset(settings: AllSettings, mode: PlatformMode): AllSettings {
  if (mode === 'pc') {
    const gfx = settings.graphics.preset === 'eco512' ? GRAPHICS_PRESETS.balanced : null;
    return {
      ...settings,
      platformMode: 'pc',
      graphics: gfx
        ? {
            ...settings.graphics,
            preset: 'balanced',
            pixelRatio: gfx.pixelRatio,
            shadows: gfx.shadows,
            viewDistance: gfx.viewDistance,
            particles: gfx.particles,
            raceAnimation: gfx.raceAnimation,
            brakingAnimation: gfx.brakingAnimation,
            targetFps: gfx.targetFps,
          }
        : settings.graphics,
      controls: {
        ...settings.controls,
        steeringMode:
          settings.controls.steeringMode === 'buttons' ||
          settings.controls.steeringMode === 'joystick' ||
          settings.controls.steeringMode === 'tilt'
            ? 'keyboard'
            : settings.controls.steeringMode,
        accelerationMode: 'manual',
        gamepadEnabled: true,
      },
    };
  }
  return {
    ...settings,
    platformMode: 'mobile',
    controls: {
      ...settings.controls,
      steeringMode:
        settings.controls.steeringMode === 'keyboard' || settings.controls.steeringMode === 'mouse'
          ? 'buttons'
          : settings.controls.steeringMode,
      accelerationMode: 'auto',
    },
  };
}

const STORAGE_KEY = 'racing_car_1_settings_v1';

export function loadSettings(): AllSettings {
  const defaults = createDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AllSettings>;
    return {
      playerName: parsed.playerName || defaults.playerName,
      platformMode: parsed.platformMode === 'pc' || parsed.platformMode === 'mobile'
        ? parsed.platformMode
        : defaults.platformMode,
      graphics: {
        ...defaults.graphics,
        ...(parsed.graphics || {}),
        targetFps:
          typeof parsed.graphics?.targetFps === 'number' &&
          Number.isFinite(parsed.graphics.targetFps)
            ? parsed.graphics.targetFps <= 0
              ? 0
              : Math.max(1, Math.min(240, Math.round(parsed.graphics.targetFps)))
            : defaults.graphics.targetFps,
      },
      audio: { ...defaults.audio, ...(parsed.audio || {}) },
      controls: {
        ...defaults.controls,
        ...(parsed.controls || {}),
        p1Keys: { ...defaults.controls.p1Keys, ...(parsed.controls?.p1Keys || {}) },
        p2Keys: { ...defaults.controls.p2Keys, ...(parsed.controls?.p2Keys || {}) },
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AllSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors on constrained devices
  }
}

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft') return 'L-Shift';
  if (code === 'ShiftRight') return 'R-Shift';
  return code;
}
