import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ALLOWED_ATTACHMENT_MIME, LIMITS, isAudioMime, isImageMime } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { readImageInfo, makeThumbnail } from '../lib/images.js';
import { readMultipartFile } from '../lib/multipart.js';
import { toAttachment } from '../lib/serialize.js';
import { storage } from '../lib/storage.js';
import { ApiError } from '../errors.js';
import { attachmentLimit, assertPlus, loadPlus } from '../lib/plus.js';
import { consumeRateLimit } from '../redis.js';
import { transcribeAudio } from '../services/llmService.js';
import { assertConversationMember, loadChannelContext } from '../lib/permissions.js';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  /**
   * Two-step upload: the file is stored first and referenced by id when the
   * message is sent, so a failed send never leaves a half-written message.
   */
  app.post('/', async (request, reply) => {
    const query = z
      .object({
        durationMs: z.coerce.number().int().min(1).max(15 * 60_000).optional(),
      })
      .parse(request.query);

    const plus = await loadPlus(request.userId);
    if (!plus) {
      const allowed = await consumeRateLimit(
        `rl:upload:${request.userId}`,
        LIMITS.uploadRatePerMinute,
        60,
      ).catch(() => true);
      if (!allowed) throw ApiError.tooManyRequests('Слишком много загрузок. Это ограничение снимает TetherChat Plus.');
    }

    const file = await readMultipartFile(request, {
      maxBytes: attachmentLimit(plus),
      allowedMime: ALLOWED_ATTACHMENT_MIME,
    });

    const dimensions = isImageMime(file.mimetype)
      ? await readImageInfo(file.buffer)
      : { width: null, height: null };
    const thumbnailData = isImageMime(file.mimetype) ? await makeThumbnail(file.buffer) : null;

    const stored = await storage().put({
      body: file.buffer,
      contentType: file.mimetype,
      filename: file.filename,
      prefix: `attachments/${request.userId}`,
    });

    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: request.userId,
        storageKey: stored.key,
        url: stored.url,
        filename: file.filename.slice(0, 255),
        contentType: file.mimetype,
        size: file.buffer.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        durationMs: query.durationMs ?? null,
        thumbnailData,
      },
    });

    reply.status(201).send(toAttachment(attachment));
  });

  app.delete('/:attachmentId', async (request, reply) => {
    const { attachmentId } = z.object({ attachmentId: z.string().min(1) }).parse(request.params);

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw ApiError.notFound('Attachment not found');
    if (attachment.uploaderId !== request.userId) {
      throw ApiError.forbidden('You can only remove your own uploads');
    }
    if (attachment.messageId) {
      throw ApiError.badRequest('Delete the message instead — this file is already attached');
    }

    await storage().remove(attachment.storageKey);
    await prisma.attachment.delete({ where: { id: attachmentId } });
    reply.status(204).send();
  });
}

export async function attachmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.post('/:attachmentId/transcribe', async (request) => {
    await assertPlus(request.userId);
    const { attachmentId } = z.object({ attachmentId: z.string().min(1) }).parse(request.params);

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          select: {
            channelId: true,
            conversationId: true,
            conversation: { select: { isSecret: true } },
          },
        },
      },
    });
    if (!attachment) throw ApiError.notFound('Файл не найден');
    if (!isAudioMime(attachment.contentType)) {
      throw ApiError.badRequest('Расшифровка доступна только для голосовых');
    }

    if (attachment.message?.conversation?.isSecret) {
      throw ApiError.badRequest('В секретном чате расшифровка недоступна');
    }

    if (attachment.message?.conversationId) {
      await assertConversationMember(attachment.message.conversationId, request.userId);
    } else if (attachment.message?.channelId) {
      await loadChannelContext(attachment.message.channelId, request.userId);
    } else if (attachment.uploaderId !== request.userId) {
      throw ApiError.forbidden('Нет доступа к этому файлу');
    }

    if (attachment.transcript) {
      return { transcript: attachment.transcript, cached: true };
    }

    const stored = await storage().get(attachment.storageKey);
    if (!stored) throw ApiError.internal('Не удалось загрузить аудио для расшифровки');
    const transcript = await transcribeAudio(stored.body, attachment.filename, attachment.contentType);

    const updated = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { transcript },
    });

    return { transcript: updated.transcript, cached: false };
  });
}
