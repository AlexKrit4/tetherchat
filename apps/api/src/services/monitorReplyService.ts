import { getMonitorBotUserId } from '../lib/monitorBot.js';
import { assertMonitorBotAccess } from '../lib/monitorBotAccess.js';
import { consumeRateLimit } from '../redis.js';
import {
  formatApiReport,
  formatDiskReport,
  formatDockerReport,
  formatIntegrityReport,
  formatStatusReport,
} from './monitor/health.js';
import { createMessage } from './messageService.js';

const inflight = new Map<string, Promise<void>>();

export function replyAsMonitor(conversationId: string, userId: string, text: string): Promise<void> {
  const previous = inflight.get(conversationId) ?? Promise.resolve();
  const next = previous
    .then(() => replyAsMonitorUnlocked(conversationId, userId, text))
    .catch((error) => console.error('[monitor-bot] reply failed', error))
    .finally(() => {
      if (inflight.get(conversationId) === next) inflight.delete(conversationId);
    });
  inflight.set(conversationId, next);
  return next;
}

async function replyAsMonitorUnlocked(conversationId: string, userId: string, text: string) {
  await assertMonitorBotAccess(userId);
  const botId = await getMonitorBotUserId();
  const allowed = await consumeRateLimit(`rl:monitor:${userId}`, 20, 60).catch(() => true);
  const content = allowed
    ? await buildReply(text.trim())
    : 'Слишком много запросов. Подождите минуту.';
  await createMessage({
    authorId: botId,
    conversationId,
    content,
    skipAiReply: true,
    skipVpnReply: true,
    skipMonitorReply: true,
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

function renderHelp(): string {
  return (
    '**🖥 Server Monitor**\n\n' +
    'Команды:\n' +
    '• **статус** / **status** — полный снимок сервера\n' +
    '• **диск** / **disk** — занятость диска\n' +
    '• **docker** — контейнеры Docker\n' +
    '• **api** — проверка /api/health\n' +
    '• **целостность** / **integrity** — сводная проверка\n' +
    '• **помощь** / **help** — это меню\n\n' +
    'Бот доступен только администратору **alexkrit**.'
  );
}

async function buildReply(text: string): Promise<string> {
  const normalized = normalizeCommand(text);

  if (!text || normalized === '/start' || normalized === 'меню' || normalized === 'start') {
    return renderHelp();
  }
  if (normalized === 'помощь' || normalized === 'help' || normalized === '/help') {
    return renderHelp();
  }
  if (normalized === 'статус' || normalized === 'status' || normalized === '/status') {
    return formatStatusReport();
  }
  if (normalized === 'диск' || normalized === 'disk' || normalized === '/disk') {
    return formatDiskReport();
  }
  if (normalized === 'docker' || normalized === 'контейнеры' || normalized === 'containers') {
    return formatDockerReport();
  }
  if (normalized === 'api' || normalized === '/api') {
    return formatApiReport();
  }
  if (normalized === 'целостность' || normalized === 'integrity' || normalized === '/integrity') {
    return formatIntegrityReport();
  }

  return `${renderHelp()}\n\nНе понял команду. Используйте кнопки ниже или напишите **статус**, **диск**, **docker**.`;
}
