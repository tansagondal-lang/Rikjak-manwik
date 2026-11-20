import * as THREE from 'three';
import { CompiledTrack } from '../data/tracks';
import { GraphicsSettings } from '../types/game';
import { getAsphaltTexture, getCheckerTexture, getCurbTexture, getGroundTexture } from './textures';

export interface BuiltTrackScene {
  group: THREE.Group;
  dispose: () => void;
}

function buildRibbonGeometry(
  compiled: CompiledTrack,
  innerOffset: number,
  outerOffset: number,
  yOffset: number,
  uvRepeatLength: number,
): THREE.BufferGeometry {
  const samples = compiled.samples;
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const normals = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const indices: number[] = [];

  let accumDist = 0;
  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    if (i > 0) {
      const prev = samples[(i - 1) % n];
      accumDist += s.point.distanceTo(prev.point);
    }
    const vCoord = accumDist / uvRepeatLength;

    const ix = s.point.x + s.right.x * innerOffset;
    const iz = s.point.z + s.right.z * innerOffset;
    const ox = s.point.x + s.right.x * outerOffset;
    const oz = s.point.z + s.right.z * outerOffset;

    const baseV = i * 6;
    positions[baseV] = ix;
    positions[baseV + 1] = yOffset;
    positions[baseV + 2] = iz;
    positions[baseV + 3] = ox;
    positions[baseV + 4] = yOffset;
    positions[baseV + 5] = oz;

    normals[baseV] = 0;
    normals[baseV + 1] = 1;
    normals[baseV + 2] = 0;
    normals[baseV + 3] = 0;
    normals[baseV + 4] = 1;
    normals[baseV + 5] = 0;

    const baseUv = i * 4;
    uvs[baseUv] = 0;
    uvs[baseUv + 1] = vCoord;
    uvs[baseUv + 2] = 1;
    uvs[baseUv + 3] = vCoord;

    if (i < n) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function buildTrackEnvironment(
  compiled: CompiledTrack,
  graphics: GraphicsSettings,
): BuiltTrackScene {
  const { spec, samples } = compiled;
  const ecoMode = graphics.preset === 'eco512';
  const group = new THREE.Group();
  const geosToDispose: THREE.BufferGeometry[] = [];
  const matsToDispose: THREE.Material[] = [];

  const makeMat = (params: THREE.MeshLambertMaterialParameters & { roughness?: number; metalness?: number }) => {
    const m = ecoMode
      ? new THREE.MeshLambertMaterial(params)
      : new THREE.MeshStandardMaterial({
          color: params.color,
          map: params.map,
          emissive: params.emissive,
          emissiveIntensity: params.emissiveIntensity,
          roughness: params.roughness ?? 0.85,
          metalness: params.metalness ?? 0.05,
        });
    matsToDispose.push(m);
    return m;
  };

  const sunShadows = !spec.isNight && graphics.shadows !== 'off';
  const highPropShadows =
    sunShadows && (graphics.shadows === 'soft' || graphics.shadows === 'high');

  // 1. Extended Ground Plane (no floating rectangular island!)
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  groundGeo.rotateX(-Math.PI / 2);
  geosToDispose.push(groundGeo);
  const groundMat = makeMat({
    map: getGroundTexture(spec.groundColor),
    roughness: 0.95,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = sunShadows;
  group.add(groundMesh);

  // 2. Road Surface Ribbon (+0.03 Y to avoid Z-fighting)
  const halfW = spec.width / 2;
  const roadGeo = buildRibbonGeometry(compiled, -halfW, halfW, 0.03, 14);
  geosToDispose.push(roadGeo);
  const roadMat = makeMat({
    map: getAsphaltTexture(spec.roadColor),
    roughness: 0.8,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = sunShadows;
  group.add(roadMesh);

  // 3. Left & Right Blocky Curbs (+0.05 Y)
  const curbW = 1.4;
  const curbGeoL = buildRibbonGeometry(compiled, -halfW - curbW, -halfW, 0.05, 6);
  const curbGeoR = buildRibbonGeometry(compiled, halfW, halfW + curbW, 0.05, 6);
  geosToDispose.push(curbGeoL, curbGeoR);
  const curbMat = makeMat({
    map: getCurbTexture(spec.curbColorA, spec.curbColorB),
    roughness: 0.65,
  });
  const curbL = new THREE.Mesh(curbGeoL, curbMat);
  const curbR = new THREE.Mesh(curbGeoR, curbMat);
  curbL.receiveShadow = sunShadows;
  curbR.receiveShadow = sunShadows;
  group.add(curbL, curbR);

  // 4. Start / Finish Line Strip + Checkered Gantry Arch at sample 0
  const startSample = samples[0];
  const startYaw = Math.atan2(-startSample.tangent.x, -startSample.tangent.z);

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startSample.point);
  gantryGroup.rotation.y = startYaw;

  const stripGeo = new THREE.PlaneGeometry(spec.width, 3.6);
  stripGeo.rotateX(-Math.PI / 2);
  geosToDispose.push(stripGeo);
  const stripMat = makeMat({ map: getCheckerTexture(), roughness: 0.6 });
  const startStrip = new THREE.Mesh(stripGeo, stripMat);
  startStrip.position.y = 0.06;
  gantryGroup.add(startStrip);

  const pillarGeo = new THREE.BoxGeometry(1.1, 7.2, 1.1);
  const bannerGeo = new THREE.BoxGeometry(spec.width + 2.8, 1.8, 1.2);
  const lightBoxGeo = new THREE.BoxGeometry(0.65, 0.65, 1.32);
  geosToDispose.push(pillarGeo, bannerGeo, lightBoxGeo);

  const pillarMat = makeMat({ color: '#1e293b', roughness: 0.5, metalness: 0.4 });
  const bannerMat = makeMat({ map: getCheckerTexture(), roughness: 0.4 });
  const signalMat = makeMat({
    color: '#f59e0b',
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
  });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-halfW - 1.1, 3.6, 0);
  leftPillar.castShadow = sunShadows;
  leftPillar.receiveShadow = sunShadows;
  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(halfW + 1.1, 3.6, 0);
  rightPillar.castShadow = sunShadows;
  rightPillar.receiveShadow = sunShadows;
  const topBanner = new THREE.Mesh(bannerGeo, bannerMat);
  topBanner.position.set(0, 7.4, 0);
  topBanner.castShadow = sunShadows;
  gantryGroup.add(leftPillar, rightPillar, topBanner);

  for (let i = -1; i <= 1; i++) {
    const sig = new THREE.Mesh(lightBoxGeo, signalMat);
    sig.position.set(i * 1.6, 6.2, 0);
    gantryGroup.add(sig);
  }
  group.add(gantryGroup);

  // 5. Instanced Trackside Blocky Props (Trees / Cacti / Harbor Containers & Lamps)
  // Using InstancedMesh keeps draw calls ultra-low for 512MB RAM phones!
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  geosToDispose.push(boxGeo);

  const step = ecoMode ? 6 : 4;
  const propPositions: { x: number; z: number; scale: number; side: number; idx: number }[] = [];
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i];
    const side = (i / step) % 2 === 0 ? 1 : -1;
    const distFromCenter = halfW + 6.5 + ((i * 17) % 14);
    const px = s.point.x + s.right.x * side * distFromCenter;
    const pz = s.point.z + s.right.z * side * distFromCenter;

    // Ensure prop doesn't overlap another segment of the road!
    let tooCloseToRoad = false;
    for (let j = 0; j < samples.length; j += 4) {
      const sp = samples[j].point;
      const dx = px - sp.x;
      const dz = pz - sp.z;
      if (dx * dx + dz * dz < (halfW + 3.2) * (halfW + 3.2)) {
        tooCloseToRoad = true;
        break;
      }
    }
    if (!tooCloseToRoad) {
      propPositions.push({
        x: px,
        z: pz,
        scale: 0.85 + ((i * 13) % 30) / 100,
        side,
        idx: i,
      });
    }
  }

  const dummy = new THREE.Object3D();
  const colorHelper = new THREE.Color();

  if (spec.propType === 'pine' && propPositions.length > 0) {
    const trunkMat = makeMat({ color: '#78350f', roughness: 0.9 });
    const leafMat = makeMat({ color: '#166534', roughness: 0.85 });

    const trunks = new THREE.InstancedMesh(boxGeo, trunkMat, propPositions.length);
    const leavesLower = new THREE.InstancedMesh(boxGeo, leafMat, propPositions.length);
    const leavesUpper = new THREE.InstancedMesh(boxGeo, leafMat, propPositions.length);

    propPositions.forEach((p, idx) => {
      dummy.position.set(p.x, 1.5 * p.scale, p.z);
      dummy.scale.set(1.1 * p.scale, 3.0 * p.scale, 1.1 * p.scale);
      dummy.rotation.set(0, (idx * 0.7) % Math.PI, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x, 4.1 * p.scale, p.z);
      dummy.scale.set(3.4 * p.scale, 2.6 * p.scale, 3.4 * p.scale);
      dummy.updateMatrix();
      leavesLower.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x, 6.2 * p.scale, p.z);
      dummy.scale.set(2.1 * p.scale, 2.2 * p.scale, 2.1 * p.scale);
      dummy.updateMatrix();
      leavesUpper.setMatrixAt(idx, dummy.matrix);

      colorHelper.setHSL(0.36 + (idx % 5) * 0.015, 0.55, 0.25 + (idx % 4) * 0.04);
      leavesLower.setColorAt(idx, colorHelper);
      leavesUpper.setColorAt(idx, colorHelper);
    });

    trunks.instanceMatrix.needsUpdate = true;
    leavesLower.instanceMatrix.needsUpdate = true;
    leavesUpper.instanceMatrix.needsUpdate = true;
    if (leavesLower.instanceColor) leavesLower.instanceColor.needsUpdate = true;
    if (leavesUpper.instanceColor) leavesUpper.instanceColor.needsUpdate = true;
    trunks.castShadow = highPropShadows;
    leavesLower.castShadow = highPropShadows;
    leavesUpper.castShadow = highPropShadows;
    trunks.computeBoundingSphere();
    leavesLower.computeBoundingSphere();
    leavesUpper.computeBoundingSphere();
    group.add(trunks, leavesLower, leavesUpper);
  } else if (spec.propType === 'desert' && propPositions.length > 0) {
    const rockMat = makeMat({ color: '#b45309', roughness: 0.9 });
    const cactusMat = makeMat({ color: '#15803d', roughness: 0.8 });

    const rocks = new THREE.InstancedMesh(boxGeo, rockMat, propPositions.length);
    const cacti = new THREE.InstancedMesh(boxGeo, cactusMat, propPositions.length);

    propPositions.forEach((p, idx) => {
      if (idx % 2 === 0) {
        dummy.position.set(p.x, 1.6 * p.scale, p.z);
        dummy.scale.set(3.4 * p.scale, 3.2 * p.scale, 3.2 * p.scale);
        dummy.rotation.set(0, idx * 0.5, 0);
        dummy.updateMatrix();
        rocks.setMatrixAt(idx, dummy.matrix);
        colorHelper.setHSL(0.07, 0.72, 0.36 + (idx % 4) * 0.04);
        rocks.setColorAt(idx, colorHelper);

        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        cacti.setMatrixAt(idx, dummy.matrix);
      } else {
        dummy.position.set(p.x, 2.0 * p.scale, p.z);
        dummy.scale.set(0.95 * p.scale, 4.0 * p.scale, 0.95 * p.scale);
        dummy.rotation.set(0, idx * 0.4, 0);
        dummy.updateMatrix();
        cacti.setMatrixAt(idx, dummy.matrix);

        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        rocks.setMatrixAt(idx, dummy.matrix);
      }
    });

    rocks.instanceMatrix.needsUpdate = true;
    cacti.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.castShadow = highPropShadows;
    cacti.castShadow = highPropShadows;
    rocks.computeBoundingSphere();
    cacti.computeBoundingSphere();
    group.add(rocks, cacti);
  } else if (spec.propType === 'harbor' && propPositions.length > 0) {
    const containerMat = makeMat({ color: '#334155', roughness: 0.65, metalness: 0.2 });
    const lampMat = makeMat({
      color: '#38bdf8',
      emissive: 0x06b6d4,
      emissiveIntensity: 1.0,
    });

    const containers = new THREE.InstancedMesh(boxGeo, containerMat, propPositions.length);
    const lamps = new THREE.InstancedMesh(boxGeo, lampMat, propPositions.length);

    propPositions.forEach((p, idx) => {
      if (idx % 3 === 0) {
        dummy.position.set(p.x, 1.8 * p.scale, p.z);
        dummy.scale.set(3.2, 3.6 * p.scale, 6.8);
        dummy.rotation.set(0, (idx * 0.8) % Math.PI, 0);
        dummy.updateMatrix();
        containers.setMatrixAt(idx, dummy.matrix);
        const palette = [0x0284c7, 0xd97706, 0xdc2626, 0x334155];
        colorHelper.setHex(palette[idx % palette.length]);
        containers.setColorAt(idx, colorHelper);

        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        lamps.setMatrixAt(idx, dummy.matrix);
      } else {
        dummy.position.set(p.x, 3.5, p.z);
        dummy.scale.set(0.45, 7.0, 0.45);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        containers.setMatrixAt(idx, dummy.matrix);
        colorHelper.setHex(0x475569);
        containers.setColorAt(idx, colorHelper);

        dummy.position.set(p.x, 7.1, p.z);
        dummy.scale.set(1.1, 0.45, 1.1);
        dummy.updateMatrix();
        lamps.setMatrixAt(idx, dummy.matrix);
      }
    });

    containers.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    if (containers.instanceColor) containers.instanceColor.needsUpdate = true;
    containers.computeBoundingSphere();
    lamps.computeBoundingSphere();
    group.add(containers, lamps);
  }

  // 6. Trackside Grandstands near Start/Finish
  const standMat = makeMat({ color: '#475569', roughness: 0.7 });
  const roofMat = makeMat({ color: spec.curbColorA, roughness: 0.5 });
  const standGroup = new THREE.Group();
  standGroup.position.copy(startSample.point);
  standGroup.rotation.y = startYaw;
  for (let tier = 0; tier < 3; tier++) {
    const tierMesh = new THREE.Mesh(boxGeo, standMat);
    tierMesh.scale.set(6, 1.2 + tier * 1.1, 24);
    tierMesh.position.set(-halfW - 10 - tier * 2.4, (1.2 + tier * 1.1) / 2, -16);
    tierMesh.castShadow = sunShadows;
    tierMesh.receiveShadow = sunShadows;
    standGroup.add(tierMesh);
  }
  const standRoof = new THREE.Mesh(boxGeo, roofMat);
  standRoof.scale.set(8, 0.45, 25);
  standRoof.position.set(-halfW - 12.5, 6.2, -16);
  standRoof.castShadow = sunShadows;
  standGroup.add(standRoof);
  group.add(standGroup);

  const dispose = () => {
    geosToDispose.forEach((g) => g.dispose());
    matsToDispose.forEach((m) => m.dispose());
  };

  return { group, dispose };
}
