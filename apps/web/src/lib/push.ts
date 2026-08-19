import type { Message } from '@tetherchat/shared';
import { api } from './api';
import { isInstalledAndroidApp } from './androidApp';

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}

const SUBSCRIBED_KEY = 'tetherchat:push-subscribed';

interface NativeNotifier {
  showNotification(title: string, body: string, url: string): void;
  notificationsAllowed(): boolean;
}

declare global {
  interface Window {
    TetherChatNative?: NativeNotifier;
  }
}

function nativeNotifier(): NativeNotifier | undefined {
  return typeof window === 'undefined' ? undefined : window.TetherChatNative;
}

export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (nativeNotifier()) return true;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushState(): PushState {
  if (!pushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false };
  }
  const permission: NotificationPermission | 'unsupported' =
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  return {
    supported: true,
    permission,
    subscribed: localStorage.getItem(SUBSCRIBED_KEY) === '1',
  };
}

/** VAPID keys travel as base64url and must be raw bytes for subscribe(). */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export type EnablePushResult = 'enabled' | 'denied' | 'unsupported' | 'no-key';

export async function enablePush(): Promise<EnablePushResult> {
  if (!pushSupported()) return 'unsupported';

  if (webPushSupported()) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const { publicKey } = await api
      .get<{ publicKey: string | null }>('/api/push/public-key')
      .catch(() => ({ publicKey: null }));

    const key = publicKey ?? import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) {
      if (nativeNotifier()) {
        localStorage.setItem(SUBSCRIBED_KEY, '1');
        return 'enabled';
      }
      return 'no-key';
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(key),
        }));

      const payload = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (payload.endpoint && payload.keys?.p256dh && payload.keys.auth) {
        await api.post('/api/push/subscribe', {
          endpoint: payload.endpoint,
          keys: { p256dh: payload.keys.p256dh, auth: payload.keys.auth },
        });
        localStorage.setItem(SUBSCRIBED_KEY, '1');
        return 'enabled';
      }
    } catch {
      if (!nativeNotifier()) return 'unsupported';
    }
  }

  if (nativeNotifier()) {
    localStorage.setItem(SUBSCRIBED_KEY, '1');
    return 'enabled';
  }

  return 'unsupported';
}

/**
 * After login, subscribe without a toast. The permission prompt is the point:
 * without it, a closed Android app never hears about new messages.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (!pushSupported()) return;
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
  await enablePush().catch(() => undefined);
}

export async function disablePush(): Promise<void> {
  localStorage.removeItem(SUBSCRIBED_KEY);
  if (!webPushSupported()) return;

  const registration = await navigator.serviceWorker.ready.catch(() => undefined);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

export function messageDeepLink(message: Message): string {
  if (message.serverId) return `/channels/${message.serverId}/${message.channelId}`;
  return `/channels/@me/${message.channelId}`;
}

/** Local banner when the page is hidden; Web Push covers the process-killed case. */
export function notifyIncomingMessage(message: Message, currentUserId: string | undefined): void {
  if (!currentUserId || message.authorId === currentUserId) return;
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
  if (localStorage.getItem(SUBSCRIBED_KEY) !== '1' && !isInstalledAndroidApp()) return;

  const title = message.author.displayName ?? message.author.username;
  const body = message.content.trim().slice(0, 140) || 'Вложение';
  const url = messageDeepLink(message);
  const native = nativeNotifier();
  if (native) {
    native.showNotification(title, body, url);
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(title, { body, tag: `channel:${message.channelId}` });
}
