import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function pushRoutes(app: FastifyInstance) {
  /** The public VAPID key the service worker needs to subscribe. */
  app.get('/public-key', async () => ({ publicKey: getConfig().VAPID_PUBLIC_KEY ?? null }));

  app.post('/subscribe', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const body = subscriptionSchema.parse(request.body);

    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: request.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: { userId: request.userId, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });

    reply.status(204).send();
  });

  app.post('/unsubscribe', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(request.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: request.userId } });
    reply.status(204).send();
  });
}
