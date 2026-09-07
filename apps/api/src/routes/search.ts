import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { searchEverywhere } from '../services/messageService.js';

export async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/messages', async (request) => {
    const { q, limit } = z
      .object({
        q: z.string().min(2).max(200),
        limit: z.coerce.number().int().min(1).max(50).default(40),
      })
      .parse(request.query);
    return searchEverywhere(request.userId, q, limit);
  });
}
