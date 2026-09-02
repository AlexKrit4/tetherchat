import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { getBotUserId } from './bots.js';
import { canAccessMonitorBot } from './monitorBotAccess.js';
import { conversationInclude, toConversation } from './serialize.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

export const MONITOR_BOT_USERNAME = 'tethermonitor';

export async function getMonitorBotUserId(): Promise<string> {
  return getBotUserId('monitor');
}

export async function ensureMonitorConversation(userId: string) {
  if (!(await canAccessMonitorBot(userId))) {
    throw new Error('Monitor bot is restricted to platform admins');
  }

  const existing = await prisma.directConversation.findUnique({
    where: { monitorForUserId: userId },
    include: conversationInclude,
  });
  if (existing) {
    await joinUserToRoom(userId, socketRooms.conversation(existing.id));
    return existing;
  }

  const botId = await getMonitorBotUserId();

  try {
    const created = await prisma.directConversation.create({
      data: {
        isMonitor: true,
        monitorForUserId: userId,
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
      where: { monitorForUserId: userId },
      include: conversationInclude,
    });
    if (raced) {
      await joinUserToRoom(userId, socketRooms.conversation(raced.id));
      return raced;
    }
    throw new Error('Failed to create monitor bot conversation');
  }
}
