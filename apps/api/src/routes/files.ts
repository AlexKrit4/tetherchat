import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { verifyFileToken } from '../lib/fileTokens.js';
import { storage } from '../lib/storage.js';

function contentDisposition(filename: string, inline: boolean): string {
  const safe = filename.replace(/["\\]/g, '_').slice(0, 180);
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${safe}"`;
}

export async function fileRoutes(app: FastifyInstance) {
  app.get('/:attachmentId', {
    config: { rateLimit: { max: 1200, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const { attachmentId } = z.object({ attachmentId: z.string().min(1) }).parse(request.params);
      const query = z
        .object({
          exp: z.coerce.number().int(),
          sig: z.string().min(1),
          download: z.enum(['1', 'true']).optional(),
        })
        .parse(request.query);

      if (!verifyFileToken(attachmentId, query.exp, query.sig)) {
        throw ApiError.forbidden('This file link has expired');
      }

      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
        select: { storageKey: true, filename: true, contentType: true },
      });
      if (!attachment) throw ApiError.notFound('File not found');

      const stored = await storage().get(attachment.storageKey);
      if (!stored) throw ApiError.notFound('File not found');

      reply.header('Content-Type', stored.contentType ?? attachment.contentType);
      reply.header(
        'Content-Disposition',
        contentDisposition(attachment.filename, !query.download),
      );
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.send(stored.body);
    },
  });
}
