import { afterAll, describe, expect, it } from 'vitest';
import type { DirectConversation, PublicUser } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createUser, testApp } from './harness.js';
import type { TestUser } from './harness.js';

const created: TestUser[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.map((user) => user.id) } } });
  await closeTestApp();
});

describe('user blocks', () => {
  it('blocks a user, hides the 1:1 DM, and refuses new messages either way', async () => {
    const alice = await createUser();
    const bob = await createUser();
    created.push(alice, bob);
    const app = await testApp();

    const opened = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: alice.auth,
      payload: { userIds: [bob.id] },
    });
    expect(opened.statusCode).toBe(201);
    const conversation = opened.json<DirectConversation>();

    const sent = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: bob.auth,
      payload: { content: 'hello' },
    });
    expect(sent.statusCode).toBe(201);

    const blocked = await app.inject({
      method: 'PUT',
      url: `/api/users/@me/blocks/${bob.id}`,
      headers: alice.auth,
    });
    expect(blocked.statusCode).toBe(200);
    expect(blocked.json<PublicUser>().id).toBe(bob.id);

    const list = await app.inject({
      method: 'GET',
      url: '/api/users/@me/blocks',
      headers: alice.auth,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<PublicUser[]>().map((user) => user.id)).toContain(bob.id);

    const aliceDms = await app.inject({ method: 'GET', url: '/api/dms', headers: alice.auth });
    expect(aliceDms.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(
      false,
    );

    const bobDms = await app.inject({ method: 'GET', url: '/api/dms', headers: bob.auth });
    expect(bobDms.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(
      false,
    );

    const fromBob = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/messages`,
      headers: bob.auth,
      payload: { content: 'still there?' },
    });
    expect(fromBob.statusCode).toBe(403);

    const reopen = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: bob.auth,
      payload: { userIds: [alice.id] },
    });
    expect(reopen.statusCode).toBe(403);

    const unblocked = await app.inject({
      method: 'DELETE',
      url: `/api/users/@me/blocks/${bob.id}`,
      headers: alice.auth,
    });
    expect(unblocked.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: '/api/dms', headers: alice.auth });
    expect(after.json<DirectConversation[]>().some((row) => row.id === conversation.id)).toBe(true);
  });

  it('refuses to block yourself or a missing user', async () => {
    const alice = await createUser();
    created.push(alice);
    const app = await testApp();

    const self = await app.inject({
      method: 'PUT',
      url: `/api/users/@me/blocks/${alice.id}`,
      headers: alice.auth,
    });
    expect(self.statusCode).toBe(400);

    const missing = await app.inject({
      method: 'PUT',
      url: '/api/users/@me/blocks/does-not-exist',
      headers: alice.auth,
    });
    expect(missing.statusCode).toBe(404);
  });
});
