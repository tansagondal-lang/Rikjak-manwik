import React, { useEffect, useState } from 'react';
import { Copy, Check, Users, Wifi, Play, X, LogOut } from 'lucide-react';
import { CARS, CAR_MAP } from '../data/cars';
import { TRACKS, TRACK_MAP } from '../data/tracks';
import { multiplayerClient, RoomSummary } from '../services/multiplayer';
import { CarId, RoomInfo, TrackId } from '../types/game';

interface MultiplayerLobbyProps {
  playerName: string;
  selectedCar: CarId;
  ownedCars: CarId[];
  selectedTrack: TrackId;
  room: RoomInfo | null;
  roomsList: RoomSummary[];
  localClientId: string | null;
  errorMsg: string | null;
  onSelectCar: (car: CarId) => void;
  onClose: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  playerName,
  selectedCar,
  ownedCars,
  selectedTrack,
  room,
  roomsList,
  localClientId,
  errorMsg,
  onSelectCar,
  onClose,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState(`${playerName}'s Lobby`);
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [fillWithAi, setFillWithAi] = useState(true);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    multiplayerClient.requestRooms();
    fetch('/api/network-info')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.suggestedLocalUrls)) {
          setLanUrls(data.suggestedLocalUrls);
        }
      })
      .catch(() => {});
  }, []);

  const copyShareUrl = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const myPlayer = room?.players.find((p) => p.id === localClientId);
  const isHost = room?.hostId === localClientId;

  const shareLink = room
    ? `${window.location.origin}/?room=${room.code}`
    : window.location.origin;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Multiplayer and Local Host Lobby"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Multiplayer & Local Host Lobby
              </h2>
              <p className="text-xs text-slate-400">
                Real-Time WebSocket Rooms · Local Wi-Fi / LAN Host · Up to 8 Racers
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (room) multiplayerClient.leaveRoom();
              onClose();
            }}
            aria-label="Close Multiplayer Lobby"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll touch-pan-y p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/50 text-rose-200 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {!room ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Create Room Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  Host a Race Room
                </h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Room Name</label>
                  <input
                    type="text"
                    maxLength={28}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLocalHost}
                      onChange={(e) => setIsLocalHost(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400"
                    />
                    Local Host Mode (Show LAN IP for local Wi-Fi devices)
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fillWithAi}
                      onChange={(e) => setFillWithAi(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    Fill Empty Grid Slots with AI Racers
                  </label>
                </div>

                <button
                  onClick={() =>
                    multiplayerClient.createRoom({
                      playerName,
                      carId: selectedCar,
                      trackId: selectedTrack,
                      roomName,
                      isLocalHost,
                      fillWithAi,
                    })
                  }
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
                >
                  Create {isLocalHost ? 'Local Host' : 'Online'} Room
                </button>
              </div>

              {/* Join Room Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  Join Existing Room
                </h3>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono-tabular uppercase tracking-widest text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => {
                      if (joinCode.trim().length >= 3) {
                        multiplayerClient.joinRoom({
                          code: joinCode.trim(),
                          playerName,
                          carId: selectedCar,
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    Join Code
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Open Lobbies</span>
                    <button
                      onClick={() => multiplayerClient.requestRooms()}
                      className="text-cyan-400 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  {roomsList.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                      No open rooms active right now. Host one to start!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scroll">
                      {roomsList.map((r) => (
                        <div
                          key={r.code}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {r.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {TRACK_MAP[r.trackId]?.name ?? r.trackId} · {r.playerCount}/8 ·{' '}
                              {r.isLocalHost ? 'LAN Host' : 'Online'}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              multiplayerClient.joinRoom({
                                code: r.code,
                                playerName,
                                carId: selectedCar,
                              })
                            }
                            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-xs font-mono-tabular font-bold text-cyan-300 transition-colors"
                          >
                            {r.code}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Active Room View */
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div>
                  <div className="text-xs text-slate-400">
                    {room.isLocalHost ? 'Local Host LAN Lobby' : 'Online Multiplayer Room'} ·{' '}
                    {TRACK_MAP[room.trackId]?.name}
                  </div>
                  <div className="font-display text-2xl font-bold text-white flex items-center gap-3 mt-0.5">
                    <span>{room.name}</span>
                    <span className="font-mono-tabular text-amber-400 tracking-widest">
                      #{room.code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyShareUrl(shareLink)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Link Copied' : 'Copy Invite Link'}
                  </button>
                  <button
                    onClick={() => multiplayerClient.leaveRoom()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave
                  </button>
                </div>
              </div>

              {room.isLocalHost && lanUrls.length > 0 && (
                <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-3.5 text-xs text-cyan-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-cyan-400" />
                    Local Host Network Address (Open on phones/devices on same Wi-Fi)
                  </div>
                  <div className="font-mono-tabular text-cyan-100">
                    {lanUrls[0]}/?room={room.code}
                  </div>
                </div>
              )}

              {/* Host Controls + Car Picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Your Owned Cars ({ownedCars.length}/{CARS.length})
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scroll touch-pan-y pr-1 grid grid-cols-2 gap-2">
                    {CARS.filter((c) => ownedCars.includes(c.id)).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectCar(c.id);
                          multiplayerClient.updateLobbyPlayer({ carId: c.id });
                        }}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors ${
                          (myPlayer?.carId ?? selectedCar) === c.id
                            ? 'bg-amber-500/15 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-semibold truncate">{c.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Circuit ({TRACKS.length}) {isHost ? '(Host Select)' : '(Host Controlled)'}
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scroll touch-pan-y pr-1 space-y-1.5">
                    {TRACKS.map((t) => (
                      <button
                        key={t.id}
                        disabled={!isHost}
                        onClick={() =>
                          multiplayerClient.updateLobbyPlayer({ trackId: t.id })
                        }
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-colors ${
                          room.trackId === t.id
                            ? 'bg-cyan-500/15 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        } ${!isHost ? 'opacity-70 cursor-not-allowed' : 'hover:border-slate-600'}`}
                      >
                        <span className="font-semibold">{t.name}</span> ·{' '}
                        <span className="text-slate-400">{t.environment}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Connected Racers */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">
                  Racers in Lobby ({room.players.length}/8)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {room.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          {p.name} {p.isHost ? '(Host)' : ''}
                        </div>
                        <div className="text-slate-400">
                          {CAR_MAP[p.carId]?.name ?? p.carId}
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          p.ready ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {p.ready ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start / Ready Bar */}
              <div className="flex items-center justify-end gap-3">
                {!isHost && myPlayer && (
                  <button
                    onClick={() =>
                      multiplayerClient.updateLobbyPlayer({ ready: !myPlayer.ready })
                    }
                    className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      myPlayer.ready
                        ? 'bg-slate-700 text-white'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {myPlayer.ready ? 'Cancel Ready' : 'Mark Ready'}
                  </button>
                )}
                {isHost && (
                  <button
                    onClick={() => multiplayerClient.startRoomRace()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Multiplayer Race
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
