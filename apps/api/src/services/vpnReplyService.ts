import { getVpnBotUserId } from '../lib/vpnBot.js';
import { consumeRateLimit } from '../redis.js';
import { getVpnConfig } from './vpn/config.js';
import {
  createOrder,
  createTrial,
  formatSubscription,
  getActiveSubscription,
  listActivePlans,
} from './vpn/provisioning.js';
import { createMessage } from './messageService.js';

const inflight = new Map<string, Promise<void>>();

export function replyAsVpn(conversationId: string, userId: string, text: string): Promise<void> {
  const previous = inflight.get(conversationId) ?? Promise.resolve();
  const next = previous
    .then(() => replyAsVpnUnlocked(conversationId, userId, text))
    .catch((error) => console.error('[vpn-bot] reply failed', error))
    .finally(() => {
      if (inflight.get(conversationId) === next) inflight.delete(conversationId);
    });
  inflight.set(conversationId, next);
  return next;
}

async function replyAsVpnUnlocked(conversationId: string, userId: string, text: string) {
  const botId = await getVpnBotUserId();
  const allowed = await consumeRateLimit(`rl:vpn:${userId}`, 30, 60).catch(() => true);
  const content = allowed ? await buildReply(userId, text.trim()) : 'Слишком много запросов. Подождите минуту.';
  await createMessage({
    authorId: botId,
    conversationId,
    content,
    skipAiReply: true,
    skipVpnReply: true,
    skipRateLimit: true,
  });
}

async function buildReply(userId: string, text: string): Promise<string> {
  const cfg = getVpnConfig();
  const normalized = text.toLowerCase();

  if (!text || normalized === '/start' || normalized === 'меню' || normalized === 'start') {
    return renderMenu(userId, cfg.brandName);
  }
  if (normalized === 'тарифы' || normalized === 'plans' || normalized === '/plans') {
    return renderPlans();
  }
  if (normalized === 'подписка' || normalized === 'mysub' || normalized === '/mysub' || normalized === 'моя подписка') {
    return renderSubscription(userId);
  }
  if (normalized === 'пробный' || normalized === 'trial' || normalized === '/trial') {
    return renderTrial(userId);
  }
  if (normalized === 'помощь' || normalized === 'help' || normalized === '/help') {
    return renderHelp(cfg.brandName);
  }

  const buyMatch = normalized.match(/^(?:купить|buy)\s+(\d+|[a-z0-9-]+)$/i);
  if (buyMatch) {
    return renderBuy(userId, buyMatch[1]!);
  }

  return (
    `${await renderMenu(userId, cfg.brandName)}\n\n` +
    'Не понял команду. Напишите **тарифы**, **подписка**, **пробный**, **купить 1** или **помощь**.'
  );
}

function renderHelp(brand: string): string {
  return (
    `**Как подключить ${brand} в Happ:**\n` +
    '1. Скачайте Happ (iOS / Android / Desktop)\n' +
    '2. Напишите боту **подписка** и скопируйте ссылку\n' +
    '3. Happ → + → Импорт из URL → вставьте ссылку\n' +
    '4. Обновите подписку и подключитесь\n\n' +
    'Оплата через ЮMoney. После оплаты подписка активируется автоматически.'
  );
}

async function renderMenu(userId: string, brand: string): Promise<string> {
  const sub = await getActiveSubscription(userId);
  let intro = `Привет! Это **${brand}** — VPN для Happ прямо в TetherChat.\n\n`;
  if (!sub) {
    intro += 'Пробный период: напишите **пробный**\n\n';
  }
  intro += sub ? `**Ваша подписка:**\n${formatSubText(sub)}\n\n` : 'Активной подписки пока нет.\n\n';
  intro +=
    '**Команды:**\n' +
    '• **тарифы** — список тарифов\n' +
    '• **купить 1** — оплатить тариф по номеру\n' +
    '• **подписка** — ссылка для Happ\n' +
    '• **пробный** — пробный период\n' +
    '• **помощь** — инструкция';
  return intro;
}

async function renderPlans(): Promise<string> {
  const plans = await listActivePlans();
  if (plans.length === 0) return 'Тарифы пока не настроены.';

  let currentGroup = '';
  const lines: string[] = ['**Тарифы:**', ''];
  plans.forEach((plan, index) => {
    if (plan.groupName !== currentGroup) {
      currentGroup = plan.groupName;
      lines.push(`_${currentGroup}_`);
    }
    const traffic = plan.trafficGb != null ? `${plan.trafficGb} GB` : '∞';
    lines.push(
      `${index + 1}. **${plan.name}** — ${plan.priceRub} ₽ (${plan.durationDays} дн., ${traffic}, ${plan.deviceLimit} устр.)`,
    );
  });
  lines.push('', 'Чтобы купить: **купить 1** (номер из списка)');
  return lines.join('\n');
}

async function renderSubscription(userId: string): Promise<string> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return 'Активной подписки нет. Напишите **пробный** или **тарифы**.';
  const formatted = formatSubscription(sub);
  return (
    `**Подписка ${formatted.brand}**\n` +
    `Статус: **${formatted.status}**\n` +
    `До: **${new Date(formatted.endsAt).toLocaleString('ru-RU')}**\n` +
    `Трафик: ${formatted.trafficUsedGb} / ${formatted.trafficLimitGb ?? '∞'} GB\n` +
    `Устройств: ${formatted.deviceLimit}\n\n` +
    `**Ссылка для Happ:**\n${formatted.subUrl}`
  );
}

async function renderTrial(userId: string): Promise<string> {
  const sub = await createTrial(userId);
  if (!sub) {
    const active = await getActiveSubscription(userId);
    if (active) return `У вас уже есть подписка.\n\n${formatSubText(active)}`;
    return 'Пробный период недоступен (уже использован или отключён).';
  }
  const formatted = formatSubscription(sub);
  return (
    '✅ Пробный период активирован!\n\n' +
    `До: **${new Date(formatted.endsAt).toLocaleString('ru-RU')}**\n` +
    `Трафик: ${formatted.trafficLimitGb} GB\n\n` +
    `**Ссылка для Happ:**\n${formatted.subUrl}`
  );
}

async function renderBuy(userId: string, token: string): Promise<string> {
  const plans = await listActivePlans();
  const plan = /^\d+$/.test(token)
    ? plans[Number(token) - 1]
    : plans.find((row) => row.slug === token || row.id === token);

  if (!plan) return 'Тариф не найден. Напишите **тарифы** и выберите номер.';

  const { order, paymentUrl } = await createOrder(userId, plan.id);
  return (
    `**Заказ создан:** ${plan.name}\n` +
    `Сумма: **${plan.priceRub} ₽**\n` +
    `Метка платежа: \`${order.paymentLabel}\`\n\n` +
    `Оплатите через ЮMoney:\n${paymentUrl}\n\n` +
    'После поступления средств подписка активируется автоматически, и я пришлю ссылку сюда.'
  );
}

function formatSubText(sub: NonNullable<Awaited<ReturnType<typeof getActiveSubscription>>>) {
  const formatted = formatSubscription(sub);
  return (
    `Статус: ${formatted.status}, до ${new Date(formatted.endsAt).toLocaleDateString('ru-RU')}\n` +
    `${formatted.subUrl}`
  );
}
