import { randomBytes } from 'node:crypto';
import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { conversationInclude, toConversation } from './serialize.js';
import { hashPassword } from './tokens.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

export const AI_BOT_USERNAME = 'tetherai';
export const AI_BOT_EMAIL = 'tetherai@tetherchat.invalid';
export const AI_BOT_DISPLAY_NAME = 'Нейросеть';

const RESERVED_USERNAMES = new Set([AI_BOT_USERNAME]);

let cachedBotId: string | null = null;

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.trim().toLowerCase());
}

export async function getAiBotUserId(): Promise<string> {
  if (cachedBotId) return cachedBotId;

  const byFlag = await prisma.user.findFirst({
    where: { isBot: true },
    select: { id: true },
  });
  if (byFlag) {
    cachedBotId = byFlag.id;
    return byFlag.id;
  }

  const existing = await prisma.user.findUnique({
    where: { username: AI_BOT_USERNAME },
    select: { id: true, email: true },
  });
  if (existing && existing.email === AI_BOT_EMAIL) {
    await prisma.user.update({ where: { id: existing.id }, data: { isBot: true } });
    cachedBotId = existing.id;
    return existing.id;
  }

  const username = existing ? `${AI_BOT_USERNAME}_bot` : AI_BOT_USERNAME;

  try {
    const created = await prisma.user.create({
      data: {
        email: AI_BOT_EMAIL,
        username,
        displayName: AI_BOT_DISPLAY_NAME,
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        emailVerified: true,
        isBot: true,
        bio: 'Встроенный помощник TetherChat',
        status: 'online',
      },
      select: { id: true },
    });
    cachedBotId = created.id;
    return created.id;
  } catch {
    const raced = await prisma.user.findFirst({
      where: { OR: [{ isBot: true }, { email: AI_BOT_EMAIL }] },
      select: { id: true },
    });
    if (raced) {
      cachedBotId = raced.id;
      return raced.id;
    }
    throw new Error('Failed to create AI bot user');
  }
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
