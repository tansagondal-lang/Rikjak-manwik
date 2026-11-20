import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

interface LeaderboardEntry {
  id: string;
  playerName: string;
  carId: string;
  trackId: string;
  timeMs: number;
  bestLapMs: number;
  mode: string;
  createdAt: number;
}

interface NetworkPlayerState {
  id: string;
  name: string;
  carId: string;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  lap: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
  finishTimeMs: number | null;
}

interface Room {
  code: string;
  name: string;
  trackId: string;
  hostId: string;
  isLocalHost: boolean;
  fillWithAi: boolean;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  countdownStartAt: number | null;
  raceStartAt: number | null;
  players: Map<string, NetworkPlayerState>;
}

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: 'K.Takahashi',
    carId: 'drift-86',
    trackId: 'sunstone',
    timeMs: 68420,
    bestLapMs: 22110,
    mode: 'Solo',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed-2',
    playerName: 'VoxelAce',
    carId: 'volt-x',
    trackId: 'sunstone',
    timeMs: 70950,
    bestLapMs: 22980,
    mode: 'Online',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'seed-3',
    playerName: 'NovaBlock',
    carId: 'apex-gt1',
    trackId: 'alpine',
    timeMs: 75340,
    bestLapMs: 24510,
    mode: 'Solo',
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'seed-4',
    playerName: 'TitanDriver',
    carId: 'titan',
    trackId: 'harbor',
    timeMs: 73180,
    bestLapMs: 23820,
    mode: 'LAN Host',
    createdAt: Date.now() - 18000000,
  },
];

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(SEED_LEADERBOARD, null, 2));
      return [...SEED_LEADERBOARD];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback to seed
  }
  return [...SEED_LEADERBOARD];
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2));
  } catch {
    // ignore disk error
  }
}

let leaderboard: LeaderboardEntry[] = loadLeaderboard();
const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, { id: string; roomCode: string | null }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: Room) {
  return {
    code: room.code,
    name: room.name,
    trackId: room.trackId,
    hostId: room.hostId,
    isLocalHost: room.isLocalHost,
    fillWithAi: room.fillWithAi,
    status: room.status,
    countdownStartAt: room.countdownStartAt,
    raceStartAt: room.raceStartAt,
    players: Array.from(room.players.values()),
  };
}

function listRoomSummaries() {
  return Array.from(rooms.values())
    .filter((r) => r.status === 'waiting')
    .map((r) => ({
      code: r.code,
      name: r.name,
      trackId: r.trackId,
      playerCount: r.players.size,
      status: r.status,
      isLocalHost: r.isLocalHost,
    }));
}

function broadcastAll(payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const ws of clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function broadcastRoom(roomCode: string, payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const [ws, meta] of clients.entries()) {
    if (meta.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function broadcastRoomList(): void {
  broadcastAll({ type: 'room:list', rooms: listRoomSummaries() });
}

function addLeaderboardRecord(input: Partial<LeaderboardEntry>): LeaderboardEntry {
  const cleanName = String(input.playerName || 'Driver')
    .trim()
    .slice(0, 20) || 'Driver';
  const entry: LeaderboardEntry = {
    id: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerName: cleanName,
    carId: String(input.carId || 'apex-gt1'),
    trackId: String(input.trackId || 'sunstone'),
    timeMs: Math.max(1000, Math.round(Number(input.timeMs) || 99999)),
    bestLapMs: Math.max(500, Math.round(Number(input.bestLapMs) || 33333)),
    mode: String(input.mode || 'Solo').slice(0, 18),
    createdAt: Date.now(),
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.timeMs - b.timeMs);
  leaderboard = leaderboard.slice(0, 100);
  saveLeaderboard(leaderboard);

  broadcastAll({
    type: 'leaderboard:updated',
    entry,
    entries: leaderboard,
  });

  return entry;
}

function removeClientFromRoom(ws: WebSocket): void {
  const meta = clients.get(ws);
  if (!meta || !meta.roomCode) return;

  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;

  room.players.delete(meta.id);
  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else {
    if (room.hostId === meta.id) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
      }
    }
    broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
  }
  broadcastRoomList();
}

function getLocalLanAddresses(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    const list = nets[name];
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, clients: clients.size });
  });

  app.get('/api/leaderboard', (req, res) => {
    const trackId = typeof req.query.trackId === 'string' ? req.query.trackId : null;
    const filtered = trackId
      ? leaderboard.filter((e) => e.trackId === trackId)
      : leaderboard;
    res.json({ entries: filtered });
  });

  app.post('/api/leaderboard', (req, res) => {
    const entry = addLeaderboardRecord(req.body || {});
    res.json({ entry, entries: leaderboard });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: listRoomSummaries() });
  });

  app.get('/api/network-info', (req, res) => {
    const ips = getLocalLanAddresses();
    const hostHeader = req.get('host') || `localhost:${PORT}`;
    res.json({
      lanIps: ips,
      port: PORT,
      suggestedLocalUrls: ips.map((ip) => `http://${ip}:${PORT}`),
      currentOrigin: `${req.protocol}://${hostHeader}`,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    clients.set(ws, { id: clientId, roomCode: null });

    ws.send(JSON.stringify({ type: 'welcome', clientId }));
    ws.send(JSON.stringify({ type: 'leaderboard:all', entries: leaderboard }));
    ws.send(JSON.stringify({ type: 'room:list', rooms: listRoomSummaries() }));

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const meta = clients.get(ws);
      if (!meta) return;

      switch (msg.type) {
        case 'leaderboard:get': {
          ws.send(JSON.stringify({ type: 'leaderboard:all', entries: leaderboard }));
          break;
        }
        case 'leaderboard:submit': {
          addLeaderboardRecord(msg as Partial<LeaderboardEntry>);
          break;
        }
        case 'rooms:list': {
          ws.send(JSON.stringify({ type: 'room:list', rooms: listRoomSummaries() }));
          break;
        }
        case 'room:create': {
          removeClientFromRoom(ws);
          const code = generateRoomCode();
          const roomName = String(msg.roomName || 'Circuit Lobby').trim().slice(0, 28) || 'Circuit Lobby';
          const playerName = String(msg.playerName || 'Host').trim().slice(0, 20) || 'Host';
          const carId = String(msg.carId || 'apex-gt1');
          const trackId = String(msg.trackId || 'sunstone');
          const isLocalHost = Boolean(msg.isLocalHost);
          const fillWithAi = msg.fillWithAi !== false;

          const player: NetworkPlayerState = {
            id: meta.id,
            name: playerName,
            carId,
            ready: true,
            isHost: true,
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            speed: 0,
            steerAngle: 0,
            lap: 1,
            checkpoint: 0,
            progress: 0,
            finished: false,
            finishTimeMs: null,
          };

          const room: Room = {
            code,
            name: roomName,
            trackId,
            hostId: meta.id,
            isLocalHost,
            fillWithAi,
            status: 'waiting',
            countdownStartAt: null,
            raceStartAt: null,
            players: new Map([[meta.id, player]]),
          };

          rooms.set(code, room);
          meta.roomCode = code;
          ws.send(JSON.stringify({ type: 'room:state', room: serializeRoom(room) }));
          broadcastRoomList();
          break;
        }
        case 'room:join': {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: `Room ${code} was not found.` }));
            return;
          }
          if (room.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: `Race in room ${code} already started.` }));
            return;
          }
          if (room.players.size >= 8) {
            ws.send(JSON.stringify({ type: 'error', message: `Room ${code} is full (8/8).` }));
            return;
          }

          removeClientFromRoom(ws);
          const playerName = String(msg.playerName || 'Driver').trim().slice(0, 20) || 'Driver';
          const carId = String(msg.carId || 'apex-gt1');

          room.players.set(meta.id, {
            id: meta.id,
            name: playerName,
            carId,
            ready: false,
            isHost: false,
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            speed: 0,
            steerAngle: 0,
            lap: 1,
            checkpoint: 0,
            progress: 0,
            finished: false,
            finishTimeMs: null,
          });
          meta.roomCode = code;
          broadcastRoom(code, { type: 'room:state', room: serializeRoom(room) });
          broadcastRoomList();
          break;
        }
        case 'room:leave': {
          removeClientFromRoom(ws);
          break;
        }
        case 'room:update': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const p = room.players.get(meta.id);
          if (!p) return;

          if (typeof msg.carId === 'string') p.carId = msg.carId;
          if (typeof msg.ready === 'boolean') p.ready = msg.ready;
          if (room.hostId === meta.id) {
            if (typeof msg.trackId === 'string') room.trackId = msg.trackId;
            if (typeof msg.fillWithAi === 'boolean') room.fillWithAi = msg.fillWithAi;
          }
          broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
          broadcastRoomList();
          break;
        }
        case 'room:start': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.hostId !== meta.id) return;
          if (room.status !== 'waiting') return;

          room.status = 'countdown';
          room.countdownStartAt = Date.now();
          room.raceStartAt = Date.now() + 3200;
          for (const p of room.players.values()) {
            p.finished = false;
            p.finishTimeMs = null;
            p.lap = 1;
            p.progress = 0;
          }
          broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
          broadcastRoomList();

          setTimeout(() => {
            const active = rooms.get(room.code);
            if (active && active.status === 'countdown') {
              active.status = 'racing';
              broadcastRoom(active.code, { type: 'room:state', room: serializeRoom(active) });
            }
          }, 3200);
          break;
        }
        case 'player:state': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const p = room.players.get(meta.id);
          if (!p) return;

          p.x = Number(msg.x) || 0;
          p.y = Number(msg.y) || 0;
          p.z = Number(msg.z) || 0;
          p.yaw = Number(msg.yaw) || 0;
          p.speed = Number(msg.speed) || 0;
          p.steerAngle = Number(msg.steerAngle) || 0;
          p.lap = Number(msg.lap) || 1;
          p.checkpoint = Number(msg.checkpoint) || 0;
          p.progress = Number(msg.progress) || 0;
          p.finished = Boolean(msg.finished);
          p.finishTimeMs = typeof msg.finishTimeMs === 'number' ? msg.finishTimeMs : null;
          break;
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(ws);
      clients.delete(ws);
    });
  });

  // Authoritative 20Hz broadcast loop for active racing rooms
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status === 'racing' || room.status === 'countdown') {
        broadcastRoom(room.code, { type: 'room:state', room: serializeRoom(room) });
      }
    }
  }, 50);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Racing Car 1 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
