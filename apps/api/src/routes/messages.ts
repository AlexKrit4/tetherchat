import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS } from '@tetherchat/shared';
import { deleteMessage, editMessage, listThread, toggleReaction } from '../services/messageService.js';

const messageParam = z.object({ messageId: z.string().min(1) });

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.patch('/:messageId', async (request) => {
    const { messageId } = messageParam.parse(request.params);
    const { content } = z
      .object({ content: z.string().min(1).max(LIMITS.messageContent.max) })
      .parse(request.body);
    return editMessage(messageId, request.userId, content);
  });

  app.delete('/:messageId', async (request, reply) => {
    const { messageId } = messageParam.parse(request.params);
    await deleteMessage(messageId, request.userId);
    reply.status(204).send();
  });

  app.put('/:messageId/reactions', async (request) => {
    const { messageId } = messageParam.parse(request.params);
    const { emoji } = z.object({ emoji: z.string().min(1).max(32) }).parse(request.body);
    const reactions = await toggleReaction(messageId, request.userId, emoji);
    return { messageId, reactions };
  });

  app.get('/:messageId/thread', async (request) => {
    const { messageId } = messageParam.parse(request.params);
    return listThread(messageId, request.userId);
  });
}
