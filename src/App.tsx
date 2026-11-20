import { useCallback, useEffect, useRef, useState } from 'react';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MainMenu } from './components/MainMenu';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RaceHUD } from './components/RaceHUD';
import { SettingsModal } from './components/SettingsModal';
import {
  CAR_MAP,
  getRaceRewardCoins,
  getRepairCostForCar,
  loadGarageProgress,
  saveGarageProgress,
} from './data/cars';
import { loadSettings, saveSettings } from './data/defaultSettings';
import { audioEngine } from './engine/audio';
import { GameViewport, TouchControlState } from './engine/GameViewport';
import { multiplayerClient, RoomSummary } from './services/multiplayer';
import {
  AllSettings,
  CarId,
  GarageProgress,
  LeaderboardEntry,
  RaceMode,
  RaceResultItem,
  RaceTelemetry,
  RoomInfo,
  TrackId,
} from './types/game';

const INITIAL_TEL: RaceTelemetry = {
  speedKmh: 0,
  gear: 1,
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 4,
  elapsedMs: 0,
  bestLapMs: null,
  lastLapMs: null,
  wrongWay: false,
  drifting: false,
  boostCharge: 0,
  hullHealth: 100,
  fps: 60,
  estimatedRamMb: 48,
};

export default function App() {
  const [settings, setSettings] = useState<AllSettings>(() => loadSettings());
  const [garage, setGarage] = useState<GarageProgress>(() => loadGarageProgress());
  const [phase, setPhase] = useState<'menu' | 'racing'>('menu');
  const [mode, setMode] = useState<RaceMode>('solo');
  const [selectedCar, setSelectedCar] = useState<CarId>('apex-gt1');
  const [inspectedCar, setInspectedCar] = useState<CarId>('apex-gt1');
  const [p2Car, setP2Car] = useState<CarId>('volt-x');
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('sunstone');
  const [paused, setPaused] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  // Real-time Multiplayer & Leaderboard State
  const [wsConnected, setWsConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomsList, setRoomsList] = useState<RoomSummary[]>([]);
  const [mpError, setMpError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Live Race HUD state
  const [p1Tel, setP1Tel] = useState<RaceTelemetry>(INITIAL_TEL);
  const [p2Tel, setP2Tel] = useState<RaceTelemetry | undefined>(undefined);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [results, setResults] = useState<RaceResultItem[] | null>(null);
  const [lastEarnedCoins, setLastEarnedCoins] = useState(0);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);
  const [raceInstanceSeed, setRaceInstanceSeed] = useState(0);
  const [liveFps, setLiveFps] = useState(60);
  const [liveRamMb, setLiveRamMb] = useState(48);

  const touchP1Ref = useRef<TouchControlState>({
    steer: 0,
    throttle: 0,
    brake: 0,
    drift: false,
    respawnPressed: false,
  });
  const touchP2Ref = useRef<TouchControlState>({
    steer: 0,
    throttle: 0,
    brake: 0,
    drift: false,
    respawnPressed: false,
  });

  // Sync audio, settings & garage progress whenever updated
  useEffect(() => {
    audioEngine.updateSettings(settings.audio);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveGarageProgress(garage);
  }, [garage]);

  // Subscribe to WebSocket multiplayer + live global leaderboard feed
  useEffect(() => {
    const unsub = multiplayerClient.subscribe((msg) => {
      setWsConnected(multiplayerClient.connected);
      if (msg.type === 'welcome') {
        setClientId(msg.clientId);
        setWsConnected(true);
      } else if (msg.type === 'room:list') {
        setRoomsList(msg.rooms);
      } else if (msg.type === 'room:state') {
        setRoom(msg.room);
        setMpError(null);
        if (msg.room.status === 'countdown' || msg.room.status === 'racing') {
          setSelectedTrack(msg.room.trackId);
          setMode('multiplayer');
          setShowMultiplayer(false);
          setResults(null);
          setLeaderboardSubmitted(false);
          setPaused(false);
          setPhase('racing');
        }
      } else if (msg.type === 'room:closed') {
        setRoom(null);
        setMpError(msg.reason);
      } else if (msg.type === 'leaderboard:all') {
        setLeaderboard(msg.entries);
      } else if (msg.type === 'leaderboard:updated') {
        setLeaderboard(msg.entries);
      } else if (msg.type === 'error') {
        setMpError(msg.message);
      }
    });

    // Support direct ?room=XXXX invite link for Local Host LAN / Online sharing
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('room');
    if (inviteCode && inviteCode.trim().length >= 3) {
      setShowMultiplayer(true);
      multiplayerClient.joinRoom({
        code: inviteCode.trim().toUpperCase(),
        playerName: settings.playerName,
        carId: selectedCar,
      });
    }

    return unsub;
  }, []);

  const handleStartRace = useCallback((nextMode: RaceMode) => {
    audioEngine.unlock();
    setMode(nextMode);
    setPaused(false);
    setResults(null);
    setLastEarnedCoins(0);
    setLeaderboardSubmitted(false);
    setRaceInstanceSeed((n) => n + 1);
    setPhase('racing');
  }, []);

  const handleRestartRace = useCallback(() => {
    setPaused(false);
    setResults(null);
    setLastEarnedCoins(0);
    setLeaderboardSubmitted(false);
    setPhase('menu');
    requestAnimationFrame(() => {
      setRaceInstanceSeed((n) => n + 1);
      setPhase('racing');
    });
  }, []);

  const handleExitToMenu = useCallback(() => {
    if (mode === 'multiplayer' && room) {
      multiplayerClient.leaveRoom();
      setRoom(null);
    }
    setPaused(false);
    setResults(null);
    setCountdownLabel(null);
    setInspectedCar(selectedCar);
    setPhase('menu');
  }, [mode, room, selectedCar]);

  const handleBuyCar = useCallback((carId: CarId) => {
    const spec = CAR_MAP[carId];
    if (!spec) return;
    setGarage((prev) => {
      if (prev.ownedCars.includes(carId) || prev.coins < spec.price) return prev;
      audioEngine.playLapChime(false);
      return {
        ...prev,
        coins: prev.coins - spec.price,
        ownedCars: [...prev.ownedCars, carId],
        carHealth: { ...prev.carHealth, [carId]: 100 },
      };
    });
    setSelectedCar(carId);
    setInspectedCar(carId);
  }, []);

  const handleRepairCar = useCallback((carId: CarId) => {
    setGarage((prev) => {
      const currentHp = prev.carHealth[carId] ?? 100;
      const cost = getRepairCostForCar(carId, currentHp);
      if (cost <= 0 || prev.coins < cost) return prev;
      audioEngine.playLapChime(false);
      return {
        ...prev,
        coins: prev.coins - cost,
        carHealth: { ...prev.carHealth, [carId]: 100 },
      };
    });
  }, []);

  const handleRaceFinish = useCallback(
    (raceResults: RaceResultItem[]) => {
      const p1Res = raceResults.find((r) => r.isLocalP1);
      const earned = p1Res
        ? getRaceRewardCoins(p1Res.position, raceResults.length, mode === 'multiplayer')
        : 0;
      setLastEarnedCoins(earned);
      setResults(raceResults);

      if (p1Res) {
        setGarage((prev) => ({
          ...prev,
          coins: prev.coins + earned,
          wins: p1Res.position === 1 ? prev.wins + 1 : prev.wins,
          carHealth: {
            ...prev.carHealth,
            [p1Res.carId]: Math.max(20, Math.min(100, p1Res.hullHealthRemaining)),
          },
        }));
      }
    },
    [mode],
  );

  const handleCycleCamera = useCallback(() => {
    const order = ['chase', 'far', 'hood'] as const;
    const idx = order.indexOf(settings.graphics.cameraMode);
    const nextCam = order[(idx + 1) % order.length];
    setSettings((prev) => ({
      ...prev,
      graphics: { ...prev.graphics, cameraMode: nextCam },
    }));
  }, [settings.graphics.cameraMode]);

  const handleTelemetry = useCallback((p1: RaceTelemetry, p2?: RaceTelemetry) => {
    setP1Tel(p1);
    setP2Tel(p2);
  }, []);

  const handleSubmitLeaderboard = useCallback(() => {
    if (!results || leaderboardSubmitted) return;
    const p1Result = results.find((r) => r.isLocalP1);
    if (!p1Result) return;

    const modeLabel =
      mode === 'multiplayer'
        ? room?.isLocalHost
          ? 'LAN Host'
          : 'Online'
        : mode === 'split-screen'
          ? 'Split-Screen'
          : 'Solo';

    multiplayerClient.submitLeaderboard({
      playerName: settings.playerName,
      carId: p1Result.carId,
      trackId: mode === 'multiplayer' && room ? room.trackId : selectedTrack,
      timeMs: p1Result.finishTimeMs,
      bestLapMs: p1Result.bestLapMs,
      mode: modeLabel,
    });
    setLeaderboardSubmitted(true);
  }, [results, leaderboardSubmitted, mode, room, settings.playerName, selectedTrack]);

  // Escape key pauses/resumes during race
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && phase === 'racing' && !results && !showSettings) {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, results, showSettings]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Live 3D Blocky WebGL Viewport */}
      <GameViewport
        phase={phase}
        mode={mode}
        selectedCar={phase === 'menu' ? inspectedCar : selectedCar}
        p2Car={p2Car}
        selectedTrack={selectedTrack}
        settings={settings}
        paused={paused}
        room={room}
        localClientId={clientId}
        raceInstanceSeed={raceInstanceSeed}
        initialP1Health={
          phase === 'menu'
            ? (garage.carHealth[inspectedCar] ?? 100)
            : (garage.carHealth[selectedCar] ?? 100)
        }
        touchP1Ref={touchP1Ref}
        touchP2Ref={touchP2Ref}
        onTelemetry={handleTelemetry}
        onCountdownChange={setCountdownLabel}
        onRaceFinish={handleRaceFinish}
        onFpsSample={(fps, ram) => {
          setLiveFps(fps);
          setLiveRamMb(ram);
        }}
      />

      {/* Main Menu Showroom Overlay */}
      {phase === 'menu' && (
        <MainMenu
          selectedCar={selectedCar}
          inspectedCar={inspectedCar}
          p2Car={p2Car}
          selectedTrack={selectedTrack}
          settings={settings}
          garage={garage}
          liveFps={liveFps}
          liveRamMb={liveRamMb}
          onInspectCar={setInspectedCar}
          onSelectCar={setSelectedCar}
          onBuyCar={handleBuyCar}
          onRepairCar={handleRepairCar}
          onSelectP2Car={setP2Car}
          onSelectTrack={setSelectedTrack}
          onStartRace={handleStartRace}
          onOpenMultiplayer={() => {
            setMpError(null);
            setShowMultiplayer(true);
          }}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Active Race HUD & Touch Controls */}
      {phase === 'racing' && (
        <RaceHUD
          mode={mode}
          trackId={mode === 'multiplayer' && room ? room.trackId : selectedTrack}
          settings={settings}
          p1Tel={p1Tel}
          p2Tel={p2Tel}
          countdownLabel={countdownLabel}
          paused={paused}
          results={results}
          lastEarnedCoins={lastEarnedCoins}
          leaderboardSubmitted={leaderboardSubmitted}
          touchP1Ref={touchP1Ref}
          touchP2Ref={touchP2Ref}
          onTogglePause={() => setPaused((p) => !p)}
          onCycleCamera={handleCycleCamera}
          onOpenSettings={() => setShowSettings(true)}
          onSubmitLeaderboard={handleSubmitLeaderboard}
          onRestartRace={handleRestartRace}
          onExitToMenu={handleExitToMenu}
        />
      )}

      {/* Modals */}
      {showMultiplayer && (
        <MultiplayerLobby
          playerName={settings.playerName}
          selectedCar={selectedCar}
          ownedCars={garage.ownedCars}
          selectedTrack={selectedTrack}
          room={room}
          roomsList={roomsList}
          localClientId={clientId}
          errorMsg={mpError}
          onSelectCar={(c) => {
            setSelectedCar(c);
            setInspectedCar(c);
          }}
          onClose={() => setShowMultiplayer(false)}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal
          entries={leaderboard}
          connected={wsConnected}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
