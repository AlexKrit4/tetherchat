import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { DirectConversation, FriendRequest, PublicUser } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import {
  areFriends,
  assertCanRequest,
  createFriendshipPair,
  incomingRequestCount,
} from '../lib/friends.js';
import { conversationInclude, publicUserSelect, toConversation, toPublicUser } from '../lib/serialize.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';
import { socketRooms } from '@tetherchat/shared';

const requestInclude = {
  from: { select: publicUserSelect },
  to: { select: publicUserSelect },
} as const;

function toFriendRequest(row: {
  id: string;
  createdAt: Date;
  from: Parameters<typeof toPublicUser>[0];
  to: Parameters<typeof toPublicUser>[0];
}): FriendRequest {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    from: toPublicUser(row.from),
    to: toPublicUser(row.to),
  };
}

async function ensureDirectConversation(userA: string, userB: string): Promise<DirectConversation> {
  const existing = await prisma.directConversation.findFirst({
    where: {
      isGroup: false,
      isSaved: false,
      AND: [
        { members: { some: { userId: userA, leftAt: null } } },
        { members: { some: { userId: userB, leftAt: null } } },
      ],
    },
    include: conversationInclude,
  });
  if (existing) return toConversation(existing, userA);

  const created = await prisma.directConversation.create({
    data: {
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
    include: conversationInclude,
  });
  for (const userId of [userA, userB]) {
    await joinUserToRoom(userId, socketRooms.conversation(created.id));
    emitToUser(userId, 'dm:create', toConversation(created, userId));
  }
  return toConversation(created, userA);
}

export async function friendRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (request) => {
    const rows = await prisma.friendship.findMany({
      where: { userId: request.userId },
      include: { friend: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toPublicUser(row.friend));
  });

  app.get('/incoming', async (request) => {
    const rows = await prisma.friendRequest.findMany({
      where: { toId: request.userId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFriendRequest);
  });

  app.get('/incoming/count', async (request) => ({
    count: await incomingRequestCount(request.userId),
  }));

  app.post('/requests', async (request, reply) => {
    const body = z
      .object({
        userId: z.string().min(1).optional(),
        username: z.string().min(1).max(32).optional(),
      })
      .parse(request.body);

    const target = body.userId
      ? await prisma.user.findUnique({ where: { id: body.userId }, select: publicUserSelect })
      : body.username
        ? await prisma.user.findUnique({
            where: { username: body.username.toLowerCase() },
            select: publicUserSelect,
          })
        : null;
    if (!target) throw ApiError.notFound('Пользователь не найден');

    await assertCanRequest(request.userId, target.id);

    const reverse = await prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: target.id, toId: request.userId } },
    });
    if (reverse) {
      await createFriendshipPair(request.userId, target.id);
      const conversation = await ensureDirectConversation(request.userId, target.id);
      emitToUser(target.id, 'friend:accepted', { conversation: toConversation(
        await prisma.directConversation.findUniqueOrThrow({
          where: { id: conversation.id },
          include: conversationInclude,
        }),
        target.id,
      ) });
      emitToUser(request.userId, 'friend:accepted', { conversation });
      reply.status(201).send({ accepted: true, user: target, conversation });
      return;
    }

    const existing = await prisma.friendRequest.findUnique({
      where: { fromId_toId: { fromId: request.userId, toId: target.id } },
    });
    if (existing) {
      reply.send({ accepted: false, user: target, request: toFriendRequest({
        ...existing,
        from: (await prisma.user.findUniqueOrThrow({ where: { id: request.userId }, select: publicUserSelect })),
        to: target,
      }) });
      return;
    }

    const created = await prisma.friendRequest.create({
      data: { fromId: request.userId, toId: target.id },
      include: requestInclude,
    });
    emitToUser(target.id, 'friend:incoming', { count: await incomingRequestCount(target.id) });
    reply.status(201).send({ accepted: false, user: target, request: toFriendRequest(created) });
  });

  app.post('/requests/:id/accept', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const row = await prisma.friendRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row || row.toId !== request.userId) throw ApiError.notFound('Заявка не найдена');

    await createFriendshipPair(row.fromId, row.toId);
    const conversation = await ensureDirectConversation(row.fromId, row.toId);
    const forPeer = toConversation(
      await prisma.directConversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: conversationInclude,
      }),
      row.fromId,
    );
    emitToUser(row.fromId, 'friend:accepted', { conversation: forPeer });
    emitToUser(row.toId, 'friend:incoming', { count: await incomingRequestCount(row.toId) });
    return { user: toPublicUser(row.from), conversation };
  });

  app.post('/requests/:id/decline', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await prisma.friendRequest.deleteMany({
      where: { id, toId: request.userId },
    });
    if (deleted.count === 0) throw ApiError.notFound('Заявка не найдена');
    emitToUser(request.userId, 'friend:incoming', { count: await incomingRequestCount(request.userId) });
    reply.status(204).send();
  });

  app.delete('/:userId', async (request, reply) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    if (!(await areFriends(request.userId, userId))) throw ApiError.notFound('Пользователь не в друзьях');
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: request.userId, friendId: userId },
          { userId, friendId: request.userId },
        ],
      },
    });
    reply.status(204).send();
  });
}

export type { PublicUser };
