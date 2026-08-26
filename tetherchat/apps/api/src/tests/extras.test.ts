import { afterAll, describe, expect, it } from 'vitest';
import type {
  AdminCredentials,
  AdminSession,
  DirectConversation,
  FriendRequest,
  Message,
  MessageReport,
  SelfUser,
  SiteBan,
  TotpChallenge,
  TotpSetup,
} from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createUser, linkFriends, testApp } from './harness.js';
import type { TestUser } from './harness.js';
import { decryptSecret, totpCode } from '../lib/totp.js';
import { dailyAdminCredentials } from '../lib/adminCredentials.js';

const created: TestUser[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.map((user) => user.id) } } });
  await closeTestApp();
});

describe('two-factor authentication', () => {
  it('gates login behind a TOTP ticket after setup', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const setup = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/setup',
      headers: user.auth,
    });
    expect(setup.statusCode).toBe(200);
    const payload = setup.json<TotpSetup>();
    expect(payload.secret).toHaveLength(32);
    expect(payload.otpauthUrl).toContain('otpauth://totp/');

    const enable = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/enable',
      headers: user.auth,
      payload: { code: totpCode(payload.secret) },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json<SelfUser>().totpEnabled).toBe(true);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    expect(login.statusCode).toBe(200);
    const challenge = login.json<TotpChallenge>();
    expect(challenge.requires2fa).toBe(true);

    const finished = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { ticket: challenge.ticket, code: totpCode(payload.secret) },
    });
    expect(finished.statusCode).toBe(200);
    expect(finished.json<{ accessToken: string }>().accessToken).toBeTruthy();
  });
});

describe('friend requests', () => {
  it('sends, accepts, and then allows a DM', async () => {
    const alice = await createUser();
    const bob = await createUser();
    created.push(alice, bob);
    const app = await testApp();

    const denied = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: alice.auth,
      payload: { userIds: [bob.id] },
    });
    expect(denied.statusCode).toBe(403);

    const sent = await app.inject({
      method: 'POST',
      url: '/api/friends/requests',
      headers: alice.auth,
      payload: { userId: bob.id },
    });
    expect(sent.statusCode).toBe(201);

    const incoming = await app.inject({
      method: 'GET',
      url: '/api/friends/incoming',
      headers: bob.auth,
    });
    const requests = incoming.json<FriendRequest[]>();
    expect(requests).toHaveLength(1);
    expect(requests[0].from.id).toBe(alice.id);

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/friends/requests/${requests[0].id}/accept`,
      headers: bob.auth,
    });
    expect(accepted.statusCode).toBe(200);

    const opened = await app.inject({
      method: 'POST',
      url: '/api/dms',
      headers: alice.auth,
      payload: { userIds: [bob.id] },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json<DirectConversation>().members.map((member) => member.id).sort()).toEqual(
      [alice.id, bob.id].sort(),
    );
  });
});

describe('pinned conversations', () => {
  it('pins a DM above unpinned chats', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const carol = await createUser();
    created.push(alice, bob, carol);
    await linkFriends(alice, bob);
    await linkFriends(alice, carol);
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
      url: `/api/dms/${withCarol.id}/messages`,
      headers: alice.auth,
      payload: { content: 'later' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/dms/${withBob.id}/messages`,
      headers: alice.auth,
      payload: { content: 'newer' },
    });

    const pinned = await app.inject({
      method: 'POST',
      url: `/api/dms/${withCarol.id}/pin`,
      headers: alice.auth,
    });
    expect(pinned.json<DirectConversation>().pinned).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/api/dms', headers: alice.auth });
    const ids = list
      .json<DirectConversation[]>()
      .filter((row) => !row.isSaved && !row.isAi)
      .map((row) => row.id);
    expect(ids[0]).toBe(withCarol.id);
    expect(ids).toContain(withBob.id);
  });
});

describe('reports and admin', () => {
  it('lets a user report a message and an admin ban the author', async () => {
    const alice = await createUser();
    const bob = await createUser();
    created.push(alice, bob);
    await linkFriends(alice, bob);
    const app = await testApp();

    const conversation = (
      await app.inject({
        method: 'POST',
        url: '/api/dms',
        headers: alice.auth,
        payload: { userIds: [bob.id] },
      })
    ).json<DirectConversation>();
    const message = (
      await app.inject({
        method: 'POST',
        url: `/api/dms/${conversation.id}/messages`,
        headers: bob.auth,
        payload: { content: 'spam ||hidden||' },
      })
    ).json<Message>();

    const reported = await app.inject({
      method: 'POST',
      url: '/api/reports',
      headers: alice.auth,
      payload: { messageId: message.id, comment: 'спам' },
    });
    expect(reported.statusCode).toBe(201);
    expect(reported.json<MessageReport>().comment).toBe('спам');

    const creds = dailyAdminCredentials();
    const session = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { login: creds.login, password: creds.password },
    });
    expect(session.statusCode).toBe(200);
    const adminAuth = { authorization: `Bearer ${session.json<AdminSession>().accessToken}` };

    const pending = await app.inject({
      method: 'GET',
      url: '/api/admin/reports?status=pending',
      headers: adminAuth,
    });
    expect(pending.json<MessageReport[]>().some((row) => row.messageId === message.id)).toBe(true);

    const banned = await app.inject({
      method: 'POST',
      url: `/api/admin/reports/${reported.json<MessageReport>().id}/ban`,
      headers: adminAuth,
      payload: { durationHours: 24, message: 'Спам. Попробуйте завтра.' },
    });
    expect(banned.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: bob.email, password: bob.password },
    });
    expect(login.statusCode).toBe(403);
    expect(login.json<{ code: string }>().code).toBe('account_banned');

    const bans = await app.inject({ method: 'GET', url: '/api/admin/bans', headers: adminAuth });
    const ban = bans.json<SiteBan[]>().find((row) => row.user.id === bob.id);
    expect(ban?.reason).toContain('Спам');

    const lifted = await app.inject({
      method: 'POST',
      url: `/api/admin/bans/${ban!.id}/lift`,
      headers: adminAuth,
    });
    expect(lifted.statusCode).toBe(200);

    const again = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: bob.email, password: bob.password },
    });
    expect(again.statusCode).toBe(200);
  });

  it('reveals daily admin credentials only with 2FA', async () => {
    const admin = await createUser();
    created.push(admin);
    await prisma.user.update({
      where: { id: admin.id },
      data: { isPlatformAdmin: true },
    });

    const app = await testApp();
    const setup = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/setup',
      headers: admin.auth,
    });
    const secret = setup.json<TotpSetup>().secret;
    await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/enable',
      headers: admin.auth,
      payload: { code: totpCode(secret) },
    });

    const denied = await app.inject({
      method: 'POST',
      url: '/api/auth/admin-credentials',
      headers: admin.auth,
      payload: { code: '000000' },
    });
    expect(denied.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/admin-credentials',
      headers: admin.auth,
      payload: { code: totpCode(secret) },
    });
    expect(ok.statusCode).toBe(200);
    const creds = ok.json<AdminCredentials>();
    expect(creds.login).toHaveLength(18);
    expect(creds.password).toHaveLength(18);
  });
});

describe('totp secret roundtrip', () => {
  it('encrypts and decrypts a secret', async () => {
    const { encryptSecret } = await import('../lib/totp.js');
    const packed = encryptSecret('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
    expect(decryptSecret(packed)).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
  });
});
