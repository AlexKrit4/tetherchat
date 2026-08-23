import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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
  await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
  await closeTestApp();
});

describe('secret chats', () => {
  it('stores only ciphertext and returns keys only to their device owner', async () => {
    const app = await testApp();
    const aliceDevice = `alice-device-${randomUUID()}`;
    const bobDevice = `bob-device-${randomUUID()}`;
    for (const [user, deviceId] of [
      [alice, aliceDevice],
      [bob, bobDevice],
    ] as const) {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/e2ee/devices',
        headers: user.auth,
        payload: { deviceId, name: 'test', publicKey: 'p'.repeat(256) },
      });
      expect(registered.statusCode).toBe(200);
    }

    const created = await app.inject({
      method: 'POST',
      url: '/api/dms/secret',
      headers: alice.auth,
      payload: {
        userId: bob.id,
        keys: [
          { deviceId: aliceDevice, wrappedKey: 'a'.repeat(344) },
          { deviceId: bobDevice, wrappedKey: 'b'.repeat(344) },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const conversation = created.json<DirectConversation>();
    expect(conversation.isSecret).toBe(true);

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

    const stored = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(stored.content).toBe('');
    expect(stored.ciphertext).toBe('opaque-ciphertext');

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

    const plaintext = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: alice.auth,
      payload: { content: 'server must not see this' },
    });
    expect(plaintext.statusCode).toBe(400);
  });
});
