import { afterAll, describe, expect, it } from 'vitest';
import { LIMITS } from '@tetherchat/shared';
import type { DirectConversation, PublicUser, SelfUser } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createUser, linkFriends, testApp } from './harness.js';
import type { TestUser } from './harness.js';
import { TEST_TRANSCRIPT } from '../services/llmService.js';

const created: TestUser[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.map((user) => user.id) } } });
  await closeTestApp();
});

async function grantPlus(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { isPlus: true, plusUntil: null } });
}

describe('TetherChat Plus', () => {
  it('serializes isPlus on /api/users/@me and hides lastSeenAt when requested', async () => {
    const alice = await createUser();
    const bob = await createUser();
    created.push(alice, bob);
    const app = await testApp();

    const me = await app.inject({ method: 'GET', url: '/api/users/@me', headers: alice.auth });
    expect(me.json<SelfUser>().isPlus).toBe(false);

    const hidden = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: alice.auth,
      payload: { hideLastSeen: true },
    });
    expect(hidden.statusCode).toBe(403);

    await grantPlus(alice.id);
    const enabled = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: alice.auth,
      payload: { hideLastSeen: true },
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json<SelfUser>().isPlus).toBe(true);
    expect(enabled.json<SelfUser>().hideLastSeen).toBe(true);
    expect(enabled.json<SelfUser>().lastSeenAt).toBeTruthy();

    const seen = await app.inject({
      method: 'GET',
      url: `/api/users/${alice.id}`,
      headers: bob.auth,
    });
    expect(seen.json<PublicUser>().isPlus).toBe(true);
    expect(seen.json<PublicUser>().lastSeenAt).toBeNull();
  });

  it('locks banner and accent colours without Plus', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const denied = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bannerColor: '#123456' },
    });
    expect(denied.statusCode).toBe(403);

    await grantPlus(user.id);
    const allowed = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bannerColor: '#123456', accentColor: '#abcdef' },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json<SelfUser>().bannerColor).toBe('#123456');
    expect(allowed.json<SelfUser>().accentColor).toBe('#abcdef');
  });

  it('caps bio at 50 for free and 500 for Plus', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();
    const tooLong = 'x'.repeat(LIMITS.bio.max + 1);

    const denied = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bio: tooLong },
    });
    expect(denied.statusCode).toBe(400);

    const okFree = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bio: 'x'.repeat(LIMITS.bio.max) },
    });
    expect(okFree.statusCode).toBe(200);

    await grantPlus(user.id);
    const plusBio = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bio: 'y'.repeat(LIMITS.bio.plus) },
    });
    expect(plusBio.statusCode).toBe(200);

    const overPlus = await app.inject({
      method: 'PATCH',
      url: '/api/users/@me',
      headers: user.auth,
      payload: { bio: 'z'.repeat(LIMITS.bio.plus + 1) },
    });
    expect(overPlus.statusCode).toBe(400);
  });

  it('caps pinned DMs at 5 for free and 10 for Plus', async () => {
    const alice = await createUser();
    created.push(alice);
    const app = await testApp();
    const peers: TestUser[] = [];
    for (let i = 0; i < 11; i += 1) {
      const peer = await createUser();
      created.push(peer);
      peers.push(peer);
      await linkFriends(alice, peer);
    }

    const ids: string[] = [];
    for (const peer of peers) {
      const dm = await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [peer.id] },
      });
      ids.push(dm.json<DirectConversation>().id);
    }

    for (let i = 0; i < LIMITS.pinnedDms; i += 1) {
      const pin = await app.inject({
        method: 'POST',
        url: `/api/dms/${ids[i]}/pin`,
        headers: alice.auth,
      });
      expect(pin.statusCode).toBe(200);
    }

    const sixth = await app.inject({
      method: 'POST',
      url: `/api/dms/${ids[LIMITS.pinnedDms]}/pin`,
      headers: alice.auth,
    });
    expect(sixth.statusCode).toBe(403);

    await grantPlus(alice.id);
    for (let i = LIMITS.pinnedDms; i < LIMITS.pinnedDmsPlus; i += 1) {
      const pin = await app.inject({
        method: 'POST',
        url: `/api/dms/${ids[i]}/pin`,
        headers: alice.auth,
      });
      expect(pin.statusCode).toBe(200);
    }

    const eleventh = await app.inject({
      method: 'POST',
      url: `/api/dms/${ids[LIMITS.pinnedDmsPlus]}/pin`,
      headers: alice.auth,
    });
    expect(eleventh.statusCode).toBe(400);
  });

  it('rejects transcription without Plus and caches the result for Plus', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: user.id,
        storageKey: `test/${user.id}/voice.webm`,
        url: 'https://example.test/voice.webm',
        filename: 'voice.webm',
        contentType: 'audio/webm',
        size: 1024,
      },
    });

    const denied = await app.inject({
      method: 'POST',
      url: `/api/attachments/${attachment.id}/transcribe`,
      headers: user.auth,
    });
    expect(denied.statusCode).toBe(403);

    await grantPlus(user.id);
    const first = await app.inject({
      method: 'POST',
      url: `/api/attachments/${attachment.id}/transcribe`,
      headers: user.auth,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json<{ transcript: string; cached: boolean }>()).toEqual({
      transcript: TEST_TRANSCRIPT,
      cached: false,
    });

    const second = await app.inject({
      method: 'POST',
      url: `/api/attachments/${attachment.id}/transcribe`,
      headers: user.auth,
    });
    expect(second.json<{ cached: boolean }>().cached).toBe(true);
  });

  it('lets a platform admin grant Plus', async () => {
    const admin = await createUser();
    const target = await createUser();
    created.push(admin, target);
    await prisma.user.update({ where: { id: admin.id }, data: { isPlatformAdmin: true } });
    const app = await testApp();

    const granted = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${target.id}/plus`,
      headers: admin.auth,
      payload: { enabled: true },
    });
    expect(granted.statusCode).toBe(200);
    expect(granted.json<PublicUser>().isPlus).toBe(true);

    const stranger = await createUser();
    created.push(stranger);
    const denied = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${target.id}/plus`,
      headers: stranger.auth,
      payload: { enabled: false },
    });
    expect(denied.statusCode).toBe(403);
  });
});
