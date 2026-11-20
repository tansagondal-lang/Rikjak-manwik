import * as THREE from 'three';
import { CAR_MAP } from '../data/cars';
import { CarId } from '../types/game';
import { getBrakeGlowTexture } from './textures';

export interface CarModelRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Group[];
  brakeLights: THREE.Mesh[];
  setCondition: (health: number, showDirt?: boolean) => void;
  setBrakingGlow: (braking: number, enabled: boolean, brakeHeat?: number) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

// Shared unit box geometry for low-RAM efficiency across all blocky cars
let sharedBoxGeo: THREE.BoxGeometry | null = null;
function getBoxGeo(): THREE.BoxGeometry {
  if (!sharedBoxGeo) {
    sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  }
  return sharedBoxGeo;
}

let sharedGlowPlaneGeo: THREE.PlaneGeometry | null = null;
function getGlowPlaneGeo(): THREE.PlaneGeometry {
  if (!sharedGlowPlaneGeo) {
    sharedGlowPlaneGeo = new THREE.PlaneGeometry(3.2, 2.2);
    sharedGlowPlaneGeo.rotateX(-Math.PI / 2);
  }
  return sharedGlowPlaneGeo;
}

export function buildBlockyCar(carId: CarId, ecoMode: boolean, castShadow: boolean): CarModelRig {
  const spec = CAR_MAP[carId] ?? CAR_MAP['apex-gt1'];
  const box = getBoxGeo();

  const makeMat = (
    color: string | number,
    opts: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number } = {},
  ) => {
    if (ecoMode) {
      return new THREE.MeshLambertMaterial({
        color,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0,
      });
    }
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.4,
      metalness: opts.metalness ?? 0.2,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
  };

  const materialsToDispose: THREE.Material[] = [];
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };

  const primaryMat = trackMat(makeMat(spec.primaryColor, { roughness: 0.35, metalness: 0.25 }));
  const secondaryMat = trackMat(makeMat(spec.secondaryColor, { roughness: 0.55, metalness: 0.1 }));
  const accentMat = trackMat(makeMat(spec.accentColor, { roughness: 0.3, metalness: 0.5 }));
  const glassMat = trackMat(makeMat('#0f172a', { roughness: 0.1, metalness: 0.85 }));
  const tireMat = trackMat(makeMat(spec.wheelColor, { roughness: 0.85, metalness: 0.05 }));
  const rimMat = trackMat(makeMat('#cbd5e1', { roughness: 0.25, metalness: 0.8 }));
  const rotorMat = trackMat(
    makeMat('#64748b', {
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0xff4500,
      emissiveIntensity: 0,
    }),
  );
  const caliperMat = trackMat(makeMat('#ef4444', { roughness: 0.35, metalness: 0.4 }));
  const headlightMat = trackMat(
    makeMat('#fef9c3', { emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.2 }),
  );
  const taillightMat = trackMat(
    makeMat('#dc2626', { emissive: 0xef4444, emissiveIntensity: 0.65, roughness: 0.25 }),
  );
  const brakeGlowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: getBrakeGlowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const exhaustMat = trackMat(makeMat('#64748b', { roughness: 0.35, metalness: 0.75 }));
  const dirtMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x453221,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );

  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const shadowCasters: THREE.Mesh[] = [];
  const shadowReceivers: THREE.Mesh[] = [];

  const addPart = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    px: number,
    py: number,
    pz: number,
    rx = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    if (rx !== 0) m.rotation.x = rx;
    m.castShadow = castShadow;
    m.receiveShadow = castShadow && !ecoMode;
    shadowCasters.push(m);
    if (!ecoMode) shadowReceivers.push(m);
    parent.add(m);
    return m;
  };

  // Forward direction is -Z
  if (spec.bodyStyle === 'formula') {
    addPart(bodyGroup, secondaryMat, 1.95, 0.26, 4.15, 0, 0.42, 0.02);
    addPart(bodyGroup, primaryMat, 1.5, 0.34, 3.85, 0, 0.64, 0.05);
    addPart(bodyGroup, primaryMat, 0.75, 0.26, 1.15, 0, 0.56, -2.05, 0.12);
    addPart(bodyGroup, accentMat, 2.15, 0.12, 0.55, 0, 0.28, -2.35);
    addPart(bodyGroup, glassMat, 0.88, 0.36, 1.25, 0, 0.96, 0.15);
    addPart(bodyGroup, primaryMat, 0.72, 0.25, 1.05, 0, 1.04, 0.95);
    addPart(bodyGroup, accentMat, 0.35, 0.06, 2.2, 0, 0.83, -0.8);
    addPart(bodyGroup, secondaryMat, 0.14, 0.55, 0.25, -0.68, 1.05, 1.75);
    addPart(bodyGroup, secondaryMat, 0.14, 0.55, 0.25, 0.68, 1.05, 1.75);
    addPart(bodyGroup, accentMat, 1.98, 0.12, 0.52, 0, 1.32, 1.82);
  } else if (spec.bodyStyle === 'wedge') {
    addPart(bodyGroup, secondaryMat, 2.04, 0.24, 4.2, 0, 0.42, 0);
    addPart(bodyGroup, primaryMat, 1.88, 0.42, 3.9, 0, 0.72, 0.05);
    addPart(bodyGroup, primaryMat, 1.72, 0.24, 1.35, 0, 0.78, -1.35, 0.14);
    addPart(bodyGroup, glassMat, 1.48, 0.42, 1.65, 0, 1.08, -0.05);
    addPart(bodyGroup, primaryMat, 1.44, 0.14, 1.05, 0, 1.28, 0.25);
    addPart(bodyGroup, accentMat, 0.28, 0.08, 2.4, 0, 0.95, 0.9);
    addPart(bodyGroup, accentMat, 1.92, 0.1, 0.45, 0, 1.18, 1.85);
  } else if (spec.bodyStyle === 'truck') {
    addPart(bodyGroup, secondaryMat, 2.08, 0.3, 4.25, 0, 0.58, 0);
    addPart(bodyGroup, primaryMat, 1.98, 0.58, 4.05, 0, 0.98, 0);
    addPart(bodyGroup, primaryMat, 1.82, 0.68, 1.65, 0, 1.56, -0.25);
    addPart(bodyGroup, glassMat, 1.86, 0.42, 1.25, 0, 1.54, -0.25);
    addPart(bodyGroup, secondaryMat, 1.55, 0.22, 0.22, 0, 1.98, 0.2);
    addPart(bodyGroup, accentMat, 1.25, 0.16, 0.16, 0, 2.05, 0.2);
    addPart(bodyGroup, secondaryMat, 1.65, 0.34, 0.28, 0, 0.72, -2.14);
  } else if (spec.bodyStyle === 'pickup') {
    // Wide sport/baja pickup with open rear bed & spare tire rack
    addPart(bodyGroup, secondaryMat, 2.06, 0.28, 4.3, 0, 0.5, 0);
    addPart(bodyGroup, primaryMat, 1.96, 0.5, 4.1, 0, 0.88, 0);
    addPart(bodyGroup, primaryMat, 1.76, 0.58, 1.55, 0, 1.42, -0.55);
    addPart(bodyGroup, glassMat, 1.8, 0.38, 1.2, 0, 1.4, -0.55);
    addPart(bodyGroup, secondaryMat, 1.55, 0.14, 1.6, 0, 1.16, 1.05); // bed deck
    addPart(bodyGroup, accentMat, 1.68, 0.18, 0.24, 0, 1.72, 0.35); // cab light bar
    addPart(bodyGroup, secondaryMat, 1.85, 0.26, 0.26, 0, 0.68, -2.12);
  } else if (spec.bodyStyle === 'coupe') {
    addPart(bodyGroup, secondaryMat, 1.96, 0.28, 4.1, 0, 0.44, 0);
    addPart(bodyGroup, primaryMat, 1.88, 0.46, 3.95, 0, 0.78, 0);
    addPart(bodyGroup, primaryMat, 1.58, 0.46, 1.8, 0, 1.22, 0.18);
    addPart(bodyGroup, glassMat, 1.64, 0.34, 1.5, 0, 1.2, 0.15);
    addPart(bodyGroup, secondaryMat, 0.85, 0.08, 0.85, 0, 1.02, -1.15);
    addPart(bodyGroup, accentMat, 1.82, 0.12, 0.4, 0, 1.18, 1.82);
  } else if (spec.bodyStyle === 'gt') {
    // Widebody GT endurance coupe with front splitter, vented hood, and swan-neck wing
    addPart(bodyGroup, secondaryMat, 2.12, 0.22, 4.35, 0, 0.4, 0);
    addPart(bodyGroup, accentMat, 2.16, 0.08, 0.5, 0, 0.28, -2.06); // front splitter
    addPart(bodyGroup, primaryMat, 2.02, 0.42, 4.1, 0, 0.7, 0);
    addPart(bodyGroup, glassMat, 1.54, 0.36, 1.65, 0, 1.08, 0.05);
    addPart(bodyGroup, primaryMat, 1.48, 0.18, 1.2, 0, 1.2, 0.22);
    addPart(bodyGroup, secondaryMat, 0.12, 0.46, 0.28, -0.72, 1.12, 1.82);
    addPart(bodyGroup, secondaryMat, 0.12, 0.46, 0.28, 0.72, 1.12, 1.82);
    addPart(bodyGroup, accentMat, 2.08, 0.1, 0.48, 0, 1.36, 1.88);
  } else if (spec.bodyStyle === 'buggy') {
    addPart(bodyGroup, secondaryMat, 1.75, 0.28, 3.9, 0, 0.52, 0);
    addPart(bodyGroup, primaryMat, 1.35, 0.42, 2.9, 0, 0.82, 0.1);
    addPart(bodyGroup, accentMat, 1.25, 0.48, 1.4, 0, 1.26, 0.1);
    addPart(bodyGroup, glassMat, 1.12, 0.34, 1.1, 0, 1.24, 0.05);
    addPart(bodyGroup, exhaustMat, 1.1, 0.45, 0.9, 0, 0.95, 1.45);
    addPart(bodyGroup, primaryMat, 1.85, 0.12, 0.45, 0, 1.48, 1.72);
  } else if (spec.bodyStyle === 'van') {
    addPart(bodyGroup, secondaryMat, 2.12, 0.32, 4.3, 0, 0.48, 0);
    addPart(bodyGroup, primaryMat, 2.04, 1.08, 4.15, 0, 1.16, 0.02);
    addPart(bodyGroup, glassMat, 1.9, 0.46, 0.9, 0, 1.42, -1.55);
    addPart(bodyGroup, accentMat, 2.08, 0.18, 3.8, 0, 0.95, 0.05);
    addPart(bodyGroup, secondaryMat, 1.65, 0.14, 2.2, 0, 1.76, 0.3);
  } else if (spec.bodyStyle === 'hyper') {
    addPart(bodyGroup, secondaryMat, 2.14, 0.22, 4.35, 0, 0.38, 0);
    addPart(bodyGroup, primaryMat, 1.98, 0.36, 4.1, 0, 0.64, 0.02);
    addPart(bodyGroup, accentMat, 1.88, 0.1, 0.55, 0, 0.42, -2.02);
    addPart(bodyGroup, glassMat, 1.38, 0.38, 1.85, 0, 0.98, -0.05);
    addPart(bodyGroup, primaryMat, 1.26, 0.14, 1.1, 0, 1.16, 0.25);
    addPart(bodyGroup, secondaryMat, 0.14, 0.42, 0.9, 0, 1.06, 1.25);
    addPart(bodyGroup, accentMat, 2.12, 0.12, 0.5, 0, 1.24, 1.88);
  } else {
    addPart(bodyGroup, secondaryMat, 2.1, 0.28, 4.35, 0, 0.46, 0);
    addPart(bodyGroup, primaryMat, 2.02, 0.52, 4.15, 0, 0.84, 0);
    addPart(bodyGroup, secondaryMat, 0.32, 0.06, 4.05, -0.32, 1.12, 0);
    addPart(bodyGroup, secondaryMat, 0.32, 0.06, 4.05, 0.32, 1.12, 0);
    addPart(bodyGroup, exhaustMat, 0.56, 0.26, 0.65, 0, 1.18, -1.15);
    addPart(bodyGroup, primaryMat, 1.66, 0.42, 1.7, 0, 1.3, 0.25);
    addPart(bodyGroup, glassMat, 1.7, 0.32, 1.35, 0, 1.28, 0.22);
    addPart(bodyGroup, secondaryMat, 1.98, 0.22, 0.32, 0, 1.18, 1.92);
  }

  // Headlights (front -Z)
  addPart(bodyGroup, headlightMat, 0.38, 0.18, 0.12, -0.64, 0.68, -2.02);
  addPart(bodyGroup, headlightMat, 0.38, 0.18, 0.12, 0.64, 0.68, -2.02);

  // Brake / Taillights (rear +Z) + Center 3rd High-Mount Brake Bar
  const tailLeft = addPart(bodyGroup, taillightMat, 0.44, 0.19, 0.13, -0.64, 0.7, 2.04);
  const tailRight = addPart(bodyGroup, taillightMat, 0.44, 0.19, 0.13, 0.64, 0.7, 2.04);
  const tailCenter = addPart(bodyGroup, taillightMat, 0.76, 0.09, 0.12, 0, 1.04, 1.98);
  const brakeLights = [tailLeft, tailRight, tailCenter];

  // Rear Brake-Light Ground Glow Plane (+Z behind rear bumper)
  const brakeGroundGlow = new THREE.Mesh(getGlowPlaneGeo(), brakeGlowMat);
  brakeGroundGlow.position.set(0, 0.05, 2.55);
  brakeGroundGlow.visible = false;
  group.add(brakeGroundGlow);

  // Dual exhaust pipes
  addPart(bodyGroup, exhaustMat, 0.18, 0.18, 0.26, -0.45, 0.36, 2.08);
  addPart(bodyGroup, exhaustMat, 0.18, 0.18, 0.26, 0.45, 0.36, 2.08);

  // 4 Blocky Wheels + Inner Glowing Brake Rotors & Calipers
  const wheelY = spec.bodyStyle === 'truck' || spec.bodyStyle === 'pickup' ? 0.46 : 0.38;
  const wheelScale = spec.bodyStyle === 'truck' || spec.bodyStyle === 'pickup' ? 0.92 : 0.76;
  const wheelPositions: [number, number, number, boolean][] = [
    [-1.02, wheelY, -1.32, true],
    [1.02, wheelY, -1.32, true],
    [-1.02, wheelY, 1.32, false],
    [1.02, wheelY, 1.32, false],
  ];

  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();
  const wheelMeshes: THREE.Group[] = [];

  wheelPositions.forEach(([wx, wy, wz, isFront], idx) => {
    const wheelSpinGroup = new THREE.Group();
    const tireA = new THREE.Mesh(box, tireMat);
    tireA.scale.set(0.36, wheelScale, wheelScale);
    tireA.castShadow = castShadow;
    shadowCasters.push(tireA);
    wheelSpinGroup.add(tireA);

    const tireB = new THREE.Mesh(box, tireMat);
    tireB.scale.set(0.34, wheelScale, wheelScale);
    tireB.rotation.x = Math.PI / 4;
    wheelSpinGroup.add(tireB);

    const rim = new THREE.Mesh(box, rimMat);
    rim.scale.set(0.4, wheelScale * 0.48, wheelScale * 0.48);
    wheelSpinGroup.add(rim);

    // Spinning brake rotor disc inside wheel hub (heats up bright orange under braking)
    const rotorA = new THREE.Mesh(box, rotorMat);
    rotorA.scale.set(0.08, wheelScale * 0.62, wheelScale * 0.62);
    rotorA.position.x = wx < 0 ? 0.14 : -0.14;
    wheelSpinGroup.add(rotorA);

    const rotorB = new THREE.Mesh(box, rotorMat);
    rotorB.scale.set(0.08, wheelScale * 0.62, wheelScale * 0.62);
    rotorB.position.x = wx < 0 ? 0.14 : -0.14;
    rotorB.rotation.x = Math.PI / 4;
    wheelSpinGroup.add(rotorB);

    wheelMeshes.push(wheelSpinGroup);

    // Non-spinning brake caliper mounted to knuckle/axle
    const caliper = new THREE.Mesh(box, caliperMat);
    caliper.scale.set(0.14, wheelScale * 0.34, wheelScale * 0.24);
    caliper.position.set(wx < 0 ? 0.13 : -0.13, wheelScale * 0.14, 0.14);

    if (isFront) {
      const pivot = idx === 0 ? frontLeftPivot : frontRightPivot;
      pivot.position.set(wx, wy, wz);
      pivot.add(wheelSpinGroup);
      pivot.add(caliper);
      group.add(pivot);
    } else {
      const rearHub = new THREE.Group();
      rearHub.position.set(wx, wy, wz);
      rearHub.add(wheelSpinGroup);
      rearHub.add(caliper);
      group.add(rearHub);
    }
  });

  // Blocky dirt/grime patches on skirts, bumpers, and hood (visible when hull condition drops & brakingAnimation is ON)
  const dirtGroup = new THREE.Group();
  dirtGroup.visible = false;
  const addDirt = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const dm = new THREE.Mesh(box, dirtMat);
    dm.scale.set(sx, sy, sz);
    dm.position.set(px, py, pz);
    dirtGroup.add(dm);
  };
  addDirt(2.06, 0.22, 3.6, 0, 0.44, 0);
  addDirt(1.96, 0.26, 0.24, 0, 0.56, -2.04);
  addDirt(1.96, 0.26, 0.24, 0, 0.56, 2.04);
  addDirt(0.95, 0.08, 1.05, 0.25, 0.96, -1.05);
  addDirt(0.65, 0.28, 1.4, -0.96, 0.72, 0.35);
  addDirt(0.65, 0.28, 1.4, 0.96, 0.72, -0.25);
  bodyGroup.add(dirtGroup);

  const basePrimaryColor = new THREE.Color(spec.primaryColor);
  const grimeTintColor = new THREE.Color('#44403c');
  const coolRotorColor = new THREE.Color('#64748b');
  const hotRotorColor = new THREE.Color('#fb923c');
  let lastConditionKey = '';
  let lastBrakingKey = -1;
  let lastHeatBucket = -1;
  let lastShadowsEnabled = castShadow;

  const setCondition = (health: number, showDirt = true) => {
    const clamped = Math.max(15, Math.min(100, Math.round(health)));
    const key = `${clamped}_${showDirt ? 1 : 0}`;
    if (key === lastConditionKey) return;
    lastConditionKey = key;

    if (!showDirt || clamped >= 90) {
      dirtGroup.visible = false;
      dirtMat.opacity = 0;
      primaryMat.color.copy(basePrimaryColor);
    } else {
      const damageFrac = (90 - clamped) / 75;
      dirtGroup.visible = true;
      dirtMat.opacity = 0.16 + damageFrac * 0.72;
      primaryMat.color.copy(basePrimaryColor).lerp(grimeTintColor, damageFrac * 0.42);
    }
  };

  const setBrakingGlow = (braking: number, enabled: boolean, brakeHeat = 0) => {
    const key = !enabled ? 0 : braking > 0.1 ? 2 : 1;
    if (key !== lastBrakingKey) {
      lastBrakingKey = key;
      if (key === 2) {
        taillightMat.emissiveIntensity = 4.2;
        taillightMat.color.setHex(0xff3b30);
        brakeGroundGlow.visible = true;
        brakeGlowMat.opacity = 0.55;
      } else if (key === 1) {
        taillightMat.emissiveIntensity = 0.65;
        taillightMat.color.setHex(0xdc2626);
        brakeGroundGlow.visible = false;
        brakeGlowMat.opacity = 0;
      } else {
        taillightMat.emissiveIntensity = 0.08;
        taillightMat.color.setHex(0x991b1b);
        brakeGroundGlow.visible = false;
        brakeGlowMat.opacity = 0;
      }
    }

    // Update glowing brake rotors smoothly in 10% heat steps
    const effectiveHeat = enabled ? Math.max(0, Math.min(1, brakeHeat)) : 0;
    const heatBucket = Math.round(effectiveHeat * 10);
    if (heatBucket !== lastHeatBucket) {
      lastHeatBucket = heatBucket;
      const h = heatBucket / 10;
      rotorMat.emissiveIntensity = h * 3.2;
      rotorMat.color.copy(coolRotorColor).lerp(hotRotorColor, h * 0.85);
    }
  };

  const setShadowsEnabled = (enabled: boolean) => {
    if (enabled === lastShadowsEnabled) return;
    lastShadowsEnabled = enabled;
    shadowCasters.forEach((m) => {
      m.castShadow = enabled;
    });
    shadowReceivers.forEach((m) => {
      m.receiveShadow = enabled && !ecoMode;
    });
  };

  const dispose = () => {
    materialsToDispose.forEach((m) => m.dispose());
  };

  return {
    group,
    bodyGroup,
    frontLeftPivot,
    frontRightPivot,
    wheelMeshes,
    brakeLights,
    setCondition,
    setBrakingGlow,
    setShadowsEnabled,
    dispose,
  };
}

