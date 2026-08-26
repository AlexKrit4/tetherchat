import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Channel, Message } from '@tetherchat/shared';
import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { attachSocketServer } from '../ws/index.js';
import { realtimeServer } from '../ws/realtime.js';
import {
  closeTestApp,
  createServer,
  createUser,
  firstChannel,
  joinServer,
  testApp,
} from './harness.js';
import type { TestUser } from './harness.js';

let port: number;
const sockets: Socket[] = [];
const createdUserIds: string[] = [];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spawnUser(): Promise<TestUser> {
  const user = await createUser();
  createdUserIds.push(user.id);
  return user;
}

async function connectUser(user: TestUser): Promise<Socket> {
  const socket = io(`http://127.0.0.1:${port}`, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: user.accessToken, silent: true },
    extraHeaders: { Origin: 'http://localhost:5173' },
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 8_000);
    socket.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}

async function roomsOf(userId: string): Promise<Set<string>> {
  const server = realtimeServer();
  if (!server) throw new Error('realtime server is not attached');
  const connected = await server.in(socketRooms.user(userId)).fetchSockets();
  const rooms = new Set<string>();
  for (const socket of connected) {
    for (const room of socket.rooms) rooms.add(room);
  }
  return rooms;
}

function nextMessage(socket: Socket, timeoutMs = 4_000): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message:new', onMessage);
      reject(new Error('timed out waiting for message:new'));
    }, timeoutMs);
    function onMessage(payload: Message) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once('message:new', onMessage);
  });
}

beforeAll(async () => {
  const app = await testApp();
  await attachSocketServer(app);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('API did not bind a TCP port');
  port = address.port;
});

afterEach(() => {
  while (sockets.length) {
    sockets.pop()?.close();
  }
});

afterAll(async () => {
  while (sockets.length) {
    sockets.pop()?.close();
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await closeTestApp();
});

describe('websocket channel authorization', () => {
  it('does not join a stranger who subscribes to a private channel', async () => {
    const owner = await spawnUser();
    const outsider = await spawnUser();
    const server = await createServer(owner, 'Private WS');
    const channelId = firstChannel(server).id;
    const stranger = await connectUser(outsider);

    stranger.emit('channel:subscribe', { channelId });
    await wait(200);

    expect((await roomsOf(outsider.id)).has(socketRooms.channel(channelId))).toBe(false);

    const received: Message[] = [];
    stranger.on('message:new', (payload: Message) => received.push(payload));

    const app = await testApp();
    const posted = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/messages`,
      headers: owner.auth,
      payload: { content: 'secret to members only' },
    });
    expect(posted.statusCode).toBe(201);
    await wait(300);
    expect(received).toHaveLength(0);
  });

  it('lets a member subscribe to a channel created after they connected', async () => {
    const owner = await spawnUser();
    const member = await spawnUser();
    const server = await createServer(owner, 'Live Subscribe');
    await joinServer(server.id, member);
    const memberSocket = await connectUser(member);

    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/channels`,
      headers: owner.auth,
      payload: { name: 'late-channel' },
    });
    expect(created.statusCode).toBe(201);
    const channelId = created.json<Channel>().id;

    memberSocket.emit('channel:subscribe', { channelId });
    const pending = nextMessage(memberSocket);
    await wait(200);

    const posted = await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/messages`,
      headers: owner.auth,
      payload: { content: 'hello from the new channel' },
    });
    expect(posted.statusCode).toBe(201);
    await expect(pending).resolves.toMatchObject({ content: 'hello from the new channel' });
  });

  it('removes a kicked member from channel rooms and blocks resubscribe', async () => {
    const owner = await spawnUser();
    const member = await spawnUser();
    const server = await createServer(owner, 'Kick WS');
    const channelId = firstChannel(server).id;
    await joinServer(server.id, member);
    const memberSocket = await connectUser(member);

    expect((await roomsOf(member.id)).has(socketRooms.channel(channelId))).toBe(true);

    const app = await testApp();
    const kicked = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}/members/${member.id}`,
      headers: owner.auth,
    });
    expect(kicked.statusCode).toBe(204);
    await wait(200);

    expect((await roomsOf(member.id)).has(socketRooms.channel(channelId))).toBe(false);

    const received: Message[] = [];
    memberSocket.on('message:new', (payload: Message) => received.push(payload));

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/channels/${channelId}/messages`,
          headers: owner.auth,
          payload: { content: 'after kick' },
        })
      ).statusCode,
    ).toBe(201);
    await wait(300);
    expect(received).toHaveLength(0);

    memberSocket.emit('channel:subscribe', { channelId });
    await wait(200);
    expect((await roomsOf(member.id)).has(socketRooms.channel(channelId))).toBe(false);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/channels/${channelId}/messages`,
          headers: owner.auth,
          payload: { content: 'after resubscribe attempt' },
        })
      ).statusCode,
    ).toBe(201);
    await wait(300);
    expect(received).toHaveLength(0);
  });
});
