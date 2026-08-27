import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { DirectConversation, Message } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createUser, linkFriends, testApp } from './harness.js';
import type { TestUser } from './harness.js';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser();
  bob = await createUser();
  await linkFriends(alice, bob);
});

afterAll(async () => {
  const ids = [alice?.id, bob?.id].filter((id): id is string => Boolean(id));
  if (ids.length > 0) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await closeTestApp();
});

describe('secret chats', () => {
  it('stores only ciphertext and binds each user to one device', async () => {
    const app = await testApp();
    const aliceDevice = `alice-device-${randomUUID()}`;
    const bobDevice = `bob-device-${randomUUID()}`;
    const bobDevice2 = `bob-device2-${randomUUID()}`;
    const publicKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64');
    for (const [user, deviceId] of [
      [alice, aliceDevice],
      [bob, bobDevice],
      [bob, bobDevice2],
    ] as const) {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/e2ee/devices',
        headers: user.auth,
        payload: { deviceId, name: 'test', publicKey },
      });
      expect(registered.statusCode).toBe(200);
    }

    const created = await app.inject({
      method: 'POST',
      url: '/api/dms/secret',
      headers: alice.auth,
      payload: {
        userId: bob.id,
        keys: [{ deviceId: aliceDevice, wrappedKey: 'a'.repeat(344) }],
      },
    });
    expect(created.statusCode).toBe(201);
    const conversation = created.json<DirectConversation>();
    expect(conversation.isSecret).toBe(true);

    const aliceList = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${aliceDevice}`,
      headers: alice.auth,
    });
    expect(aliceList.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(true);

    const bobListBeforeClaim = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${bobDevice}`,
      headers: bob.auth,
    });
    expect(bobListBeforeClaim.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(false);

    const claim = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/claim`,
      headers: bob.auth,
      payload: { deviceId: bobDevice },
    });
    expect(claim.statusCode).toBe(200);

    const deliver = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/deliver-key`,
      headers: alice.auth,
      payload: { deviceId: bobDevice, wrappedKey: 'b'.repeat(344) },
    });
    expect(deliver.statusCode).toBe(200);

    const bobList = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${bobDevice}`,
      headers: bob.auth,
    });
    expect(bobList.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(true);

    const bobListOtherDevice = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${bobDevice2}`,
      headers: bob.auth,
    });
    expect(bobListOtherDevice.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(false);

    const sent = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: alice.auth,
      payload: {
        encrypted: { version: 1, iv: 'aW5pdGlhbGl6YXRpb24=', ciphertext: 'opaque-ciphertext' },
      },
    });
    expect(sent.statusCode).toBe(201);
    const message = sent.json<Message>();
    expect(message.content).toBe('');
    expect(message.encrypted?.ciphertext).toBe('opaque-ciphertext');

    const ownKey = await app.inject({
      method: 'GET',
      url: `/api/e2ee/conversations/${conversation.id}/key/${bobDevice}`,
      headers: bob.auth,
    });
    expect(ownKey.statusCode).toBe(200);
    expect(ownKey.json<{ wrappedKey: string }>().wrappedKey).toBe('b'.repeat(344));

    const otherKey = await app.inject({
      method: 'GET',
      url: `/api/e2ee/conversations/${conversation.id}/key/${aliceDevice}`,
      headers: bob.auth,
    });
    expect(otherKey.statusCode).toBe(403);

    const secondClaim = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/claim`,
      headers: bob.auth,
      payload: { deviceId: bobDevice2 },
    });
    expect(secondClaim.statusCode).toBe(409);
  });

  it('refuses to deliver a key to a device that did not claim the chat', async () => {
    const app = await testApp();
    const aliceDevice = `alice-device-${randomUUID()}`;
    const bobPhone = `bob-phone-${randomUUID()}`;
    const bobTablet = `bob-tablet-${randomUUID()}`;
    const publicKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64');
    for (const [user, deviceId] of [
      [alice, aliceDevice],
      [bob, bobPhone],
      [bob, bobTablet],
    ] as const) {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/e2ee/devices',
        headers: user.auth,
        payload: { deviceId, name: 'test', publicKey },
      });
      expect(registered.statusCode).toBe(200);
    }

    const created = await app.inject({
      method: 'POST',
      url: '/api/dms/secret',
      headers: alice.auth,
      payload: {
        userId: bob.id,
        keys: [{ deviceId: aliceDevice, wrappedKey: 'a'.repeat(344) }],
      },
    });
    expect(created.statusCode).toBe(201);
    const conversation = created.json<DirectConversation>();

    const sneakDeliver = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/deliver-key`,
      headers: alice.auth,
      payload: { deviceId: bobTablet, wrappedKey: 'c'.repeat(344) },
    });
    expect(sneakDeliver.statusCode).toBe(403);

    const claimPhone = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/claim`,
      headers: bob.auth,
      payload: { deviceId: bobPhone },
    });
    expect(claimPhone.statusCode).toBe(200);

    const wrongDevice = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/deliver-key`,
      headers: alice.auth,
      payload: { deviceId: bobTablet, wrappedKey: 'c'.repeat(344) },
    });
    expect(wrongDevice.statusCode).toBe(403);

    const claimTablet = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/claim`,
      headers: bob.auth,
      payload: { deviceId: bobTablet },
    });
    expect(claimTablet.statusCode).toBe(409);

    const unfiltered = await app.inject({
      method: 'GET',
      url: '/api/dms',
      headers: bob.auth,
    });
    expect(unfiltered.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(
      false,
    );

    const foreignDevice = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${aliceDevice}`,
      headers: bob.auth,
    });
    expect(foreignDevice.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(
      false,
    );

    const deliverPhone = await app.inject({
      method: 'POST',
      url: `/api/e2ee/conversations/${conversation.id}/deliver-key`,
      headers: alice.auth,
      payload: { deviceId: bobPhone, wrappedKey: 'b'.repeat(344) },
    });
    expect(deliverPhone.statusCode).toBe(200);

    const phoneList = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${bobPhone}`,
      headers: bob.auth,
    });
    expect(phoneList.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(true);

    const tabletList = await app.inject({
      method: 'GET',
      url: `/api/dms?deviceId=${bobTablet}`,
      headers: bob.auth,
    });
    expect(tabletList.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(
      false,
    );
  });
});
