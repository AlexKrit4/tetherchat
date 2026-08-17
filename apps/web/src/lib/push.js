import { api } from './api';
const SUBSCRIBED_KEY = 'tetherchat:push-subscribed';
export function pushSupported() {
    return (typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window);
}
export function pushState() {
    if (!pushSupported()) {
        return { supported: false, permission: 'unsupported', subscribed: false };
    }
    return {
        supported: true,
        permission: Notification.permission,
        subscribed: localStorage.getItem(SUBSCRIBED_KEY) === '1',
    };
}
/** VAPID keys travel as base64url and must be a Uint8Array for subscribe(). */
function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(normalized);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1)
        output[i] = raw.charCodeAt(i);
    return output;
}
export async function enablePush() {
    if (!pushSupported())
        return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted')
        return 'denied';
    const { publicKey } = await api
        .get('/api/push/public-key')
        .catch(() => ({ publicKey: null }));
    const key = publicKey ?? import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!key)
        return 'no-key';
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ??
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
        }));
    const payload = subscription.toJSON();
    if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys.auth)
        return 'unsupported';
    await api.post('/api/push/subscribe', {
        endpoint: payload.endpoint,
        keys: { p256dh: payload.keys.p256dh, auth: payload.keys.auth },
    });
    localStorage.setItem(SUBSCRIBED_KEY, '1');
    return 'enabled';
}
export async function disablePush() {
    localStorage.removeItem(SUBSCRIBED_KEY);
    if (!pushSupported())
        return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription)
        return;
    await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
}
//# sourceMappingURL=push.js.map