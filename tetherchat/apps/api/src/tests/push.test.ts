import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { closeTestApp, createUser, testApp } from './harness.js';
import type { TestUser } from './harness.js';

let user: TestUser;

beforeAll(async () => {
  user = await createUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: user.id } });
  await closeTestApp();
});

describe('push subscriptions', () => {
  it('returns empty Android FCM config when Firebase is not configured', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/push/android-config' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: '',
      applicationId: '',
      apiKey: '',
      senderId: '',
    });
  });

  it('stores an FCM device token for Android', async () => {
    const app = await testApp();
    const token = `fcm-test-token-${'x'.repeat(40)}`;

    const subscribed = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: user.auth,
      payload: { platform: 'fcm', token },
    });
    expect(subscribed.statusCode).toBe(204);

    const tokenOnly = `fcm-test-token-${'y'.repeat(40)}`;
    const subscribedTokenOnly = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: user.auth,
      payload: { token: tokenOnly },
    });
    expect(subscribedTokenOnly.statusCode).toBe(204);
    expect((await prisma.pushSubscription.findUnique({ where: { endpoint: tokenOnly } }))?.platform).toBe(
      'fcm',
    );
    await prisma.pushSubscription.deleteMany({ where: { endpoint: tokenOnly } });

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint: token } });
    expect(row?.userId).toBe(user.id);
    expect(row?.platform).toBe('fcm');

    const removed = await app.inject({
      method: 'POST',
      url: '/api/push/unsubscribe',
      headers: user.auth,
      payload: { token },
    });
    expect(removed.statusCode).toBe(204);
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint: token } })).toBeNull();
  });

  it('still accepts a Web Push subscription', async () => {
    const app = await testApp();
    const endpoint = `https://push.example.test/sub/${user.id}`;

    const subscribed = await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: user.auth,
      payload: {
        endpoint,
        keys: { p256dh: 'dGVzdC1wMjU2ZGg', auth: 'dGVzdC1hdXRo' },
      },
    });
    expect(subscribed.statusCode).toBe(204);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row?.platform).toBe('web');
    expect(row?.p256dh).toBe('dGVzdC1wMjU2ZGg');

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  });
});
