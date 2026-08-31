import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { getBotUserId, isReservedUsername as isReservedBotUsername } from './bots.js';
import { conversationInclude, toConversation } from './serialize.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

export const AI_BOT_USERNAME = 'tetherai';
export const AI_BOT_EMAIL = 'tetherai@tetherchat.invalid';
export const AI_BOT_DISPLAY_NAME = 'Нейросеть';

export function isReservedUsername(username: string): boolean {
  return isReservedBotUsername(username);
}

export async function getAiBotUserId(): Promise<string> {
  return getBotUserId('ai');
}

export async function ensureAiConversation(userId: string) {
  const existing = await prisma.directConversation.findUnique({
    where: { aiForUserId: userId },
    include: conversationInclude,
  });
  if (existing) {
    await joinUserToRoom(userId, socketRooms.conversation(existing.id));
    return existing;
  }

  const botId = await getAiBotUserId();

  try {
    const created = await prisma.directConversation.create({
      data: {
        isAi: true,
        aiForUserId: userId,
        ownerId: userId,
        members: { create: [{ userId }, { userId: botId }] },
      },
      include: conversationInclude,
    });
    await joinUserToRoom(userId, socketRooms.conversation(created.id));
    emitToUser(userId, 'dm:create', toConversation(created, userId));
    return created;
  } catch {
    const raced = await prisma.directConversation.findUnique({
      where: { aiForUserId: userId },
      include: conversationInclude,
    });
    if (raced) {
      await joinUserToRoom(userId, socketRooms.conversation(raced.id));
      return raced;
    }
    throw new Error('Failed to create AI conversation');
  }
}
