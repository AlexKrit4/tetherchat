import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, NOTIFICATION_LEVELS, Permission } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { assertPermission, loadChannelContext } from '../lib/permissions.js';
import { messageInclude, toChannel, toMessage } from '../lib/serialize.js';
import { listChatMedia } from '../services/mediaService.js';
import {
  createMessage,
  listMessages,
  searchMessages,
  setPinned,
} from '../services/messageService.js';
import { ackChannel } from '../services/readStateService.js';
import { emitToServer } from '../ws/realtime.js';
import { assertPlus } from '../lib/plus.js';
import { readWallpaperUpload } from '../lib/wallpaper.js';

const channelParam = z.object({ channelId: z.string().min(1) });

export async function channelRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/:channelId', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    await loadChannelContext(channelId, request.userId);
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
    return toChannel(channel);
  });

  app.patch('/:channelId', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const body = z
      .object({
        name: z.string().min(LIMITS.channelName.min).max(LIMITS.channelName.max).optional(),
        topic: z.string().max(LIMITS.channelTopic.max).nullable().optional(),
        categoryId: z.string().nullable().optional(),
        position: z.number().int().min(0).optional(),
      })
      .parse(request.body);

    const context = await loadChannelContext(channelId, request.userId);
    assertPermission(context, Permission.MANAGE_CHANNELS);

    const channel = await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(body.name ? { name: body.name.trim().toLowerCase().replace(/\s+/g, '-') } : {}),
        ...(body.topic !== undefined ? { topic: body.topic } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      },
    });

    const payload = toChannel(channel);
    emitToServer(channel.serverId, 'channel:update', payload);
    return payload;
  });

  app.delete('/:channelId', async (request, reply) => {
    const { channelId } = channelParam.parse(request.params);
    const context = await loadChannelContext(channelId, request.userId);
    assertPermission(context, Permission.MANAGE_CHANNELS);

    const remaining = await prisma.channel.count({ where: { serverId: context.serverId } });
    if (remaining <= 1) throw ApiError.badRequest('A server needs at least one channel');

    await prisma.channel.delete({ where: { id: channelId } });
    emitToServer(context.serverId, 'channel:delete', { channelId, serverId: context.serverId });
    reply.status(204).send();
  });

  // --- messages -------------------------------------------------------------

  app.get('/:channelId/messages', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const query = z
      .object({
        before: z.string().optional(),
        after: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(LIMITS.messagePageSize),
        thread: z.string().min(1).optional(),
      })
      .parse(request.query);

    const context = await loadChannelContext(channelId, request.userId);

    return listMessages(
      { channelId, serverId: context.serverId },
      { ...query, threadRootId: query.thread ?? null, currentUserId: request.userId },
    );
  });

  app.post('/:channelId/messages', async (request, reply) => {
    const { channelId } = channelParam.parse(request.params);
    const body = z
      .object({
        content: z.string().max(LIMITS.messageContent.max).default(''),
        replyToId: z.string().nullable().optional(),
        attachmentIds: z.array(z.string()).max(LIMITS.attachmentsPerMessage).optional(),
        attachmentDurations: z.record(z.string(), z.number().int().min(1).max(15 * 60_000)).optional(),
        attachmentSpoilers: z.record(z.string(), z.boolean()).optional(),
        forwardMessageId: z.string().min(1).optional(),
        threadRootId: z.string().min(1).nullable().optional(),
        nonce: z.string().max(64).optional(),
      })
      .parse(request.body);

    const message = await createMessage({
      authorId: request.userId,
      channelId,
      content: body.content,
      replyToId: body.replyToId ?? null,
      attachmentIds: body.attachmentIds,
      attachmentDurations: body.attachmentDurations,
      attachmentSpoilers: body.attachmentSpoilers,
      forwardMessageId: body.forwardMessageId,
      threadRootId: body.threadRootId ?? null,
      nonce: body.nonce,
    });

    reply.status(201).send(message);
  });

  app.get('/:channelId/messages/search', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const { q } = z.object({ q: z.string().min(2).max(200) }).parse(request.query);

    const context = await loadChannelContext(channelId, request.userId);
    return searchMessages({ channelId, serverId: context.serverId }, q, request.userId);
  });

  app.get('/:channelId/media', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const query = z
      .object({
        before: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(request.query);
    await loadChannelContext(channelId, request.userId);
    return listChatMedia({ channelId, before: query.before, limit: query.limit });
  });

  app.get('/:channelId/pins', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const context = await loadChannelContext(channelId, request.userId);

    const pins = await prisma.pin.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      include: { message: { include: messageInclude } },
    });

    return pins
      .filter((pin) => !pin.message.deletedAt)
      .map((pin) => ({ ...toMessage(pin.message, request.userId), serverId: context.serverId }));
  });

  app.put('/:channelId/pins/:messageId', async (request, reply) => {
    const { messageId } = z
      .object({ channelId: z.string().min(1), messageId: z.string().min(1) })
      .parse(request.params);
    await setPinned(messageId, request.userId, true);
    reply.status(204).send();
  });

  app.delete('/:channelId/pins/:messageId', async (request, reply) => {
    const { messageId } = z
      .object({ channelId: z.string().min(1), messageId: z.string().min(1) })
      .parse(request.params);
    await setPinned(messageId, request.userId, false);
    reply.status(204).send();
  });

  // --- read state & notification prefs ---------------------------------------

  app.post('/:channelId/ack', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const { messageId } = z.object({ messageId: z.string().min(1) }).parse(request.body);
    await loadChannelContext(channelId, request.userId);
    return ackChannel(request.userId, channelId, messageId);
  });

  app.put('/:channelId/notifications', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    const body = z
      .object({
        level: z.enum(NOTIFICATION_LEVELS).optional(),
        muted: z.boolean().optional(),
      })
      .parse(request.body);

    await loadChannelContext(channelId, request.userId);

    const setting = await prisma.channelNotificationSetting.upsert({
      where: { userId_channelId: { userId: request.userId, channelId } },
      create: {
        userId: request.userId,
        channelId,
        level: body.level ?? 'all',
        muted: body.muted ?? false,
      },
      update: {
        ...(body.level ? { level: body.level } : {}),
        ...(body.muted !== undefined ? { muted: body.muted } : {}),
      },
    });

    return { channelId, level: setting.level, muted: setting.muted, wallpaperUrl: setting.wallpaperUrl };
  });

  app.get('/:channelId/notifications', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    await loadChannelContext(channelId, request.userId);
    const setting = await prisma.channelNotificationSetting.findUnique({
      where: { userId_channelId: { userId: request.userId, channelId } },
    });
    return {
      channelId,
      level: setting?.level ?? 'all',
      muted: setting?.muted ?? false,
      wallpaperUrl: setting?.wallpaperUrl ?? null,
    };
  });

  app.post('/:channelId/wallpaper', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    await loadChannelContext(channelId, request.userId);
    await assertPlus(request.userId);
    const url = await readWallpaperUpload(request, request.userId);
    const setting = await prisma.channelNotificationSetting.upsert({
      where: { userId_channelId: { userId: request.userId, channelId } },
      create: { userId: request.userId, channelId, wallpaperUrl: url },
      update: { wallpaperUrl: url },
    });
    return {
      channelId,
      level: setting.level,
      muted: setting.muted,
      wallpaperUrl: setting.wallpaperUrl,
    };
  });

  app.delete('/:channelId/wallpaper', async (request) => {
    const { channelId } = channelParam.parse(request.params);
    await loadChannelContext(channelId, request.userId);
    const setting = await prisma.channelNotificationSetting.upsert({
      where: { userId_channelId: { userId: request.userId, channelId } },
      create: { userId: request.userId, channelId, wallpaperUrl: null },
      update: { wallpaperUrl: null },
    });
    return {
      channelId,
      level: setting.level,
      muted: setting.muted,
      wallpaperUrl: setting.wallpaperUrl,
    };
  });
}
