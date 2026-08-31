import { useEffect } from 'react';
import type { PresenceStatus } from '@tetherchat/shared';
import {
  isSessionParked,
  markNativeBackground,
  markSessionParked,
} from '@/lib/appForeground';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

function preferredStatus(): PresenceStatus | null {
  const status = useAuthStore.getState().user?.status;
  if (!status || status === 'offline') return null;
  return status;
}

function restorePreferredStatus(): void {
  const socket = getSocket();
  const status = preferredStatus();
  if (!status) return;
  const emit = () => socket.emit('presence:update', { status });
  if (socket.connected) emit();
  else socket.once('connect', emit);
}

/**
 * A minimized tab or Android activity must drop the realtime session so the
 * user disappears from Online. A silent native socket (notifications only)
 * does not count as being in the app.
 */
export function parkRealtimeSession(): void {
  if (isSessionParked()) return;
  markSessionParked(true);
  const socket = getSocket();
  socket.io.reconnection(false);
  if (socket.connected) socket.disconnect();
}

export function resumeRealtimeSession(): void {
  markSessionParked(false);
  const socket = getSocket();
  socket.io.reconnection(true);
  if (!socket.connected) socket.connect();
  restorePreferredStatus();
}

function onNativeBackground(): void {
  markNativeBackground(true);
  parkRealtimeSession();
}

function onNativeForeground(): void {
  markNativeBackground(false);
  resumeRealtimeSession();
}

/**
 * Parks the socket while the document is hidden (browser tab) or the Android
 * WebView reports onStop via `__tetherchatOnBackground`.
 */
export function usePresenceLifecycle(): void {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    window.__tetherchatOnBackground = onNativeBackground;
    window.__tetherchatOnForeground = onNativeForeground;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') parkRealtimeSession();
      else if (!window.__tetherchatNativeBackground) resumeRealtimeSession();
    };
    const onPageHide = () => parkRealtimeSession();
    const onPageShow = () => {
      if (!window.__tetherchatNativeBackground) resumeRealtimeSession();
    };
    const onFreeze = () => parkRealtimeSession();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('freeze' as 'visibilitychange', onFreeze);

    if (document.visibilityState === 'hidden' || window.__tetherchatNativeBackground) {
      parkRealtimeSession();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('freeze' as 'visibilitychange', onFreeze);
      if (window.__tetherchatOnBackground === onNativeBackground) {
        delete window.__tetherchatOnBackground;
      }
      if (window.__tetherchatOnForeground === onNativeForeground) {
        delete window.__tetherchatOnForeground;
      }
    };
  }, [status]);
}
