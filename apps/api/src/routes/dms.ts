import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { blockedPeerIds, isBlockedEitherWay } from '../lib/blocks.js';
import { areFriends } from '../lib/friends.js';
import { assertConversationMember } from '../lib/permissions.js';
import { conversationInclude, toConversation } from '../lib/serialize.js';
import { ensureAiConversation, getAiBotUserId } from '../lib/aiBot.js';
import { ensureVpnConversation, getVpnBotUserId } from '../lib/vpnBot.js';
import { assertPlus, loadPlus, pinnedDmLimit } from '../lib/plus.js';
import { readWallpaperUpload } from '../lib/wallpaper.js';
import {
  createMessage,
  createEncryptedMessage,
  listMessages,
  searchMessages,
} from '../services/messageService.js';
import { listChatMedia } from '../services/mediaService.js';
import { ackConversation } from '../services/readStateService.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

const conversationParam = z.object({ conversationId: z.string().min(1) });
const messageBody = z.object({
  content: z.string().max(LIMITS.messageContent.max).default(''),
  replyToId: z.string().nullable().optional(),
      attachmentIds: z.array(z.string()).max(LIMITS.attachmentsPerMessage).optional(),
  attachmentDurations: z.record(z.string(), z.number().int().min(1).max(15 * 60_000)).optional(),
  attachmentSpoilers: z.record(z.string(), z.boolean()).optional(),
  forwardMessageId: z.string().min(1).optional(),
  nonce: z.string().max(64).optional(),
  encrypted: z
    .object({
      version: z.literal(1),
      iv: z.string().min(12).max(64),
      ciphertext: z.string().min(1).max(32_000),
    })
    .optional(),
});

export async function dmRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (request) => {
    await ensureSavedConversation(request.userId);
    await ensureAiConversation(request.userId);
    await ensureVpnConversation(request.userId);
    const conversations = await prisma.directConversation.findMany({
      where: { members: { some: { userId: request.userId, leftAt: null, hiddenAt: null } } },
      include: conversationInclude,
      orderBy: [
        { isSaved: 'desc' },
        { isAi: 'desc' },
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    const blocked = await blockedPeerIds(request.userId);
    return conversations
      .map((row) => toConversation(row, request.userId))
      .filter(
        (conversation) =>
          conversation.isSaved ||
          conversation.isAi ||
          conversation.isVpn ||
          conversation.isGroup ||
          !conversation.members.some((member) => member.id !== request.userId && blocked.has(member.id)),
      )
      .sort((a, b) => {
        if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
        if (Boolean(a.isAi) !== Boolean(b.isAi)) return a.isAi ? -1 : 1;
        if (Boolean(a.isVpn) !== Boolean(b.isVpn)) return a.isVpn ? -1 : 1;
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        const aTime = a.lastMessageAt ?? '';
        const bTime = b.lastMessageAt ?? '';
        return bTime.localeCompare(aTime);
      });
  });

  app.get('/saved', async (request) => {
    const conversation = await ensureSavedConversation(request.userId);
    return toConversation(conversation, request.userId);
  });

  app.post('/saved', async (request, reply) => {
    const conversation = await ensureSavedConversation(request.userId);
    reply.send(toConversation(conversation, request.userId));
  });

  app.post('/secret', async (request, reply) => {
    const body = z
      .object({
        userId: z.string().min(1),
        keys: z
          .array(
            z.object({
              deviceId: z.string().min(16).max(128),
              wrappedKey: z.string().min(128).max(2048),
            }),
          )
          .min(2)
          .max(32),
      })
      .parse(request.body);
    if (body.userId === request.userId) throw ApiError.badRequest('Pick a friend');
    if (await isBlockedEitherWay(request.userId, body.userId)) {
      throw ApiError.forbidden('You cannot message this user');
    }
    if (!(await areFriends(request.userId, body.userId))) {
      throw ApiError.forbidden('Секретный чат можно создать только с другом');
    }

    const devices = await prisma.cryptoDevice.findMany({
      where: { userId: { in: [request.userId, body.userId] }, revokedAt: null },
      select: { id: true, userId: true },
    });
    if (!devices.some((device) => device.userId === request.userId)) {
      throw ApiError.badRequest('Сначала зарегистрируйте ключ этого устройства');
    }
    if (!devices.some((device) => device.userId === body.userId)) {
      throw ApiError.conflict('Друг ещё не настроил секретные чаты');
    }
    const submitted = new Map(body.keys.map((entry) => [entry.deviceId, entry.wrappedKey]));
    if (devices.some((device) => !submitted.has(device.id)) || submitted.size !== devices.length) {
      throw ApiError.badRequest('Ключ должен быть зашифрован для каждого активного устройства');
    }

    const conversation = await prisma.$transaction(async (tx) => {
      const created = await tx.directConversation.create({
        data: {
          isSecret: true,
          members: { create: [{ userId: request.userId }, { userId: body.userId }] },
        },
        include: conversationInclude,
      });
      await tx.secretConversationKey.createMany({
        data: devices.map((device) => ({
          conversationId: created.id,
          deviceId: device.id,
          wrappedKey: submitted.get(device.id)!,
        })),
      });
      return created;
    });

    for (const userId of [request.userId, body.userId]) {
      await joinUserToRoom(userId, socketRooms.conversation(conversation.id));
      emitToUser(userId, 'dm:create', toConversation(conversation, userId));
    }
    reply.status(201).send(toConversation(conversation, request.userId));
  });

  app.post('/', async (request, reply) => {
    const body = z
      .object({
        userIds: z.array(z.string().min(1)).min(1).max(LIMITS.groupDmMembers - 1),
        name: z.string().max(64).nullable().optional(),
      })
      .parse(request.body);

    const otherIds = Array.from(new Set(body.userIds.filter((id) => id !== request.userId)));
    if (otherIds.length === 0) throw ApiError.badRequest('Pick at least one other person');

    const aiBotId = await getAiBotUserId();
    if (otherIds.includes(aiBotId)) {
      if (otherIds.length > 1) throw ApiError.badRequest('Нельзя добавить нейросеть в группу');
      const conversation = await ensureAiConversation(request.userId);
      reply.send(toConversation(conversation, request.userId));
      return;
    }

    const vpnBotId = await getVpnBotUserId();
    if (otherIds.includes(vpnBotId)) {
      if (otherIds.length > 1) throw ApiError.badRequest('Нельзя добавить VPN-бота в группу');
      const conversation = await ensureVpnConversation(request.userId);
      reply.send(toConversation(conversation, request.userId));
      return;
    }

    const known = await prisma.user.count({ where: { id: { in: otherIds } } });
    if (known !== otherIds.length) throw ApiError.badRequest('One or more users do not exist');

    const memberIds = [request.userId, ...otherIds];
    const isGroup = memberIds.length > 2;

    if (!isGroup) {
      if (await isBlockedEitherWay(request.userId, otherIds[0])) {
        throw ApiError.forbidden('You cannot message this user');
      }
      if (!(await areFriends(request.userId, otherIds[0]))) {
        throw ApiError.forbidden('Сначала добавьте пользователя в друзья');
      }
      const existing = await findDirectConversation(request.userId, otherIds[0]);
      if (existing) {
        await unhideConversationForUser(existing.id, request.userId);
        const refreshed = await prisma.directConversation.findUniqueOrThrow({
          where: { id: existing.id },
          include: conversationInclude,
        });
        reply.send(toConversation(refreshed, request.userId));
        return;
      }
    } else {
      for (const otherId of otherIds) {
        if (!(await areFriends(request.userId, otherId))) {
          throw ApiError.forbidden('В группу можно добавить только друзей');
        }
      }
    }

    const conversation = await prisma.directConversation.create({
      data: {
        isGroup,
        name: isGroup ? (body.name?.trim() ?? null) : null,
        ownerId: isGroup ? request.userId : null,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: conversationInclude,
    });

    for (const userId of memberIds) {
      await joinUserToRoom(userId, socketRooms.conversation(conversation.id));
      emitToUser(userId, 'dm:create', toConversation(conversation, userId));
    }

    reply.status(201).send(toConversation(conversation, request.userId));
  });

  app.get('/:conversationId', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    await unhideConversationForUser(conversationId, request.userId);
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    return toConversation(conversation, request.userId);
  });

  app.get('/:conversationId/messages', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const query = z
      .object({
        before: z.string().optional(),
        after: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(LIMITS.messagePageSize),
      })
      .parse(request.query);

    await assertConversationMember(conversationId, request.userId);
    return listMessages({ conversationId, serverId: null }, { ...query, currentUserId: request.userId });
  });

  app.post('/:conversationId/messages', async (request, reply) => {
    const { conversationId } = conversationParam.parse(request.params);
    const body = messageBody.parse(request.body);

    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { isSecret: true },
    });
    const message = conversation.isSecret
      ? await createEncryptedMessage({
          authorId: request.userId,
          conversationId,
          encrypted: body.encrypted,
          nonce: body.nonce,
          hasUnsupportedPayload: Boolean(
            body.content || body.replyToId || body.attachmentIds?.length || body.forwardMessageId,
          ),
        })
      : await createMessage({
          authorId: request.userId,
          conversationId,
          content: body.content,
          replyToId: body.replyToId ?? null,
          attachmentIds: body.attachmentIds,
          attachmentDurations: body.attachmentDurations,
          attachmentSpoilers: body.attachmentSpoilers,
          forwardMessageId: body.forwardMessageId,
          nonce: body.nonce,
        });

    reply.status(201).send(message);
  });

  app.get('/:conversationId/messages/search', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const { q } = z.object({ q: z.string().min(2).max(200) }).parse(request.query);
    await assertConversationMember(conversationId, request.userId);
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { isSecret: true },
    });
    if (conversation.isSecret) throw ApiError.badRequest('Поиск недоступен в секретном чате');
    return searchMessages({ conversationId, serverId: null }, q, request.userId);
  });

  app.get('/:conversationId/media', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const query = z
      .object({
        before: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(request.query);
    await assertConversationMember(conversationId, request.userId);
    return listChatMedia({ conversationId, before: query.before, limit: query.limit });
  });

  app.post('/:conversationId/pin', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);

    const member = await prisma.directConversationMember.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      select: { pinnedAt: true },
    });

    if (!member.pinnedAt) {
      const plus = await loadPlus(request.userId);
      const limit = pinnedDmLimit(plus);
      const pinnedCount = await prisma.directConversationMember.count({
        where: { userId: request.userId, leftAt: null, pinnedAt: { not: null } },
      });
      if (pinnedCount >= limit) {
        if (!plus) throw ApiError.forbidden('Это функция TetherChat Plus');
        throw ApiError.badRequest(`Можно закрепить до ${limit} чатов`);
      }
    }

    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { pinnedAt: new Date() },
    });
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    const payload = toConversation(conversation, request.userId);
    emitToUser(request.userId, 'dm:update', payload);
    return payload;
  });

  app.delete('/:conversationId/pin', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { pinnedAt: null },
    });
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    const payload = toConversation(conversation, request.userId);
    emitToUser(request.userId, 'dm:update', payload);
    return payload;
  });

  app.post('/:conversationId/ack', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const { messageId } = z.object({ messageId: z.string().min(1) }).parse(request.body);
    await assertConversationMember(conversationId, request.userId);
    return ackConversation(request.userId, conversationId, messageId);
  });

  app.post('/:conversationId/leave', async (request, reply) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);

    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { isGroup: true, isSaved: true },
    });
    if (!conversation.isGroup || conversation.isSaved) {
      throw ApiError.badRequest('Direct messages cannot be left');
    }

    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { leftAt: new Date(), pinnedAt: null },
    });

    emitToUser(request.userId, 'dm:remove', { conversationId });
    reply.status(204).send();
  });

  app.delete('/:conversationId', async (request, reply) => {
    const { conversationId } = conversationParam.parse(request.params);
    const { scope } = z.object({ scope: z.enum(['me', 'all']) }).parse(request.query);

    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { members: { select: { userId: true, leftAt: true } } },
    });

    if (conversation.isSaved || conversation.isAi || conversation.isVpn) {
      throw ApiError.badRequest('This chat cannot be deleted');
    }

    const membership = conversation.members.find((member) => member.userId === request.userId);
    if (!membership || membership.leftAt) {
      throw ApiError.forbidden('You are not part of this conversation');
    }

    const activeMemberIds = conversation.members
      .filter((member) => !member.leftAt)
      .map((member) => member.userId);

    if (scope === 'me') {
      if (conversation.isGroup) {
        await prisma.directConversationMember.update({
          where: { conversationId_userId: { conversationId, userId: request.userId } },
          data: { leftAt: new Date(), pinnedAt: null },
        });
      } else {
        await prisma.directConversationMember.update({
          where: { conversationId_userId: { conversationId, userId: request.userId } },
          data: { hiddenAt: new Date(), pinnedAt: null },
        });
      }
      emitToUser(request.userId, 'dm:remove', { conversationId });
      reply.status(204).send();
      return;
    }

    if (conversation.isGroup) {
      if (conversation.ownerId !== request.userId) {
        throw ApiError.forbidden('Only the group owner can delete the group for everyone');
      }
      await prisma.directConversation.delete({ where: { id: conversationId } });
      for (const userId of activeMemberIds) {
        emitToUser(userId, 'dm:remove', { conversationId });
      }
      reply.status(204).send();
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { conversationId } });
      await tx.directConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: null },
      });
      await tx.directConversationMember.updateMany({
        where: { conversationId, leftAt: null },
        data: {
          hiddenAt: new Date(),
          pinnedAt: null,
          lastReadMessageId: null,
          lastReadAt: null,
        },
      });
    });

    for (const userId of activeMemberIds) {
      emitToUser(userId, 'dm:remove', { conversationId });
    }
    reply.status(204).send();
  });

  app.post('/:conversationId/wallpaper', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    await assertPlus(request.userId);
    const url = await readWallpaperUpload(request, request.userId);
    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { wallpaperUrl: url },
    });
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    return toConversation(conversation, request.userId);
  });

  app.delete('/:conversationId/wallpaper', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { wallpaperUrl: null },
    });
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    return toConversation(conversation, request.userId);
  });
}

async function ensureSavedConversation(userId: string) {
  const existing = await prisma.directConversation.findUnique({
    where: { savedForUserId: userId },
    include: conversationInclude,
  });
  if (existing) {
    await joinUserToRoom(userId, socketRooms.conversation(existing.id));
    return existing;
  }

  const created = await prisma.directConversation.create({
    data: {
      isSaved: true,
      savedForUserId: userId,
      ownerId: userId,
      members: { create: [{ userId }] },
    },
    include: conversationInclude,
  });
  await joinUserToRoom(userId, socketRooms.conversation(created.id));
  emitToUser(userId, 'dm:create', toConversation(created, userId));
  return created;
}

async function unhideConversationForUser(conversationId: string, userId: string) {
  await prisma.directConversationMember.updateMany({
    where: { conversationId, userId, hiddenAt: { not: null } },
    data: { hiddenAt: null },
  });
}

async function findDirectConversation(userA: string, userB: string) {
  return prisma.directConversation.findFirst({
    where: {
      isGroup: false,
      isSaved: false,
      isAi: false,
      isSecret: false,
      AND: [
        { members: { some: { userId: userA, leftAt: null } } },
        { members: { some: { userId: userB, leftAt: null } } },
      ],
    },
    include: conversationInclude,
  });
}
