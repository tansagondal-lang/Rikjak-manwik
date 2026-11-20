import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAR_MAP } from '../data/cars';
import { getCompiledTrack } from '../data/tracks';
import { multiplayerClient } from '../services/multiplayer';
import {
  AllSettings,
  CarId,
  RaceMode,
  RaceResultItem,
  RaceTelemetry,
  RoomInfo,
  TrackId,
} from '../types/game';
import { audioEngine } from './audio';
import { buildBlockyCar, CarModelRig } from './carBuilder';
import {
  computeAiInput,
  createGridRacers,
  RacerBody,
  RacerInput,
  resolveCarCollisions,
  respawnRacerOnTrack,
  stepRacerPhysics,
} from './physics';
import { disposeCachedTextures } from './textures';
import { buildTrackEnvironment, BuiltTrackScene } from './trackBuilder';

export interface TouchControlState {
  steer: number; // -1..1
  throttle: number; // 0..1
  brake: number; // 0..1
  drift: boolean;
  respawnPressed: boolean;
}

export interface GameViewportProps {
  phase: 'menu' | 'racing';
  mode: RaceMode;
  selectedCar: CarId;
  p2Car: CarId;
  selectedTrack: TrackId;
  settings: AllSettings;
  paused: boolean;
  room: RoomInfo | null;
  localClientId: string | null;
  raceInstanceSeed: number;
  initialP1Health?: number;
  touchP1Ref: React.MutableRefObject<TouchControlState>;
  touchP2Ref: React.MutableRefObject<TouchControlState>;
  onTelemetry: (p1: RaceTelemetry, p2?: RaceTelemetry) => void;
  onCountdownChange: (label: string | null) => void;
  onRaceFinish: (results: RaceResultItem[]) => void;
  onFpsSample?: (fps: number, ramMb: number) => void;
}

// Module-scope reusable math helpers (zero per-frame GC pressure)
const _camDesiredPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camLookSmoothP1 = new THREE.Vector3();
const _camLookSmoothP2 = new THREE.Vector3();
const _dustDummy = new THREE.Object3D();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const GameViewport: React.FC<GameViewportProps> = ({
  phase,
  mode,
  selectedCar,
  p2Car,
  selectedTrack,
  settings,
  paused,
  room,
  localClientId,
  raceInstanceSeed,
  initialP1Health = 100,
  touchP1Ref,
  touchP2Ref,
  onTelemetry,
  onCountdownChange,
  onRaceFinish,
  onFpsSample,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  // Keep latest props in refs so the WebGL loop never tears down on UI updates
  const propsRef = useRef({
    phase,
    mode,
    selectedCar,
    p2Car,
    selectedTrack,
    settings,
    paused,
    room,
    localClientId,
    raceInstanceSeed,
    initialP1Health,
    onTelemetry,
    onCountdownChange,
    onRaceFinish,
    onFpsSample,
  });
  propsRef.current = {
    phase,
    mode,
    selectedCar,
    p2Car,
    selectedTrack,
    settings,
    paused,
    room,
    localClientId,
    raceInstanceSeed,
    initialP1Health,
    onTelemetry,
    onCountdownChange,
    onRaceFinish,
    onFpsSample,
  };

  // Track keyboard, tilt & mouse input states
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const tiltSteerRef = useRef<number>(0);
  const mouseSteerRef = useRef<number>(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      pressedKeysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code);
    };
    const onBlur = () => pressedKeysRef.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Optional gyroscope/tilt steering listener
  useEffect(() => {
    if (settings.controls.steeringMode !== 'tilt') {
      tiltSteerRef.current = 0;
      return;
    }
    const handler = (ev: DeviceOrientationEvent) => {
      const gamma = ev.gamma ?? 0; // -90..90
      const beta = ev.beta ?? 0;
      const isLandscape = window.innerWidth > window.innerHeight;
      const rawAngle = isLandscape ? beta : gamma;
      const norm = Math.max(-1, Math.min(1, -rawAngle / 32));
      const deadzone = propsRef.current.settings.controls.tiltDeadzone;
      tiltSteerRef.current = Math.abs(norm) < deadzone ? 0 : norm;
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [settings.controls.steeringMode]);

  // Optional PC Mouse steering listener
  useEffect(() => {
    if (settings.controls.steeringMode !== 'mouse') {
      mouseSteerRef.current = 0;
      return;
    }
    const onMove = (e: MouseEvent) => {
      const half = Math.max(1, window.innerWidth * 0.5);
      const norm = (half - e.clientX) / (half * 0.72);
      mouseSteerRef.current = Math.abs(norm) < 0.04 ? 0 : Math.max(-1, Math.min(1, norm));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.controls.steeringMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl && propsRef.current.settings.graphics.preset !== 'eco512',
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();

    // Procedural Studio Environment Map for authentic PBR reflections on cars (skipped in 512MB Eco)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    if (propsRef.current.settings.graphics.preset !== 'eco512') {
      scene.environment = envTex;
    }
    pmremGenerator.dispose();

    // Cameras (P1 + P2 for split-screen)
    const cam1 = new THREE.PerspectiveCamera(64, width / height, 0.3, 450);
    const cam2 = new THREE.PerspectiveCamera(64, width / height, 0.3, 450);

    // 3-Point Outdoor Lighting Rig (Warm Sun Key + Cool Hemisphere Sky Fill)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    sunLight.position.set(55, 95, 45);
    sunLight.castShadow = !isSoftwareGl && propsRef.current.settings.graphics.shadows !== 'off';
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 260;
    const d = 90;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Lightweight InstancedMesh Rear-Tire Drift Smoke Pool (1 draw call, zero allocations per frame)
    const DUST_COUNT = 72;
    const dustGeo = new THREE.BoxGeometry(0.65, 0.52, 0.65);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const dustMesh = new THREE.InstancedMesh(dustGeo, dustMat, DUST_COUNT);
    dustMesh.frustumCulled = false;
    for (let i = 0; i < DUST_COUNT; i++) {
      _dustDummy.position.set(0, -50, 0);
      _dustDummy.scale.setScalar(0.001);
      _dustDummy.updateMatrix();
      dustMesh.setMatrixAt(i, _dustDummy.matrix);
    }
    dustMesh.instanceMatrix.needsUpdate = true;
    scene.add(dustMesh);

    const _smokeColorDrift = new THREE.Color(0xf1f5f9);
    const _smokeColorBrake = new THREE.Color(0x64748b);
    const _smokeColorDirtyBrake = new THREE.Color(0x453221);
    const _smokeColorEngine = new THREE.Color(0x334155);

    const dustPool = Array.from({ length: DUST_COUNT }, () => ({
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vz: 0,
      life: 0,
      maxLife: 0.62,
      color: _smokeColorDrift,
    }));
    let dustCursor = 0;

    const spawnSmokePuff = (
      r: RacerBody,
      kind: 'drift' | 'brake' | 'damage',
    ) => {
      const fx = -Math.sin(r.yaw);
      const fz = -Math.cos(r.yaw);
      const rx = Math.cos(r.yaw);
      const rz = -Math.sin(r.yaw);

      if (kind === 'damage') {
        const p = dustPool[dustCursor];
        dustCursor = (dustCursor + 1) % DUST_COUNT;
        p.x = r.x + fx * 1.15 + (Math.random() - 0.5) * 0.45;
        p.y = 1.05 + Math.random() * 0.2;
        p.z = r.z + fz * 1.15 + (Math.random() - 0.5) * 0.45;
        p.vx = (Math.random() - 0.5) * 0.8;
        p.vz = (Math.random() - 0.5) * 0.8;
        p.maxLife = 0.72;
        p.life = p.maxLife;
        p.color = _smokeColorEngine;
        return;
      }

      const puffColor =
        kind === 'brake'
          ? r.hullHealth < 70
            ? _smokeColorDirtyBrake
            : _smokeColorBrake
          : _smokeColorDrift;

      // Spawn behind both rear tires
      for (let side = -1; side <= 1; side += 2) {
        const p = dustPool[dustCursor];
        dustCursor = (dustCursor + 1) % DUST_COUNT;
        p.x = r.x - fx * 1.45 + rx * side * 0.85 + (Math.random() - 0.5) * 0.25;
        p.y = 0.28 + Math.random() * 0.12;
        p.z = r.z - fz * 1.45 + rz * side * 0.85 + (Math.random() - 0.5) * 0.25;
        p.vx = rx * side * 1.2 - fx * 1.4 + (Math.random() - 0.5) * 0.8;
        p.vz = rz * side * 1.2 - fz * 1.4 + (Math.random() - 0.5) * 0.8;
        p.maxLife = kind === 'brake' ? 0.5 : 0.62;
        p.life = p.maxLife;
        p.color = puffColor;
      }
    };

    let appliedDpr = -1;
    let appliedShadowsSig = '';
    let appliedEco: boolean | null = null;
    let appliedSmokeVisible: boolean | null = null;
    let activeIsNight = false;

    // Dynamic Scene State
    let builtTrack: BuiltTrackScene | null = null;
    let activeTrackId: TrackId | null = null;
    let activeGfxSig = '';
    let showroomRig: CarModelRig | null = null;
    let showroomCarId: CarId | null = null;

    let racers: RacerBody[] = [];
    const racerRigs = new Map<string, CarModelRig>();
    let raceActiveKey = '';
    let raceStartElapsedMs = 0;
    let lastCountdownShown: string | null = null;
    let raceFinishedReported = false;
    let lastNetSyncAt = 0;
    let lastHudEmitAt = 0;
    let fpsFrames = 0;
    let fpsAccum = 0;
    let currentFps = 60;

    const getEffectiveTrackId = (): TrackId => {
      const { phase: ph, mode: md, selectedTrack: tId, room: rm } = propsRef.current;
      return ph === 'racing' && md === 'multiplayer' && rm ? rm.trackId : tId;
    };

    const applyGraphicsSettings = () => {
      const gfx = propsRef.current.settings.graphics;
      const eco = gfx.preset === 'eco512';
      const compiledTrack = getCompiledTrack(getEffectiveTrackId());
      activeIsNight = compiledTrack.spec.isNight;

      // Allow true 1.5x / 1.75x / 2.0x supersampling on desktop/mobile unless software WebGL
      const targetDpr = isSoftwareGl ? 1 : Math.min(2, gfx.pixelRatio);

      if (Math.abs(targetDpr - appliedDpr) > 0.01) {
        appliedDpr = targetDpr;
        renderer.setPixelRatio(targetDpr);
      }

      const shadowsSig = `${gfx.shadows}_${activeIsNight ? 'night' : 'day'}`;
      if (shadowsSig !== appliedShadowsSig) {
        appliedShadowsSig = shadowsSig;
        // Sun shadows only exist when sunlight is present (daytime tracks) and Shadows != off
        const enableShadows = !isSoftwareGl && !activeIsNight && gfx.shadows !== 'off';
        renderer.shadowMap.enabled = enableShadows;
        sunLight.castShadow = enableShadows;

        const mapSize =
          gfx.shadows === 'high' ? 2048 : gfx.shadows === 'simple' ? 512 : 1024;
        if (sunLight.shadow.mapSize.width !== mapSize) {
          sunLight.shadow.mapSize.set(mapSize, mapSize);
          if (sunLight.shadow.map) {
            sunLight.shadow.map.dispose();
            sunLight.shadow.map = null;
          }
        }

        renderer.shadowMap.type =
          gfx.shadows === 'simple'
            ? THREE.BasicShadowMap
            : gfx.shadows === 'medium'
              ? THREE.PCFShadowMap
              : THREE.PCFSoftShadowMap;
        renderer.shadowMap.needsUpdate = true;

        if (showroomRig) {
          showroomRig.setShadowsEnabled(enableShadows);
        }
        racerRigs.forEach((rig) => {
          rig.setShadowsEnabled(enableShadows);
        });
      }

      if (eco !== appliedEco) {
        appliedEco = eco;
        scene.environment = eco ? null : envTex;
      }

      const showSmokeMesh = gfx.particles || (gfx.brakingAnimation ?? true);
      if (showSmokeMesh !== appliedSmokeVisible) {
        appliedSmokeVisible = showSmokeMesh;
        dustMesh.visible = showSmokeMesh;
        if (!showSmokeMesh) {
          for (let i = 0; i < DUST_COUNT; i++) {
            dustPool[i].life = 0;
          }
        }
      }
    };
    applyGraphicsSettings();

    const clearRacers = () => {
      racerRigs.forEach((rig) => {
        scene.remove(rig.group);
        rig.dispose();
      });
      racerRigs.clear();
      racers = [];
    };

    const rebuildTrackIfNeeded = () => {
      const tId = getEffectiveTrackId();
      const { settings: st } = propsRef.current;
      const gfxSig = `${st.graphics.preset}_${st.graphics.shadows}_${st.graphics.viewDistance}`;
      if (activeTrackId === tId && activeGfxSig === gfxSig && builtTrack) {
        return;
      }

      if (builtTrack) {
        scene.remove(builtTrack.group);
        builtTrack.dispose();
        builtTrack = null;
      }

      const compiled = getCompiledTrack(tId);
      const spec = compiled.spec;
      scene.background = new THREE.Color(spec.skyColor);

      const farDist =
        st.graphics.viewDistance === 'short'
          ? 210
          : st.graphics.viewDistance === 'medium'
            ? 340
            : 520;
      scene.fog = new THREE.Fog(spec.fogColor, farDist * 0.38, farDist);
      cam1.far = farDist + 60;
      cam2.far = farDist + 60;
      cam1.updateProjectionMatrix();
      cam2.updateProjectionMatrix();

      if (spec.isNight) {
        // Night harbor relies on floodlight ambient fill — no daytime sunlight or sun shadows
        hemiLight.intensity = 0.78;
        sunLight.intensity = 0.28;
        sunLight.color.setHex(0x93c5fd);
      } else {
        hemiLight.intensity = 0.85;
        sunLight.intensity = 1.45;
        sunLight.color.setHex(0xfffbeb);
      }

      builtTrack = buildTrackEnvironment(compiled, st.graphics);
      scene.add(builtTrack.group);
      activeTrackId = tId;
      activeGfxSig = gfxSig;

      // Force showroom car rebuild if eco mode changed
      if (showroomRig) {
        scene.remove(showroomRig.group);
        showroomRig.dispose();
        showroomRig = null;
        showroomCarId = null;
      }
    };

    const rebuildShowroomCarIfNeeded = () => {
      const { selectedCar: cId, settings: st } = propsRef.current;
      if (showroomRig && showroomCarId === cId) return;

      if (showroomRig) {
        scene.remove(showroomRig.group);
        showroomRig.dispose();
        showroomRig = null;
      }

      const compiled = getCompiledTrack(propsRef.current.selectedTrack);
      const eco = st.graphics.preset === 'eco512';
      const cast = !isSoftwareGl && !compiled.spec.isNight && st.graphics.shadows !== 'off';
      showroomRig = buildBlockyCar(cId, eco, cast);
      const start = compiled.samples[0];
      showroomRig.group.position.set(start.point.x, 0, start.point.z);
      showroomRig.group.rotation.y = Math.atan2(-start.tangent.x, -start.tangent.z);
      scene.add(showroomRig.group);
      showroomCarId = cId;
    };

    const setupRaceIfNeeded = () => {
      const { phase: ph, mode: md, selectedCar: c1, p2Car: c2, selectedTrack: tId, room: rm, localClientId: myId, raceInstanceSeed: seed, settings: st } =
        propsRef.current;

      if (ph !== 'racing') {
        if (racers.length > 0) {
          clearRacers();
          raceActiveKey = '';
          audioEngine.setEngineRunning(false);
          propsRef.current.onCountdownChange(null);
        }
        return;
      }

      // Remove showroom car during active race
      if (showroomRig) {
        scene.remove(showroomRig.group);
        showroomRig.dispose();
        showroomRig = null;
        showroomCarId = null;
      }

      const targetTrackId = md === 'multiplayer' && rm ? rm.trackId : tId;
      const key =
        md === 'multiplayer' && rm
          ? `mp_${rm.code}_${rm.raceStartAt}_${targetTrackId}_${seed}`
          : `${md}_${c1}_${c2}_${targetTrackId}_${seed}`;

      if (raceActiveKey === key && racers.length > 0) return;

      clearRacers();
      raceActiveKey = key;
      raceStartElapsedMs = 0;
      lastCountdownShown = null;
      raceFinishedReported = false;

      const compiled = getCompiledTrack(targetTrackId);
      const roster: Array<{
        id: string;
        name: string;
        carId: CarId;
        isHuman: boolean;
        isLocalP1?: boolean;
        isLocalP2?: boolean;
        initialHealth?: number;
        aiPaceFactor?: number;
      }> = [];

      if (md === 'multiplayer' && rm) {
        rm.players.forEach((p) => {
          const isMe = p.id === myId;
          roster.push({
            id: p.id,
            name: p.name,
            carId: p.carId,
            isHuman: true,
            isLocalP1: isMe,
            initialHealth: isMe ? propsRef.current.initialP1Health : 100,
          });
        });
        if (rm.fillWithAi) {
          const aiPool: CarId[] = ['volt-x', 'drift-86', 'trailblazer', 'titan', 'rally-evo', 'neon-blade'];
          for (let i = roster.length; i < 4; i++) {
            roster.push({
              id: `ai-${i}`,
              name: `Bot ${i}`,
              carId: aiPool[i % aiPool.length],
              isHuman: false,
              aiPaceFactor: 0.78 + (i % 3) * 0.06,
            });
          }
        }
      } else if (md === 'split-screen') {
        roster.push({
          id: 'p1',
          name: `${st.playerName} (P1)`,
          carId: c1,
          isHuman: true,
          isLocalP1: true,
          initialHealth: propsRef.current.initialP1Health,
        });
        roster.push({
          id: 'p2',
          name: 'Player 2',
          carId: c2,
          isHuman: true,
          isLocalP2: true,
        });
        const aiPool: CarId[] = ['volt-x', 'trailblazer', 'titan', 'rally-evo'];
        for (let i = 0; i < 2; i++) {
          roster.push({
            id: `ai-${i}`,
            name: `Bot ${i + 1}`,
            carId: aiPool[i % aiPool.length],
            isHuman: false,
            aiPaceFactor: 0.8 + i * 0.05,
          });
        }
      } else {
        roster.push({
          id: 'p1',
          name: st.playerName,
          carId: c1,
          isHuman: true,
          isLocalP1: true,
          initialHealth: propsRef.current.initialP1Health,
        });
        const aiNames = ['K.Sato', 'M.Rossi', 'A.Vance', 'L.Chen'];
        const aiCars: CarId[] = ['volt-x', 'drift-86', 'trailblazer', 'titan', 'rally-evo', 'neon-blade'].filter(
          (id) => id !== c1,
        ) as CarId[];
        for (let i = 0; i < 3; i++) {
          roster.push({
            id: `ai-${i}`,
            name: aiNames[i],
            carId: aiCars[i % aiCars.length],
            isHuman: false,
            aiPaceFactor: 0.78 + i * 0.065,
          });
        }
      }

      racers = createGridRacers(compiled, roster);
      const eco = st.graphics.preset === 'eco512';
      const cast = !isSoftwareGl && !compiled.spec.isNight && st.graphics.shadows !== 'off';

      racers.forEach((r) => {
        const rig = buildBlockyCar(r.carId, eco, cast);
        rig.group.position.set(r.x, 0, r.z);
        rig.group.rotation.y = r.yaw;
        scene.add(rig.group);
        racerRigs.set(r.id, rig);
      });

      // Position camera behind P1 immediately so there is no snap
      const p1 = racers.find((r) => r.isLocalP1);
      if (p1) {
        const backX = Math.sin(p1.yaw) * 9.5;
        const backZ = Math.cos(p1.yaw) * 9.5;
        cam1.position.set(p1.x + backX, 4.4, p1.z + backZ);
        _camLookSmoothP1.set(p1.x, 1.2, p1.z);
        cam1.lookAt(_camLookSmoothP1);
      }
      const p2 = racers.find((r) => r.isLocalP2);
      if (p2) {
        const backX = Math.sin(p2.yaw) * 9.5;
        const backZ = Math.cos(p2.yaw) * 9.5;
        cam2.position.set(p2.x + backX, 4.4, p2.z + backZ);
        _camLookSmoothP2.set(p2.x, 1.2, p2.z);
        cam2.lookAt(_camLookSmoothP2);
      }

      audioEngine.unlock();
      audioEngine.setEngineRunning(true);
    };

    const readHumanInput = (isP2: boolean): RacerInput => {
      const { controls } = propsRef.current.settings;
      const keys = pressedKeysRef.current;
      const bindings = isP2 ? controls.p2Keys : controls.p1Keys;
      const touch = isP2 ? touchP2Ref.current : touchP1Ref.current;

      let steer = 0;
      if (keys.has(bindings.steerLeft)) steer += 1;
      if (keys.has(bindings.steerRight)) steer -= 1;

      if (!isP2 && controls.steeringMode === 'tilt') {
        steer += tiltSteerRef.current;
      } else if (!isP2 && controls.steeringMode === 'mouse') {
        steer += mouseSteerRef.current;
      }
      steer += touch.steer;

      let throttle = keys.has(bindings.accelerate) ? 1 : touch.throttle;
      let brake = keys.has(bindings.brake) ? 1 : touch.brake;
      let drift = keys.has(bindings.drift) || touch.drift;

      // Optional USB / Bluetooth Gamepad support for P1 (or P2 if second pad attached)
      if (controls.gamepadEnabled && typeof navigator !== 'undefined' && navigator.getGamepads) {
        const pads = navigator.getGamepads();
        const pad = pads[isP2 ? 1 : 0];
        if (pad) {
          const axisX = pad.axes[0] ?? 0;
          if (Math.abs(axisX) > 0.12) steer -= axisX;
          const rt = pad.buttons[7]?.value ?? 0;
          const lt = pad.buttons[6]?.value ?? 0;
          if (rt > 0.08) throttle = Math.max(throttle, rt);
          if (pad.buttons[0]?.pressed) throttle = 1;
          if (lt > 0.08) brake = Math.max(brake, lt);
          if (pad.buttons[2]?.pressed || pad.buttons[1]?.pressed) brake = 1;
          if (pad.buttons[4]?.pressed || pad.buttons[5]?.pressed) drift = true;
        }
      }

      steer = Math.max(-1, Math.min(1, steer));
      if (controls.accelerationMode === 'auto' && !isP2 && brake < 0.2) {
        throttle = Math.max(throttle, 1);
      }

      return { throttle, brake, steer, drift };
    };

    const updateCameraForRacer = (
      cam: THREE.PerspectiveCamera,
      lookSmooth: THREE.Vector3,
      racer: RacerBody,
      dt: number,
    ) => {
      const { graphics, controls } = propsRef.current.settings;
      const modeCam = graphics.cameraMode;
      const fx = -Math.sin(racer.yaw);
      const fz = -Math.cos(racer.yaw);

      const speedNorm = Math.min(1, racer.speed / 80);
      const raceAnim = graphics.raceAnimation ?? true;
      const targetFov = modeCam === 'hood'
        ? 72 + (raceAnim ? speedNorm * 10 : 0)
        : 62 + (raceAnim ? speedNorm * 14 : 0);
      cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 7, dt);
      cam.updateProjectionMatrix();

      if (modeCam === 'hood') {
        _camDesiredPos.set(racer.x + fx * 0.4, 1.85, racer.z + fz * 0.4);
        cam.position.lerp(_camDesiredPos, Math.min(1, dt * 18));
        _camLookTarget.set(racer.x + fx * 22, 1.3, racer.z + fz * 22);
        lookSmooth.lerp(_camLookTarget, Math.min(1, dt * 18));
        cam.lookAt(lookSmooth);
      } else {
        const dist = modeCam === 'far' ? 12.2 : 8.6;
        const heightOffset = modeCam === 'far' ? 5.4 : 3.9;
        const shake =
          raceAnim && !controls.reducedShake && racer.drifting
            ? (Math.random() - 0.5) * 0.08
            : 0;

        _camDesiredPos.set(
          racer.x - fx * dist + shake,
          heightOffset + shake * 0.5,
          racer.z - fz * dist,
        );
        const dampLambda = 1 - Math.exp(-9.5 * dt);
        cam.position.lerp(_camDesiredPos, dampLambda);
        _camLookTarget.set(racer.x + fx * 6, 1.35, racer.z + fz * 6);
        lookSmooth.lerp(_camLookTarget, 1 - Math.exp(-12 * dt));
        cam.lookAt(lookSmooth);
      }
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      applyGraphicsSettings();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Pre-warm shaders once when not on software WebGL
    rebuildTrackIfNeeded();
    rebuildShowroomCarIfNeeded();
    if (!isSoftwareGl) {
      renderer.compile(scene, cam1);
    }

    let frameId = 0;
    let lastTime = performance.now();
    let showroomOrbitAngle = 0.6;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.ALREADY_SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = (nowMs?: number) => {
      const now = typeof nowMs === 'number' ? nowMs : performance.now();
      const rawDt = (now - lastTime) / 1000;
      const targetFps = propsRef.current.settings.graphics.targetFps ?? 0;

      // Enforce custom FPS cap (0 = native/unlimited); 2.5ms tolerance prevents jitter drops on 60Hz screens
      if (!isSoftwareGl && targetFps > 0 && rawDt * 1000 < 1000 / targetFps - 2.5) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      lastTime = now;
      const dt = Math.min(0.25, Math.max(0.001, rawDt));

      fpsFrames++;
      fpsAccum += rawDt;
      if (fpsAccum >= 0.5) {
        currentFps = Math.round(fpsFrames / fpsAccum);
        fpsFrames = 0;
        fpsAccum = 0;
        const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const estRamMb = perfMem
          ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024))
          : propsRef.current.settings.graphics.preset === 'eco512'
            ? 42
            : 68;
        propsRef.current.onFpsSample?.(currentFps, estRamMb);
      }

      applyGraphicsSettings();
      rebuildTrackIfNeeded();
      setupRaceIfNeeded();

      const { phase: ph, mode: md, paused: isPaused, room: rm, settings: st } = propsRef.current;

      if (ph === 'menu') {
        rebuildShowroomCarIfNeeded();
        if (showroomRig) {
          const showBrakeAnim = st.graphics.brakingAnimation ?? true;
          showroomRig.setCondition(propsRef.current.initialP1Health ?? 100, showBrakeAnim);
          showroomRig.setBrakingGlow(0, showBrakeAnim);
          showroomOrbitAngle += dt * 0.42;
          const base = showroomRig.group.position;
          const r = 7.4;
          cam1.fov = 52;
          cam1.aspect =
            (container.clientWidth || window.innerWidth) /
            Math.max(1, container.clientHeight || window.innerHeight);
          cam1.updateProjectionMatrix();
          cam1.position.set(
            base.x + Math.cos(showroomOrbitAngle) * r,
            2.95,
            base.z + Math.sin(showroomOrbitAngle) * r,
          );
          cam1.lookAt(base.x, 1.0, base.z);
          sunLight.target.position.copy(base);
          sunLight.position.set(base.x + 40, 75, base.z + 35);
        }

        renderer.setScissorTest(false);
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, cam1);
      } else {
        // Active Race Loop
        const targetTrackId = md === 'multiplayer' && rm ? rm.trackId : propsRef.current.selectedTrack;
        const compiled = getCompiledTrack(targetTrackId);

        if (!isPaused) {
          raceStartElapsedMs += dt * 1000;

          // 3.2 second countdown phase
          const countdownRemaining = 3.2 - raceStartElapsedMs / 1000;
          let cdLabel: string | null = null;
          if (countdownRemaining > 2.2) cdLabel = '3';
          else if (countdownRemaining > 1.2) cdLabel = '2';
          else if (countdownRemaining > 0.2) cdLabel = '1';
          else if (countdownRemaining > -0.75) cdLabel = 'GO!';

          if (cdLabel !== lastCountdownShown) {
            lastCountdownShown = cdLabel;
            propsRef.current.onCountdownChange(cdLabel);
            if (cdLabel === '3' || cdLabel === '2' || cdLabel === '1') {
              audioEngine.playCountdownBeep(false);
            } else if (cdLabel === 'GO!') {
              audioEngine.playCountdownBeep(true);
            }
          }

          const canDrive = countdownRemaining <= 0.2;
          const raceTimeMs = Math.max(0, raceStartElapsedMs - 3000);

          // Sync incoming remote player targets if in multiplayer
          if (md === 'multiplayer' && rm) {
            rm.players.forEach((np) => {
              const targetRacer = racers.find((r) => r.id === np.id && !r.isLocalP1);
              if (targetRacer) {
                targetRacer.targetX = np.x;
                targetRacer.targetZ = np.z;
                targetRacer.targetYaw = np.yaw;
                targetRacer.targetSpeed = np.speed;
                targetRacer.steerVisual = np.steerAngle;
                targetRacer.lap = np.lap;
                targetRacer.progress = np.progress;
                targetRacer.finished = np.finished;
                targetRacer.finishTimeMs = np.finishTimeMs;
              }
            });
          }

          const keys = pressedKeysRef.current;

          racers.forEach((r) => {
            if (r.isLocalP1 || r.isLocalP2) {
              const isP2 = Boolean(r.isLocalP2);
              const bindings = isP2 ? st.controls.p2Keys : st.controls.p1Keys;
              const touch = isP2 ? touchP2Ref.current : touchP1Ref.current;

              if (keys.has(bindings.respawn) || touch.respawnPressed) {
                respawnRacerOnTrack(r, compiled);
                touch.respawnPressed = false;
              }

              const input = canDrive
                ? r.finished
                  ? computeAiInput(r, compiled)
                  : readHumanInput(isP2)
                : { throttle: 0, brake: 0, steer: 0, drift: false };

              const subSteps = Math.max(1, Math.ceil(dt / 0.04));
              const subDt = dt / subSteps;
              for (let stepIdx = 0; stepIdx < subSteps; stepIdx++) {
                stepRacerPhysics(
                  r,
                  input,
                  compiled,
                  subDt,
                  raceTimeMs,
                  st.controls.steeringSensitivity,
                  (strength) => {
                    if (r.isLocalP1) audioEngine.playBump(strength);
                  },
                  (finishedRacer, isFinal) => {
                    if (finishedRacer.isLocalP1 || finishedRacer.isLocalP2) {
                      audioEngine.playLapChime(isFinal);
                    }
                  },
                );
              }

              const allowDriftSmoke = st.graphics.particles;
              const allowBrakeAnim = st.graphics.brakingAnimation ?? true;

              if (allowDriftSmoke && r.drifting && r.speed > 18 && Math.random() < 0.72) {
                spawnSmokePuff(r, 'drift');
              }
              if (allowBrakeAnim && r.braking > 0.1 && r.speed > 6 && Math.random() < 0.72) {
                spawnSmokePuff(r, 'brake');
              }
              if (
                allowBrakeAnim &&
                r.hullHealth < 60 &&
                r.speed > 8 &&
                Math.random() < 0.25
              ) {
                spawnSmokePuff(r, 'damage');
              }
            } else if (!r.isHuman) {
              const aiInput = canDrive
                ? computeAiInput(r, compiled)
                : { throttle: 0, brake: 0, steer: 0, drift: false };
              const subSteps = Math.max(1, Math.ceil(dt / 0.04));
              const subDt = dt / subSteps;
              for (let stepIdx = 0; stepIdx < subSteps; stepIdx++) {
                stepRacerPhysics(r, aiInput, compiled, subDt, raceTimeMs, 1.0);
              }
              if (st.graphics.particles && r.drifting && r.speed > 24 && Math.random() < 0.35) {
                spawnSmokePuff(r, 'drift');
              }
              if ((st.graphics.brakingAnimation ?? true) && r.braking > 0.25 && r.speed > 12 && Math.random() < 0.35) {
                spawnSmokePuff(r, 'brake');
              }
            } else if (r.targetX !== undefined && r.targetZ !== undefined && r.targetYaw !== undefined) {
              // Smooth remote multiplayer car interpolation
              const alpha = 1 - Math.exp(-14 * dt);
              r.x = THREE.MathUtils.lerp(r.x, r.targetX, alpha);
              r.z = THREE.MathUtils.lerp(r.z, r.targetZ, alpha);
              let dy = r.targetYaw - r.yaw;
              while (dy > Math.PI) dy -= Math.PI * 2;
              while (dy < -Math.PI) dy += Math.PI * 2;
              r.yaw += dy * alpha;
              r.speed = r.targetSpeed ?? 0;
              r.wheelSpin += r.speed * dt * 1.4;
            }
          });

          if (canDrive) {
            resolveCarCollisions(racers, (r, strength) => {
              if (r.isLocalP1) audioEngine.playBump(strength);
            });
          }

          const raceAnimOn = st.graphics.raceAnimation ?? true;
          const brakeAnimOn = st.graphics.brakingAnimation ?? true;

          // Update 3D car rigs from physics bodies (including dirt condition, race & braking animations)
          racers.forEach((r) => {
            const rig = racerRigs.get(r.id);
            if (!rig) return;
            rig.group.position.set(r.x, 0, r.z);
            rig.group.rotation.y = r.yaw;
            rig.setCondition(r.hullHealth, brakeAnimOn);
            rig.setBrakingGlow(r.braking, brakeAnimOn);

            const targetRoll = raceAnimOn
              ? -r.steerVisual * 0.135 * Math.min(1, r.speed / 38)
              : 0;
            // Nose-dive forward (-X pitch) when brakingAnimation is ON, subtle rear squat (+X pitch) on throttle when raceAnimation is ON
            const targetPitch =
              brakeAnimOn && r.braking > 0.1 && r.speed > 4
                ? -0.115 * r.braking * Math.min(1, r.speed / 24)
                : raceAnimOn && r.throttleApplied > 0.1
                  ? 0.045 * r.throttleApplied
                  : 0;

            rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
              rig.bodyGroup.rotation.z,
              targetRoll,
              10,
              dt,
            );
            rig.bodyGroup.rotation.x = THREE.MathUtils.damp(
              rig.bodyGroup.rotation.x,
              targetPitch,
              12,
              dt,
            );

            rig.frontLeftPivot.rotation.y = raceAnimOn ? r.steerVisual : 0;
            rig.frontRightPivot.rotation.y = raceAnimOn ? r.steerVisual : 0;
            rig.wheelMeshes.forEach((wm) => {
              wm.rotation.x = raceAnimOn ? -r.wheelSpin : 0;
            });
          });

          // Update drift, braking & damaged-car smoke pool
          if (st.graphics.particles || brakeAnimOn) {
            let anySmokeActive = false;
            for (let i = 0; i < DUST_COUNT; i++) {
              const p = dustPool[i];
              if (p.life > 0) {
                anySmokeActive = true;
                p.life -= dt;
                p.x += p.vx * dt;
                p.z += p.vz * dt;
                p.y += dt * 2.1;
                const progress = 1 - Math.max(0, p.life / p.maxLife);
                // Expand quickly into blocky smoke puff then shrink cleanly
                const s =
                  progress < 0.35
                    ? 0.65 + (progress / 0.35) * 1.15
                    : Math.max(0.01, (1 - (progress - 0.35) / 0.65) * 1.8);
                _dustDummy.position.set(p.x, p.y, p.z);
                _dustDummy.scale.setScalar(s);
                dustMesh.setColorAt(i, p.color);
              } else {
                _dustDummy.position.set(0, -50, 0);
                _dustDummy.scale.setScalar(0.001);
              }
              _dustDummy.updateMatrix();
              dustMesh.setMatrixAt(i, _dustDummy.matrix);
            }
            if (anySmokeActive) {
              dustMesh.instanceMatrix.needsUpdate = true;
              if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
            }
          }

          // Update audio engine from P1
          const p1 = racers.find((r) => r.isLocalP1);
          if (p1) {
            const spec = CAR_MAP[p1.carId] ?? CAR_MAP['apex-gt1'];
            audioEngine.updateEngine(p1.speed / spec.topSpeed, p1.drifting);
            sunLight.target.position.set(p1.x, 0, p1.z);
            sunLight.position.set(p1.x + 55, 95, p1.z + 45);
          }

          // Network 20Hz state push in multiplayer
          if (md === 'multiplayer' && p1 && now - lastNetSyncAt > 50) {
            lastNetSyncAt = now;
            multiplayerClient.sendRaceState({
              x: p1.x,
              y: 0,
              z: p1.z,
              yaw: p1.yaw,
              speed: p1.speed,
              steerAngle: p1.steerVisual,
              lap: p1.lap,
              checkpoint: p1.furthestCheckpoint,
              progress: p1.progress,
              finished: p1.finished,
              finishTimeMs: p1.finishTimeMs,
            });
          }

          // Emit HUD Telemetry ~15Hz so React UI never causes GC churn on low-end phones
          if (now - lastHudEmitAt > 66) {
            lastHudEmitAt = now;
            const sorted = [...racers].sort((a, b) => {
              if (a.finished && b.finished) {
                return (a.finishTimeMs ?? 9e9) - (b.finishTimeMs ?? 9e9);
              }
              if (a.finished) return -1;
              if (b.finished) return 1;
              return b.progress - a.progress;
            });

            const minimapDots = racers.map((rc) => ({
              id: rc.id,
              x: rc.x,
              z: rc.z,
              yaw: rc.yaw,
              isP1: rc.isLocalP1,
              isP2: rc.isLocalP2,
            }));

            const buildTel = (r: RacerBody): RaceTelemetry => {
              const pos = sorted.findIndex((x) => x.id === r.id) + 1;
              const kmh = Math.round(r.speed * 3.1);
              const gear = kmh < 5 ? 1 : Math.min(6, Math.floor(kmh / 38) + 1);
              const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
              const estRamMb = perfMem
                ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024))
                : st.graphics.preset === 'eco512'
                  ? 42
                  : 68;
              return {
                speedKmh: kmh,
                gear,
                lap: Math.min(r.lap, compiled.spec.laps),
                totalLaps: compiled.spec.laps,
                position: pos,
                totalRacers: racers.length,
                elapsedMs: raceTimeMs,
                bestLapMs: r.bestLapMs,
                lastLapMs: r.lastLapMs,
                wrongWay: r.wrongWay,
                drifting: r.drifting,
                boostCharge: r.boostCharge,
                hullHealth: Math.round(r.hullHealth),
                fps: currentFps,
                estimatedRamMb: estRamMb,
                minimapDots: r.isLocalP1 ? minimapDots : undefined,
              };
            };

            const p2 = racers.find((r) => r.isLocalP2);
            if (p1) {
              propsRef.current.onTelemetry(buildTel(p1), p2 ? buildTel(p2) : undefined);
            }

            // Check if all local human players finished
            const localHumans = racers.filter((r) => r.isLocalP1 || r.isLocalP2);
            if (
              !raceFinishedReported &&
              localHumans.length > 0 &&
              localHumans.every((r) => r.finished)
            ) {
              raceFinishedReported = true;
              const results: RaceResultItem[] = sorted.map((r, idx) => ({
                id: r.id,
                name: r.name,
                carId: r.carId,
                isHuman: r.isHuman,
                isLocalP1: r.isLocalP1,
                isLocalP2: r.isLocalP2,
                position: idx + 1,
                finishTimeMs:
                  r.finishTimeMs ??
                  Math.round(raceTimeMs + Math.max(1, compiled.spec.laps - r.progress) * 14000),
                bestLapMs: r.bestLapMs ?? Math.round(raceTimeMs / compiled.spec.laps),
                hullHealthRemaining: Math.round(r.hullHealth),
              }));
              propsRef.current.onRaceFinish(results);
            }
          }
        }

        // Render Single or Split-Screen Viewport
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        const p1 = racers.find((r) => r.isLocalP1);
        const p2 = racers.find((r) => r.isLocalP2);

        if (md === 'split-screen' && p1 && p2) {
          renderer.setScissorTest(true);
          const isWide = w >= h;
          if (isWide) {
            const halfW = Math.floor(w / 2);
            cam1.aspect = halfW / Math.max(1, h);
            cam2.aspect = halfW / Math.max(1, h);
            updateCameraForRacer(cam1, _camLookSmoothP1, p1, dt);
            updateCameraForRacer(cam2, _camLookSmoothP2, p2, dt);

            renderer.setViewport(0, 0, halfW, h);
            renderer.setScissor(0, 0, halfW, h);
            renderer.render(scene, cam1);

            renderer.setViewport(halfW, 0, w - halfW, h);
            renderer.setScissor(halfW, 0, w - halfW, h);
            renderer.render(scene, cam2);
          } else {
            const halfH = Math.floor(h / 2);
            cam1.aspect = w / Math.max(1, halfH);
            cam2.aspect = w / Math.max(1, halfH);
            updateCameraForRacer(cam1, _camLookSmoothP1, p1, dt);
            updateCameraForRacer(cam2, _camLookSmoothP2, p2, dt);

            // Top half: Player 1 (WebGL Y=0 is bottom)
            renderer.setViewport(0, halfH, w, h - halfH);
            renderer.setScissor(0, halfH, w, h - halfH);
            renderer.render(scene, cam1);

            // Bottom half: Player 2
            renderer.setViewport(0, 0, w, halfH);
            renderer.setScissor(0, 0, w, halfH);
            renderer.render(scene, cam2);
          }
        } else if (p1) {
          renderer.setScissorTest(false);
          cam1.aspect = w / Math.max(1, h);
          updateCameraForRacer(cam1, _camLookSmoothP1, p1, dt);
          renderer.setViewport(0, 0, w, h);
          renderer.render(scene, cam1);
        }
      }

      if (isSoftwareGl) {
        afterDraw(() => tick());
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(() => tick());
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      clearRacers();
      if (showroomRig) {
        scene.remove(showroomRig.group);
        showroomRig.dispose();
      }
      if (builtTrack) {
        scene.remove(builtTrack.group);
        builtTrack.dispose();
      }
      dustGeo.dispose();
      dustMat.dispose();
      envTex.dispose();
      disposeCachedTextures();
      audioEngine.setEngineRunning(false);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [touchP1Ref, touchP2Ref]);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md text-center space-y-3 bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="font-display text-xl font-bold text-amber-400">
            Graphics Context Interrupted
          </h2>
          <p className="text-sm text-slate-400">
            Your device freed WebGL memory. Tap reload or switch to 512MB Eco preset in Settings.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            Reload Viewport
          </button>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full bg-slate-950 touch-none" />;
};
