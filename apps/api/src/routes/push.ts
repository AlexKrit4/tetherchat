import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';

const webSchema = z.object({
  platform: z.literal('web').optional(),
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const fcmSchema = z.object({
  platform: z.literal('fcm').optional(),
  token: z.string().min(32).max(4096),
});

const unsubscribeSchema = z.union([
  z.object({ endpoint: z.string().min(8).max(4096) }),
  z.object({ token: z.string().min(32).max(4096) }),
]);

export async function pushRoutes(app: FastifyInstance) {
  /** The public VAPID key the service worker needs to subscribe. */
  app.get('/public-key', async () => ({ publicKey: getConfig().VAPID_PUBLIC_KEY ?? null }));

  /** Public Firebase Android client ids — the same values that go in google-services.json. */
  app.get('/android-config', async () => {
    const config = getConfig();
    return {
      projectId: config.FCM_PROJECT_ID ?? '',
      applicationId: config.FCM_APPLICATION_ID ?? '',
      apiKey: config.FCM_API_KEY ?? '',
      senderId: config.FCM_SENDER_ID ?? '',
    };
  });

  app.post('/subscribe', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const fcm = fcmSchema.safeParse(request.body);
    if (fcm.success) {
      const endpoint = fcm.data.token;
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId: request.userId,
          endpoint,
          platform: 'fcm',
          p256dh: '',
          auth: '',
        },
        update: { userId: request.userId, platform: 'fcm' },
      });
      reply.status(204).send();
      return;
    }

    const body = webSchema.parse(request.body);
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: request.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        platform: 'web',
      },
      update: {
        userId: request.userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        platform: 'web',
      },
    });

    reply.status(204).send();
  });

  app.post('/unsubscribe', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const body = unsubscribeSchema.parse(request.body);
    const endpoint = 'token' in body ? body.token : body.endpoint;
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: request.userId } });
    reply.status(204).send();
  });
}
