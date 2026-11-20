import { CarId, LeaderboardEntry, RoomInfo, TrackId } from '../types/game';

export type ServerMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'room:state'; room: RoomInfo }
  | { type: 'room:closed'; reason: string }
  | { type: 'room:list'; rooms: RoomSummary[] }
  | { type: 'leaderboard:all'; entries: LeaderboardEntry[] }
  | { type: 'leaderboard:updated'; entry: LeaderboardEntry; entries: LeaderboardEntry[] }
  | { type: 'error'; message: string };

export interface RoomSummary {
  code: string;
  name: string;
  trackId: TrackId;
  playerCount: number;
  status: string;
  isLocalHost: boolean;
}

type Listener = (msg: ServerMessage) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;
  private queue: string[] = [];
  public clientId: string | null = null;
  public connected = false;

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        while (this.queue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const msg = this.queue.shift();
          if (msg) ws.send(msg);
        }
        this.send({ type: 'rooms:list' });
        this.send({ type: 'leaderboard:get' });
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerMessage;
          if (parsed.type === 'welcome') {
            this.clientId = parsed.clientId;
          }
          this.listeners.forEach((fn) => fn(parsed));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        if (this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // ignore
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public send(payload: Record<string, unknown>): void {
    const raw = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      if (this.queue.length < 24) {
        this.queue.push(raw);
      }
      this.connect();
    }
  }

  public createRoom(opts: {
    playerName: string;
    carId: CarId;
    trackId: TrackId;
    roomName: string;
    isLocalHost: boolean;
    fillWithAi: boolean;
  }): void {
    this.send({ type: 'room:create', ...opts });
  }

  public joinRoom(opts: { code: string; playerName: string; carId: CarId }): void {
    this.send({ type: 'room:join', ...opts });
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
  }

  public updateLobbyPlayer(opts: { carId?: CarId; ready?: boolean; trackId?: TrackId; fillWithAi?: boolean }): void {
    this.send({ type: 'room:update', ...opts });
  }

  public startRoomRace(): void {
    this.send({ type: 'room:start' });
  }

  public sendRaceState(state: {
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
  }): void {
    this.send({ type: 'player:state', ...state });
  }

  public submitLeaderboard(entry: {
    playerName: string;
    carId: CarId;
    trackId: TrackId;
    timeMs: number;
    bestLapMs: number;
    mode: string;
  }): void {
    this.send({ type: 'leaderboard:submit', ...entry });
  }

  public requestRooms(): void {
    this.send({ type: 'rooms:list' });
  }
}

export const multiplayerClient = new MultiplayerClient();
