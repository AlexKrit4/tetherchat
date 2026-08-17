import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { assertConversationMember } from '../lib/permissions.js';
import { conversationInclude, toConversation } from '../lib/serialize.js';
import {
  createMessage,
  listMessages,
  searchMessages,
} from '../services/messageService.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

const conversationParam = z.object({ conversationId: z.string().min(1) });

export async function dmRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (request) => {
    const conversations = await prisma.directConversation.findMany({
      where: { members: { some: { userId: request.userId, leftAt: null } } },
      include: conversationInclude,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
    return conversations.map(toConversation);
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

    const known = await prisma.user.count({ where: { id: { in: otherIds } } });
    if (known !== otherIds.length) throw ApiError.badRequest('One or more users do not exist');

    const memberIds = [request.userId, ...otherIds];
    const isGroup = memberIds.length > 2;

    if (!isGroup) {
      const existing = await findDirectConversation(request.userId, otherIds[0]);
      if (existing) {
        reply.send(toConversation(existing));
        return;
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

    const payload = toConversation(conversation);
    for (const userId of memberIds) {
      await joinUserToRoom(userId, socketRooms.conversation(conversation.id));
      emitToUser(userId, 'dm:create', payload);
    }

    reply.status(201).send(payload);
  });

  app.get('/:conversationId', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    return toConversation(conversation);
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
    const body = z
      .object({
        content: z.string().max(LIMITS.messageContent.max).default(''),
        replyToId: z.string().nullable().optional(),
        attachmentIds: z.array(z.string()).max(LIMITS.attachmentsPerMessage).optional(),
        nonce: z.string().max(64).optional(),
      })
      .parse(request.body);

    const message = await createMessage({
      authorId: request.userId,
      conversationId,
      content: body.content,
      replyToId: body.replyToId ?? null,
      attachmentIds: body.attachmentIds,
      nonce: body.nonce,
    });

    reply.status(201).send(message);
  });

  app.get('/:conversationId/messages/search', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const { q } = z.object({ q: z.string().min(2).max(200) }).parse(request.query);
    await assertConversationMember(conversationId, request.userId);
    return searchMessages({ conversationId, serverId: null }, q, request.userId);
  });

  app.post('/:conversationId/ack', async (request) => {
    const { conversationId } = conversationParam.parse(request.params);
    const { messageId } = z.object({ messageId: z.string().min(1) }).parse(request.body);
    await assertConversationMember(conversationId, request.userId);

    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { lastReadMessageId: messageId },
    });

    return { conversationId, lastReadMessageId: messageId };
  });

  app.post('/:conversationId/leave', async (request, reply) => {
    const { conversationId } = conversationParam.parse(request.params);
    await assertConversationMember(conversationId, request.userId);

    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { isGroup: true },
    });
    if (!conversation.isGroup) throw ApiError.badRequest('Direct messages cannot be left');

    await prisma.directConversationMember.update({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      data: { leftAt: new Date() },
    });

    reply.status(204).send();
  });
}

async function findDirectConversation(userA: string, userB: string) {
  return prisma.directConversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: userA, leftAt: null } } },
        { members: { some: { userId: userB, leftAt: null } } },
      ],
    },
    include: conversationInclude,
  });
}
