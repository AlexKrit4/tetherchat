import { io } from 'socket.io-client';
import { API_BASE, getAccessToken, refreshSession } from './api';
const WS_URL = import.meta.env.VITE_WS_URL ?? API_BASE;
let socket = null;
/**
 * A single shared connection. Reconnection uses socket.io's own exponential
 * backoff; an expired access token is refreshed before each retry so a long
 * disconnect (laptop asleep, tunnel down) still reconnects cleanly.
 */
export function getSocket() {
    if (socket)
        return socket;
    socket = io(WS_URL || window.location.origin, {
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
export function connectSocket() {
    const instance = getSocket();
    if (!instance.connected)
        instance.connect();
    return instance;
}
export function disconnectSocket() {
    socket?.disconnect();
    socket?.removeAllListeners();
    socket = null;
}
//# sourceMappingURL=socket.js.map