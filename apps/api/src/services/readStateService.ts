import type { ReadState } from '@tetherchat/shared';
import { ApiError } from '../errors.js';
import { prisma } from '../db.js';
import { loadChannelContext } from '../lib/permissions.js';
import { emitToConversation } from '../ws/realtime.js';

/** Marks a channel as read up to a message and clears its mention counter. */
export async function ackChannel(
  userId: string,
  channelId: string,
  messageId: string,
): Promise<ReadState> {
  await loadChannelContext(channelId, userId);
  const message = await prisma.message.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
    select: { id: true },
  });
  if (!message) throw ApiError.notFound('Message not found');
  const row = await prisma.readState.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: {
      userId,
      channelId,
      lastReadMessageId: messageId,
      lastReadAt: new Date(),
      mentionCount: 0,
    },
    update: { lastReadMessageId: messageId, lastReadAt: new Date(), mentionCount: 0 },
  });

  return {
    channelId,
    lastReadMessageId: row.lastReadMessageId,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    mentionCount: 0,
    unread: false,
  };
}

/** Acknowledges a DM. Emits read receipts only for 1:1 chats, never for servers or groups. */
export async function ackConversation(
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<{ conversationId: string; lastReadMessageId: string; lastReadAt: string }> {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    include: { members: { where: { leftAt: null } } },
  });
  if (!conversation || !conversation.members.some((member) => member.userId === userId)) {
    throw ApiError.forbidden('You are not part of this conversation');
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId, deletedAt: null },
    select: { id: true },
  });
  if (!message) throw ApiError.notFound('Message not found');

  const lastReadAt = new Date();
  await prisma.directConversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadMessageId: messageId, lastReadAt },
  });

  const isOneToOne =
    !conversation.isGroup &&
    !conversation.isSaved &&
    !conversation.isAi &&
    conversation.members.length === 2;
  if (isOneToOne) {
    emitToConversation(conversationId, 'receipt:update', {
      conversationId,
      userId,
      lastReadMessageId: messageId,
      lastReadAt: lastReadAt.toISOString(),
    });
  }

  return { conversationId, lastReadMessageId: messageId, lastReadAt: lastReadAt.toISOString() };
}

/** Socket acks use one event for both guild channels and DMs. */
export async function ackTarget(userId: string, targetId: string, messageId: string): Promise<void> {
  const member = await prisma.directConversationMember.findUnique({
    where: { conversationId_userId: { conversationId: targetId, userId } },
  });
  if (member && !member.leftAt) {
    await ackConversation(userId, targetId, messageId);
    return;
  }
  await ackChannel(userId, targetId, messageId);
}

export async function bumpMentionCounts(channelId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.readState.upsert({
        where: { userId_channelId: { userId, channelId } },
        create: { userId, channelId, mentionCount: 1 },
        update: { mentionCount: { increment: 1 } },
      }),
    ),
  );
}

/**
 * Unread state for every channel the user can see. A channel counts as unread
 * when its newest message is younger than the user's last read timestamp.
 */
export async function listReadStates(userId: string): Promise<ReadState[]> {
  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    select: { serverId: true },
  });
  const serverIds = memberships.map((row) => row.serverId);
  if (serverIds.length === 0) return [];

  const channels = await prisma.channel.findMany({
    where: { serverId: { in: serverIds } },
    select: { id: true },
  });
  const channelIds = channels.map((channel) => channel.id);
  if (channelIds.length === 0) return [];

  const [states, latest] = await Promise.all([
    prisma.readState.findMany({ where: { userId, channelId: { in: channelIds } } }),
    prisma.message.groupBy({
      by: ['channelId'],
      where: { channelId: { in: channelIds }, deletedAt: null },
      _max: { createdAt: true },
    }),
  ]);

  const stateByChannel = new Map(states.map((state) => [state.channelId, state]));
  const latestByChannel = new Map(
    latest.map((row) => [row.channelId as string, row._max.createdAt as Date | null]),
  );

  return channelIds.map((channelId) => {
    const state = stateByChannel.get(channelId);
    const newest = latestByChannel.get(channelId) ?? null;
    const lastReadAt = state?.lastReadAt ?? null;
    const unread = Boolean(newest) && (!lastReadAt || newest! > lastReadAt);

    return {
      channelId,
      lastReadMessageId: state?.lastReadMessageId ?? null,
      lastReadAt: lastReadAt?.toISOString() ?? null,
      mentionCount: state?.mentionCount ?? 0,
      unread,
    };
  });
}
