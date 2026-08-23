/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/**
 * App shell is precached so TetherChat opens instantly and shows a usable frame
 * offline. API traffic is deliberately not cached: stale messages are worse than
 * an empty state.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url: string;
  tag: string;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = {
      title: 'TetherChat',
      body: event.data.text(),
      url: '/',
      tag: 'tetherchat',
    };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((client) => 'focused' in client && client.focused)) {
        return;
      }
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon ?? '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: payload.tag,
        data: { url: payload.url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Navigation fallback: serve the cached shell so deep links work offline.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  if (new URL(event.request.url).pathname.startsWith('/api')) return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cache = await caches.open('workbox-precache-v2');
        const cached = await cache.match('/index.html', { ignoreSearch: true });
        return cached ?? new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })(),
  );
});
