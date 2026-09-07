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

function tauriInvoke(command: string, args: Record<string, unknown>): Promise<unknown> {
  const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  if (!internals?.invoke) return Promise.reject(new Error('not tauri'));
  return internals.invoke(command, args);
}

/** Native tray notifications, so the desktop shell is not just a browser frame. */
export function installDesktopNotifier(): void {
  if (!isDesktopApp() || typeof window === 'undefined') return;
  if (window.TetherChatNative) return;
  window.TetherChatNative = {
    showNotification(title, body) {
      void tauriInvoke('show_notification', { title, body });
    },
    notificationsAllowed() {
      return true;
    },
    requestNotifications() {
      void tauriInvoke('plugin:notification|request_permission', {});
    },
  };
}
