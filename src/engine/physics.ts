import { CAR_MAP } from '../data/cars';
import { CompiledTrack, findClosestTrackSample } from '../data/tracks';
import { CarId } from '../types/game';

export interface RacerInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (right) to +1 (left)
  drift: boolean;
}

export interface RacerBody {
  id: string;
  name: string;
  carId: CarId;
  isHuman: boolean;
  isLocalP1?: boolean;
  isLocalP2?: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  speed: number;
  steerVisual: number;
  wheelSpin: number;
  lap: number; // 1-based current lap
  lastSampleIdx: number;
  furthestCheckpoint: number; // 0..3 within current lap
  progress: number; // total continuous progress (lap + t)
  wrongWay: boolean;
  drifting: boolean;
  braking: number; // 0..1 active braking intensity
  throttleApplied: number; // 0..1 active throttle intensity
  boostCharge: number;
  boostTimer: number;
  hullHealth: number; // 0..100
  lapStartTimeMs: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  finished: boolean;
  finishTimeMs: number | null;
  // Remote interpolation targets
  targetX?: number;
  targetZ?: number;
  targetYaw?: number;
  targetSpeed?: number;
  // AI properties
  aiLaneOffset: number;
  aiPaceFactor: number;
}

export function createGridRacers(
  compiled: CompiledTrack,
  entries: Array<{
    id: string;
    name: string;
    carId: CarId;
    isHuman: boolean;
    isLocalP1?: boolean;
    isLocalP2?: boolean;
    initialHealth?: number;
    aiPaceFactor?: number;
  }>,
): RacerBody[] {
  const startSample = compiled.samples[0];
  const baseYaw = Math.atan2(-startSample.tangent.x, -startSample.tangent.z);

  return entries.map((entry, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2 === 0 ? -1 : 1;
    const lateral = col * 3.2;
    const backOffset = 6 + row * 7.2;

    const x =
      startSample.point.x +
      startSample.right.x * lateral -
      startSample.tangent.x * backOffset;
    const z =
      startSample.point.z +
      startSample.right.z * lateral -
      startSample.tangent.z * backOffset;

    return {
      id: entry.id,
      name: entry.name,
      carId: entry.carId,
      isHuman: entry.isHuman,
      isLocalP1: entry.isLocalP1,
      isLocalP2: entry.isLocalP2,
      x,
      y: 0,
      z,
      vx: 0,
      vz: 0,
      yaw: baseYaw,
      speed: 0,
      steerVisual: 0,
      wheelSpin: 0,
      lap: 1,
      lastSampleIdx: compiled.samples.length - 2,
      furthestCheckpoint: 0,
      progress: -(row * 0.015 + (idx % 2) * 0.005),
      wrongWay: false,
      drifting: false,
      braking: 0,
      throttleApplied: 0,
      boostCharge: 0,
      boostTimer: 0,
      hullHealth: Math.max(15, Math.min(100, entry.initialHealth ?? 100)),
      lapStartTimeMs: 0,
      bestLapMs: null,
      lastLapMs: null,
      finished: false,
      finishTimeMs: null,
      aiLaneOffset: ((idx % 3) - 1) * 3.1,
      aiPaceFactor: entry.aiPaceFactor ?? 0.82 + (idx % 4) * 0.04,
    };
  });
}

export function computeAiInput(
  racer: RacerBody,
  compiled: CompiledTrack,
): RacerInput {
  const { index } = findClosestTrackSample(compiled, racer.x, racer.z);
  const lookAhead = 12;
  const targetSample = compiled.samples[(index + lookAhead) % compiled.samples.length];

  const tx = targetSample.point.x + targetSample.right.x * racer.aiLaneOffset;
  const tz = targetSample.point.z + targetSample.right.z * racer.aiLaneOffset;

  const dx = tx - racer.x;
  const dz = tz - racer.z;
  const desiredYaw = Math.atan2(-dx, -dz);

  let diff = desiredYaw - racer.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const steer = Math.max(-1, Math.min(1, diff * 1.9));
  const sharpTurn = Math.abs(diff) > 0.45;
  const throttle = sharpTurn ? 0.65 * racer.aiPaceFactor : racer.aiPaceFactor;

  return {
    throttle,
    brake: Math.abs(diff) > 0.95 ? 0.4 : 0,
    steer,
    drift: Math.abs(diff) > 0.52 && racer.speed > 38,
  };
}

function applyHullDamage(racer: RacerBody, impactStrength: number): void {
  const spec = CAR_MAP[racer.carId] ?? CAR_MAP['apex-gt1'];
  const resist = Math.max(0.5, spec.durabilityFactor || 1);
  const dmg = (impactStrength * 9.5) / resist;
  racer.hullHealth = Math.max(15, racer.hullHealth - dmg);
}

export function getHealthAbilityFactor(hullHealth: number): number {
  const clamped = Math.max(15, Math.min(100, hullHealth));
  return 0.45 + 0.55 * (clamped / 100);
}

export function stepRacerPhysics(
  racer: RacerBody,
  input: RacerInput,
  compiled: CompiledTrack,
  dt: number,
  raceElapsedMs: number,
  sensitivity: number,
  onWallBump?: (strength: number) => void,
  onLapComplete?: (racer: RacerBody, finished: boolean) => void,
): void {
  const spec = CAR_MAP[racer.carId] ?? CAR_MAP['apex-gt1'];
  const clampedDt = Math.min(dt, 0.05);

  // Crash damage degrades EVERY car ability (speed, acceleration, handling, braking, drifting & grip)
  const conditionFactor = getHealthAbilityFactor(racer.hullHealth);
  const handlingFactor = 0.5 + 0.5 * (Math.max(15, Math.min(100, racer.hullHealth)) / 100);
  const gripFactor = 0.6 + 0.4 * (Math.max(15, Math.min(100, racer.hullHealth)) / 100);

  // Boost logic from drifting (damaged cars charge slower and gain weaker boost)
  if (racer.boostTimer > 0) {
    racer.boostTimer = Math.max(0, racer.boostTimer - clampedDt);
  }
  const boostMult = racer.boostTimer > 0 ? 1 + 0.18 * conditionFactor : 1.0;

  // Forward unit vector (model faces -Z at yaw=0)
  const fx = -Math.sin(racer.yaw);
  const fz = -Math.cos(racer.yaw);

  // Current signed forward speed
  const forwardSpeed = racer.vx * fx + racer.vz * fz;

  // Acceleration & Braking (both degrade as hull condition drops)
  const effectiveAccel = spec.acceleration * conditionFactor;
  const effectiveBraking = (spec.brakingPower || 1.65) * conditionFactor;
  racer.throttleApplied = input.throttle;
  racer.braking = input.brake > 0 && forwardSpeed > -0.5 ? input.brake : 0;

  let accel = 0;
  if (input.throttle > 0) {
    accel += input.throttle * effectiveAccel * boostMult;
  }
  if (input.brake > 0) {
    if (forwardSpeed > 2) {
      accel -= input.brake * effectiveAccel * effectiveBraking;
    } else {
      accel -= input.brake * effectiveAccel * 0.65; // reverse
    }
  }

  // Rolling drag + aero drag
  const effectiveTopSpeed = spec.topSpeed * conditionFactor;
  const drag = 0.42 + (Math.abs(forwardSpeed) / Math.max(1, effectiveTopSpeed)) * 0.55;
  const nextForward =
    forwardSpeed + accel * clampedDt - forwardSpeed * drag * clampedDt;

  const maxSpeed = effectiveTopSpeed * boostMult;
  const clampedForward = Math.max(-22, Math.min(maxSpeed, nextForward));

  // Steering & Drift Charge (degrades with crash condition)
  const isDrifting = input.drift && Math.abs(clampedForward) > 22 && Math.abs(input.steer) > 0.12;
  racer.drifting = isDrifting;

  const driftChargeSpeed = (0.42 + (spec.stats.drifting / 100) * 0.35) * conditionFactor;
  if (isDrifting) {
    racer.boostCharge = Math.min(1, racer.boostCharge + clampedDt * driftChargeSpeed);
  } else if (racer.boostCharge >= 0.7) {
    racer.boostTimer = 1.25 * conditionFactor;
    racer.boostCharge = 0;
  } else {
    racer.boostCharge = Math.max(0, racer.boostCharge - clampedDt * 0.8);
  }

  const speedFactor = Math.min(1, Math.abs(clampedForward) / 14);
  const reverseSign = clampedForward >= -0.5 ? 1 : -1;
  const driftSteerBonus = isDrifting ? 1.1 + 0.18 * conditionFactor : 1.0;
  const turnRate =
    input.steer *
    spec.handling *
    handlingFactor *
    sensitivity *
    driftSteerBonus *
    speedFactor *
    reverseSign;

  racer.yaw += turnRate * clampedDt;
  racer.steerVisual += (input.steer * 0.42 - racer.steerVisual) * Math.min(1, clampedDt * 12);

  // Reconstruct velocity with lateral grip (degraded cars lose grip faster)
  const nfx = -Math.sin(racer.yaw);
  const nfz = -Math.cos(racer.yaw);
  const nrx = Math.cos(racer.yaw);
  const nrz = -Math.sin(racer.yaw);

  const currentLateral = racer.vx * nrx + racer.vz * nrz;
  const lateralGrip = isDrifting
    ? 2.4 * gripFactor
    : 7.5 * spec.driftGrip * gripFactor;
  const nextLateral = currentLateral * Math.max(0, 1 - lateralGrip * clampedDt);

  racer.vx = nfx * clampedForward + nrx * nextLateral;
  racer.vz = nfz * clampedForward + nrz * nextLateral;
  racer.speed = Math.hypot(racer.vx, racer.vz);

  racer.x += racer.vx * clampedDt;
  racer.z += racer.vz * clampedDt;
  racer.wheelSpin += clampedForward * clampedDt * 1.4;

  // Track bounds & soft wall collision
  const closest = findClosestTrackSample(compiled, racer.x, racer.z);
  const maxLateral = compiled.spec.width * 0.5 + 0.65;

  if (Math.abs(closest.lateralOffset) > maxLateral) {
    const sign = Math.sign(closest.lateralOffset);
    racer.x = closest.sample.point.x + closest.sample.right.x * sign * maxLateral;
    racer.z = closest.sample.point.z + closest.sample.right.z * sign * maxLateral;

    // Damp outward velocity component
    const outVel = racer.vx * closest.sample.right.x + racer.vz * closest.sample.right.z;
    if (outVel * sign > 0) {
      racer.vx -= closest.sample.right.x * outVel * 1.25;
      racer.vz -= closest.sample.right.z * outVel * 1.25;
      racer.vx *= 0.85;
      racer.vz *= 0.85;
      if (Math.abs(outVel) > 10) {
        const strength = Math.min(1, Math.abs(outVel) / 40);
        if (racer.isHuman) {
          applyHullDamage(racer, strength * 0.7);
        }
        if (onWallBump) {
          onWallBump(strength);
        }
      }
    }
  }

  // Wrong-way detection
  const headingDot = nfx * closest.sample.tangent.x + nfz * closest.sample.tangent.z;
  racer.wrongWay = headingDot < -0.35 && racer.speed > 8;

  // Checkpoint & lap progression (4 sectors across sample array)
  const totalSamples = compiled.samples.length;
  const sector = Math.floor((closest.index / totalSamples) * 4); // 0, 1, 2, 3

  if (sector === racer.furthestCheckpoint + 1) {
    racer.furthestCheckpoint = sector;
  }

  // Detect crossing start/finish line forward (from high sector 3 -> sector 0)
  if (
    racer.lastSampleIdx > totalSamples * 0.85 &&
    closest.index < totalSamples * 0.15 &&
    racer.furthestCheckpoint >= 2
  ) {
    const lapTime = raceElapsedMs - racer.lapStartTimeMs;
    if (lapTime > 4000) {
      racer.lastLapMs = lapTime;
      if (racer.bestLapMs === null || lapTime < racer.bestLapMs) {
        racer.bestLapMs = lapTime;
      }
      racer.lapStartTimeMs = raceElapsedMs;
    }

    if (racer.lap >= compiled.spec.laps) {
      if (!racer.finished) {
        racer.finished = true;
        racer.finishTimeMs = raceElapsedMs;
        if (onLapComplete) onLapComplete(racer, true);
      }
    } else {
      racer.lap += 1;
      racer.furthestCheckpoint = 0;
      if (onLapComplete) onLapComplete(racer, false);
    }
  }

  racer.lastSampleIdx = closest.index;
  racer.progress = (racer.lap - 1) + closest.sample.t;
}

export function resolveCarCollisions(
  racers: RacerBody[],
  onBump?: (racer: RacerBody, strength: number) => void,
): void {
  const minDist = 2.4;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < minDistSq) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        const overlap = (minDist - d) * 0.5;

        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;
        if (velAlongNormal < 0) {
          const impulse = -velAlongNormal * 0.65;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;

          const strength = Math.min(1, Math.abs(velAlongNormal) / 30);
          if (strength > 0.25) {
            if (a.isHuman) applyHullDamage(a, strength);
            if (b.isHuman) applyHullDamage(b, strength);
          }
          if (onBump && strength > 0.2) {
            onBump(a, strength);
            onBump(b, strength);
          }
        }
      }
    }
  }
}

export function respawnRacerOnTrack(racer: RacerBody, compiled: CompiledTrack): void {
  const { sample } = findClosestTrackSample(compiled, racer.x, racer.z);
  racer.x = sample.point.x;
  racer.z = sample.point.z;
  racer.vx = 0;
  racer.vz = 0;
  racer.speed = 0;
  racer.yaw = Math.atan2(-sample.tangent.x, -sample.tangent.z);
}
