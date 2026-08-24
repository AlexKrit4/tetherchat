import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { getBotUserId } from './bots.js';
import { conversationInclude, toConversation } from './serialize.js';
import { emitToUser, joinUserToRoom } from '../ws/realtime.js';

export const VPN_BOT_USERNAME = 'tethervpn';

export async function getVpnBotUserId(): Promise<string> {
  return getBotUserId('vpn');
}

export async function ensureVpnConversation(userId: string) {
  const existing = await prisma.directConversation.findUnique({
    where: { vpnForUserId: userId },
    include: conversationInclude,
  });
  if (existing) {
    await joinUserToRoom(userId, socketRooms.conversation(existing.id));
    return existing;
  }

  const botId = await getVpnBotUserId();

  try {
    const created = await prisma.directConversation.create({
      data: {
        isVpn: true,
        vpnForUserId: userId,
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
      where: { vpnForUserId: userId },
      include: conversationInclude,
    });
    if (raced) {
      await joinUserToRoom(userId, socketRooms.conversation(raced.id));
      return raced;
    }
    throw new Error('Failed to create VPN bot conversation');
  }
}
