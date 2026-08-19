import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, PRESENCE_STATUSES, USERNAME_PATTERN } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { normalizeAvatar } from '../lib/images.js';
import { publicUserSelect, toPublicUser, toSelfUser } from '../lib/serialize.js';
import { storage } from '../lib/storage.js';
import { dropFriendship } from '../lib/friends.js';
import { isReservedUsername } from '../lib/aiBot.js';
import { listReadStates } from '../services/readStateService.js';
import { broadcastPresence } from '../ws/presence.js';
import { readMultipartFile } from '../lib/multipart.js';

const selfSelect = {
  ...publicUserSelect,
  email: true,
  emailVerified: true,
  enterToSend: true,
  totpEnabled: true,
  isPlatformAdmin: true,
} as const;

const patchSchema = z.object({
  username: z
    .string()
    .min(LIMITS.username.min)
    .max(LIMITS.username.max)
    .regex(USERNAME_PATTERN)
    .optional(),
  displayName: z.string().max(LIMITS.displayName.max).nullable().optional(),
  bio: z.string().max(LIMITS.bio.max).nullable().optional(),
  customStatus: z.string().max(LIMITS.customStatus.max).nullable().optional(),
  status: z.enum(PRESENCE_STATUSES).optional(),
  enterToSend: z.boolean().optional(),
  bannerColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/@me', async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: selfSelect,
    });
    return toSelfUser(user);
  });

  app.patch('/@me', async (request) => {
    const body = patchSchema.parse(request.body);

    if (body.username) {
      const username = body.username.toLowerCase();
      if (isReservedUsername(username)) throw ApiError.conflict('That username is taken');
      const taken = await prisma.user.findFirst({
        where: { username, NOT: { id: request.userId } },
        select: { id: true },
      });
      if (taken) throw ApiError.conflict('That username is taken');
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: {
        ...(body.username ? { username: body.username.toLowerCase() } : {}),
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.customStatus !== undefined ? { customStatus: body.customStatus } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.enterToSend !== undefined ? { enterToSend: body.enterToSend } : {}),
        ...(body.bannerColor !== undefined ? { bannerColor: body.bannerColor } : {}),
      },
      select: selfSelect,
    });

    if (body.status) await broadcastPresence(request.userId, body.status);

    return toSelfUser(user);
  });

  app.post('/@me/avatar', async (request) => {
    const file = await readMultipartFile(request, {
      maxBytes: LIMITS.avatarBytes,
      allowedMime: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    });

    const normalized = await normalizeAvatar(file.buffer);
    const stored = await storage().put({
      body: normalized.body,
      contentType: normalized.contentType,
      filename: 'avatar.webp',
      prefix: `avatars/${request.userId}`,
    });

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { avatarUrl: stored.url },
      select: selfSelect,
    });

    return toSelfUser(user);
  });

  app.delete('/@me/avatar', async (request, reply) => {
    await prisma.user.update({ where: { id: request.userId }, data: { avatarUrl: null } });
    reply.status(204).send();
  });

  app.get('/@me/read-states', async (request) => listReadStates(request.userId));

  app.get('/@me/blocks', async (request) => {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: request.userId },
      include: { blocked: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toPublicUser(row.blocked));
  });

  app.put('/@me/blocks/:userId', async (request) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    if (userId === request.userId) throw ApiError.badRequest('You cannot block yourself');

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!target) throw ApiError.notFound('User not found');

    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: request.userId, blockedId: userId } },
      create: { blockerId: request.userId, blockedId: userId },
      update: {},
    });
    await dropFriendship(request.userId, userId);

    return toPublicUser(target);
  });

  app.delete('/@me/blocks/:userId', async (request, reply) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    await prisma.userBlock.deleteMany({
      where: { blockerId: request.userId, blockedId: userId },
    });
    reply.status(204).send();
  });

  app.get('/:userId', async (request) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  });

  /** Username search used by the "new direct message" picker. */
  app.get('/', async (request) => {
    const { q, limit } = z
      .object({ q: z.string().min(2).max(32), limit: z.coerce.number().int().min(1).max(25).default(10) })
      .parse(request.query);

    const users = await prisma.user.findMany({
      where: {
        isBot: false,
        OR: [
          { username: { contains: q.toLowerCase(), mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { id: request.userId },
      },
      select: publicUserSelect,
      take: limit,
    });

    return users.map(toPublicUser);
  });
}
