import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DirectConversation, Message } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createUser, linkFriends, testApp } from './harness.js';
import type { TestUser } from './harness.js';

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;

beforeAll(async () => {
  alice = await createUser();
  bob = await createUser();
  carol = await createUser();
  await linkFriends(alice, bob);
  await linkFriends(alice, carol);
  await linkFriends(bob, carol);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id, carol.id] } } });
  await closeTestApp();
});

describe('direct messages', () => {
  it('reuses the existing one-on-one conversation', async () => {
    const app = await testApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: alice.auth,
      payload: { userIds: [bob.id] },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: bob.auth,
      payload: { userIds: [alice.id] },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json<DirectConversation>().id).toBe(first.json<DirectConversation>().id);
  });

  it('exchanges messages between both participants', async () => {
    const app = await testApp();
    const conversation = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [bob.id] },
      })
    ).json<DirectConversation>();

    const sent = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: alice.auth,
      payload: { content: 'hey bob' },
    });
    expect(sent.statusCode).toBe(201);

    const history = await app.inject({
      method: 'GET',
      url: `/api/dms/${conversation.id}/messages`,
      headers: bob.auth,
    });
    expect(history.json<{ items: Message[] }>().items.at(-1)?.content).toBe('hey bob');
  });

  it('keeps outsiders out of a conversation', async () => {
    const app = await testApp();
    const conversation = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [bob.id] },
      })
    ).json<DirectConversation>();

    const read = await app.inject({
      method: 'GET',
      url: `/api/dms/${conversation.id}/messages`,
      headers: carol.auth,
    });
    expect(read.statusCode).toBe(403);

    const write = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: carol.auth,
      payload: { content: 'eavesdropping' },
    });
    expect(write.statusCode).toBe(403);
  });

  it('creates a group conversation and allows leaving it', async () => {
    const app = await testApp();
    const group = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [bob.id, carol.id], name: 'Weekend plans' },
      })
    ).json<DirectConversation>();

    expect(group.isGroup).toBe(true);
    expect(group.members).toHaveLength(3);

    const left = await app.inject({
      method: 'POST',
      url: `/api/dms/${group.id}/leave`,
      headers: carol.auth,
    });
    expect(left.statusCode).toBe(204);

    const listed = await app.inject({ method: 'GET', url: '/api/dms', headers: carol.auth });
    expect(listed.json<DirectConversation[]>().some((entry) => entry.id === group.id)).toBe(false);
  });

  it('refuses to open a conversation with an unknown user', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: alice.auth,
      payload: { userIds: ['nobody-with-this-id'] },
    });
    expect(response.statusCode).toBe(400);
  });

  it('orders the conversation list by most recent activity', async () => {
    const app = await testApp();
    const withBob = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [bob.id] },
      })
    ).json<DirectConversation>();

    const withCarol = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [carol.id] },
      })
    ).json<DirectConversation>();

    await app.inject({
      method: 'POST',
      url: `/api/dms/${withBob.id}/messages`,
      headers: alice.auth,
      payload: { content: 'first' },
    });

    // lastMessageAt has millisecond precision, so the two sends need to land in
    // different milliseconds for the ordering assertion to mean anything.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await app.inject({
      method: 'POST',
      url: `/api/dms/${withCarol.id}/messages`,
      headers: alice.auth,
      payload: { content: 'second' },
    });

    const list = await app.inject({ method: 'GET', url: '/api/dms', headers: alice.auth });
    const ids = list
      .json<DirectConversation[]>()
      .filter((conversation) => !conversation.isSaved)
      .map((conversation) => conversation.id);
    expect(ids[0]).toBe(withCarol.id);
  });
});
