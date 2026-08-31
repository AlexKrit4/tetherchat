import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { assertConversationMember, loadChannelContext } from '../lib/permissions.js';
import { reportInclude, toMessageReport } from '../lib/reports.js';

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.post('/', async (request, reply) => {
    const body = z
      .object({
        messageId: z.string().min(1),
        comment: z.string().trim().min(1).max(1000),
      })
      .parse(request.body);

    const message = await prisma.message.findUnique({
      where: { id: body.messageId },
      include: { attachments: true },
    });
    if (!message || message.deletedAt) throw ApiError.notFound('Сообщение не найдено');
    if (message.authorId === request.userId) throw ApiError.badRequest('Нельзя пожаловаться на своё сообщение');
    if (message.system) throw ApiError.badRequest('На это сообщение нельзя пожаловаться');

    if (message.channelId) {
      await loadChannelContext(message.channelId, request.userId);
    } else if (message.conversationId) {
      await assertConversationMember(message.conversationId, request.userId);
    } else {
      throw ApiError.notFound('Сообщение не найдено');
    }

    const existing = await prisma.messageReport.findFirst({
      where: { reporterId: request.userId, messageId: message.id, status: 'pending' },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict('Вы уже пожаловались на это сообщение');

    const created = await prisma.messageReport.create({
      data: {
        messageId: message.id,
        reporterId: request.userId,
        targetUserId: message.authorId,
        comment: body.comment,
        messageContent: message.content,
        messageCreatedAt: message.createdAt,
        attachmentsJson: message.attachments.map((attachment) => ({
          url: attachment.url,
          filename: attachment.filename,
          contentType: attachment.contentType,
          spoiler: attachment.spoiler,
        })),
      },
      include: reportInclude,
    });

    reply.status(201).send(toMessageReport(created));
  });
}
