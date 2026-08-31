import { createAdapter } from '@socket.io/redis-adapter';
import { Server as SocketServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { TYPING_TIMEOUT_MS, socketRooms, PRESENCE_STATUSES } from '@tetherchat/shared';
import type { AckResult } from '@tetherchat/shared';
import { getConfig } from '../config.js';
import { webCorsOrigins } from '../lib/corsOrigins.js';
import { prisma } from '../db.js';
import { isApiError } from '../errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { activeSiteBan } from '../lib/platformAdmin.js';
import { createRedis } from '../redis.js';
import {
  createMessage,
  deleteMessage,
  editMessage,
  toggleReaction,
} from '../services/messageService.js';
import { ackTarget } from '../services/readStateService.js';
import { acceptCall, declineCall, endCall } from '../services/callService.js';
import { broadcastPresence, registerSession, setStatus, unregisterSession } from './presence.js';
import { setRealtimeServer } from './realtime.js';
import type { SocketData, TypedServer } from './realtime.js';
import { handshakeIsSilent } from './silent.js';

interface TypingEntry {
  userId: string;
  username: string;
  expiresAt: number;
}

const typingByChannel = new Map<string, Map<string, TypingEntry>>();

function fail(error: unknown): AckResult<never> {
  if (isApiError(error)) return { ok: false, code: error.code, message: error.message };
  return { ok: false, code: 'internal_error', message: 'Что-то пошло не так' };
}

/** Rooms a user must join on connect so they receive server and channel traffic. */
async function roomsForUser(userId: string): Promise<string[]> {
  const [memberships, conversations] = await Promise.all([
    prisma.serverMember.findMany({ where: { userId }, select: { serverId: true } }),
    prisma.directConversationMember.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true },
    }),
  ]);

  const serverIds = memberships.map((row) => row.serverId);
  const channels = serverIds.length
    ? await prisma.channel.findMany({ where: { serverId: { in: serverIds } }, select: { id: true } })
    : [];

  return [
    socketRooms.user(userId),
    ...serverIds.map(socketRooms.server),
    ...channels.map((channel) => socketRooms.channel(channel.id)),
    ...conversations.map((row) => socketRooms.conversation(row.conversationId)),
  ];
}

export async function attachSocketServer(app: FastifyInstance): Promise<TypedServer> {
  const config = getConfig();

  const io: TypedServer = new SocketServer(app.server, {
    path: '/socket.io',
    serveClient: false,
    cors: { origin: webCorsOrigins(config.PUBLIC_WEB_ORIGIN), credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e6,
  });

  if (config.NODE_ENV !== 'test') {
    const pubClient = createRedis();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);
    if (!token) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      const data = socket.data as SocketData;
      data.userId = payload.sub;
      data.username = payload.username;
      data.silent = handshakeIsSilent(socket.handshake.auth, socket.handshake.query);
      void activeSiteBan(payload.sub).then((ban) => {
        if (ban) next(new Error('account_banned'));
        else next();
      });
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, silent } = socket.data;

    void (async () => {
      const rooms = await roomsForUser(userId);
      await socket.join(rooms);

      if (!silent) {
        const sessions = await registerSession(userId, socket.id).catch(() => 1);
        if (sessions === 1) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
          const stored = user?.status ?? 'online';
          const next = stored === 'offline' ? 'online' : stored;
          await setStatus(userId, next);
          await broadcastPresence(userId, next);
        }
      }

      socket.emit('ready', { userId, sessionId: socket.id });
    })();

    socket.on('message:send', (payload, ack) => {
      void (async () => {
        try {
          const target = await resolveTargetKind(payload.channelId);
          const message = await createMessage({
            authorId: userId,
            channelId: target === 'channel' ? payload.channelId : undefined,
            conversationId: target === 'conversation' ? payload.channelId : undefined,
            content: payload.content,
            replyToId: payload.replyToId ?? null,
            attachmentIds: payload.attachmentIds,
            attachmentDurations: payload.attachmentDurations,
            attachmentSpoilers: payload.attachmentSpoilers,
            forwardMessageId: payload.forwardMessageId,
            nonce: payload.nonce,
          });
          clearTyping(payload.channelId, userId, io);
          ack?.({ ok: true, data: message });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('message:edit', (payload, ack) => {
      void (async () => {
        try {
          ack?.({ ok: true, data: await editMessage(payload.messageId, userId, payload.content) });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('message:delete', (payload, ack) => {
      void (async () => {
        try {
          await deleteMessage(payload.messageId, userId);
          ack?.({ ok: true, data: { messageId: payload.messageId } });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('reaction:toggle', (payload, ack) => {
      void (async () => {
        try {
          const reactions = await toggleReaction(payload.messageId, userId, payload.emoji);
          ack?.({ ok: true, data: { messageId: payload.messageId, reactions } });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('typing:start', ({ channelId }) => {
      if (!socket.rooms.has(socketRooms.channel(channelId)) && !socket.rooms.has(socketRooms.conversation(channelId))) {
        return;
      }
      const entries = typingByChannel.get(channelId) ?? new Map<string, TypingEntry>();
      entries.set(userId, {
        userId,
        username: socket.data.username,
        expiresAt: Date.now() + TYPING_TIMEOUT_MS,
      });
      typingByChannel.set(channelId, entries);
      emitTyping(channelId, io);
    });

    socket.on('typing:stop', ({ channelId }) => clearTyping(channelId, userId, io));

    socket.on('presence:update', ({ status }) => {
      if (silent) return;
      if (!PRESENCE_STATUSES.includes(status)) return;
      void (async () => {
        await setStatus(userId, status);
        await broadcastPresence(userId, status);
      })();
    });

    socket.on('channel:subscribe', ({ channelId }) => {
      void socket.join(socketRooms.channel(channelId));
    });

    socket.on('channel:unsubscribe', ({ channelId }) => {
      socket.leave(socketRooms.channel(channelId));
    });

    socket.on('channel:ack', ({ channelId, messageId }) => {
      void ackTarget(userId, channelId, messageId).catch(() => undefined);
    });

    socket.on('call:accept', (payload, ack) => {
      void (async () => {
        try {
          await acceptCall(userId, payload.callId);
          ack?.({ ok: true, data: { callId: payload.callId } });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('call:decline', (payload, ack) => {
      void (async () => {
        try {
          await declineCall(userId, payload.callId);
          ack?.({ ok: true, data: { callId: payload.callId } });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('call:end', (payload, ack) => {
      void (async () => {
        try {
          await endCall(userId, payload.callId);
          ack?.({ ok: true, data: { callId: payload.callId } });
        } catch (error) {
          ack?.(fail(error));
        }
      })();
    });

    socket.on('disconnect', () => {
      if (silent) return;
      void (async () => {
        clearTyping(channelsOfSocket(socket.rooms), userId, io);
        const remaining = await unregisterSession(userId, socket.id).catch(() => 0);
        if (remaining === 0) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
          if (user?.status !== 'invisible') {
            await setStatus(userId, 'offline');
          }
          await broadcastPresence(userId, 'offline');
        }
      })();
    });
  });

  setRealtimeServer(io);
  return io;
}

function channelsOfSocket(rooms: Set<string>): string[] {
  return Array.from(rooms)
    .filter((room) => room.startsWith('channel:') || room.startsWith('dm:'))
    .map((room) => room.split(':')[1]);
}

function clearTyping(channelId: string | string[], userId: string, io: TypedServer): void {
  const ids = Array.isArray(channelId) ? channelId : [channelId];
  for (const id of ids) {
    const entries = typingByChannel.get(id);
    if (!entries?.delete(userId)) continue;
    if (entries.size === 0) typingByChannel.delete(id);
    emitTyping(id, io);
  }
}

function emitTyping(channelId: string, io: TypedServer): void {
  const entries = typingByChannel.get(channelId);
  const now = Date.now();
  const users = Array.from(entries?.values() ?? [])
    .filter((entry) => entry.expiresAt > now)
    .map((entry) => ({ id: entry.userId, username: entry.username }));

  io.to(socketRooms.channel(channelId)).emit('typing:update', { channelId, users });
  io.to(socketRooms.conversation(channelId)).emit('typing:update', { channelId, users });
}

/** A room id is either a guild channel or a direct conversation. */
async function resolveTargetKind(id: string): Promise<'channel' | 'conversation'> {
  const channel = await prisma.channel.findUnique({ where: { id }, select: { id: true } });
  return channel ? 'channel' : 'conversation';
}
