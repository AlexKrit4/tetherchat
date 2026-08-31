import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tetherchat/shared';
import { API_BASE, getAccessToken, refreshSession } from './api';
import { isSessionParked } from './appForeground';
import { desktopWsOrigin, isDesktopApp } from './desktop';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = isDesktopApp()
  ? desktopWsOrigin()
  : (import.meta.env.VITE_WS_URL ?? API_BASE);

let socket: AppSocket | null = null;

/**
 * A single shared connection. Reconnection uses socket.io's own exponential
 * backoff; an expired access token is refreshed before each retry so a long
 * disconnect (laptop asleep, tunnel down) still reconnects cleanly.
 */
export function getSocket(): AppSocket {
  if (socket) return socket;

  socket = io(WS_URL || (isDesktopApp() ? desktopWsOrigin() : window.location.origin), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.4,
    auth: (cb) => cb({ token: getAccessToken() }),
  });

  socket.io.on('reconnect_attempt', () => {
    void refreshSession();
  });

  return socket;
}

export function connectSocket(): AppSocket {
  const instance = getSocket();
  if (isSessionParked()) return instance;
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket?.removeAllListeners();
  socket = null;
}
