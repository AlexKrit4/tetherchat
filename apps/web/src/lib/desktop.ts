/** True when running inside the TetherChat desktop shell (Tauri), not a browser tab. */
export function isDesktopApp(): boolean {
  if (import.meta.env.VITE_DESKTOP === '1') return true;
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** API origin for REST and static files in desktop builds. */
export function desktopApiOrigin(): string {
  const configured = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  return configured || 'https://tetherchat.ru';
}

/** WebSocket origin for Socket.IO in desktop builds. */
export function desktopWsOrigin(): string {
  const configured = (import.meta.env.VITE_WS_URL ?? '').replace(/\/$/, '');
  return configured || desktopApiOrigin();
}
