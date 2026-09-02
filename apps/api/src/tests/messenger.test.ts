import { afterAll, describe, expect, it } from 'vitest';
import type { DirectConversation, Message, Session } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { getBotUserId } from '../lib/bots.js';
import { hashPassword } from '../lib/tokens.js';
import { closeTestApp, createServer, createUser, firstChannel, linkFriends, testApp } from './harness.js';
import type { TestUser } from './harness.js';

const created: TestUser[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.map((user) => user.id) } } });
  await closeTestApp();
});

describe('saved messages', () => {
  it('creates a Saved Messages conversation and lists it first', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const saved = await app.inject({ method: 'GET', url: '/api/dms/saved', headers: user.auth });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<DirectConversation>().isSaved).toBe(true);
    expect(saved.json<DirectConversation>().members).toHaveLength(1);

    const list = await app.inject({ method: 'GET', url: '/api/dms', headers: user.auth });
    expect(list.json<DirectConversation[]>()[0].isSaved).toBe(true);
    expect(list.json<DirectConversation[]>().some((row) => row.isAi)).toBe(true);
  });
});

describe('ai chat', () => {
  it('lists the built-in AI conversation and replies without an API key', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const list = await app.inject({ method: 'GET', url: '/api/dms', headers: user.auth });
    expect(list.statusCode).toBe(200);
    const conversations = list.json<DirectConversation[]>();
    expect(conversations[0]?.isSaved).toBe(true);
    const ai = conversations.find((row) => row.isAi);
    expect(ai).toBeTruthy();
    expect(ai!.members).toHaveLength(2);

    const sent = await app.inject({
      method: 'POST',
      url: `/api/dms/${ai!.id}/messages`,
      headers: user.auth,
      payload: { content: 'привет' },
    });
    expect(sent.statusCode).toBe(201);

    const history = await app.inject({
      method: 'GET',
      url: `/api/dms/${ai!.id}/messages`,
      headers: user.auth,
    });
    const items = history.json<{ items: Message[] }>().items;
    expect(items).toHaveLength(2);
    expect(items[0]!.content).toBe('привет');
    expect(items[0]!.authorId).toBe(user.id);
    expect(items[1]!.content).toBe('Это тестовый ответ нейросети.');
    expect(items[1]!.authorId).not.toBe(user.id);
  });

  it('rejects registering the reserved AI username', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `tetherai-${Date.now()}@example.test`,
        username: 'tetherai',
        password: 'sup3r-secret-pass',
      },
    });
    expect(response.statusCode).toBe(409);
  });

  it('rejects registering reserved bot emails', async () => {
    const app = await testApp();
    for (const email of [
      'tetherai@tetherchat.invalid',
      'tethervpn@tetherchat.invalid',
      'tethermonitor@tetherchat.invalid',
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          username: `sq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          password: 'sup3r-secret-pass',
        },
      });
      expect(response.statusCode).toBe(409);
    }
  });

  it('does not promote a regular account that squatted a bot email into the bot', async () => {
    const occupied = await prisma.user.findUnique({
      where: { email: 'tethermonitor@tetherchat.invalid' },
      select: { id: true, isBot: true },
    });

    const emailSquatter = occupied
      ? null
      : await prisma.user.create({
          data: {
            email: 'tethermonitor@tetherchat.invalid',
            username: `msq${Date.now().toString(36).slice(-8)}`,
            passwordHash: await hashPassword('sup3r-secret-pass'),
          },
        });
    if (emailSquatter) {
      created.push({
        id: emailSquatter.id,
        email: emailSquatter.email,
        username: emailSquatter.username,
        password: 'sup3r-secret-pass',
        accessToken: '',
        auth: { authorization: '' },
      });
    }

    const bystander = await prisma.user.create({
      data: {
        email: `squat-${Date.now()}@example.test`,
        username: `sq${Date.now().toString(36).slice(-8)}`,
        passwordHash: await hashPassword('sup3r-secret-pass'),
      },
    });
    created.push({
      id: bystander.id,
      email: bystander.email,
      username: bystander.username,
      password: 'sup3r-secret-pass',
      accessToken: '',
      auth: { authorization: '' },
    });

    const botId = await getBotUserId('monitor');
    expect(botId).not.toBe(bystander.id);
    if (emailSquatter) expect(botId).not.toBe(emailSquatter.id);

    const stillBystander = await prisma.user.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(stillBystander.isBot).toBe(false);

    if (emailSquatter) {
      const stillHuman = await prisma.user.findUniqueOrThrow({ where: { id: emailSquatter.id } });
      expect(stillHuman.isBot).toBe(false);
      const bot = await prisma.user.findUniqueOrThrow({ where: { id: botId } });
      expect(bot.isBot).toBe(true);
      expect(bot.username).toBe('tethermonitor');
    }
  });
});

describe('read receipts', () => {
  it('exposes the peer read cursor on 1:1 DMs after ack, but not on servers', async () => {
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

    const sent = (
      await app.inject({
        method: 'POST',
        url: `/api/dms/${conversation.id}/messages`,
        headers: alice.auth,
        payload: { content: 'seen?' },
      })
    ).json<Message>();

    const before = await app.inject({
      method: 'GET',
      url: `/api/dms/${conversation.id}`,
      headers: alice.auth,
    });
    expect(before.json<DirectConversation>().peerLastReadMessageId).toBeNull();

    const ack = await app.inject({
      method: 'POST',
      url: `/api/dms/${conversation.id}/ack`,
      headers: bob.auth,
      payload: { messageId: sent.id },
    });
    expect(ack.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: `/api/dms/${conversation.id}`,
      headers: alice.auth,
    });
    expect(after.json<DirectConversation>().peerLastReadMessageId).toBe(sent.id);
    expect(after.json<DirectConversation>().peerLastReadAt).toBeTruthy();
  });
});

describe('forward', () => {
  it('copies a DM message into another conversation', async () => {
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

    const original = (
      await app.inject({
        method: 'POST',
        url: `/api/dms/${withBob.id}/messages`,
        headers: bob.auth,
        payload: { content: 'please forward me' },
      })
    ).json<Message>();

    const forwarded = await app.inject({
      method: 'POST',
      url: `/api/dms/${withCarol.id}/messages`,
      headers: alice.auth,
      payload: { content: '', forwardMessageId: original.id },
    });
    expect(forwarded.statusCode).toBe(201);
    const body = forwarded.json<Message>();
    expect(body.content).toBe('please forward me');
    expect(body.forwardedFrom?.id).toBe(original.id);
    expect(body.authorId).toBe(alice.id);
  });

  it('forwards a channel message into Saved Messages', async () => {
    const owner = await createUser();
    created.push(owner);
    const app = await testApp();
    const server = await createServer(owner, 'Forward Target');
    const channelId = firstChannel(server).id;

    const original = (
      await app.inject({
        method: 'POST',
        url: `/api/channels/${channelId}/messages`,
        headers: owner.auth,
        payload: { content: 'keep this' },
      })
    ).json<Message>();

    const saved = (
      await app.inject({ method: 'GET', url: '/api/dms/saved', headers: owner.auth })
    ).json<DirectConversation>();

    const forwarded = await app.inject({
      method: 'POST',
      url: `/api/dms/${saved.id}/messages`,
      headers: owner.auth,
      payload: { forwardMessageId: original.id },
    });
    expect(forwarded.statusCode).toBe(201);
    expect(forwarded.json<Message>().forwardedFrom?.id).toBe(original.id);
  });
});

describe('sessions', () => {
  it('lists the current session and can revoke others', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const listed = await app.inject({
      method: 'GET',
      url: '/api/auth/sessions',
      headers: {
        ...user.auth,
        'x-refresh-token': user.refreshToken ?? '',
      },
    });
    expect(listed.statusCode).toBe(200);
    const sessions = listed.json<Session[]>();
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some((session) => session.current)).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    expect(second.statusCode).toBe(200);

    const afterLogin = await app.inject({
      method: 'GET',
      url: '/api/auth/sessions',
      headers: {
        ...user.auth,
        'x-refresh-token': user.refreshToken ?? '',
      },
    });
    expect(afterLogin.json<Session[]>().length).toBeGreaterThanOrEqual(2);

    const revoked = await app.inject({
      method: 'POST',
      url: '/api/auth/sessions/revoke-others',
      headers: {
        ...user.auth,
        'x-refresh-token': user.refreshToken ?? '',
      },
    });
    expect(revoked.statusCode).toBe(204);

    const remaining = await app.inject({
      method: 'GET',
      url: '/api/auth/sessions',
      headers: {
        ...user.auth,
        'x-refresh-token': user.refreshToken ?? '',
      },
    });
    expect(remaining.json<Session[]>().every((session) => session.current)).toBe(true);
    expect(remaining.json<Session[]>()).toHaveLength(1);
  });
});
