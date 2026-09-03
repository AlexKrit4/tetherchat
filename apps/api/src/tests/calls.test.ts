import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DirectConversation } from '@tetherchat/shared';
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
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id, carol.id] } } });
  await closeTestApp();
});

async function openDm(from: TestUser, to: TestUser): Promise<string> {
  const app = await testApp();
  const response = await app.inject({
    method: 'POST',
    url: '/api/dms',
    headers: from.auth,
    payload: { userIds: [to.id] },
  });
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  return response.json<DirectConversation>().id;
}

describe('voice calls', () => {
  it('does not drop an answered call when another friend dials after 30s', async () => {
    const app = await testApp();
    const aliceBob = await openDm(alice, bob);
    const aliceCarol = await openDm(alice, carol);

    const started = await app.inject({
      method: 'POST',
      url: '/api/calls/start',
      headers: alice.auth,
      payload: { conversationId: aliceBob },
    });
    expect(started.statusCode).toBe(200);
    const { callId } = started.json<{ callId: string }>();

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/calls/${callId}/accept`,
      headers: bob.auth,
    });
    expect(accepted.statusCode).toBe(200);

    await prisma.call.update({
      where: { id: callId },
      data: { startedAt: new Date(Date.now() - 45_000) },
    });

    const thirdParty = await app.inject({
      method: 'POST',
      url: '/api/calls/start',
      headers: carol.auth,
      payload: { conversationId: aliceCarol },
    });
    expect(thirdParty.statusCode).toBe(409);

    const live = await prisma.call.findUnique({
      where: { id: callId },
      select: { status: true },
    });
    expect(live?.status).toBe('active');
  });
});
