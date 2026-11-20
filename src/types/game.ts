export type CarId =
  | 'apex-gt1'
  | 'volt-x'
  | 'trailblazer'
  | 'drift-86'
  | 'titan'
  | 'pixel-kart'
  | 'rally-evo'
  | 'neon-blade'
  | 'sand-dune'
  | 'brick-van'
  | 'cobalt-rs'
  | 'crimson-v8'
  | 'jade-spider'
  | 'arctic-4x4'
  | 'solar-proto'
  | 'shadow-gt'
  | 'turbo-taxi'
  | 'copper-rod'
  | 'mint-coupe'
  | 'cobalt-buggy'
  | 'obsidian-f1'
  | 'aurora-hyper';

export type TrackId = 'sunstone' | 'alpine' | 'harbor';

export type RaceMode = 'solo' | 'split-screen' | 'multiplayer';

export type GraphicsPreset = 'eco512' | 'balanced' | 'high' | 'ultra';

export type CameraMode = 'chase' | 'far' | 'hood';

export type PlatformMode = 'pc' | 'mobile';

export type SteeringMode = 'buttons' | 'joystick' | 'tilt' | 'keyboard' | 'mouse';

export type AccelerationMode = 'manual' | 'auto';

export type TouchSize = 'standard' | 'large' | 'xlarge';

export type CarBodyStyle =
  | 'formula'
  | 'wedge'
  | 'truck'
  | 'coupe'
  | 'muscle'
  | 'buggy'
  | 'van'
  | 'hyper';

export interface CarSpec {
  id: CarId;
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  wheelColor: string;
  bodyStyle: CarBodyStyle;
  price: number; // 0 = starter unlocked
  repairCost: number; // full repair cost in coins
  topSpeed: number; // physics units/s
  acceleration: number;
  handling: number;
  brakingPower: number;
  driftGrip: number;
  durabilityFactor: number; // 0.5..1.5 damage resistance multiplier
  stats: {
    speed: number; // 1-100
    accel: number; // 1-100
    handling: number; // 1-100
    braking: number; // 1-100
    drifting: number; // 1-100
    durability: number; // 1-100
  };
}

export interface GarageProgress {
  coins: number;
  ownedCars: CarId[];
  carHealth: Record<string, number>; // 0..100 per carId
  wins: number;
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  environment: string;
  laps: number;
  width: number;
  skyColor: string;
  fogColor: string;
  groundColor: string;
  roadColor: string;
  curbColorA: string;
  curbColorB: string;
  propType: 'desert' | 'pine' | 'harbor';
  isNight: boolean;
  waypoints: [number, number, number][];
}

export type ShadowQuality = 'off' | 'simple' | 'medium' | 'soft' | 'high';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  pixelRatio: number; // 0.6, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0
  shadows: ShadowQuality;
  viewDistance: 'short' | 'medium' | 'far';
  particles: boolean;
  raceAnimation: boolean;
  brakingAnimation: boolean;
  cameraMode: CameraMode;
  showFps: boolean;
  targetFps: number; // 0 = Max/Native, or custom FPS cap (1..240)
}

export interface AudioSettings {
  muted: boolean;
  masterVolume: number; // 0..1
  engineVolume: number; // 0..1
  sfxVolume: number; // 0..1
}

export interface KeyBindings {
  accelerate: string;
  brake: string;
  steerLeft: string;
  steerRight: string;
  drift: string;
  respawn: string;
}

export interface ControlSettings {
  steeringMode: SteeringMode;
  accelerationMode: AccelerationMode;
  steeringSensitivity: number; // 0.5..2.0
  tiltDeadzone: number; // 0.02..0.2
  touchSize: TouchSize;
  swapSides: boolean;
  reducedShake: boolean;
  highContrastHud: boolean;
  gamepadEnabled: boolean;
  p1Keys: KeyBindings;
  p2Keys: KeyBindings;
}

export interface AllSettings {
  playerName: string;
  platformMode: PlatformMode;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  controls: ControlSettings;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  carId: CarId;
  trackId: TrackId;
  timeMs: number;
  bestLapMs: number;
  mode: string;
  createdAt: number;
}

export interface NetworkPlayerState {
  id: string;
  name: string;
  carId: CarId;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  lap: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
  finishTimeMs: number | null;
}

export interface RoomInfo {
  code: string;
  name: string;
  trackId: TrackId;
  hostId: string;
  isLocalHost: boolean;
  fillWithAi: boolean;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  countdownStartAt: number | null;
  raceStartAt: number | null;
  players: NetworkPlayerState[];
}

export interface MinimapDot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  isP1?: boolean;
  isP2?: boolean;
}

export interface RaceTelemetry {
  speedKmh: number;
  gear: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  elapsedMs: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  wrongWay: boolean;
  drifting: boolean;
  boostCharge: number; // 0..1
  hullHealth: number; // 0..100
  fps: number;
  estimatedRamMb: number;
  gamepadConnected?: boolean;
  minimapDots?: MinimapDot[];
}

export interface RaceResultItem {
  id: string;
  name: string;
  carId: CarId;
  isHuman: boolean;
  isLocalP1?: boolean;
  isLocalP2?: boolean;
  position: number;
  finishTimeMs: number;
  bestLapMs: number;
  hullHealthRemaining: number;
}
