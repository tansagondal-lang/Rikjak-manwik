import React, { useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { CAR_MAP } from '../data/cars';
import { TRACKS, TRACK_MAP } from '../data/tracks';
import { LeaderboardEntry, TrackId } from '../types/game';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  connected: boolean;
  onClose: () => void;
}

export function formatRaceTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const hundredths = Math.floor((safe % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  entries,
  connected,
  onClose,
}) => {
  const [filterTrack, setFilterTrack] = useState<'all' | TrackId>('all');

  const filtered =
    filterTrack === 'all'
      ? entries
      : entries.filter((e) => e.trackId === filterTrack);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global Leaderboard"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Global Leaderboards
              </h2>
              <p className="text-xs text-slate-400">
                {connected
                  ? 'Live WebSocket Sync Active'
                  : typeof navigator !== 'undefined' && !navigator.onLine
                    ? 'Offline — Showing Cached Times'
                    : 'Connecting to Leaderboard Feed'}{' '}
                · Top Circuit Times
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Leaderboard"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Filter Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-3 bg-slate-950/60 border-b border-slate-800 overflow-x-auto touch-pan-x shrink-0">
          <button
            onClick={() => setFilterTrack('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              filterTrack === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Circuits
          </button>
          {TRACKS.map((track) => (
            <button
              key={track.id}
              onClick={() => setFilterTrack(track.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filterTrack === track.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {track.name}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll touch-pan-y p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No times recorded on this circuit yet. Finish a race to claim rank #1.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                  <th className="pb-3 pr-3">Rank</th>
                  <th className="pb-3 pr-3">Driver</th>
                  <th className="pb-3 pr-3">Circuit</th>
                  <th className="pb-3 pr-3">Vehicle</th>
                  <th className="pb-3 pr-3 text-right">Best Lap</th>
                  <th className="pb-3 text-right">Total Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {filtered.map((entry, idx) => {
                  const car = CAR_MAP[entry.carId];
                  const track = TRACK_MAP[entry.trackId];
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-3 font-mono-tabular font-bold text-amber-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-white">{entry.playerName}</div>
                        <div className="text-xs text-slate-400">{entry.mode}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-300 text-xs">
                        {track?.name ?? entry.trackId}
                      </td>
                      <td className="py-3 pr-3 text-slate-300 text-xs">
                        {car?.name ?? entry.carId}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono-tabular text-slate-300">
                        {formatRaceTime(entry.bestLapMs)}
                      </td>
                      <td className="py-3 text-right font-mono-tabular font-bold text-white">
                        {formatRaceTime(entry.timeMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
