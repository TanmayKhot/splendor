import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// --- localStorage helpers ---

const TOKEN_KEY = 'splendor_token';
const ROOM_KEY = 'splendor_room';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface StoredRoom {
  roomCode: string;
  reconnectToken: string;
  nickname: string;
}

export function getStoredRoom(): StoredRoom | null {
  const raw = localStorage.getItem(ROOM_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredRoom(data: StoredRoom): void {
  localStorage.setItem(ROOM_KEY, JSON.stringify(data));
}

export function clearStoredRoom(): void {
  localStorage.removeItem(ROOM_KEY);
}

// --- Socket connection ---

export function getSocket(): Socket {
  if (socket) return socket;

  const token = getToken();
  socket = io({
    // In production: same origin, no URL needed
    // In dev: Vite proxy handles /socket.io → :3001
    auth: { token },
    autoConnect: false,       // connect explicitly after setting up listeners
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// --- Tab visibility handler ---
// When tab goes visible and socket is disconnected, force reconnect

export function setupVisibilityHandler(): () => void {
  const handler = () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) {
      socket.connect();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
