import * as THREE from 'three';
import { CAR_MAP } from '../data/cars';
import { CarId } from '../types/game';

export interface CarModelRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Group[];
  brakeLights: THREE.Mesh[];
  setCondition: (health: number, showDirt?: boolean) => void;
  setBrakingGlow: (braking: number, enabled: boolean) => void;
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
  const headlightMat = trackMat(
    makeMat('#fef9c3', { emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.2 }),
  );
  const taillightMat = trackMat(
    makeMat('#dc2626', { emissive: 0xef4444, emissiveIntensity: 0.65, roughness: 0.25 }),
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
    // Lower chassis + sidepods
    addPart(bodyGroup, secondaryMat, 1.95, 0.26, 4.15, 0, 0.42, 0.02);
    addPart(bodyGroup, primaryMat, 1.5, 0.34, 3.85, 0, 0.64, 0.05);
    // Tapered nose cone & front wing
    addPart(bodyGroup, primaryMat, 0.75, 0.26, 1.15, 0, 0.56, -2.05, 0.12);
    addPart(bodyGroup, accentMat, 2.15, 0.12, 0.55, 0, 0.28, -2.35);
    // Cockpit & halo/visor
    addPart(bodyGroup, glassMat, 0.88, 0.36, 1.25, 0, 0.96, 0.15);
    addPart(bodyGroup, primaryMat, 0.72, 0.25, 1.05, 0, 1.04, 0.95);
    // Racing stripe
    addPart(bodyGroup, accentMat, 0.35, 0.06, 2.2, 0, 0.83, -0.8);
    // Rear wing
    addPart(bodyGroup, secondaryMat, 0.14, 0.55, 0.25, -0.68, 1.05, 1.75);
    addPart(bodyGroup, secondaryMat, 0.14, 0.55, 0.25, 0.68, 1.05, 1.75);
    addPart(bodyGroup, accentMat, 1.98, 0.12, 0.52, 0, 1.32, 1.82);
  } else if (spec.bodyStyle === 'wedge') {
    // Sleek cyber-block wedge
    addPart(bodyGroup, secondaryMat, 2.04, 0.24, 4.2, 0, 0.42, 0);
    addPart(bodyGroup, primaryMat, 1.88, 0.42, 3.9, 0, 0.72, 0.05);
    addPart(bodyGroup, primaryMat, 1.72, 0.24, 1.35, 0, 0.78, -1.35, 0.14);
    // Wide wrap-around canopy
    addPart(bodyGroup, glassMat, 1.48, 0.42, 1.65, 0, 1.08, -0.05);
    addPart(bodyGroup, primaryMat, 1.44, 0.14, 1.05, 0, 1.28, 0.25);
    // Neon accent spine + rear diffuser
    addPart(bodyGroup, accentMat, 0.28, 0.08, 2.4, 0, 0.95, 0.9);
    addPart(bodyGroup, accentMat, 1.92, 0.1, 0.45, 0, 1.18, 1.85);
  } else if (spec.bodyStyle === 'truck') {
    // High-clearance 4x4 blocky rig
    addPart(bodyGroup, secondaryMat, 2.08, 0.3, 4.25, 0, 0.58, 0);
    addPart(bodyGroup, primaryMat, 1.98, 0.58, 4.05, 0, 0.98, 0);
    // Tall blocky cab
    addPart(bodyGroup, primaryMat, 1.82, 0.68, 1.65, 0, 1.56, -0.25);
    addPart(bodyGroup, glassMat, 1.86, 0.42, 1.25, 0, 1.54, -0.25);
    // Rollbar & roof lights
    addPart(bodyGroup, secondaryMat, 1.55, 0.22, 0.22, 0, 1.98, 0.2);
    addPart(bodyGroup, accentMat, 1.25, 0.16, 0.16, 0, 2.05, 0.2);
    // Front bullbar
    addPart(bodyGroup, secondaryMat, 1.65, 0.34, 0.28, 0, 0.72, -2.14);
  } else if (spec.bodyStyle === 'coupe') {
    // Classic boxy drift coupe
    addPart(bodyGroup, secondaryMat, 1.96, 0.28, 4.1, 0, 0.44, 0);
    addPart(bodyGroup, primaryMat, 1.88, 0.46, 3.95, 0, 0.78, 0);
    // Greenhouse cabin
    addPart(bodyGroup, primaryMat, 1.58, 0.46, 1.8, 0, 1.22, 0.18);
    addPart(bodyGroup, glassMat, 1.64, 0.34, 1.5, 0, 1.2, 0.15);
    // Hood vents & wing
    addPart(bodyGroup, secondaryMat, 0.85, 0.08, 0.85, 0, 1.02, -1.15);
    addPart(bodyGroup, accentMat, 1.82, 0.12, 0.4, 0, 1.18, 1.82);
  } else if (spec.bodyStyle === 'buggy') {
    // Open-frame offroad dune buggy
    addPart(bodyGroup, secondaryMat, 1.75, 0.28, 3.9, 0, 0.52, 0);
    addPart(bodyGroup, primaryMat, 1.35, 0.42, 2.9, 0, 0.82, 0.1);
    // Rollcage frame
    addPart(bodyGroup, accentMat, 1.25, 0.48, 1.4, 0, 1.26, 0.1);
    addPart(bodyGroup, glassMat, 1.12, 0.34, 1.1, 0, 1.24, 0.05);
    // Rear engine bay + big spoiler
    addPart(bodyGroup, exhaustMat, 1.1, 0.45, 0.9, 0, 0.95, 1.45);
    addPart(bodyGroup, primaryMat, 1.85, 0.12, 0.45, 0, 1.48, 1.72);
  } else if (spec.bodyStyle === 'van') {
    // Tall armored brick van
    addPart(bodyGroup, secondaryMat, 2.12, 0.32, 4.3, 0, 0.48, 0);
    addPart(bodyGroup, primaryMat, 2.04, 1.08, 4.15, 0, 1.16, 0.02);
    // Cab windshield + stripe
    addPart(bodyGroup, glassMat, 1.9, 0.46, 0.9, 0, 1.42, -1.55);
    addPart(bodyGroup, accentMat, 2.08, 0.18, 3.8, 0, 0.95, 0.05);
    // Roof rack
    addPart(bodyGroup, secondaryMat, 1.65, 0.14, 2.2, 0, 1.76, 0.3);
  } else if (spec.bodyStyle === 'hyper') {
    // Low-slung twin-vent hypercar
    addPart(bodyGroup, secondaryMat, 2.14, 0.22, 4.35, 0, 0.38, 0);
    addPart(bodyGroup, primaryMat, 1.98, 0.36, 4.1, 0, 0.64, 0.02);
    addPart(bodyGroup, accentMat, 1.88, 0.1, 0.55, 0, 0.42, -2.02);
    // Tear-drop glass canopy
    addPart(bodyGroup, glassMat, 1.38, 0.38, 1.85, 0, 0.98, -0.05);
    addPart(bodyGroup, primaryMat, 1.26, 0.14, 1.1, 0, 1.16, 0.25);
    // Twin shark-fin & carbon wing
    addPart(bodyGroup, secondaryMat, 0.14, 0.42, 0.9, 0, 1.06, 1.25);
    addPart(bodyGroup, accentMat, 2.12, 0.12, 0.5, 0, 1.24, 1.88);
  } else {
    // Heavy muscle interceptor
    addPart(bodyGroup, secondaryMat, 2.1, 0.28, 4.35, 0, 0.46, 0);
    addPart(bodyGroup, primaryMat, 2.02, 0.52, 4.15, 0, 0.84, 0);
    // Twin racing stripes
    addPart(bodyGroup, secondaryMat, 0.32, 0.06, 4.05, -0.32, 1.12, 0);
    addPart(bodyGroup, secondaryMat, 0.32, 0.06, 4.05, 0.32, 1.12, 0);
    // Supercharger blower on hood
    addPart(bodyGroup, exhaustMat, 0.56, 0.26, 0.65, 0, 1.18, -1.15);
    // Low muscle roof
    addPart(bodyGroup, primaryMat, 1.66, 0.42, 1.7, 0, 1.3, 0.25);
    addPart(bodyGroup, glassMat, 1.7, 0.32, 1.35, 0, 1.28, 0.22);
    // Rear ducktail spoiler
    addPart(bodyGroup, secondaryMat, 1.98, 0.22, 0.32, 0, 1.18, 1.92);
  }

  // Headlights (front -Z)
  addPart(bodyGroup, headlightMat, 0.38, 0.18, 0.12, -0.64, 0.68, -2.02);
  addPart(bodyGroup, headlightMat, 0.38, 0.18, 0.12, 0.64, 0.68, -2.02);

  // Brake / Taillights (rear +Z)
  const tailLeft = addPart(bodyGroup, taillightMat, 0.42, 0.18, 0.12, -0.62, 0.7, 2.02);
  const tailRight = addPart(bodyGroup, taillightMat, 0.42, 0.18, 0.12, 0.62, 0.7, 2.02);
  const brakeLights = [tailLeft, tailRight];

  // Dual exhaust pipes
  addPart(bodyGroup, exhaustMat, 0.18, 0.18, 0.26, -0.45, 0.36, 2.08);
  addPart(bodyGroup, exhaustMat, 0.18, 0.18, 0.26, 0.45, 0.36, 2.08);

  // 4 Blocky Wheels (rounded octagon-feel via crossed blocky tires + silver rims)
  const wheelY = spec.bodyStyle === 'truck' ? 0.46 : 0.38;
  const wheelScale = spec.bodyStyle === 'truck' ? 0.92 : 0.76;
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

    wheelMeshes.push(wheelSpinGroup);

    if (isFront) {
      const pivot = idx === 0 ? frontLeftPivot : frontRightPivot;
      pivot.position.set(wx, wy, wz);
      pivot.add(wheelSpinGroup);
      group.add(pivot);
    } else {
      wheelSpinGroup.position.set(wx, wy, wz);
      group.add(wheelSpinGroup);
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
  addDirt(2.06, 0.22, 3.6, 0, 0.44, 0); // Lower rocker mud coat
  addDirt(1.96, 0.26, 0.24, 0, 0.56, -2.04); // Front bumper grime
  addDirt(1.96, 0.26, 0.24, 0, 0.56, 2.04); // Rear bumper grime
  addDirt(0.95, 0.08, 1.05, 0.25, 0.96, -1.05); // Hood crash smudge
  addDirt(0.65, 0.28, 1.4, -0.96, 0.72, 0.35); // Left door scrape
  addDirt(0.65, 0.28, 1.4, 0.96, 0.72, -0.25); // Right fender scrape
  bodyGroup.add(dirtGroup);

  const basePrimaryColor = new THREE.Color(spec.primaryColor);
  const grimeTintColor = new THREE.Color('#44403c');
  let lastConditionKey = '';
  let lastBrakingKey = -1;
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
      const damageFrac = (90 - clamped) / 75; // 0..1
      dirtGroup.visible = true;
      dirtMat.opacity = 0.16 + damageFrac * 0.72;
      primaryMat.color.copy(basePrimaryColor).lerp(grimeTintColor, damageFrac * 0.42);
    }
  };

  const setBrakingGlow = (braking: number, enabled: boolean) => {
    const key = !enabled ? 0 : braking > 0.1 ? 2 : 1;
    if (key === lastBrakingKey) return;
    lastBrakingKey = key;
    if (key === 2) {
      taillightMat.emissiveIntensity = 3.6;
      taillightMat.color.setHex(0xff453a);
    } else if (key === 1) {
      taillightMat.emissiveIntensity = 0.65;
      taillightMat.color.setHex(0xdc2626);
    } else {
      taillightMat.emissiveIntensity = 0.08;
      taillightMat.color.setHex(0x991b1b);
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
