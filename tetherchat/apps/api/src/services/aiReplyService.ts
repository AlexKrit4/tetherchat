import { prisma } from '../db.js';
import { getAiBotUserId } from '../lib/aiBot.js';
import { consumeRateLimit } from '../redis.js';
import { completeAiChat } from './llmService.js';
import { createMessage } from './messageService.js';

const inflight = new Map<string, Promise<void>>();

/** Serialize replies per conversation so overlapping user messages stay in order. */
export function replyAsAi(conversationId: string, userId: string): Promise<void> {
  const previous = inflight.get(conversationId) ?? Promise.resolve();
  const next = previous
    .then(() => replyAsAiUnlocked(conversationId, userId))
    .catch((error) => {
      console.error('[ai] reply failed', error);
    })
    .finally(() => {
      if (inflight.get(conversationId) === next) inflight.delete(conversationId);
    });
  inflight.set(conversationId, next);
  return next;
}

async function replyAsAiUnlocked(conversationId: string, userId: string): Promise<void> {
  const botId = await getAiBotUserId();
  const allowed = await consumeRateLimit(`rl:ai:${userId}`, 20, 60).catch(() => true);

  let content: string;
  if (!allowed) {
    content = 'Слишком много запросов к нейросети. Подождите минуту.';
  } else {
    const history = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, system: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { authorId: true, content: true },
    });
    content = await completeAiChat(botId, history.reverse());
  }

  await createMessage({
    authorId: botId,
    conversationId,
    content,
    skipAiReply: true,
    skipRateLimit: true,
  });
}
