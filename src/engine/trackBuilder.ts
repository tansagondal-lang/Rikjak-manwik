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
    const py = s.point.y + yOffset;

    const baseV = i * 6;
    positions[baseV] = ix;
    positions[baseV + 1] = py;
    positions[baseV + 2] = iz;
    positions[baseV + 3] = ox;
    positions[baseV + 4] = py;
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

function buildEmbankmentSide(
  compiled: CompiledTrack,
  edgeOffset: number,
  outwardSign: number,
): THREE.BufferGeometry {
  const samples = compiled.samples;
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const normals = new Float32Array((n + 1) * 2 * 3);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const ex = s.point.x + s.right.x * edgeOffset;
    const ez = s.point.z + s.right.z * edgeOffset;
    const gx = ex + s.right.x * outwardSign * 3.5;
    const gz = ez + s.right.z * outwardSign * 3.5;

    const baseV = i * 6;
    // Top vertex at curb edge, bottom vertex grounded into earth
    positions[baseV] = ex;
    positions[baseV + 1] = s.point.y + 0.04;
    positions[baseV + 2] = ez;

    positions[baseV + 3] = gx;
    positions[baseV + 4] = -0.25;
    positions[baseV + 5] = gz;

    const nx = s.right.x * outwardSign;
    const nz = s.right.z * outwardSign;
    normals[baseV] = nx;
    normals[baseV + 1] = 0.5;
    normals[baseV + 2] = nz;
    normals[baseV + 3] = nx;
    normals[baseV + 4] = 0.5;
    normals[baseV + 5] = nz;

    if (i < n) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (outwardSign > 0) {
        indices.push(a, b, c, b, d, c);
      } else {
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
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

  const makeMat = (
    params: THREE.MeshLambertMaterialParameters & { roughness?: number; metalness?: number },
  ) => {
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

  // 1. Extended Ground Plane (3600x3600 so large circuits never hit an edge)
  const groundGeo = new THREE.PlaneGeometry(3600, 3600);
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

  // 2. Road Surface Ribbon (+0.04 Y to avoid Z-fighting)
  const halfW = spec.width / 2;
  const roadGeo = buildRibbonGeometry(compiled, -halfW, halfW, 0.04, 15);
  geosToDispose.push(roadGeo);
  const roadMat = makeMat({
    map: getAsphaltTexture(spec.roadColor),
    roughness: 0.8,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = sunShadows;
  group.add(roadMesh);

  // 3. Left & Right Blocky Curbs (+0.06 Y) + Embankment Skirts for elevated hills
  const curbW = 1.5;
  const curbGeoL = buildRibbonGeometry(compiled, -halfW - curbW, -halfW, 0.06, 6);
  const curbGeoR = buildRibbonGeometry(compiled, halfW, halfW + curbW, 0.06, 6);
  const embGeoL = buildEmbankmentSide(compiled, -halfW - curbW, -1);
  const embGeoR = buildEmbankmentSide(compiled, halfW + curbW, 1);
  geosToDispose.push(curbGeoL, curbGeoR, embGeoL, embGeoR);

  const curbMat = makeMat({
    map: getCurbTexture(spec.curbColorA, spec.curbColorB),
    roughness: 0.65,
  });
  const embMat = makeMat({
    color: spec.groundColor,
    roughness: 0.92,
  });
  const curbL = new THREE.Mesh(curbGeoL, curbMat);
  const curbR = new THREE.Mesh(curbGeoR, curbMat);
  const embL = new THREE.Mesh(embGeoL, embMat);
  const embR = new THREE.Mesh(embGeoR, embMat);
  curbL.receiveShadow = sunShadows;
  curbR.receiveShadow = sunShadows;
  embL.receiveShadow = sunShadows;
  embR.receiveShadow = sunShadows;
  group.add(curbL, curbR, embL, embR);

  // 4. Start / Finish Line Strip + Checkered Gantry Arch at sample 0
  const startSample = samples[0];
  const startYaw = Math.atan2(-startSample.tangent.x, -startSample.tangent.z);

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startSample.point);
  gantryGroup.rotation.y = startYaw;

  const stripGeo = new THREE.PlaneGeometry(spec.width, 3.8);
  stripGeo.rotateX(-Math.PI / 2);
  geosToDispose.push(stripGeo);
  const stripMat = makeMat({ map: getCheckerTexture(), roughness: 0.6 });
  const startStrip = new THREE.Mesh(stripGeo, stripMat);
  startStrip.position.y = 0.07;
  gantryGroup.add(startStrip);

  const pillarGeo = new THREE.BoxGeometry(1.15, 7.6, 1.15);
  const bannerGeo = new THREE.BoxGeometry(spec.width + 3.0, 1.9, 1.25);
  const lightBoxGeo = new THREE.BoxGeometry(0.68, 0.68, 1.38);
  geosToDispose.push(pillarGeo, bannerGeo, lightBoxGeo);

  const pillarMat = makeMat({ color: '#1e293b', roughness: 0.5, metalness: 0.4 });
  const bannerMat = makeMat({ map: getCheckerTexture(), roughness: 0.4 });
  const signalMat = makeMat({
    color: '#f59e0b',
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
  });

  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-halfW - 1.15, 3.8, 0);
  leftPillar.castShadow = sunShadows;
  leftPillar.receiveShadow = sunShadows;
  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(halfW + 1.15, 3.8, 0);
  rightPillar.castShadow = sunShadows;
  rightPillar.receiveShadow = sunShadows;
  const topBanner = new THREE.Mesh(bannerGeo, bannerMat);
  topBanner.position.set(0, 7.8, 0);
  topBanner.castShadow = sunShadows;
  gantryGroup.add(leftPillar, rightPillar, topBanner);

  for (let i = -1; i <= 1; i++) {
    const sig = new THREE.Mesh(lightBoxGeo, signalMat);
    sig.position.set(i * 1.65, 6.5, 0);
    gantryGroup.add(sig);
  }
  group.add(gantryGroup);

  // 5. Instanced Trackside Blocky Props across all 20 Distinct Themes
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  geosToDispose.push(boxGeo);

  const step = ecoMode ? 7 : 4;
  const propPositions: { x: number; y: number; z: number; scale: number; side: number; idx: number }[] = [];
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i];
    const side = (i / step) % 2 === 0 ? 1 : -1;
    const distFromCenter = halfW + 7.5 + ((i * 19) % 18);
    const px = s.point.x + s.right.x * side * distFromCenter;
    const pz = s.point.z + s.right.z * side * distFromCenter;

    let tooCloseToRoad = false;
    for (let j = 0; j < samples.length; j += 4) {
      const sp = samples[j].point;
      const dx = px - sp.x;
      const dz = pz - sp.z;
      if (dx * dx + dz * dz < (halfW + 4.2) * (halfW + 4.2)) {
        tooCloseToRoad = true;
        break;
      }
    }
    if (!tooCloseToRoad) {
      propPositions.push({
        x: px,
        y: 0,
        z: pz,
        scale: 0.9 + ((i * 13) % 45) / 100,
        side,
        idx: i,
      });
    }
  }

  const dummy = new THREE.Object3D();
  const colorHelper = new THREE.Color();

  const buildDualInstancedProps = (
    primaryColor: string,
    accentColor: string,
    accentEmissive: number,
    configure: (
      p: { x: number; y: number; z: number; scale: number; idx: number },
      idx: number,
      meshA: THREE.InstancedMesh,
      meshB: THREE.InstancedMesh,
    ) => void,
    roughnessA = 0.85,
    metalnessA = 0.1,
  ) => {
    if (propPositions.length === 0) return;
    const matA = makeMat({ color: primaryColor, roughness: roughnessA, metalness: metalnessA });
    const matB = makeMat({
      color: accentColor,
      roughness: accentEmissive > 0 ? 0.35 : 0.8,
      emissive: accentEmissive,
      emissiveIntensity: accentEmissive > 0 ? 1.1 : 0,
    });
    const meshA = new THREE.InstancedMesh(boxGeo, matA, propPositions.length);
    const meshB = new THREE.InstancedMesh(boxGeo, matB, propPositions.length);
    propPositions.forEach((p, idx) => configure(p, idx, meshA, meshB));
    meshA.instanceMatrix.needsUpdate = true;
    meshB.instanceMatrix.needsUpdate = true;
    if (meshA.instanceColor) meshA.instanceColor.needsUpdate = true;
    if (meshB.instanceColor) meshB.instanceColor.needsUpdate = true;
    meshA.castShadow = highPropShadows;
    meshB.castShadow = highPropShadows && accentEmissive === 0;
    meshA.computeBoundingSphere();
    meshB.computeBoundingSphere();
    group.add(meshA, meshB);
  };

  switch (spec.propType) {
    case 'pine':
    case 'snow':
    case 'autumn':
    case 'sakura':
    case 'jungle': {
      if (propPositions.length > 0) {
        const trunkColor = spec.propType === 'sakura' ? '#57534e' : '#78350f';
        const baseLeafColor =
          spec.propType === 'sakura'
            ? '#f472b6'
            : spec.propType === 'autumn'
              ? '#ea580c'
              : spec.propType === 'snow'
                ? '#e2e8f0'
                : spec.propType === 'jungle'
                  ? '#047857'
                  : '#166534';

        const trunkMat = makeMat({ color: trunkColor, roughness: 0.9 });
        const leafMat = makeMat({ color: baseLeafColor, roughness: 0.85 });

        const trunks = new THREE.InstancedMesh(boxGeo, trunkMat, propPositions.length);
        const leavesLower = new THREE.InstancedMesh(boxGeo, leafMat, propPositions.length);
        const leavesUpper = new THREE.InstancedMesh(boxGeo, leafMat, propPositions.length);

        propPositions.forEach((p, idx) => {
          const hScale = spec.propType === 'jungle' ? p.scale * 1.45 : p.scale;
          dummy.position.set(p.x, 1.7 * hScale, p.z);
          dummy.scale.set(1.15 * p.scale, 3.4 * hScale, 1.15 * p.scale);
          dummy.rotation.set(0, (idx * 0.7) % Math.PI, 0);
          dummy.updateMatrix();
          trunks.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, 4.5 * hScale, p.z);
          dummy.scale.set(3.8 * p.scale, 2.7 * hScale, 3.8 * p.scale);
          dummy.updateMatrix();
          leavesLower.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, 6.8 * hScale, p.z);
          dummy.scale.set(2.3 * p.scale, 2.4 * hScale, 2.3 * p.scale);
          dummy.updateMatrix();
          leavesUpper.setMatrixAt(idx, dummy.matrix);

          if (spec.propType === 'sakura') {
            colorHelper.setHSL(0.93 + (idx % 3) * 0.015, 0.8, 0.72 + (idx % 3) * 0.05);
          } else if (spec.propType === 'autumn') {
            const autumnHues = [0.04, 0.08, 0.11, 0.98];
            colorHelper.setHSL(autumnHues[idx % autumnHues.length], 0.82, 0.44);
          } else if (spec.propType === 'snow') {
            colorHelper.setHSL(0.56, 0.25, idx % 2 === 0 ? 0.86 : 0.76);
          } else {
            colorHelper.setHSL(0.36 + (idx % 5) * 0.015, 0.58, 0.24 + (idx % 4) * 0.04);
          }
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
      }
      break;
    }

    case 'desert':
    case 'canyon': {
      buildDualInstancedProps(
        spec.propType === 'canyon' ? '#9a3412' : '#b45309',
        spec.propType === 'canyon' ? '#c2410c' : '#15803d',
        0,
        (p, idx, rocks, cacti) => {
          if (idx % 2 === 0 || spec.propType === 'canyon') {
            const tall = spec.propType === 'canyon' ? 2.4 : 1.0;
            dummy.position.set(p.x, 2.2 * p.scale * tall, p.z);
            dummy.scale.set(4.2 * p.scale, 4.4 * p.scale * tall, 3.8 * p.scale);
            dummy.rotation.set(0, idx * 0.5, 0);
            dummy.updateMatrix();
            rocks.setMatrixAt(idx, dummy.matrix);
            colorHelper.setHSL(0.06, 0.72, 0.34 + (idx % 4) * 0.04);
            rocks.setColorAt(idx, colorHelper);

            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            cacti.setMatrixAt(idx, dummy.matrix);
          } else {
            dummy.position.set(p.x, 2.2 * p.scale, p.z);
            dummy.scale.set(1.0 * p.scale, 4.4 * p.scale, 1.0 * p.scale);
            dummy.rotation.set(0, idx * 0.4, 0);
            dummy.updateMatrix();
            cacti.setMatrixAt(idx, dummy.matrix);

            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            rocks.setMatrixAt(idx, dummy.matrix);
          }
        },
      );
      break;
    }

    case 'harbor':
    case 'industrial':
    case 'stadium': {
      const lampColor = spec.propType === 'industrial' ? '#f59e0b' : '#38bdf8';
      const lampEmissive = spec.propType === 'industrial' ? 0xf59e0b : 0x38bdf8;
      buildDualInstancedProps(
        '#334155',
        lampColor,
        lampEmissive,
        (p, idx, blocks, lamps) => {
          if (idx % 3 === 0) {
            dummy.position.set(p.x, 2.2 * p.scale, p.z);
            dummy.scale.set(4.0, 4.4 * p.scale, 7.6);
            dummy.rotation.set(0, (idx * 0.8) % Math.PI, 0);
            dummy.updateMatrix();
            blocks.setMatrixAt(idx, dummy.matrix);
            const palette =
              spec.propType === 'industrial'
                ? [0x52525b, 0x78350f, 0x3f3f46, 0xb45309]
                : [0x0284c7, 0xd97706, 0xdc2626, 0x334155];
            colorHelper.setHex(palette[idx % palette.length]);
            blocks.setColorAt(idx, colorHelper);

            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            lamps.setMatrixAt(idx, dummy.matrix);
          } else {
            const towerH = spec.propType === 'stadium' ? 11 : 7.5;
            dummy.position.set(p.x, towerH * 0.5, p.z);
            dummy.scale.set(0.55, towerH, 0.55);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            blocks.setMatrixAt(idx, dummy.matrix);
            colorHelper.setHex(0x475569);
            blocks.setColorAt(idx, colorHelper);

            dummy.position.set(p.x, towerH + 0.35, p.z);
            dummy.scale.set(spec.propType === 'stadium' ? 2.4 : 1.2, 0.6, 1.2);
            dummy.updateMatrix();
            lamps.setMatrixAt(idx, dummy.matrix);
          }
        },
        0.6,
        0.3,
      );
      break;
    }

    case 'cybercity':
    case 'synthwave': {
      buildDualInstancedProps(
        '#0f172a',
        spec.propType === 'synthwave' ? '#d946ef' : '#22d3ee',
        spec.propType === 'synthwave' ? 0xd946ef : 0x22d3ee,
        (p, idx, towers, neons) => {
          const h = (8 + (idx % 5) * 4.5) * p.scale;
          const w = spec.propType === 'synthwave' ? 2.6 : 5.4;
          dummy.position.set(p.x, h * 0.5, p.z);
          dummy.scale.set(w, h, w);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          towers.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, h * 0.72, p.z);
          dummy.scale.set(w + 0.25, 1.1, w + 0.25);
          dummy.updateMatrix();
          neons.setMatrixAt(idx, dummy.matrix);
          colorHelper.setHex(idx % 2 === 0 ? 0x22d3ee : 0xec4899);
          neons.setColorAt(idx, colorHelper);
        },
        0.35,
        0.65,
      );
      break;
    }

    case 'glacier':
    case 'crystal': {
      const isCrystal = spec.propType === 'crystal';
      buildDualInstancedProps(
        isCrystal ? '#6d28d9' : '#bae6fd',
        isCrystal ? '#c084fc' : '#e0f2fe',
        isCrystal ? 0xa855f7 : 0,
        (p, idx, baseMesh, topMesh) => {
          const h = (4.5 + (idx % 4) * 2.2) * p.scale;
          dummy.position.set(p.x, h * 0.45, p.z);
          dummy.scale.set(3.2 * p.scale, h, 3.2 * p.scale);
          dummy.rotation.set(0.08 * ((idx % 3) - 1), idx * 0.6, 0.08);
          dummy.updateMatrix();
          baseMesh.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x + 1.1, h * 0.35, p.z - 0.8);
          dummy.scale.set(1.8 * p.scale, h * 0.75, 1.8 * p.scale);
          dummy.rotation.set(-0.1, idx * 0.4, -0.1);
          dummy.updateMatrix();
          topMesh.setMatrixAt(idx, dummy.matrix);

          if (isCrystal) {
            colorHelper.setHex(idx % 2 === 0 ? 0xa855f7 : 0x22d3ee);
            baseMesh.setColorAt(idx, colorHelper);
            topMesh.setColorAt(idx, colorHelper);
          }
        },
        0.25,
        0.35,
      );
      break;
    }

    case 'volcano': {
      buildDualInstancedProps(
        '#1c1917',
        '#f97316',
        0xea580c,
        (p, idx, rocks, magma) => {
          const h = (4 + (idx % 4) * 2.5) * p.scale;
          dummy.position.set(p.x, h * 0.5, p.z);
          dummy.scale.set(3.8 * p.scale, h, 3.8 * p.scale);
          dummy.rotation.set(0, idx * 0.5, 0);
          dummy.updateMatrix();
          rocks.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, 0.35, p.z);
          dummy.scale.set(5.2 * p.scale, 0.5, 5.2 * p.scale);
          dummy.rotation.set(0, idx * 0.3, 0);
          dummy.updateMatrix();
          magma.setMatrixAt(idx, dummy.matrix);
        },
        0.9,
        0.05,
      );
      break;
    }

    case 'tropical':
    case 'sunset': {
      buildDualInstancedProps(
        '#78350f',
        '#16a34a',
        0,
        (p, idx, trunks, crowns) => {
          const h = (5.5 + (idx % 3) * 1.6) * p.scale;
          dummy.position.set(p.x, h * 0.5, p.z);
          dummy.scale.set(0.75 * p.scale, h, 0.75 * p.scale);
          dummy.rotation.set(0.08, idx * 0.7, 0.05);
          dummy.updateMatrix();
          trunks.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, h + 0.4, p.z);
          dummy.scale.set(4.6 * p.scale, 1.3 * p.scale, 4.6 * p.scale);
          dummy.rotation.set(0, idx * 0.5, 0);
          dummy.updateMatrix();
          crowns.setMatrixAt(idx, dummy.matrix);
        },
      );
      break;
    }

    case 'egypt': {
      buildDualInstancedProps(
        '#ca8a04',
        '#fef08a',
        0,
        (p, idx, bases, caps) => {
          if (idx % 3 === 0) {
            // Stepped pyramid
            const s = 5.5 * p.scale;
            dummy.position.set(p.x, s * 0.45, p.z);
            dummy.scale.set(s * 1.6, s * 0.9, s * 1.6);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            bases.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(p.x, s * 1.1, p.z);
            dummy.scale.set(s * 0.85, s * 0.6, s * 0.85);
            dummy.updateMatrix();
            caps.setMatrixAt(idx, dummy.matrix);
          } else {
            // Obelisk pillar
            dummy.position.set(p.x, 4.0 * p.scale, p.z);
            dummy.scale.set(1.4 * p.scale, 8.0 * p.scale, 1.4 * p.scale);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            bases.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(p.x, 8.3 * p.scale, p.z);
            dummy.scale.set(0.95 * p.scale, 0.95 * p.scale, 0.95 * p.scale);
            dummy.updateMatrix();
            caps.setMatrixAt(idx, dummy.matrix);
          }
        },
      );
      break;
    }

    case 'space': {
      buildDualInstancedProps(
        '#64748b',
        '#38bdf8',
        0x0284c7,
        (p, idx, rocks, solar) => {
          if (idx % 2 === 0) {
            dummy.position.set(p.x, 1.5 * p.scale, p.z);
            dummy.scale.set(3.8 * p.scale, 3.0 * p.scale, 3.8 * p.scale);
            dummy.rotation.set(0, idx * 0.6, 0);
            dummy.updateMatrix();
            rocks.setMatrixAt(idx, dummy.matrix);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            solar.setMatrixAt(idx, dummy.matrix);
          } else {
            dummy.position.set(p.x, 2.5, p.z);
            dummy.scale.set(0.55, 5.0, 0.55);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            rocks.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(p.x, 5.4, p.z);
            dummy.scale.set(4.2, 0.25, 2.4);
            dummy.rotation.set(0.45, idx * 0.5, 0);
            dummy.updateMatrix();
            solar.setMatrixAt(idx, dummy.matrix);
          }
        },
        0.4,
        0.6,
      );
      break;
    }

    case 'castle': {
      buildDualInstancedProps(
        '#78716c',
        '#dc2626',
        0,
        (p, idx, stone, banners) => {
          const h = (6.2 + (idx % 3) * 2.0) * p.scale;
          dummy.position.set(p.x, h * 0.5, p.z);
          dummy.scale.set(3.2 * p.scale, h, 3.2 * p.scale);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          stone.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(p.x, h + 1.2, p.z);
          dummy.scale.set(0.9, 2.4, 0.25);
          dummy.rotation.set(0, idx * 0.7, 0);
          dummy.updateMatrix();
          banners.setMatrixAt(idx, dummy.matrix);
        },
      );
      break;
    }
  }

  // 6. Trackside Grandstands near Start/Finish
  const standMat = makeMat({ color: '#475569', roughness: 0.7 });
  const roofMat = makeMat({ color: spec.curbColorA, roughness: 0.5 });
  const standGroup = new THREE.Group();
  standGroup.position.copy(startSample.point);
  standGroup.rotation.y = startYaw;
  for (let tier = 0; tier < 3; tier++) {
    const tierMesh = new THREE.Mesh(boxGeo, standMat);
    tierMesh.scale.set(6, 1.2 + tier * 1.1, 28);
    tierMesh.position.set(-halfW - 10.5 - tier * 2.4, (1.2 + tier * 1.1) / 2, -18);
    tierMesh.castShadow = sunShadows;
    tierMesh.receiveShadow = sunShadows;
    standGroup.add(tierMesh);
  }
  const standRoof = new THREE.Mesh(boxGeo, roofMat);
  standRoof.scale.set(8.5, 0.45, 29);
  standRoof.position.set(-halfW - 13, 6.2, -18);
  standRoof.castShadow = sunShadows;
  standGroup.add(standRoof);
  group.add(standGroup);

  const dispose = () => {
    geosToDispose.forEach((g) => g.dispose());
    matsToDispose.forEach((m) => m.dispose());
  };

  return { group, dispose };
}
