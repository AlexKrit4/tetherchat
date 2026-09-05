import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Permission, DEFAULT_PERMISSIONS, encodeUserMention } from '@tetherchat/shared';
import type { Message, ServerDetail } from '@tetherchat/shared';
import { prisma } from '../db.js';
import {
  closeTestApp,
  createServer,
  createUser,
  firstChannel,
  grantPermissions,
  joinServer,
  testApp,
} from './harness.js';
import type { TestUser } from './harness.js';

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;
let server: ServerDetail;
let channelId: string;

beforeAll(async () => {
  owner = await createUser();
  member = await createUser();
  outsider = await createUser();
  server = await createServer(owner, 'Message Tests');
  channelId = firstChannel(server).id;
  await joinServer(server.id, member);
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [owner.id, member.id, outsider.id] } },
  });
  await closeTestApp();
});

async function send(user: TestUser, payload: Record<string, unknown>) {
  const app = await testApp();
  return app.inject({
    method: 'POST',
    url: `/api/channels/${channelId}/messages`,
    headers: user.auth,
    payload,
  });
}

describe('messages', () => {
  it('posts a message and lists it in history', async () => {
    const response = await send(owner, { content: 'first post' });
    expect(response.statusCode).toBe(201);
    expect(response.json<Message>().content).toBe('first post');

    const app = await testApp();
    const history = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages`,
      headers: owner.auth,
    });

    expect(history.statusCode).toBe(200);
    const body = history.json<{ items: Message[]; hasMore: boolean }>();
    expect(body.items.at(-1)?.content).toBe('first post');
  });

  it('rejects an empty message and one over the length limit', async () => {
    expect((await send(owner, { content: '   ' })).statusCode).toBe(400);
    expect((await send(owner, { content: 'x'.repeat(4001) })).statusCode).toBe(400);
  });

  it('keeps non-members out of the channel', async () => {
    expect((await send(outsider, { content: 'let me in' })).statusCode).toBe(403);

    const app = await testApp();
    const history = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages`,
      headers: outsider.auth,
    });
    expect(history.statusCode).toBe(403);
  });

  it('honours the SEND_MESSAGES permission', async () => {
    await grantPermissions(server.id, Permission.VIEW_CHANNEL);
    expect((await send(member, { content: 'muted?' })).statusCode).toBe(403);

    await grantPermissions(server.id, DEFAULT_PERMISSIONS);
    expect((await send(member, { content: 'unmuted' })).statusCode).toBe(201);
  });

  it('records mentions only for real members', async () => {
    const response = await send(owner, {
      content: `hey ${encodeUserMention(member.id)} and ${encodeUserMention(outsider.id)}`,
    });

    const message = response.json<Message>();
    expect(message.mentionedUserIds).toEqual([member.id]);
  });

  it('ignores @everyone from members without the permission', async () => {
    await grantPermissions(server.id, DEFAULT_PERMISSIONS);
    const withoutPermission = await send(member, { content: '@everyone listen up' });
    expect(withoutPermission.json<Message>().mentionsEveryone).toBe(false);

    const asOwner = await send(owner, { content: '@everyone listen up' });
    expect(asOwner.json<Message>().mentionsEveryone).toBe(true);
  });

  it('lets the author edit and marks the message as edited', async () => {
    const created = (await send(owner, { content: 'typo here' })).json<Message>();
    const app = await testApp();

    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/messages/${created.id}`,
      headers: owner.auth,
      payload: { content: 'typo fixed' },
    });

    expect(edited.statusCode).toBe(200);
    const body = edited.json<Message>();
    expect(body.content).toBe('typo fixed');
    expect(body.editedAt).not.toBeNull();
  });

  it('refuses edits from anybody but the author', async () => {
    const created = (await send(owner, { content: 'mine' })).json<Message>();
    const app = await testApp();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/messages/${created.id}`,
      headers: member.auth,
      payload: { content: 'hijacked' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lets a moderator delete somebody else message but not a plain member', async () => {
    const app = await testApp();
    const victim = (await send(member, { content: 'delete me' })).json<Message>();

    const byOwner = await app.inject({
      method: 'DELETE',
      url: `/api/messages/${victim.id}`,
      headers: owner.auth,
    });
    expect(byOwner.statusCode).toBe(204);

    const ownerMessage = (await send(owner, { content: 'not yours' })).json<Message>();
    const byMember = await app.inject({
      method: 'DELETE',
      url: `/api/messages/${ownerMessage.id}`,
      headers: member.auth,
    });
    expect(byMember.statusCode).toBe(403);
  });

  it('refuses to let a kicked member delete their old messages', async () => {
    const app = await testApp();
    const host = await createUser();
    const visitor = await createUser();
    const server = await createServer(host, 'Kick Delete');
    const target = firstChannel(server).id;
    await joinServer(server.id, visitor);

    const posted = await app.inject({
      method: 'POST',
      url: `/api/channels/${target}/messages`,
      headers: visitor.auth,
      payload: { content: 'please erase me later' },
    });
    expect(posted.statusCode).toBe(201);
    const messageId = posted.json<Message>().id;

    const kicked = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}/members/${visitor.id}`,
      headers: host.auth,
    });
    expect(kicked.statusCode).toBe(204);

    const erased = await app.inject({
      method: 'DELETE',
      url: `/api/messages/${messageId}`,
      headers: visitor.auth,
    });
    expect(erased.statusCode).toBe(403);

    const history = await app.inject({
      method: 'GET',
      url: `/api/channels/${target}/messages`,
      headers: host.auth,
    });
    expect(history.json<{ items: Message[] }>().items.some((item) => item.id === messageId)).toBe(
      true,
    );

    await prisma.user.deleteMany({ where: { id: { in: [host.id, visitor.id] } } });
  });

  it('toggles a reaction on and off', async () => {
    const app = await testApp();
    const message = (await send(owner, { content: 'react here' })).json<Message>();

    const added = await app.inject({
      method: 'PUT',
      url: `/api/messages/${message.id}/reactions`,
      headers: member.auth,
      payload: { emoji: '🎉' },
    });
    expect(added.json<{ reactions: Message['reactions'] }>().reactions[0]).toMatchObject({
      emoji: '🎉',
      count: 1,
    });

    const removed = await app.inject({
      method: 'PUT',
      url: `/api/messages/${message.id}/reactions`,
      headers: member.auth,
      payload: { emoji: '🎉' },
    });
    expect(removed.json<{ reactions: Message['reactions'] }>().reactions).toHaveLength(0);
  });

  it('replies only to messages in the same channel', async () => {
    const app = await testApp();
    const target = (await send(owner, { content: 'parent' })).json<Message>();

    const valid = await send(member, { content: 'child', replyToId: target.id });
    expect(valid.statusCode).toBe(201);
    expect(valid.json<Message>().replyTo?.id).toBe(target.id);

    const otherServer = await createServer(owner, 'Elsewhere');
    const elsewhere = await app.inject({
      method: 'POST',
      url: `/api/channels/${firstChannel(otherServer).id}/messages`,
      headers: owner.auth,
      payload: { content: 'cross-channel reply', replyToId: target.id },
    });
    expect(elsewhere.statusCode).toBe(400);
  });

  it('paginates history from newest to oldest', async () => {
    const app = await testApp();
    const fresh = await createServer(owner, 'Pagination');
    const paginated = firstChannel(fresh).id;

    for (let index = 0; index < 7; index += 1) {
      await app.inject({
        method: 'POST',
        url: `/api/channels/${paginated}/messages`,
        headers: owner.auth,
        payload: { content: `message ${index}` },
      });
    }

    const firstPage = await app.inject({
      method: 'GET',
      url: `/api/channels/${paginated}/messages?limit=3`,
      headers: owner.auth,
    });
    const first = firstPage.json<{ items: Message[]; hasMore: boolean }>();

    expect(first.items.map((item) => item.content)).toEqual(['message 4', 'message 5', 'message 6']);
    expect(first.hasMore).toBe(true);

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/channels/${paginated}/messages?limit=3&before=${first.items[0].id}`,
      headers: owner.auth,
    });
    const second = secondPage.json<{ items: Message[]; hasMore: boolean }>();
    expect(second.items.map((item) => item.content)).toEqual(['message 1', 'message 2', 'message 3']);
  });

  it('searches message content case-insensitively', async () => {
    const app = await testApp();
    await send(owner, { content: 'The Penguin Slide is undefeated' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages/search?q=penguin`,
      headers: owner.auth,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<Message[]>().some((item) => item.content.includes('Penguin'))).toBe(true);
  });

  it('pins and unpins with MANAGE_MESSAGES', async () => {
    const app = await testApp();
    const message = (await send(owner, { content: 'pin me' })).json<Message>();

    const denied = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}/pins/${message.id}`,
      headers: member.auth,
    });
    expect(denied.statusCode).toBe(403);

    const pinned = await app.inject({
      method: 'PUT',
      url: `/api/channels/${channelId}/pins/${message.id}`,
      headers: owner.auth,
    });
    expect(pinned.statusCode).toBe(204);

    const pins = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/pins`,
      headers: owner.auth,
    });
    expect(pins.json<Message[]>().some((item) => item.id === message.id)).toBe(true);

    const unpinned = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${channelId}/pins/${message.id}`,
      headers: owner.auth,
    });
    expect(unpinned.statusCode).toBe(204);
  });

  it('tracks unread state and clears it on ack', async () => {
    const app = await testApp();
    const fresh = await createServer(owner, 'Read State');
    await joinServer(fresh.id, member);
    const target = firstChannel(fresh).id;

    const posted = (
      await app.inject({
        method: 'POST',
        url: `/api/channels/${target}/messages`,
        headers: owner.auth,
        payload: { content: `hello ${encodeUserMention(member.id)}` },
      })
    ).json<Message>();

    const before = await app.inject({
      method: 'GET',
      url: '/api/users/@me/read-states',
      headers: member.auth,
    });
    const unread = before.json<{ channelId: string; unread: boolean; mentionCount: number }[]>();
    const state = unread.find((entry) => entry.channelId === target);
    expect(state?.unread).toBe(true);
    expect(state?.mentionCount).toBe(1);

    await app.inject({
      method: 'POST',
      url: `/api/channels/${target}/ack`,
      headers: member.auth,
      payload: { messageId: posted.id },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/api/users/@me/read-states',
      headers: member.auth,
    });
    const cleared = after
      .json<{ channelId: string; unread: boolean; mentionCount: number }[]>()
      .find((entry) => entry.channelId === target);
    expect(cleared?.unread).toBe(false);
    expect(cleared?.mentionCount).toBe(0);
  });
});
