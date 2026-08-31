import { getVpnBotUserId } from '../lib/vpnBot.js';
import { consumeRateLimit } from '../redis.js';
import { getVpnConfig } from './vpn/config.js';
import {
  calculateCustomPrice,
  getCustomFsm,
  setCustomFsm,
} from './vpn/custom.js';
import {
  createCustomOrder,
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

function normalizeCommand(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildReply(userId: string, text: string): Promise<string> {
  const cfg = getVpnConfig();
  const normalized = normalizeCommand(text);

  const fsm = await getCustomFsm(userId);
  if (fsm) {
    const customReply = await handleCustomFsm(userId, normalized, fsm);
    if (customReply) return customReply;
  }

  if (!text || normalized === '/start' || normalized === 'меню' || normalized === 'start') {
    return renderMenu(userId, cfg.brandName);
  }
  if (normalized === 'тарифы' || normalized === 'plans' || normalized === '/plans') {
    return renderTariffCategories();
  }
  if (normalized === 'tarif:limited' || normalized === 'ограниченный') {
    return renderPlansByGroup('ограниченный');
  }
  if (normalized === 'tarif:eternal' || normalized === 'вечный') {
    return renderPlansByGroup('вечный');
  }
  if (normalized === 'tarif:custom' || normalized === 'свой тариф' || normalized === 'свой') {
    await setCustomFsm(userId, { step: 'gb' });
    return (
      '**Свой тариф**\n\n' +
      'Укажите объём трафика в ГБ (например **100**) или напишите **∞** / **безлимит** для вечного трафика.\n\n' +
      'Формула: 2 ₽/ГБ + 1 ₽/день + 25 ₽/устройство'
    );
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
  if (normalized === 'поддержка' || normalized === 'support' || normalized === '/support') {
    return renderSupport(cfg.brandName);
  }

  const buyMatch = normalized.match(/^(?:купить|buy)\s+(\d+|[a-z0-9-]+)$/i);
  if (buyMatch) {
    return renderBuy(userId, buyMatch[1]!);
  }

  return (
    `${await renderMenu(userId, cfg.brandName)}\n\n` +
    'Не понял команду. Используйте кнопки ниже или напишите **тарифы**, **подписка**, **купить limited-30gb**.'
  );
}

async function handleCustomFsm(
  userId: string,
  normalized: string,
  fsm: NonNullable<Awaited<ReturnType<typeof getCustomFsm>>>,
): Promise<string | null> {
  if (normalized === 'отмена' || normalized === 'cancel' || normalized === 'меню') {
    await setCustomFsm(userId, null);
    return 'Настройка своего тарифа отменена.';
  }

  if (fsm.step === 'gb') {
    let trafficGb: number | null;
    if (normalized === '∞' || normalized === 'безлимит' || normalized === 'unlimited' || normalized === '0') {
      trafficGb = null;
    } else {
      const value = Number.parseInt(normalized, 10);
      if (!Number.isFinite(value) || value < 1 || value > 10_000) {
        return 'Укажите число от 1 до 10000 ГБ, или **∞** для безлимита.';
      }
      trafficGb = value;
    }
    await setCustomFsm(userId, { step: 'days', trafficGb });
    const label = trafficGb != null ? `${trafficGb} ГБ` : '∞';
    return `Трафик: **${label}**\n\nНа сколько дней нужна подписка? (1–365)`;
  }

  if (fsm.step === 'days') {
    const days = Number.parseInt(normalized, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return 'Укажите срок от 1 до 365 дней.';
    }
    await setCustomFsm(userId, { step: 'devices', trafficGb: fsm.trafficGb, durationDays: days });
    return `Срок: **${days} дн.**\n\nСколько устройств подключить? (1–10, по умолчанию 3)`;
  }

  if (fsm.step === 'devices') {
    const devices = normalized === '' ? 3 : Number.parseInt(normalized, 10);
    if (!Number.isFinite(devices) || devices < 1 || devices > 10) {
      return 'Укажите число устройств от 1 до 10.';
    }
    const durationDays = fsm.durationDays ?? 30;
    const trafficGb = fsm.trafficGb ?? null;
    const price = calculateCustomPrice(trafficGb, durationDays, devices);
    if (price < 50) {
      await setCustomFsm(userId, null);
      return 'Минимальная сумма заказа — **50 ₽**. Увеличьте трафик или срок.';
    }

    await setCustomFsm(userId, null);
    const { order, paymentUrl } = await createCustomOrder(userId, {
      durationDays,
      trafficGb,
      deviceLimit: devices,
    });
    const trafficLabel = trafficGb != null ? `${trafficGb} GB` : '∞';
    return (
      `**Свой тариф готов**\n` +
      `• ${durationDays} дн., ${trafficLabel}, ${devices} устр.\n` +
      `• Сумма: **${price} ₽**\n` +
      `• Метка: \`${order.paymentLabel}\`\n\n` +
      `Оплатите через ЮMoney:\n${paymentUrl}\n\n` +
      'После оплаты подписка активируется автоматически.'
    );
  }

  return null;
}

function renderHelp(brand: string): string {
  return (
    `**Как подключить ${brand} в Happ:**\n` +
    '1. Скачайте Happ (iOS / Android / Desktop)\n' +
    '2. Нажмите **📱 Моя подписка** или напишите **подписка**\n' +
    '3. Happ → + → Импорт из URL → вставьте ссылку\n' +
    '4. Обновите подписку и подключитесь\n\n' +
    'Оплата через ЮMoney. После оплаты подписка активируется автоматически.'
  );
}

function renderSupport(brand: string): string {
  return (
    `**Поддержка ${brand}**\n\n` +
    'Если возникли проблемы с оплатой или подключением — напишите в поддержку на сайте **bigwinzone.ru** или повторите **подписка**, чтобы получить актуальную ссылку.'
  );
}

function renderTariffCategories(): string {
  return (
    '**Выберите категорию тарифов:**\n\n' +
    '• **📦 Ограниченный** — фиксированный трафик на месяц\n' +
    '• **♾️ Вечный** — безлимитный трафик\n' +
    '• **🛠 Свой тариф** — настройте объём, срок и устройства\n\n' +
    'Нажмите кнопку категории ниже.'
  );
}

async function renderMenu(userId: string, brand: string): Promise<string> {
  const sub = await getActiveSubscription(userId);
  let intro = `Привет! Это **${brand}** — VPN для Happ прямо в TetherChat.\n\n`;
  if (!sub) {
    intro += 'Пробный период: нажмите **пробный** или кнопку в меню\n\n';
  }
  intro += sub ? `**Ваша подписка:**\n${formatSubText(sub)}\n\n` : 'Активной подписки пока нет.\n\n';
  intro +=
    '**Команды:**\n' +
    '• **🛒 Тарифы** — выбор тарифа\n' +
    '• **📱 Моя подписка** — ссылка для Happ\n' +
    '• **❓ Помощь** — инструкция\n' +
    '• **💬 Поддержка** — связаться с поддержкой';
  return intro;
}

async function renderPlansByGroup(groupName: string): Promise<string> {
  const plans = await listActivePlans(groupName);
  if (plans.length === 0) return 'Тарифы в этой категории пока не настроены.';

  const title = groupName === 'ограниченный' ? '📦 Ограниченный' : '♾️ Вечный';
  const lines: string[] = [`**${title}:**`, ''];
  plans.forEach((plan, index) => {
    const traffic = plan.trafficGb != null ? `${plan.trafficGb} GB` : '∞';
    lines.push(
      `${index + 1}. **${plan.name}** — ${plan.priceRub} ₽ (${plan.durationDays} дн., ${traffic}, ${plan.deviceLimit} устр.)`,
    );
    lines.push(`   → **купить ${plan.slug}**`);
  });
  return lines.join('\n');
}

async function renderSubscription(userId: string): Promise<string> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return 'Активной подписки нет. Нажмите **🛒 Тарифы** или **пробный**.';
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

  if (!plan) return 'Тариф не найден. Нажмите **🛒 Тарифы** и выберите тариф.';

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
