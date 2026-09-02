import type { FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import { getConfig } from '../config.js';
import { ApiError } from '../errors.js';
import { verifyYooMoneyNotification } from '../services/vpn/config.js';
import {
  confirmMockPayment,
  formatSubscription,
  getSubscriptionBody,
  listActivePlans,
  markOrderPaid,
  seedVpnPlans,
} from '../services/vpn/provisioning.js';
import { getVpnBotUserId } from '../lib/vpnBot.js';
import { createMessage } from '../services/messageService.js';
import { prisma } from '../db.js';

export async function vpnRoutes(app: FastifyInstance) {
  await app.register(formbody);
  app.get('/plans', async (request) => {
    const group = (request.query as { group?: string }).group?.trim();
    const plans = await listActivePlans(group || undefined);
    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      groupName: plan.groupName,
      durationDays: plan.durationDays,
      trafficGb: plan.trafficGb,
      deviceLimit: plan.deviceLimit,
      priceRub: plan.priceRub.toString(),
    }));
  });

  app.get('/s/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = await getSubscriptionBody(token);
    if (!body) throw ApiError.notFound('Subscription not found or expired');
    reply.header('content-type', 'text/plain; charset=utf-8');
    reply.header('profile-update-interval', '12');
    return reply.send(body);
  });

  app.post('/webhooks/yoomoney', async (request, reply) => {
    const form: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.body as Record<string, string>)) {
      form[key] = String(value);
    }
    const verified = verifyYooMoneyNotification(form);
    if (!verified.ok) {
      request.log.warn({ err: verified.error, label: verified.label }, 'yoomoney webhook rejected');
      throw ApiError.forbidden(verified.error ?? 'invalid notification');
    }

    const sub = await markOrderPaid({
      paymentLabel: verified.label,
      externalId: verified.externalId,
      raw: form,
    });

    if (sub) {
      const order = await prisma.vpnOrder.findFirst({
        where: { paymentLabel: verified.label },
        select: { userId: true },
      });
      if (order) {
        const conversation = await prisma.directConversation.findUnique({
          where: { vpnForUserId: order.userId },
          select: { id: true },
        });
        if (conversation) {
          const botId = await getVpnBotUserId();
          const formatted = formatSubscription(sub);
          await createMessage({
            authorId: botId,
            conversationId: conversation.id,
            content:
              `✅ **Оплата получена!**\n\n` +
              `Подписка активна до **${new Date(formatted.endsAt).toLocaleString('ru-RU')}**\n\n` +
              `**Ссылка для Happ:**\n${formatted.subUrl}`,
            skipAiReply: true,
            skipVpnReply: true,
            skipRateLimit: true,
          });
        }
      }
    }

    reply.status(200).send('OK');
  });

  app.get('/pay/mock', async (request, reply) => {
    const config = getConfig();
    if (!config.MARZBAN_MOCK) throw ApiError.notFound('Not found');
    const label = (request.query as { label?: string }).label;
    if (!label) throw ApiError.badRequest('label required');
    const sub = await confirmMockPayment(label);
    if (!sub) throw ApiError.notFound('Order not found');
    const formatted = formatSubscription(sub);
    reply.type('text/html; charset=utf-8').send(
      `<html><body style="font-family:sans-serif;padding:2rem"><h1>Оплата подтверждена (mock)</h1><p>Подписка до ${formatted.endsAt}</p><p><a href="${formatted.subUrl}">${formatted.subUrl}</a></p><p><a href="/channels/@me">Вернуться в TetherChat</a></p></body></html>`,
    );
  });

  app.addHook('onReady', async () => {
    await seedVpnPlans().catch((error) => app.log.warn({ err: error }, 'vpn plan seed failed'));
  });
}
