import type { PresenceStatus } from '@tetherchat/shared';
import { socketRooms } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { emitToUser, realtimeServer } from './realtime.js';

const PRESENCE_KEY = 'presence:sessions';

function sessionKey(userId: string): string {
  return `${PRESENCE_KEY}:${userId}`;
}

/**
 * Presence is reference counted in Redis: a user is online while at least one
 * socket (across any API instance) is connected.
 */
export async function registerSession(userId: string, sessionId: string): Promise<number> {
  const client = redis();
  await client.sadd(sessionKey(userId), sessionId);
  await client.expire(sessionKey(userId), 86_400);
  return client.scard(sessionKey(userId));
}

export async function unregisterSession(userId: string, sessionId: string): Promise<number> {
  const client = redis();
  await client.srem(sessionKey(userId), sessionId);
  return client.scard(sessionKey(userId));
}

export async function setStatus(userId: string, status: PresenceStatus): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { status, lastSeenAt: new Date() },
  });
}

/** Fans a status change out to every server the user shares with others. */
export async function broadcastPresence(userId: string, status: PresenceStatus): Promise<void> {
  const visible: PresenceStatus = status === 'invisible' ? 'offline' : status;
  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    select: { serverId: true },
  });

  const io = realtimeServer();
  for (const membership of memberships) {
    io?.to(socketRooms.server(membership.serverId)).emit('presence:update', {
      userId,
      status: visible,
    });
  }

  const conversations = await prisma.directConversationMember.findMany({
    where: { conversationId: { in: await conversationIdsOf(userId) } },
    select: { userId: true },
  });
  for (const member of conversations) {
    if (member.userId !== userId) emitToUser(member.userId, 'presence:update', { userId, status: visible });
  }
}

async function conversationIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.directConversationMember.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true },
  });
  return rows.map((row) => row.conversationId);
}

/** Marks every user offline. Used on boot so a crashed instance leaves no ghosts. */
export async function resetPresence(): Promise<void> {
  await prisma.user.updateMany({
    where: { status: { not: 'offline' } },
    data: { status: 'offline' },
  });
}
