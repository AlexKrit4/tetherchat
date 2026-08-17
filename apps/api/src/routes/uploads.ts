import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ALLOWED_ATTACHMENT_MIME, LIMITS, isImageMime } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { readImageInfo } from '../lib/images.js';
import { readMultipartFile } from '../lib/multipart.js';
import { toAttachment } from '../lib/serialize.js';
import { storage } from '../lib/storage.js';
import { ApiError } from '../errors.js';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  /**
   * Two-step upload: the file is stored first and referenced by id when the
   * message is sent, so a failed send never leaves a half-written message.
   */
  app.post('/', async (request, reply) => {
    const file = await readMultipartFile(request, {
      maxBytes: LIMITS.attachmentBytes,
      allowedMime: ALLOWED_ATTACHMENT_MIME,
    });

    const dimensions = isImageMime(file.mimetype)
      ? await readImageInfo(file.buffer)
      : { width: null, height: null };

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
