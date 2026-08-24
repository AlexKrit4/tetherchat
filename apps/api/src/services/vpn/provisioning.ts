import type { VpnPlan, VpnSubscription } from '@prisma/client';
import { prisma } from '../../db.js';
import { buildPaymentLabel, buildSubUrl, createYooMoneyPaymentUrl, getVpnConfig } from './config.js';
import {
  calculateCustomPrice,
  clearOrderMeta,
  getOrderMeta,
  setOrderMeta,
  type CustomOrderMeta,
} from './custom.js';
import { createMarzbanUser, modifyMarzbanUser, toUnix } from './marzban.js';

const ACTIVE_STATUSES = ['trial', 'active'] as const;

const LEGACY_SLUGS = [
  'self-1m',
  'self-3m',
  'self-1y',
  'family-1m',
  'family-3m',
  'family-1y',
] as const;

export async function seedVpnPlans(): Promise<void> {
  const plans = [
    { slug: 'limited-30gb', name: '30 ГБ — 1 месяц', groupName: 'ограниченный', durationDays: 30, trafficGb: 30, deviceLimit: 3, priceRub: '100.00', sortOrder: 10 },
    { slug: 'limited-100gb', name: '100 ГБ — 1 месяц', groupName: 'ограниченный', durationDays: 30, trafficGb: 100, deviceLimit: 3, priceRub: '300.00', sortOrder: 20 },
    { slug: 'limited-250gb', name: '250 ГБ — 1 месяц', groupName: 'ограниченный', durationDays: 30, trafficGb: 250, deviceLimit: 3, priceRub: '600.00', sortOrder: 30 },
    { slug: 'eternal-1m', name: 'Вечный — 1 месяц', groupName: 'вечный', durationDays: 30, trafficGb: null, deviceLimit: 3, priceRub: '200.00', sortOrder: 40 },
    { slug: 'eternal-3m', name: 'Вечный — 3 месяца', groupName: 'вечный', durationDays: 90, trafficGb: null, deviceLimit: 3, priceRub: '500.00', sortOrder: 50 },
    { slug: 'eternal-6m', name: 'Вечный — 6 месяцев', groupName: 'вечный', durationDays: 180, trafficGb: null, deviceLimit: 3, priceRub: '800.00', sortOrder: 60 },
    { slug: 'custom', name: 'Свой тариф', groupName: 'свой', durationDays: 30, trafficGb: null, deviceLimit: 3, priceRub: '0.00', sortOrder: 999 },
  ];

  for (const plan of plans) {
    await prisma.vpnPlan.upsert({
      where: { slug: plan.slug },
      create: { ...plan, isActive: plan.slug !== 'custom' },
      update: {
        ...plan,
        isActive: plan.slug !== 'custom',
      },
    });
  }

  await prisma.vpnPlan.updateMany({
    where: { slug: { in: [...LEGACY_SLUGS] } },
    data: { isActive: false },
  });
}

export async function listActivePlans(groupName?: string) {
  return prisma.vpnPlan.findMany({
    where: {
      isActive: true,
      ...(groupName ? { groupName } : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });
}

async function getCustomPlanTemplate() {
  const plan = await prisma.vpnPlan.findUnique({ where: { slug: 'custom' } });
  if (!plan) throw new Error('Custom plan template missing');
  return plan;
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

export async function createCustomOrder(userId: string, meta: CustomOrderMeta) {
  const template = await getCustomPlanTemplate();
  const amount = calculateCustomPrice(meta.trafficGb, meta.durationDays, meta.deviceLimit);
  if (amount < 50) throw new Error('Minimum order amount is 50 RUB');

  const order = await prisma.vpnOrder.create({
    data: {
      userId,
      planId: template.id,
      amount: amount.toFixed(2),
      paymentLabel: buildPaymentLabel(),
    },
    include: { plan: true },
  });

  await setOrderMeta(order.paymentLabel, meta);

  const trafficLabel = meta.trafficGb != null ? `${meta.trafficGb} GB` : '∞';
  const description = `Свой тариф (${meta.durationDays} дн., ${trafficLabel}, ${meta.deviceLimit} устр.) — ${getVpnConfig().brandName}`;
  const paymentUrl = createYooMoneyPaymentUrl({
    amount: order.amount.toString(),
    label: order.paymentLabel,
    description,
  });

  return { order, paymentUrl, meta };
}

function resolveOrderTerms(
  plan: VpnPlan,
  meta: CustomOrderMeta | null,
): { durationDays: number; trafficGb: number | null; deviceLimit: number } {
  if (meta) {
    return {
      durationDays: meta.durationDays,
      trafficGb: meta.trafficGb,
      deviceLimit: meta.deviceLimit,
    };
  }
  return {
    durationDays: plan.durationDays,
    trafficGb: plan.trafficGb,
    deviceLimit: plan.deviceLimit,
  };
}

async function activatePaidOrder(orderId: string) {
  const order = await prisma.vpnOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { plan: true },
  });
  const plan = order.plan;
  const meta = await getOrderMeta(order.paymentLabel);
  const terms = resolveOrderTerms(plan, meta);
  const active = await getActiveSubscription(order.userId);

  if (active?.marzbanUsername) {
    const base = active.endsAt > new Date() ? active.endsAt : new Date();
    const endsAt = new Date(base.getTime() + terms.durationDays * 86_400_000);
    const updated = await prisma.vpnSubscription.update({
      where: { id: active.id },
      data: {
        status: 'active',
        planId: plan.slug === 'custom' ? null : plan.id,
        orderId: order.id,
        endsAt,
        trafficLimitGb: terms.trafficGb,
        deviceLimit: terms.deviceLimit,
      },
    });
    await modifyMarzbanUser(active.marzbanUsername, {
      expireTs: toUnix(endsAt),
      status: 'active',
      dataLimitBytes: terms.trafficGb != null ? terms.trafficGb * 1024 ** 3 : 0,
    });
    await clearOrderMeta(order.paymentLabel);
    return updated;
  }

  const endsAt = new Date(Date.now() + terms.durationDays * 86_400_000);
  const sub = await prisma.vpnSubscription.create({
    data: {
      userId: order.userId,
      planId: plan.slug === 'custom' ? null : plan.id,
      orderId: order.id,
      status: 'active',
      endsAt,
      trafficLimitGb: terms.trafficGb,
      deviceLimit: terms.deviceLimit,
    },
  });
  await clearOrderMeta(order.paymentLabel);
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
