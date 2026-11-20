import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Lock,
  Play,
  Settings,
  ShoppingCart,
  SplitSquareHorizontal,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { CARS, CAR_MAP, getRepairCostForCar } from '../data/cars';
import { getTrackLengthKm, TRACKS, TRACK_MAP } from '../data/tracks';
import { getHealthAbilityFactor } from '../engine/physics';
import { PWAInstallButton } from './PWAInstallButton';
import {
  AllSettings,
  CarId,
  GarageProgress,
  RaceMode,
  TrackId,
} from '../types/game';

interface MainMenuProps {
  selectedCar: CarId;
  inspectedCar: CarId;
  p2Car: CarId;
  selectedTrack: TrackId;
  settings: AllSettings;
  garage: GarageProgress;
  liveFps: number;
  liveRamMb: number;
  onInspectCar: (car: CarId) => void;
  onSelectCar: (car: CarId) => void;
  onBuyCar: (car: CarId) => void;
  onRepairCar: (car: CarId) => void;
  onSelectP2Car: (car: CarId) => void;
  onSelectTrack: (track: TrackId) => void;
  onStartRace: (mode: RaceMode) => void;
  onOpenMultiplayer: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  selectedCar,
  inspectedCar,
  p2Car,
  selectedTrack,
  settings,
  garage,
  liveFps,
  liveRamMb,
  onInspectCar,
  onSelectCar,
  onBuyCar,
  onRepairCar,
  onSelectP2Car,
  onSelectTrack,
  onStartRace,
  onOpenMultiplayer,
  onOpenLeaderboard,
  onOpenSettings,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'cars' | 'tracks'>('cars');
  const [carFilter, setCarFilter] = useState<'all' | 'owned' | 'shop'>('all');

  const currentCar = CAR_MAP[inspectedCar] ?? CARS[0];
  const equippedCar = CAR_MAP[selectedCar] ?? CARS[0];
  const currentTrack = TRACK_MAP[selectedTrack] ?? TRACKS[0];

  const isOwned = garage.ownedCars.includes(currentCar.id);
  const isEquipped = selectedCar === currentCar.id;
  const carHealth = Math.round(garage.carHealth[currentCar.id] ?? 100);
  const repairCost = isOwned ? getRepairCostForCar(currentCar.id, carHealth) : currentCar.repairCost;
  const canAffordBuy = garage.coins >= currentCar.price;
  const canAffordRepair = garage.coins >= repairCost;

  const ownedCarsList = CARS.filter((c) => garage.ownedCars.includes(c.id));
  const filteredCars =
    carFilter === 'owned'
      ? ownedCarsList
      : carFilter === 'shop'
        ? CARS.filter((c) => !garage.ownedCars.includes(c.id))
        : CARS;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="pointer-events-auto flex items-center justify-between gap-6 px-5 sm:px-8 py-3.5 bg-slate-950/88 border-b border-white/10">
        {/* Zone 1: Single-element brand wordmark */}
        <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Racing Car 1
        </span>

        {/* Zone 2: Clean single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => {
              setActiveTab('cars');
              setDockCollapsed(false);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Garage ({garage.ownedCars.length}/{CARS.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('tracks');
              setDockCollapsed(false);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Circuits ({TRACKS.length})
          </button>
          <button
            onClick={onOpenMultiplayer}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Multiplayer
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Leaderboards
          </button>
          <button
            onClick={onOpenSettings}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: Mobile Quick Actions + Primary CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenLeaderboard}
            aria-label="Global Leaderboards"
            className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors shrink-0"
          >
            <Trophy className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
          <PWAInstallButton />
          <button
            onClick={() => onStartRace('solo')}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Race
          </button>
        </div>
      </header>

      {/* Center Viewport Left Unobstructed for 3D Blocky Showroom */}
      <div className="flex-1 min-h-0 flex flex-col justify-between p-3 sm:p-6 pointer-events-none">
        {/* Corner Garage Spec & Economy Card */}
        <div className="w-76 sm:w-84 max-h-full overflow-y-auto custom-scroll touch-pan-y bg-slate-950/86 border border-white/10 rounded-xl p-4 pointer-events-auto">
          <div className="flex items-center justify-between text-xs pb-2 mb-2 border-b border-white/10">
            <span className="flex items-center gap-1.5 font-mono-tabular font-bold text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              {garage.coins.toLocaleString()} Coins
            </span>
            <span className="font-mono-tabular text-slate-400">
              {settings.graphics.showFps
                ? `${liveFps} FPS · ${liveRamMb} MB`
                : `${garage.wins} ${garage.wins === 1 ? 'Win' : 'Wins'} · ${settings.platformMode === 'pc' ? 'PC' : 'Mobile'}`}
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {currentTrack.name} · {garage.wins} {garage.wins === 1 ? 'Win' : 'Wins'} ·{' '}
            <span className="text-slate-200 font-medium">{equippedCar.name}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5 leading-tight">
            {currentCar.name}
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-snug">{currentCar.tagline}</p>

          {/* 6 Car Abilities (reduced by crash damage until repaired) */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            {(
              [
                { label: 'Speed', val: currentCar.stats.speed, color: 'bg-amber-400', scales: true },
                { label: 'Accel', val: currentCar.stats.accel, color: 'bg-cyan-400', scales: true },
                { label: 'Handling', val: currentCar.stats.handling, color: 'bg-emerald-400', scales: true },
                { label: 'Braking', val: currentCar.stats.braking, color: 'bg-rose-400', scales: true },
                { label: 'Drifting', val: currentCar.stats.drifting, color: 'bg-violet-400', scales: true },
                { label: 'Durability', val: currentCar.stats.durability, color: 'bg-sky-400', scales: false },
              ] as const
            ).map((s) => {
              const damaged = isOwned && carHealth < 100 && s.scales;
              const effectiveVal = damaged
                ? Math.round(s.val * getHealthAbilityFactor(carHealth))
                : s.val;
              return (
                <div key={s.label} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{s.label}</span>
                    <span
                      className={`font-mono-tabular ${
                        damaged ? 'text-rose-400 font-semibold' : 'text-slate-200'
                      }`}
                    >
                      {effectiveVal}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    {damaged && (
                      <div
                        style={{ width: `${s.val}%` }}
                        className="absolute inset-y-0 left-0 bg-slate-600/50"
                      />
                    )}
                    <div
                      style={{ width: `${effectiveVal}%` }}
                      className={`relative h-full ${damaged ? 'bg-rose-500' : s.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {isOwned && carHealth < 100 && (
            <div className="mt-2 text-[11px] text-rose-400">
              Crash damage active · Repair to clean dirt &amp; restore abilities
            </div>
          )}

          {/* Hull Condition & Repair Cost Line */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Hull:{' '}
              <strong
                className={`font-mono-tabular ${
                  carHealth > 60
                    ? 'text-emerald-400'
                    : carHealth > 35
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {isOwned ? `${carHealth}%` : '100%'}
              </strong>
            </span>
            <span className="text-slate-400 font-mono-tabular">
              Repair Cost: {currentCar.repairCost}c
            </span>
          </div>

          {/* Distinct Buy Car vs Select Car & Repair Buttons */}
          <div className="mt-3 flex items-center gap-2">
            {!isOwned ? (
              <button
                type="button"
                disabled={!canAffordBuy}
                onClick={() => onBuyCar(currentCar.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  canAffordBuy
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {canAffordBuy
                  ? `Buy Car · ${currentCar.price.toLocaleString()} Coins`
                  : `Need ${currentCar.price.toLocaleString()} Coins`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelectCar(currentCar.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isEquipped
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white border border-slate-700'
                  }`}
                >
                  {isEquipped && <Check className="w-3.5 h-3.5" />}
                  {isEquipped ? 'Selected Car' : 'Select Car'}
                </button>

                {carHealth < 100 && (
                  <button
                    type="button"
                    disabled={!canAffordRepair}
                    onClick={() => onRepairCar(currentCar.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      canAffordRepair
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Repair · {repairCost}c
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="pointer-events-none flex flex-col items-center px-3 pb-4">
        <button
          onClick={() => setDockCollapsed((v) => !v)}
          className="pointer-events-auto mb-1.5 px-3.5 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-white/15 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Show Garage ({CARS.length} Cars) & Modes
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Hide Dock
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-5xl max-h-[48vh] overflow-y-auto custom-scroll touch-pan-y bg-slate-950/92 border border-white/15 rounded-xl p-4 shadow-2xl space-y-3">
            {/* Top Row: Garage/Circuit Tabs + Mode Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('cars')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'cars'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Garage ({CARS.length} Cars)
                </button>
                <button
                  onClick={() => setActiveTab('tracks')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'tracks'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Circuits ({TRACKS.length} Themes)
                </button>
              </div>

              {/* Action Mode Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onStartRace('solo')}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Solo vs AI
                </button>
                <button
                  onClick={() => onStartRace('split-screen')}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <SplitSquareHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  2P Split-Screen
                </button>
                <button
                  onClick={onOpenMultiplayer}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5" />
                  Online & LAN Host
                </button>
              </div>
            </div>

            {/* Selector Row */}
            {activeTab === 'cars' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg">
                    {(
                      [
                        { id: 'all', label: `All (${CARS.length})` },
                        { id: 'owned', label: `Owned (${ownedCarsList.length})` },
                        { id: 'shop', label: `Coin Shop (${CARS.length - ownedCarsList.length})` },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCarFilter(f.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          carFilter === f.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span className="hidden sm:inline text-[11px] text-slate-400">
                    All vehicles unlockable with race Coins
                  </span>
                </div>

                <div className="max-h-44 sm:max-h-52 overflow-y-auto custom-scroll touch-pan-y pr-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {filteredCars.map((car) => {
                    const owned = garage.ownedCars.includes(car.id);
                    const equipped = selectedCar === car.id;
                    const inspected = inspectedCar === car.id;
                    const hp = Math.round(garage.carHealth[car.id] ?? 100);
                    return (
                      <button
                        key={car.id}
                        onClick={() => {
                          onInspectCar(car.id);
                          if (owned) onSelectCar(car.id);
                        }}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          inspected
                            ? owned
                              ? 'bg-amber-500/15 border-amber-500 text-white'
                              : 'bg-emerald-500/15 border-emerald-400 text-white'
                            : equipped
                              ? 'bg-amber-500/10 border-amber-500/60 text-white'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              style={{ backgroundColor: car.primaryColor }}
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                            />
                            <span className="font-display font-bold text-xs truncate">
                              {car.name}
                            </span>
                          </div>
                          {!owned && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                        </div>
                        <div className="text-[11px] mt-1 font-mono-tabular flex items-center justify-between">
                          {owned ? (
                            <>
                              <span className={equipped ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                                {equipped ? 'Active' : 'Owned'}
                              </span>
                              <span className={hp < 50 ? 'text-rose-400' : 'text-slate-400'}>
                                {hp}%
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-emerald-400 font-semibold">{car.price.toLocaleString()}c</span>
                              <span className="text-slate-500">SPD {car.stats.speed}</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Driver & P2 Car Picker Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                  <span>
                    Driver: <strong className="text-slate-200">{settings.playerName}</strong> · Mode:{' '}
                    <strong className="text-slate-200 capitalize">{settings.platformMode}</strong> ·{' '}
                    <strong className="text-slate-200 capitalize">{settings.controls.steeringMode}</strong> ({settings.controls.accelerationMode})
                  </span>
                  <div className="flex items-center gap-2">
                    <span>P2 Split-Screen Car:</span>
                    <select
                      value={p2Car}
                      onChange={(e) => onSelectP2Car(e.target.value as CarId)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    >
                      {ownedCarsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-48 sm:max-h-56 overflow-y-auto custom-scroll touch-pan-y pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => onSelectTrack(track.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      selectedTrack === track.id
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        style={{ backgroundColor: track.curbColorA }}
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                      />
                      <span className="font-display font-bold text-xs truncate">
                        {track.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      {track.environment}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                      {getTrackLengthKm(track.id)} km · {track.laps} Laps · {track.isNight ? 'Night' : 'Day'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
