import type { VpnPlan, VpnSubscription } from '@prisma/client';
import { prisma } from '../../db.js';
import { buildPaymentLabel, buildSubUrl, createYooMoneyPaymentUrl, getVpnConfig } from './config.js';
import { createMarzbanUser, modifyMarzbanUser, toUnix } from './marzban.js';

const ACTIVE_STATUSES = ['trial', 'active'] as const;

export async function seedVpnPlans(): Promise<void> {
  const plans = [
    { slug: 'self-1m', name: 'Для себя — 1 месяц', groupName: 'для себя', durationDays: 30, trafficGb: 50, deviceLimit: 2, priceRub: '100.00', sortOrder: 10 },
    { slug: 'self-3m', name: 'Для себя — 3 месяца', groupName: 'для себя', durationDays: 90, trafficGb: 150, deviceLimit: 2, priceRub: '299.00', sortOrder: 20 },
    { slug: 'self-1y', name: 'Для себя — 1 год', groupName: 'для себя', durationDays: 365, trafficGb: 700, deviceLimit: 2, priceRub: '999.00', sortOrder: 30 },
    { slug: 'family-1m', name: 'Семейный — 1 месяц', groupName: 'семейный', durationDays: 30, trafficGb: 100, deviceLimit: 4, priceRub: '225.00', sortOrder: 40 },
    { slug: 'family-3m', name: 'Семейный — 3 месяца', groupName: 'семейный', durationDays: 90, trafficGb: 300, deviceLimit: 4, priceRub: '649.00', sortOrder: 50 },
    { slug: 'family-1y', name: 'Семейный — 1 год', groupName: 'семейный', durationDays: 365, trafficGb: 1300, deviceLimit: 4, priceRub: '2249.00', sortOrder: 60 },
  ];

  for (const plan of plans) {
    await prisma.vpnPlan.upsert({
      where: { slug: plan.slug },
      create: { ...plan, isActive: true },
      update: { ...plan, isActive: true },
    });
  }
}

export async function listActivePlans() {
  return prisma.vpnPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
}

export async function getActiveSubscription(userId: string) {
  return prisma.vpnSubscription.findFirst({
    where: {
      userId,
      status: { in: [...ACTIVE_STATUSES] },
      endsAt: { gt: new Date() },
    },
    include: { plan: true },
    orderBy: { endsAt: 'desc' },
  });
}

export function formatSubscription(sub: VpnSubscription & { plan?: VpnPlan | null }) {
  const cfg = getVpnConfig();
  const subUrl = buildSubUrl(sub.subToken);
  return {
    status: sub.status,
    endsAt: sub.endsAt.toISOString(),
    trafficLimitGb: sub.trafficLimitGb,
    trafficUsedGb: sub.trafficUsedGb.toString(),
    deviceLimit: sub.deviceLimit,
    subUrl,
    planName: sub.plan?.name ?? null,
    brand: cfg.brandName,
  };
}

async function provisionSubscription(sub: VpnSubscription): Promise<VpnSubscription> {
  const username = sub.marzbanUsername ?? `u${sub.userId.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`;
  const dataLimit = sub.trafficLimitGb != null ? sub.trafficLimitGb * 1024 ** 3 : null;
  const client = await createMarzbanUser({
    username,
    expireTs: toUnix(sub.endsAt),
    dataLimitBytes: dataLimit,
    note: `tetherchat:${sub.id}`,
  });
  return prisma.vpnSubscription.update({
    where: { id: sub.id },
    data: {
      marzbanUsername: client.username,
      marzbanUuid: client.uuid,
      nodeId: client.nodeId,
    },
  });
}

export async function createTrial(userId: string) {
  const cfg = getVpnConfig();
  if (!cfg.trialEnabled) return null;

  const active = await getActiveSubscription(userId);
  if (active) return active;

  const hadTrial = await prisma.vpnSubscription.findFirst({
    where: { userId, status: 'trial' },
  });
  if (hadTrial) return null;

  const endsAt = new Date(Date.now() + cfg.trialDurationDays * 86_400_000);
  const sub = await prisma.vpnSubscription.create({
    data: {
      userId,
      status: 'trial',
      endsAt,
      trafficLimitGb: cfg.trialTrafficGb,
      deviceLimit: cfg.trialDeviceLimit,
    },
  });
  return provisionSubscription(sub);
}

export async function createOrder(userId: string, planId: string) {
  const plan = await prisma.vpnPlan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw new Error('Plan not found');

  const order = await prisma.vpnOrder.create({
    data: {
      userId,
      planId: plan.id,
      amount: plan.priceRub,
      paymentLabel: buildPaymentLabel(),
    },
    include: { plan: true },
  });

  const paymentUrl = createYooMoneyPaymentUrl({
    amount: plan.priceRub.toString(),
    label: order.paymentLabel,
    description: `${plan.name} — ${getVpnConfig().brandName}`,
  });

  return { order, paymentUrl };
}

async function activatePaidOrder(orderId: string) {
  const order = await prisma.vpnOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { plan: true },
  });
  const plan = order.plan;
  const active = await getActiveSubscription(order.userId);

  if (active?.marzbanUsername) {
    const base = active.endsAt > new Date() ? active.endsAt : new Date();
    const endsAt = new Date(base.getTime() + plan.durationDays * 86_400_000);
    const updated = await prisma.vpnSubscription.update({
      where: { id: active.id },
      data: {
        status: 'active',
        planId: plan.id,
        orderId: order.id,
        endsAt,
        trafficLimitGb: plan.trafficGb,
        deviceLimit: plan.deviceLimit,
      },
    });
    await modifyMarzbanUser(active.marzbanUsername, {
      expireTs: toUnix(endsAt),
      status: 'active',
      dataLimitBytes: plan.trafficGb != null ? plan.trafficGb * 1024 ** 3 : 0,
    });
    return updated;
  }

  const endsAt = new Date(Date.now() + plan.durationDays * 86_400_000);
  const sub = await prisma.vpnSubscription.create({
    data: {
      userId: order.userId,
      planId: plan.id,
      orderId: order.id,
      status: 'active',
      endsAt,
      trafficLimitGb: plan.trafficGb,
      deviceLimit: plan.deviceLimit,
    },
  });
  return provisionSubscription(sub);
}

export async function markOrderPaid(input: {
  paymentLabel: string;
  externalId: string;
  raw: Record<string, string>;
}) {
  const order = await prisma.vpnOrder.findUnique({
    where: { paymentLabel: input.paymentLabel },
    include: { plan: true },
  });
  if (!order) return null;

  const existingPayment = await prisma.vpnPayment.findUnique({
    where: { provider_externalId: { provider: 'yoomoney', externalId: input.externalId } },
  });
  if (existingPayment || order.status === 'paid') {
    return getActiveSubscription(order.userId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.vpnPayment.create({
      data: {
        orderId: order.id,
        provider: 'yoomoney',
        externalId: input.externalId,
        status: 'succeeded',
        rawPayload: input.raw,
      },
    });
    await tx.vpnOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date(), paymentExternalId: input.externalId },
    });
  });

  return activatePaidOrder(order.id);
}

export async function confirmMockPayment(paymentLabel: string) {
  return markOrderPaid({
    paymentLabel,
    externalId: `mock-${paymentLabel}`,
    raw: { mock: 'true' },
  });
}

export async function getSubscriptionBody(subToken: string): Promise<string | null> {
  const sub = await prisma.vpnSubscription.findUnique({ where: { subToken } });
  if (!sub || !['trial', 'active'].includes(sub.status) || sub.endsAt <= new Date()) {
    return null;
  }
  if (!sub.marzbanUsername) return null;
  const { getMarzbanLinks, linksToSubscriptionBody } = await import('./marzban.js');
  const links = await getMarzbanLinks(sub.marzbanUsername);
  if (links.length === 0) return null;
  return linksToSubscriptionBody(links);
}
