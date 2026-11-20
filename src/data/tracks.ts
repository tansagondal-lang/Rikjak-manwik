import * as THREE from 'three';
import { TrackId, TrackSpec } from '../types/game';

export const TRACKS: TrackSpec[] = [
  {
    id: 'sunstone',
    name: 'Sunstone Grand Mesa',
    environment: 'Desert Mesa Speedway',
    laps: 3,
    width: 20,
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
      [0, 0, -180],
      [65, 2, -310],
      [210, 5, -340],
      [340, 4, -240],
      [310, 1, -100],
      [215, 0, -10],
      [320, 3, 125],
      [270, 6, 285],
      [105, 4, 325],
      [-40, 2, 235],
      [-20, 0, 115],
    ],
  },
  {
    id: 'alpine',
    name: 'Alpine Voxel Pass',
    environment: 'Pine Ridge Mountain Loop',
    laps: 3,
    width: 19,
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
      [0, 2, -190],
      [-105, 7, -330],
      [-285, 10, -305],
      [-365, 8, -145],
      [-225, 4, -40],
      [-310, 6, 120],
      [-195, 9, 290],
      [30, 5, 340],
      [195, 2, 240],
      [155, 0, 95],
      [45, 0, 85],
    ],
  },
  {
    id: 'harbor',
    name: 'Harbor Night Grid',
    environment: 'Floodlit Shipping Dockyard',
    laps: 3,
    width: 21,
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
      [0, 0, -210],
      [115, 0, -340],
      [295, 0, -320],
      [375, 0, -165],
      [260, 0, -35],
      [365, 0, 115],
      [310, 0, 295],
      [125, 0, 345],
      [-45, 0, 265],
      [-95, 0, 165],
      [-25, 0, 115],
    ],
  },
  {
    id: 'neon-metro',
    name: 'Neo Tokyo Expressway',
    environment: 'Cyberpunk Neon Metropolis',
    laps: 3,
    width: 22,
    skyColor: '#050816',
    fogColor: '#1e1b4b',
    groundColor: '#0f172a',
    roadColor: '#111827',
    curbColorA: '#ec4899',
    curbColorB: '#22d3ee',
    propType: 'cybercity',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -240],
      [0, 2, -410],
      [140, 4, -460],
      [320, 4, -400],
      [380, 2, -210],
      [270, 0, -95],
      [385, 0, 55],
      [345, 2, 240],
      [165, 0, 345],
      [-55, 0, 295],
      [-95, 0, 140],
    ],
  },
  {
    id: 'sakura-valley',
    name: 'Sakura Blossom Valley',
    environment: 'Cherry Blossom & Shrine Circuit',
    laps: 3,
    width: 19,
    skyColor: '#fda4af',
    fogColor: '#ffe4e6',
    groundColor: '#4d7c0f',
    roadColor: '#374151',
    curbColorA: '#f43f5e',
    curbColorB: '#fdf2f8',
    propType: 'sakura',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 1, -195],
      [-95, 5, -340],
      [-260, 7, -340],
      [-370, 4, -195],
      [-320, 2, -25],
      [-180, 0, 40],
      [-255, 4, 210],
      [-120, 6, 345],
      [95, 3, 330],
      [185, 1, 185],
      [85, 0, 95],
    ],
  },
  {
    id: 'arctic-glacier',
    name: 'Glacier Ice Circuit',
    environment: 'Frozen Arctic Icebergs & Tundra',
    laps: 3,
    width: 20,
    skyColor: '#7dd3fc',
    fogColor: '#e0f2fe',
    groundColor: '#cbd5e1',
    roadColor: '#334155',
    curbColorA: '#0284c7',
    curbColorB: '#f8fafc',
    propType: 'glacier',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 0, -215],
      [95, 3, -365],
      [265, 6, -385],
      [410, 4, -245],
      [380, 2, -55],
      [255, 0, 75],
      [325, 3, 240],
      [195, 5, 375],
      [-15, 2, 345],
      [-120, 0, 200],
      [-50, 0, 95],
    ],
  },
  {
    id: 'volcano-caldera',
    name: 'Obsidian Lava Caldera',
    environment: 'Volcanic Basalt & Magma Rift',
    laps: 3,
    width: 20,
    skyColor: '#450a0a',
    fogColor: '#7c2d12',
    groundColor: '#292524',
    roadColor: '#1c1917',
    curbColorA: '#f97316',
    curbColorB: '#facc15',
    propType: 'volcano',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 2, -205],
      [-120, 8, -345],
      [-305, 10, -325],
      [-395, 7, -145],
      [-285, 3, 15],
      [-355, 5, 185],
      [-210, 8, 340],
      [25, 6, 365],
      [215, 3, 255],
      [185, 1, 105],
      [55, 0, 85],
    ],
  },
  {
    id: 'tropical-atoll',
    name: 'Coral Coastline Bay',
    environment: 'Tropical Beach & Turquoise Lagoon',
    laps: 3,
    width: 21,
    skyColor: '#0ea5e9',
    fogColor: '#bae6fd',
    groundColor: '#fde68a',
    roadColor: '#475569',
    curbColorA: '#14b8a6',
    curbColorB: '#ffffff',
    propType: 'tropical',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 0, -210],
      [85, 1, -355],
      [255, 2, -375],
      [395, 2, -255],
      [390, 1, -75],
      [285, 0, 65],
      [325, 1, 235],
      [180, 2, 355],
      [-25, 1, 330],
      [-95, 0, 195],
      [-30, 0, 95],
    ],
  },
  {
    id: 'canyon-dam',
    name: 'Redrock Canyon Dam',
    environment: 'Grand Sandstone Gorge & Dam',
    laps: 3,
    width: 19,
    skyColor: '#fb923c',
    fogColor: '#fed7aa',
    groundColor: '#9a3412',
    roadColor: '#44403c',
    curbColorA: '#f59e0b',
    curbColorB: '#fef3c7',
    propType: 'canyon',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 2, -230],
      [-115, 6, -390],
      [-295, 9, -370],
      [-410, 6, -195],
      [-335, 3, -25],
      [-180, 1, 65],
      [-255, 4, 245],
      [-110, 6, 375],
      [115, 3, 355],
      [195, 1, 200],
      [75, 0, 95],
    ],
  },
  {
    id: 'autumn-ridge',
    name: 'Maple Autumn Ridge',
    environment: 'Crimson & Amber Forest Valley',
    laps: 3,
    width: 19,
    skyColor: '#93c5fd',
    fogColor: '#fef3c7',
    groundColor: '#a16207',
    roadColor: '#3f3f46',
    curbColorA: '#ea580c',
    curbColorB: '#fef08a',
    propType: 'autumn',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 1, -195],
      [110, 5, -340],
      [285, 8, -325],
      [375, 6, -165],
      [255, 2, -25],
      [345, 4, 155],
      [245, 7, 320],
      [55, 5, 350],
      [-95, 2, 255],
      [-110, 0, 115],
      [-25, 0, 75],
    ],
  },
  {
    id: 'cyber-grid',
    name: 'Synthwave Laser Grid',
    environment: 'Retro 80s Violet Neon Highway',
    laps: 3,
    width: 22,
    skyColor: '#1e0538',
    fogColor: '#4c1d95',
    groundColor: '#0f0720',
    roadColor: '#171726',
    curbColorA: '#d946ef',
    curbColorB: '#06b6d4',
    propType: 'synthwave',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -250],
      [0, 0, -440],
      [165, 2, -485],
      [355, 2, -415],
      [420, 0, -205],
      [310, 0, -35],
      [395, 0, 145],
      [295, 2, 335],
      [95, 0, 375],
      [-75, 0, 265],
      [-45, 0, 120],
    ],
  },
  {
    id: 'egypt-dunes',
    name: 'Pharaoh Sand Dunes',
    environment: 'Golden Pyramids & Obelisk Loop',
    laps: 3,
    width: 21,
    skyColor: '#38bdf8',
    fogColor: '#fef08a',
    groundColor: '#eab308',
    roadColor: '#57534e',
    curbColorA: '#d97706',
    curbColorB: '#fef9c3',
    propType: 'egypt',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 1, -225],
      [-95, 4, -385],
      [-285, 5, -405],
      [-425, 3, -255],
      [-375, 1, -60],
      [-235, 0, 75],
      [-295, 3, 255],
      [-140, 4, 385],
      [85, 2, 355],
      [165, 0, 195],
      [55, 0, 95],
    ],
  },
  {
    id: 'emerald-jungle',
    name: 'Maya Temple Jungle',
    environment: 'Rainforest Canopy & Stone Ruins',
    laps: 3,
    width: 19,
    skyColor: '#6ee7b7',
    fogColor: '#a7f3d0',
    groundColor: '#065f46',
    roadColor: '#475569',
    curbColorA: '#10b981',
    curbColorB: '#fde047',
    propType: 'jungle',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 1, -185],
      [95, 4, -335],
      [270, 6, -345],
      [385, 4, -185],
      [300, 1, -30],
      [375, 3, 145],
      [265, 5, 315],
      [75, 4, 345],
      [-85, 2, 245],
      [-115, 0, 155],
      [-30, 0, 105],
    ],
  },
  {
    id: 'orbital-station',
    name: 'Orbital Lunar Base',
    environment: 'Cratered Moon Track & Solar Arrays',
    laps: 3,
    width: 22,
    skyColor: '#020617',
    fogColor: '#0f172a',
    groundColor: '#475569',
    roadColor: '#1e293b',
    curbColorA: '#38bdf8',
    curbColorB: '#e2e8f0',
    propType: 'space',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -240],
      [-115, 2, -405],
      [-310, 4, -410],
      [-430, 3, -235],
      [-355, 1, -45],
      [-215, 0, 85],
      [-275, 2, 265],
      [-115, 3, 395],
      [105, 1, 365],
      [185, 0, 200],
      [60, 0, 100],
    ],
  },
  {
    id: 'snow-summit',
    name: 'Everest Snow Summit',
    environment: 'Blizzard Mountain Ridge & Chalets',
    laps: 3,
    width: 19,
    skyColor: '#cbd5e1',
    fogColor: '#f1f5f9',
    groundColor: '#e2e8f0',
    roadColor: '#334155',
    curbColorA: '#ef4444',
    curbColorB: '#ffffff',
    propType: 'snow',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 3, -205],
      [115, 8, -355],
      [295, 11, -345],
      [395, 8, -175],
      [275, 4, -35],
      [355, 6, 145],
      [255, 9, 315],
      [65, 6, 355],
      [-95, 3, 255],
      [-115, 1, 115],
      [-25, 0, 75],
    ],
  },
  {
    id: 'industrial-foundry',
    name: 'Steel Foundry Yard',
    environment: 'Heavy Smelters & Refinery Silos',
    laps: 3,
    width: 21,
    skyColor: '#451a03',
    fogColor: '#78350f',
    groundColor: '#27272a',
    roadColor: '#18181b',
    curbColorA: '#f59e0b',
    curbColorB: '#3f3f46',
    propType: 'industrial',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -225],
      [110, 0, -370],
      [305, 0, -365],
      [405, 0, -195],
      [285, 0, -45],
      [385, 0, 130],
      [310, 0, 315],
      [115, 0, 365],
      [-65, 0, 275],
      [-95, 0, 125],
      [-20, 0, 85],
    ],
  },
  {
    id: 'stadium-gp',
    name: 'Apex World Stadium',
    environment: 'Floodlit Super-GP Arena Complex',
    laps: 3,
    width: 23,
    skyColor: '#020617',
    fogColor: '#0f172a',
    groundColor: '#14532d',
    roadColor: '#1e293b',
    curbColorA: '#ef4444',
    curbColorB: '#f8fafc',
    propType: 'stadium',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 0, -245],
      [0, 0, -425],
      [155, 0, -485],
      [355, 0, -430],
      [430, 0, -245],
      [345, 0, -45],
      [410, 0, 155],
      [310, 0, 345],
      [115, 0, 385],
      [-65, 0, 295],
      [-40, 0, 135],
    ],
  },
  {
    id: 'crystal-cavern',
    name: 'Amethyst Crystal Rift',
    environment: 'Bioluminescent Geode Canyon',
    laps: 3,
    width: 20,
    skyColor: '#1e1b4b',
    fogColor: '#312e81',
    groundColor: '#1e1b4b',
    roadColor: '#27273a',
    curbColorA: '#a855f7',
    curbColorB: '#22d3ee',
    propType: 'crystal',
    isNight: true,
    waypoints: [
      [0, 0, 0],
      [0, 1, -210],
      [-110, 4, -360],
      [-295, 7, -355],
      [-405, 5, -185],
      [-295, 2, -25],
      [-365, 4, 155],
      [-245, 6, 325],
      [-35, 4, 360],
      [145, 2, 265],
      [135, 0, 115],
      [35, 0, 80],
    ],
  },
  {
    id: 'medieval-citadel',
    name: 'Crown Citadel Keep',
    environment: 'Castle Battlements & Royal Banners',
    laps: 3,
    width: 19,
    skyColor: '#7dd3fc',
    fogColor: '#bae6fd',
    groundColor: '#166534',
    roadColor: '#57534e',
    curbColorA: '#dc2626',
    curbColorB: '#facc15',
    propType: 'castle',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 1, -205],
      [105, 4, -350],
      [285, 6, -345],
      [390, 4, -180],
      [270, 2, -30],
      [355, 3, 145],
      [255, 5, 315],
      [65, 3, 350],
      [-85, 1, 250],
      [-105, 0, 115],
      [-20, 0, 75],
    ],
  },
  {
    id: 'sunset-boulevard',
    name: 'Pacific Sunset Highway',
    environment: 'Golden Coastline Palm Overpass',
    laps: 3,
    width: 22,
    skyColor: '#f97316',
    fogColor: '#fdba74',
    groundColor: '#d97706',
    roadColor: '#27272a',
    curbColorA: '#fb7185',
    curbColorB: '#fef08a',
    propType: 'sunset',
    isNight: false,
    waypoints: [
      [0, 0, 0],
      [0, 0, -255],
      [0, 2, -445],
      [165, 4, -490],
      [365, 4, -415],
      [430, 2, -205],
      [305, 0, -45],
      [395, 1, 145],
      [295, 3, 345],
      [95, 2, 385],
      [-75, 0, 275],
      [-40, 0, 125],
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

const TRACK_SAMPLES_COUNT = 480;
const compiledCache = new Map<TrackId, CompiledTrack>();

export function getCompiledTrack(trackId: TrackId): CompiledTrack {
  const cached = compiledCache.get(trackId);
  if (cached) return cached;

  const spec = TRACK_MAP[trackId] ?? TRACKS[0];
  const pts = spec.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();
  const up = new THREE.Vector3(0, 1, 0);

  const rawPoints: THREE.Vector3[] = [];
  for (let i = 0; i < TRACK_SAMPLES_COUNT; i++) {
    const t = i / TRACK_SAMPLES_COUNT;
    const p = curve.getPointAt(t);
    // Prevent Catmull-Rom undershoot from dipping below the ground plane (y = 0)
    if (p.y < 0) p.y = 0;
    rawPoints.push(p);
  }

  const samples: TrackSample[] = [];
  for (let i = 0; i < TRACK_SAMPLES_COUNT; i++) {
    const t = i / TRACK_SAMPLES_COUNT;
    const point = rawPoints[i];
    const prevPt = rawPoints[(i - 1 + TRACK_SAMPLES_COUNT) % TRACK_SAMPLES_COUNT];
    const nextPt = rawPoints[(i + 1) % TRACK_SAMPLES_COUNT];
    const tangent = new THREE.Vector3().subVectors(nextPt, prevPt).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({ point, tangent, right, t });
  }

  const compiled: CompiledTrack = { spec, curve, samples, totalLength };
  compiledCache.set(trackId, compiled);
  return compiled;
}

export function getTrackLengthKm(trackId: TrackId): string {
  const compiled = getCompiledTrack(trackId);
  return (compiled.totalLength / 650).toFixed(1);
}

function projectOntoSegment(
  x: number,
  z: number,
  a: TrackSample,
  b: TrackSample,
  n: number,
  idxA: number,
): { distSq: number; sample: TrackSample; lateralOffset: number } {
  const abx = b.point.x - a.point.x;
  const abz = b.point.z - a.point.z;
  const abLenSq = abx * abx + abz * abz;
  const u =
    abLenSq > 1e-6
      ? Math.max(0, Math.min(1, ((x - a.point.x) * abx + (z - a.point.z) * abz) / abLenSq))
      : 0;

  const cx = a.point.x + abx * u;
  const cy = a.point.y + (b.point.y - a.point.y) * u;
  const cz = a.point.z + abz * u;

  const tx = a.tangent.x + (b.tangent.x - a.tangent.x) * u;
  const ty = a.tangent.y + (b.tangent.y - a.tangent.y) * u;
  const tz = a.tangent.z + (b.tangent.z - a.tangent.z) * u;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  const ntx = tx / tLen;
  const nty = ty / tLen;
  const ntz = tz / tLen;

  // Right = tangent x (0,1,0) = (-tz, 0, tx) normalized in XZ
  const rxRaw = -ntz;
  const rzRaw = ntx;
  const rLen = Math.hypot(rxRaw, rzRaw) || 1;
  const rx = rxRaw / rLen;
  const rz = rzRaw / rLen;

  const dx = x - cx;
  const dz = z - cz;
  const distSq = dx * dx + dz * dz;
  const lateralOffset = dx * rx + dz * rz;
  const t = ((idxA + u) % n) / n;

  return {
    distSq,
    lateralOffset,
    sample: {
      point: new THREE.Vector3(cx, cy, cz),
      tangent: new THREE.Vector3(ntx, nty, ntz),
      right: new THREE.Vector3(rx, 0, rz),
      t,
    },
  };
}

export function findClosestTrackSample(
  compiled: CompiledTrack,
  x: number,
  z: number,
): { index: number; sample: TrackSample; distSq: number; lateralOffset: number } {
  let bestIdx = 0;
  let bestDistSq = Infinity;

  const samples = compiled.samples;
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const p = samples[i].point;
    const dx = x - p.x;
    const dz = z - p.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }

  // Project onto the two continuous polyline segments adjacent to bestIdx
  // so cars slide smoothly along guardrails without snapping back to discrete samples
  const prevIdx = (bestIdx - 1 + n) % n;
  const nextIdx = (bestIdx + 1) % n;
  const segA = projectOntoSegment(x, z, samples[prevIdx], samples[bestIdx], n, prevIdx);
  const segB = projectOntoSegment(x, z, samples[bestIdx], samples[nextIdx], n, bestIdx);
  const chosen = segA.distSq <= segB.distSq ? segA : segB;

  return {
    index: bestIdx,
    sample: chosen.sample,
    distSq: chosen.distSq,
    lateralOffset: chosen.lateralOffset,
  };
}
