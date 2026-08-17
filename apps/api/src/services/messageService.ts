import {
  LIMITS,
  Permission,
  can,
  extractUrls,
  extractUserMentions,
  mentionsEveryone as detectEveryone,
} from '@tetherchat/shared';
import type { Message } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { enqueue } from '../jobs/queue.js';
import { messageInclude, toMessage, toReactions } from '../lib/serialize.js';
import {
  assertConversationMember,
  assertPermission,
  loadChannelContext,
} from '../lib/permissions.js';
import { consumeRateLimit } from '../redis.js';
import { emitToChannel, emitToConversation } from '../ws/realtime.js';
import { bumpMentionCounts } from './readStateService.js';
import { filterNotifiableUsers } from './pushService.js';
import { getConfig } from '../config.js';

export interface CreateMessageInput {
  authorId: string;
  channelId?: string;
  conversationId?: string;
  content: string;
  replyToId?: string | null;
  attachmentIds?: string[];
  /**
   * Client-generated id echoed back in the broadcast so the sender can replace
   * its optimistic row instead of rendering the message twice.
   */
  nonce?: string;
}

interface Target {
  kind: 'channel' | 'conversation';
  id: string;
  serverId: string | null;
  serverName: string | null;
  channelName: string;
  recipientIds: string[];
  canMentionEveryone: boolean;
}

async function resolveTarget(input: CreateMessageInput): Promise<Target> {
  if (input.channelId) {
    const context = await loadChannelContext(input.channelId, input.authorId);
    assertPermission(context, Permission.SEND_MESSAGES);

    const channel = await prisma.channel.findUniqueOrThrow({
      where: { id: input.channelId },
      select: { name: true, serverId: true },
    });
    const members = await prisma.serverMember.findMany({
      where: { serverId: channel.serverId },
      select: { userId: true },
    });

    return {
      kind: 'channel',
      id: input.channelId,
      serverId: channel.serverId,
      serverName: context.serverName,
      channelName: channel.name,
      recipientIds: members.map((member) => member.userId),
      canMentionEveryone: can(context.permissions, Permission.MENTION_EVERYONE),
    };
  }

  if (input.conversationId) {
    await assertConversationMember(input.conversationId, input.authorId);
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { id: input.conversationId },
      include: { members: { where: { leftAt: null }, select: { userId: true } } },
    });

    return {
      kind: 'conversation',
      id: input.conversationId,
      serverId: null,
      serverName: null,
      channelName: conversation.name ?? 'Direct Message',
      recipientIds: conversation.members.map((member) => member.userId),
      canMentionEveryone: false,
    };
  }

  throw ApiError.badRequest('Either channelId or conversationId is required');
}

function assertContent(content: string, attachmentCount: number): string {
  const trimmed = content.replace(/\s+$/g, '');
  if (trimmed.length === 0 && attachmentCount === 0) {
    throw ApiError.badRequest('Message must contain text or an attachment');
  }
  if (trimmed.length > LIMITS.messageContent.max) {
    throw ApiError.badRequest(`Message must be at most ${LIMITS.messageContent.max} characters`);
  }
  return trimmed;
}

async function assertSendRate(userId: string): Promise<void> {
  const allowed = await consumeRateLimit(
    `rl:msg:${userId}`,
    getConfig().MESSAGE_RATE_PER_10S,
    10,
  ).catch(() => true);
  if (!allowed) throw ApiError.tooManyRequests('You are sending messages too quickly');
}

export async function createMessage(input: CreateMessageInput): Promise<Message> {
  await assertSendRate(input.authorId);

  const target = await resolveTarget(input);
  const attachmentIds = (input.attachmentIds ?? []).slice(0, LIMITS.attachmentsPerMessage);
  const content = assertContent(input.content, attachmentIds.length);

  if (input.replyToId) {
    const parent = await prisma.message.findUnique({
      where: { id: input.replyToId },
      select: { channelId: true, conversationId: true },
    });
    const sameTarget =
      target.kind === 'channel' ? parent?.channelId === target.id : parent?.conversationId === target.id;
    if (!parent || !sameTarget) {
      throw ApiError.badRequest('The message you are replying to does not exist here');
    }
  }

  if (attachmentIds.length > 0) {
    const owned = await prisma.attachment.count({
      where: { id: { in: attachmentIds }, uploaderId: input.authorId, messageId: null },
    });
    if (owned !== attachmentIds.length) {
      throw ApiError.badRequest('One or more attachments are unavailable');
    }
  }

  const mentionedUserIds = filterMentions(target, extractUserMentions(content));
  const mentionsEveryone = target.canMentionEveryone && detectEveryone(content);

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        channelId: target.kind === 'channel' ? target.id : null,
        conversationId: target.kind === 'conversation' ? target.id : null,
        authorId: input.authorId,
        content,
        replyToId: input.replyToId ?? null,
        mentionedUserIds,
        mentionsEveryone,
      },
      include: messageInclude,
    });

    if (attachmentIds.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { messageId: message.id },
      });
    }

    if (target.kind === 'conversation') {
      await tx.directConversation.update({
        where: { id: target.id },
        data: { lastMessageAt: message.createdAt },
      });
    }

    return message;
  });

  const full = attachmentIds.length
    ? await prisma.message.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude })
    : created;

  const payload: Message = {
    ...toMessage(full, null),
    serverId: target.serverId,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  };

  if (target.kind === 'channel') {
    emitToChannel(target.id, 'message:new', payload);
    await markAuthorRead(input.authorId, target.id, payload.id);
    const mentionTargets = mentionsEveryone
      ? target.recipientIds.filter((id) => id !== input.authorId)
      : mentionedUserIds.filter((id) => id !== input.authorId);
    await bumpMentionCounts(target.id, mentionTargets);
  } else {
    emitToConversation(target.id, 'message:new', payload);
  }

  await notifyRecipients(target, payload, mentionsEveryone, mentionedUserIds);

  const urls = extractUrls(content);
  if (urls.length > 0) {
    await enqueue({ type: 'link-preview', messageId: payload.id, urls });
  }

  return payload;
}

function filterMentions(target: Target, ids: string[]): string[] {
  if (ids.length === 0) return [];
  return ids.filter((id) => target.recipientIds.includes(id));
}

async function markAuthorRead(userId: string, channelId: string, messageId: string): Promise<void> {
  await prisma.readState
    .upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId, lastReadMessageId: messageId, lastReadAt: new Date() },
      update: { lastReadMessageId: messageId, lastReadAt: new Date() },
    })
    .catch(() => undefined);
}

async function notifyRecipients(
  target: Target,
  message: Message,
  mentionsEveryone: boolean,
  mentionedUserIds: string[],
): Promise<void> {
  const others = target.recipientIds.filter((id) => id !== message.authorId);
  if (others.length === 0) return;

  const mentioned = mentionsEveryone ? others : others.filter((id) => mentionedUserIds.includes(id));
  const notifyIds =
    target.kind === 'conversation'
      ? others
      : await filterNotifiableUsers(target.id, mentioned, { isMention: true });

  if (notifyIds.length === 0) return;

  const authorName = message.author.displayName ?? message.author.username;
  const title =
    target.kind === 'channel' ? `${authorName} in #${target.channelName}` : authorName;
  const url =
    target.kind === 'channel'
      ? `/channels/${target.serverId}/${target.id}`
      : `/channels/@me/${target.id}`;

  await enqueue({
    type: 'push',
    userIds: notifyIds,
    payload: {
      title,
      body: message.content.slice(0, 140) || 'Sent an attachment',
      icon: message.author.avatarUrl ?? undefined,
      url,
      tag: `channel:${target.id}`,
    },
  });
}

export async function editMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<Message> {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, channelId: true, conversationId: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found');
  if (existing.authorId !== userId) throw ApiError.forbidden('You can only edit your own messages');

  const target = await resolveTargetForExisting(existing, userId);
  const trimmed = assertContent(content, 1);
  const mentionedUserIds = filterMentions(target, extractUserMentions(trimmed));

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: trimmed,
      editedAt: new Date(),
      mentionedUserIds,
      mentionsEveryone: target.canMentionEveryone && detectEveryone(trimmed),
      previews: { deleteMany: {} },
    },
    include: messageInclude,
  });

  const payload: Message = { ...toMessage(updated, null), serverId: target.serverId };
  broadcast(target, 'message:updated', payload);

  const urls = extractUrls(trimmed);
  if (urls.length > 0) await enqueue({ type: 'link-preview', messageId, urls });

  return payload;
}

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, channelId: true, conversationId: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found');

  if (existing.authorId !== userId) {
    if (!existing.channelId) throw ApiError.forbidden('You can only delete your own messages');
    const context = await loadChannelContext(existing.channelId, userId);
    assertPermission(context, Permission.MANAGE_MESSAGES);
  }

  await prisma.message.delete({ where: { id: messageId } });

  const room = existing.channelId ?? existing.conversationId!;
  const event = { messageId, channelId: room };
  if (existing.channelId) emitToChannel(room, 'message:deleted', event);
  else emitToConversation(room, 'message:deleted', event);
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<Message['reactions']> {
  if (emoji.length === 0 || emoji.length > 32) throw ApiError.badRequest('Invalid emoji');

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { channelId: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found');

  if (message.channelId) {
    const context = await loadChannelContext(message.channelId, userId);
    assertPermission(context, Permission.ADD_REACTIONS);
  } else if (message.conversationId) {
    await assertConversationMember(message.conversationId, userId);
  }

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  }

  const rows = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
    orderBy: { createdAt: 'asc' },
  });
  const reactions = toReactions(rows, null);

  const room = message.channelId ?? message.conversationId!;
  const payload = { messageId, channelId: room, reactions };
  if (message.channelId) emitToChannel(room, 'reaction:updated', payload);
  else emitToConversation(room, 'reaction:updated', payload);

  return reactions;
}

export async function setPinned(
  messageId: string,
  userId: string,
  pinned: boolean,
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { channelId: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found');

  if (message.channelId) {
    const context = await loadChannelContext(message.channelId, userId);
    assertPermission(context, Permission.MANAGE_MESSAGES);
  } else if (message.conversationId) {
    await assertConversationMember(message.conversationId, userId);
  }

  const room = message.channelId ?? message.conversationId!;

  if (pinned) {
    if (message.channelId) {
      await prisma.pin.upsert({
        where: { messageId },
        create: { messageId, channelId: message.channelId, pinnedById: userId },
        update: {},
      });
    }
    await prisma.message.update({ where: { id: messageId }, data: { pinned: true } });
  } else {
    await prisma.pin.deleteMany({ where: { messageId } });
    await prisma.message.update({ where: { id: messageId }, data: { pinned: false } });
  }

  const payload = { messageId, channelId: room, pinned };
  if (message.channelId) emitToChannel(room, 'message:pinned', payload);
  else emitToConversation(room, 'message:pinned', payload);
}

export interface ListMessagesOptions {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
  currentUserId: string;
}

/** Returns messages newest-last, which is the order the UI renders them in. */
export async function listMessages(
  target: { channelId?: string; conversationId?: string; serverId: string | null },
  options: ListMessagesOptions,
): Promise<{ items: Message[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(options.limit ?? LIMITS.messagePageSize, 1), 100);
  const where = target.channelId
    ? { channelId: target.channelId, deletedAt: null }
    : { conversationId: target.conversationId, deletedAt: null };

  const cursorBoundary = await resolveCursor(options.before ?? options.after ?? options.around);

  if (options.after && cursorBoundary) {
    const rows = await prisma.message.findMany({
      where: { ...where, createdAt: { gt: cursorBoundary } },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map((row) => ({
        ...toMessage(row, options.currentUserId),
        serverId: target.serverId,
      })),
      hasMore,
    };
  }

  const rows = await prisma.message.findMany({
    where: cursorBoundary ? { ...where, createdAt: { lt: cursorBoundary } } : where,
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();

  return {
    items: page.map((row) => ({
      ...toMessage(row, options.currentUserId),
      serverId: target.serverId,
    })),
    hasMore,
  };
}

async function resolveCursor(messageId: string | undefined): Promise<Date | undefined> {
  if (!messageId) return undefined;
  const row = await prisma.message.findUnique({
    where: { id: messageId },
    select: { createdAt: true },
  });
  return row?.createdAt;
}

export async function searchMessages(
  target: { channelId?: string; conversationId?: string; serverId: string | null },
  query: string,
  currentUserId: string,
  limit = 25,
): Promise<Message[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const rows = await prisma.message.findMany({
    where: {
      ...(target.channelId ? { channelId: target.channelId } : { conversationId: target.conversationId }),
      deletedAt: null,
      content: { contains: term, mode: 'insensitive' },
    },
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  return rows.map((row) => ({ ...toMessage(row, currentUserId), serverId: target.serverId }));
}

async function resolveTargetForExisting(
  existing: { channelId: string | null; conversationId: string | null },
  userId: string,
): Promise<Target> {
  return resolveTarget({
    authorId: userId,
    channelId: existing.channelId ?? undefined,
    conversationId: existing.conversationId ?? undefined,
    content: 'x',
  });
}

function broadcast(target: Target, event: 'message:updated', payload: Message): void {
  if (target.kind === 'channel') emitToChannel(target.id, event, payload);
  else emitToConversation(target.id, event, payload);
}
