import * as THREE from 'three';
import { TrackId, TrackSpec } from '../types/game';

export const TRACKS: TrackSpec[] = [
  {
    id: 'sunstone',
    name: 'Sunstone Circuit',
    environment: 'Desert Mesa Speedway',
    laps: 3,
    width: 17,
    skyColor: '#38bdf8',
    fogColor: '#bae6fd',
    groundColor: '#d97706',
    roadColor: '#334155',
    curbColorA: '#ef4444',
    curbColorB: '#f8fafc',
    propType: 'desert',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 0, -90],
      [35, 0, -155],
      [115, 0, -165],
      [175, 0, -110],
      [165, 0, -35],
      [110, 0, 5],
      [145, 0, 75],
      [125, 0, 145],
      [45, 0, 155],
      [-15, 0, 105],
      [-5, 0, 55],
    ],
  },
  {
    id: 'alpine',
    name: 'Alpine Voxel Pass',
    environment: 'Pine Ridge Hairpins',
    laps: 3,
    width: 16,
    skyColor: '#60a5fa',
    fogColor: '#dbeafe',
    groundColor: '#15803d',
    roadColor: '#3f3f46',
    curbColorA: '#f59e0b',
    curbColorB: '#f8fafc',
    propType: 'pine',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 0, -100],
      [-55, 0, -160],
      [-145, 0, -145],
      [-175, 0, -65],
      [-105, 0, -15],
      [-145, 0, 65],
      [-90, 0, 145],
      [15, 0, 165],
      [95, 0, 115],
      [75, 0, 45],
      [25, 0, 40],
    ],
  },
  {
    id: 'harbor',
    name: 'Harbor Night Grid',
    environment: 'Floodlit Dockyard Loop',
    laps: 3,
    width: 18,
    skyColor: '#090d1a',
    fogColor: '#0f172a',
    groundColor: '#1e293b',
    roadColor: '#18181b',
    curbColorA: '#06b6d4',
    curbColorB: '#f59e0b',
    propType: 'harbor',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -115],
      [60, 0, -170],
      [150, 0, -160],
      [185, 0, -80],
      [130, 0, -15],
      [180, 0, 60],
      [155, 0, 145],
      [65, 0, 165],
      [-20, 0, 130],
      [-40, 0, 55],
      [-10, 0, 40],
    ],
  },
];

export const TRACK_MAP: Record<TrackId, TrackSpec> = TRACKS.reduce(
  (acc, track) => {
    acc[track.id] = track;
    return acc;
  },
  {} as Record<TrackId, TrackSpec>,
);

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  t: number; // 0..1 around loop
}

export interface CompiledTrack {
  spec: TrackSpec;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
}

const TRACK_SAMPLES_COUNT = 320;
const compiledCache = new Map<TrackId, CompiledTrack>();

export function getCompiledTrack(trackId: TrackId): CompiledTrack {
  const cached = compiledCache.get(trackId);
  if (cached) return cached;

  const spec = TRACK_MAP[trackId] ?? TRACKS[0];
  const pts = spec.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();
  const up = new THREE.Vector3(0, 1, 0);

  const samples: TrackSample[] = [];
  for (let i = 0; i < TRACK_SAMPLES_COUNT; i++) {
    const t = i / TRACK_SAMPLES_COUNT;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({ point, tangent, right, t });
  }

  const compiled: CompiledTrack = { spec, curve, samples, totalLength };
  compiledCache.set(trackId, compiled);
  return compiled;
}

export function findClosestTrackSample(
  compiled: CompiledTrack,
  x: number,
  z: number,
): { index: number; sample: TrackSample; distSq: number; lateralOffset: number } {
  let bestIdx = 0;
  let bestDistSq = Infinity;

  const samples = compiled.samples;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i].point;
    const dx = x - p.x;
    const dz = z - p.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }

  const sample = samples[bestIdx];
  const dx = x - sample.point.x;
  const dz = z - sample.point.z;
  const lateralOffset = dx * sample.right.x + dz * sample.right.z;

  return { index: bestIdx, sample, distSq: bestDistSq, lateralOffset };
}
