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
import { getConfig, isTest } from '../config.js';
import { blockedPeerIds, isBlockedEitherWay } from '../lib/blocks.js';
import { areFriends } from '../lib/friends.js';
import { getAiBotUserId } from '../lib/aiBot.js';
import { isBuiltInBotUserId } from '../lib/bots.js';
import { emitConversationRefresh } from '../lib/conversations.js';

export interface CreateMessageInput {
  authorId: string;
  channelId?: string;
  conversationId?: string;
  content: string;
  replyToId?: string | null;
  attachmentIds?: string[];
  attachmentDurations?: Record<string, number>;
  attachmentSpoilers?: Record<string, boolean>;
  forwardMessageId?: string;
  /**
   * Client-generated id echoed back in the broadcast so the sender can replace
   * its optimistic row instead of rendering the message twice.
   */
  nonce?: string;
  /** Internal: skip the per-user send throttle (bot replies). */
  skipRateLimit?: boolean;
  /** Internal: do not enqueue another AI reply (the bot's own messages). */
  skipAiReply?: boolean;
  skipVpnReply?: boolean;
  skipMonitorReply?: boolean;
}

interface Target {
  kind: 'channel' | 'conversation';
  id: string;
  serverId: string | null;
  serverName: string | null;
  channelName: string;
  recipientIds: string[];
  canMentionEveryone: boolean;
  isAi?: boolean;
  isVpn?: boolean;
  isMonitor?: boolean;
  isSecret?: boolean;
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

    const recipientIds = conversation.members.map((member) => member.userId);
    if (!conversation.isGroup && !conversation.isAi && !conversation.isVpn && !conversation.isMonitor && !conversation.isSaved) {
      const otherId = recipientIds.find((id) => id !== input.authorId);
      if (otherId && (await isBlockedEitherWay(input.authorId, otherId))) {
        throw ApiError.forbidden('You cannot message this user');
      }
      if (otherId && !(await areFriends(input.authorId, otherId)) && !(await isBuiltInBotUserId(otherId))) {
        throw ApiError.forbidden('Сначала добавьте пользователя в друзья');
      }
    }

    return {
      kind: 'conversation',
      id: input.conversationId,
      serverId: null,
      serverName: null,
      channelName: conversation.name ?? 'Direct Message',
      recipientIds,
      canMentionEveryone: false,
      isAi: conversation.isAi,
      isVpn: conversation.isVpn,
      isMonitor: conversation.isMonitor,
      isSecret: conversation.isSecret,
    };
  }

  throw ApiError.badRequest('Either channelId or conversationId is required');
}

function assertContent(content: string, attachmentCount: number, hasForward = false): string {
  const trimmed = content.replace(/\s+$/g, '');
  if (trimmed.length === 0 && attachmentCount === 0 && !hasForward) {
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
  if (!input.skipRateLimit) await assertSendRate(input.authorId);

  const target = await resolveTarget(input);
  if (target.isSecret) {
    throw ApiError.badRequest('Use an encrypted payload in secret chats');
  }
  const forwarded = input.forwardMessageId
    ? await loadForwardSource(input.authorId, input.forwardMessageId)
    : null;
  const attachmentIds = (input.attachmentIds ?? []).slice(0, LIMITS.attachmentsPerMessage);
  const content = assertContent(
    forwarded && !input.content.trim() ? forwarded.content : input.content,
    attachmentIds.length + (forwarded?.attachments.length ?? 0),
    Boolean(forwarded),
  );

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
  const durations = input.attachmentDurations ?? {};

  const created = await prisma.$transaction(async (tx) => {
    let unhiddenMembers = 0;
    const message = await tx.message.create({
      data: {
        channelId: target.kind === 'channel' ? target.id : null,
        conversationId: target.kind === 'conversation' ? target.id : null,
        authorId: input.authorId,
        content,
        replyToId: forwarded ? null : (input.replyToId ?? null),
        forwardedFromId: forwarded?.id ?? null,
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
      for (const [attachmentId, durationMs] of Object.entries(durations)) {
        if (!attachmentIds.includes(attachmentId) || !Number.isFinite(durationMs) || durationMs <= 0) {
          continue;
        }
        await tx.attachment.update({
          where: { id: attachmentId },
          data: { durationMs: Math.round(durationMs) },
        });
      }
      const spoilers = input.attachmentSpoilers ?? {};
      const spoilerIds = attachmentIds.filter((id) => spoilers[id]);
      if (spoilerIds.length > 0) {
        await tx.attachment.updateMany({
          where: { id: { in: spoilerIds } },
          data: { spoiler: true },
        });
      }
    }

    if (forwarded?.attachments.length) {
      await tx.attachment.createMany({
        data: forwarded.attachments.map((attachment) => ({
          uploaderId: input.authorId,
          messageId: message.id,
          storageKey: `${attachment.storageKey}#${message.id}:${attachment.id}`,
          url: attachment.url,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
          durationMs: attachment.durationMs,
        })),
      });
    }

    if (target.kind === 'conversation') {
      await tx.directConversation.update({
        where: { id: target.id },
        data: { lastMessageAt: message.createdAt },
      });
      await tx.directConversationMember.updateMany({
        where: { conversationId: target.id, userId: input.authorId, leftAt: null },
        data: { lastReadMessageId: message.id, lastReadAt: message.createdAt },
      });
      await tx.directConversationMember.updateMany({
        where: { conversationId: target.id, leftAt: null, hiddenAt: { not: null } },
        data: { hiddenAt: null },
      }).then((result) => {
        unhiddenMembers = result.count;
      });
    }

    return { message, unhiddenMembers };
  });

  const { message: createdMessage, unhiddenMembers } = created;

  const full =
    attachmentIds.length || forwarded?.attachments.length
      ? await prisma.message.findUniqueOrThrow({ where: { id: createdMessage.id }, include: messageInclude })
      : createdMessage;

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
    if (unhiddenMembers > 0) {
      void emitConversationRefresh(target.id);
    }
  }

  await notifyRecipients(target, payload, mentionsEveryone, mentionedUserIds);

  const urls = extractUrls(content);
  if (urls.length > 0) {
    await enqueue({ type: 'link-preview', messageId: payload.id, urls });
  }

  if (target.kind === 'conversation' && target.isAi && !input.skipAiReply) {
    const botId = await getAiBotUserId();
    if (input.authorId !== botId) {
      const { replyAsAi } = await import('./aiReplyService.js');
      const pending = replyAsAi(target.id, input.authorId);
      if (isTest()) await pending;
      else void pending;
    }
  }

  if (target.kind === 'conversation' && target.isVpn && !input.skipVpnReply) {
    const { getVpnBotUserId } = await import('../lib/vpnBot.js');
    const botId = await getVpnBotUserId();
    if (input.authorId !== botId) {
      const { replyAsVpn } = await import('./vpnReplyService.js');
      const pending = replyAsVpn(target.id, input.authorId, payload.content);
      if (isTest()) await pending;
      else void pending;
    }
  }

  if (target.kind === 'conversation' && target.isMonitor && !input.skipMonitorReply) {
    const { getMonitorBotUserId } = await import('../lib/monitorBot.js');
    const botId = await getMonitorBotUserId();
    if (input.authorId !== botId) {
      const { replyAsMonitor } = await import('./monitorReplyService.js');
      const pending = replyAsMonitor(target.id, input.authorId, payload.content);
      if (isTest()) await pending;
      else void pending;
    }
  }

  return payload;
}

export async function createEncryptedMessage(input: {
  authorId: string;
  conversationId: string;
  encrypted?: { version: 1; iv: string; ciphertext: string };
  nonce?: string;
  hasUnsupportedPayload?: boolean;
}): Promise<Message> {
  await assertSendRate(input.authorId);
  const target = await resolveTarget({
    authorId: input.authorId,
    conversationId: input.conversationId,
    content: '',
  });
  if (!target.isSecret) throw ApiError.badRequest('Encrypted payloads require a secret chat');
  if (!input.encrypted || input.hasUnsupportedPayload) {
    throw ApiError.badRequest('Secret chats currently support encrypted text messages only');
  }

  const created = await prisma.$transaction(async (tx) => {
    let unhiddenMembers = 0;
    const message = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        authorId: input.authorId,
        content: '',
        encryptionVersion: input.encrypted!.version,
        encryptionIv: input.encrypted!.iv,
        ciphertext: input.encrypted!.ciphertext,
      },
      include: messageInclude,
    });
    await tx.directConversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await tx.directConversationMember.updateMany({
      where: { conversationId: input.conversationId, userId: input.authorId, leftAt: null },
      data: { lastReadMessageId: message.id, lastReadAt: message.createdAt },
    });
    const unhide = await tx.directConversationMember.updateMany({
      where: { conversationId: input.conversationId, leftAt: null, hiddenAt: { not: null } },
      data: { hiddenAt: null },
    });
    unhiddenMembers = unhide.count;
    return { message, unhiddenMembers };
  });

  const { message: createdMessage, unhiddenMembers } = created;

  const payload: Message = {
    ...toMessage(createdMessage, null),
    ...(input.nonce ? { nonce: input.nonce } : {}),
  };
  emitToConversation(input.conversationId, 'message:new', payload);
  if (unhiddenMembers > 0) {
    void emitConversationRefresh(input.conversationId);
  }
  await notifyRecipients(target, payload, false, []);
  return payload;
}

async function loadForwardSource(userId: string, messageId: string) {
  const original = await prisma.message.findUnique({
    where: { id: messageId },
    include: { attachments: true },
  });
  if (!original || original.deletedAt) throw ApiError.notFound('Message not found');
  if (original.encryptionVersion > 0) {
    throw ApiError.badRequest('Секретные сообщения нельзя пересылать');
  }

  if (original.channelId) {
    await loadChannelContext(original.channelId, userId);
  } else if (original.conversationId) {
    await assertConversationMember(original.conversationId, userId);
  } else {
    throw ApiError.notFound('Message not found');
  }

  return original;
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
  const blocked = await blockedPeerIds(message.authorId);
  let others = target.recipientIds.filter(
    (id) => id !== message.authorId && !blocked.has(id),
  );
  if (target.isAi) {
    const botId = await getAiBotUserId();
    others = others.filter((id) => id !== botId);
  }
  if (others.length === 0) return;

  const notifyIds = await filterNotifiableUsers(target.id, others, {
    mentionedUserIds,
    mentionsEveryone,
  });

  if (notifyIds.length === 0) return;

  const authorName = message.author.displayName ?? message.author.username;
  const title =
    target.kind === 'channel' ? `${authorName} в #${target.channelName}` : authorName;
  const url =
    target.kind === 'channel'
      ? `/channels/${target.serverId}/${target.id}`
      : `/channels/@me/${target.id}`;

  await enqueue({
    type: 'push',
    userIds: notifyIds,
    payload: {
      title,
      body: target.isSecret
        ? 'Новое зашифрованное сообщение'
        : (message.content.slice(0, 140) || 'Вложение'),
      icon: message.author.avatarUrl ?? undefined,
      url,
      tag: `channel:${target.id}`,
      channelId: target.id,
      serverId: target.serverId ?? undefined,
      messageId: message.id,
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
    select: {
      authorId: true,
      channelId: true,
      conversationId: true,
      deletedAt: true,
      _count: { select: { attachments: true } },
    },
  });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found');
  if (existing.authorId !== userId) throw ApiError.forbidden('You can only edit your own messages');

  const target = await resolveTargetForExisting(existing, userId);
  if (target.isSecret) throw ApiError.badRequest('Редактирование секретных сообщений пока недоступно');
  const trimmed = assertContent(content, existing._count.attachments);
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
