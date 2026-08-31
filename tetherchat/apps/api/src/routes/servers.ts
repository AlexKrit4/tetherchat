import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, Permission, ROLE_COLORS, can } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { normalizeIcon } from '../lib/images.js';
import { readMultipartFile } from '../lib/multipart.js';
import {
  assertOutranks,
  assertPermission,
  loadMemberContext,
} from '../lib/permissions.js';
import {
  banInclude,
  memberInclude,
  toBan,
  toChannel,
  toCategory,
  toInvite,
  toMember,
  toRole,
} from '../lib/serialize.js';
import { storage } from '../lib/storage.js';
import {
  banMember,
  createInvite,
  createServer,
  getServerDetail,
  kickMember,
  leaveServer,
  listUserServers,
  nextChannelPosition,
} from '../services/serverService.js';
import { emitToServer } from '../ws/realtime.js';

const idParam = z.object({ serverId: z.string().min(1) });

export async function serverRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (request) => listUserServers(request.userId));

  app.post('/', async (request, reply) => {
    const body = z
      .object({ name: z.string().min(LIMITS.serverName.min).max(LIMITS.serverName.max) })
      .parse(request.body);

    const server = await createServer({ ownerId: request.userId, name: body.name.trim() });
    reply.status(201).send(server);
  });

  app.get('/:serverId', async (request) => {
    const { serverId } = idParam.parse(request.params);
    return getServerDetail(serverId, request.userId);
  });

  app.patch('/:serverId', async (request) => {
    const { serverId } = idParam.parse(request.params);
    const body = z
      .object({
        name: z.string().min(LIMITS.serverName.min).max(LIMITS.serverName.max).optional(),
        description: z.string().max(LIMITS.serverDescription.max).nullable().optional(),
      })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_SERVER);

    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
      include: { _count: { select: { members: true } } },
    });

    const summary = {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      description: server.description,
      ownerId: server.ownerId,
      memberCount: server._count.members,
    };
    emitToServer(serverId, 'server:update', summary);
    return summary;
  });

  app.post('/:serverId/icon', async (request) => {
    const { serverId } = idParam.parse(request.params);
    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_SERVER);

    const file = await readMultipartFile(request, {
      maxBytes: LIMITS.avatarBytes,
      allowedMime: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    });
    const normalized = await normalizeIcon(file.buffer);
    const stored = await storage().put({
      body: normalized.body,
      contentType: normalized.contentType,
      filename: 'icon.webp',
      prefix: `icons/${serverId}`,
    });

    const server = await prisma.server.update({
      where: { id: serverId },
      data: { iconUrl: stored.url },
      include: { _count: { select: { members: true } } },
    });

    const summary = {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      description: server.description,
      ownerId: server.ownerId,
      memberCount: server._count.members,
    };
    emitToServer(serverId, 'server:update', summary);
    return summary;
  });

  app.delete('/:serverId', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { ownerId: true },
    });
    if (!server) throw ApiError.notFound('Server not found');
    if (server.ownerId !== request.userId) {
      throw ApiError.forbidden('Only the owner can delete a server');
    }

    emitToServer(serverId, 'server:delete', { serverId });
    await prisma.server.delete({ where: { id: serverId } });
    reply.status(204).send();
  });

  app.post('/:serverId/leave', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    await leaveServer(serverId, request.userId);
    reply.status(204).send();
  });

  // --- channels & categories -------------------------------------------------

  app.get('/:serverId/channels', async (request) => {
    const { serverId } = idParam.parse(request.params);
    await loadMemberContext(serverId, request.userId);
    const channels = await prisma.channel.findMany({
      where: { serverId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return channels.map(toChannel);
  });

  app.post('/:serverId/channels', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    const body = z
      .object({
        name: z.string().min(LIMITS.channelName.min).max(LIMITS.channelName.max),
        categoryId: z.string().nullable().optional(),
        topic: z.string().max(LIMITS.channelTopic.max).nullable().optional(),
      })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_CHANNELS);

    if (body.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, serverId },
        select: { id: true },
      });
      if (!category) throw ApiError.badRequest('Category does not belong to this server');
    }

    const channel = await prisma.channel.create({
      data: {
        serverId,
        categoryId: body.categoryId ?? null,
        name: normalizeChannelName(body.name),
        topic: body.topic ?? null,
        position: await nextChannelPosition(serverId, body.categoryId ?? null),
      },
    });

    const payload = toChannel(channel);
    emitToServer(serverId, 'channel:create', payload);
    reply.status(201).send(payload);
  });

  app.post('/:serverId/categories', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    const body = z
      .object({ name: z.string().min(LIMITS.categoryName.min).max(LIMITS.categoryName.max) })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_CHANNELS);

    const last = await prisma.category.findFirst({
      where: { serverId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const category = await prisma.category.create({
      data: { serverId, name: body.name.trim(), position: (last?.position ?? -1) + 1 },
    });

    const payload = toCategory(category);
    emitToServer(serverId, 'category:create', payload);
    reply.status(201).send(payload);
  });

  // --- members --------------------------------------------------------------

  app.get('/:serverId/members', async (request) => {
    const { serverId } = idParam.parse(request.params);
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(1000).default(200) })
      .parse(request.query);

    await loadMemberContext(serverId, request.userId);

    const members = await prisma.serverMember.findMany({
      where: { serverId },
      include: memberInclude,
      orderBy: { joinedAt: 'asc' },
      take: limit,
    });

    return members.map(toMember);
  });

  app.patch('/:serverId/members/:userId', async (request) => {
    const { serverId, userId } = z
      .object({ serverId: z.string().min(1), userId: z.string().min(1) })
      .parse(request.params);
    const body = z
      .object({
        nickname: z.string().max(LIMITS.displayName.max).nullable().optional(),
        roleIds: z.array(z.string()).max(50).optional(),
      })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);

    const member = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      select: { id: true },
    });
    if (!member) throw ApiError.notFound('Member not found');

    if (body.nickname !== undefined) {
      const selfEdit = userId === request.userId;
      if (!selfEdit) assertPermission(context, Permission.MANAGE_SERVER);
      await prisma.serverMember.update({
        where: { id: member.id },
        data: { nickname: body.nickname },
      });
    }

    if (body.roleIds) {
      assertPermission(context, Permission.MANAGE_ROLES);
      await assertOutranks(context, userId);

      const roles = await prisma.role.findMany({
        where: { id: { in: body.roleIds }, serverId },
        select: { id: true, isDefault: true, position: true },
      });
      if (roles.length !== body.roleIds.length) {
        throw ApiError.badRequest('One or more roles do not belong to this server');
      }
      if (!context.isOwner) {
        const actorTop = Math.max(0, ...context.roleIds.length ? await rolePositions(context.roleIds) : [0]);
        if (roles.some((role) => role.position >= actorTop)) {
          throw ApiError.forbidden('You cannot assign roles at or above your highest role');
        }
      }

      const defaultRole = await prisma.role.findFirst({ where: { serverId, isDefault: true } });
      const finalIds = new Set(body.roleIds);
      if (defaultRole) finalIds.add(defaultRole.id);

      await prisma.$transaction([
        prisma.serverMemberRole.deleteMany({ where: { memberId: member.id } }),
        prisma.serverMemberRole.createMany({
          data: Array.from(finalIds).map((roleId) => ({ memberId: member.id, roleId })),
        }),
      ]);
    }

    const updated = await prisma.serverMember.findUniqueOrThrow({
      where: { id: member.id },
      include: memberInclude,
    });
    const payload = toMember(updated);
    emitToServer(serverId, 'member:update', { serverId, member: payload });
    return payload;
  });

  app.delete('/:serverId/members/:userId', async (request, reply) => {
    const { serverId, userId } = z
      .object({ serverId: z.string().min(1), userId: z.string().min(1) })
      .parse(request.params);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.KICK_MEMBERS);
    await assertOutranks(context, userId);
    await kickMember(serverId, userId);
    reply.status(204).send();
  });

  // --- bans -----------------------------------------------------------------

  app.get('/:serverId/bans', async (request) => {
    const { serverId } = idParam.parse(request.params);
    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.BAN_MEMBERS);

    const bans = await prisma.ban.findMany({
      where: { serverId },
      include: banInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bans.map(toBan);
  });

  app.put('/:serverId/bans/:userId', async (request, reply) => {
    const { serverId, userId } = z
      .object({ serverId: z.string().min(1), userId: z.string().min(1) })
      .parse(request.params);
    const body = z.object({ reason: z.string().max(512).nullable().optional() }).parse(request.body ?? {});

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.BAN_MEMBERS);
    await assertOutranks(context, userId);

    await banMember({ serverId, userId, moderatorId: request.userId, reason: body.reason ?? null });
    reply.status(204).send();
  });

  app.delete('/:serverId/bans/:userId', async (request, reply) => {
    const { serverId, userId } = z
      .object({ serverId: z.string().min(1), userId: z.string().min(1) })
      .parse(request.params);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.BAN_MEMBERS);
    await prisma.ban.deleteMany({ where: { serverId, userId } });
    reply.status(204).send();
  });

  // --- roles ----------------------------------------------------------------

  app.get('/:serverId/roles', async (request) => {
    const { serverId } = idParam.parse(request.params);
    await loadMemberContext(serverId, request.userId);
    const roles = await prisma.role.findMany({ where: { serverId }, orderBy: { position: 'asc' } });
    return roles.map(toRole);
  });

  app.post('/:serverId/roles', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    const body = z
      .object({
        name: z.string().min(LIMITS.roleName.min).max(LIMITS.roleName.max),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        permissions: z.number().int().min(0).optional(),
        hoist: z.boolean().optional(),
      })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_ROLES);

    const requested = body.permissions ?? 0;
    if (!can(context.permissions, Permission.ADMINISTRATOR) && (requested & ~context.permissions) !== 0) {
      throw ApiError.forbidden('You cannot grant permissions you do not hold');
    }

    const last = await prisma.role.findFirst({
      where: { serverId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const role = await prisma.role.create({
      data: {
        serverId,
        name: body.name.trim(),
        color: body.color ?? ROLE_COLORS[Math.floor(Math.random() * ROLE_COLORS.length)],
        permissions: requested,
        hoist: body.hoist ?? false,
        position: (last?.position ?? 0) + 1,
      },
    });

    await broadcastRoles(serverId);
    reply.status(201).send(toRole(role));
  });

  app.patch('/:serverId/roles/:roleId', async (request) => {
    const { serverId, roleId } = z
      .object({ serverId: z.string().min(1), roleId: z.string().min(1) })
      .parse(request.params);
    const body = z
      .object({
        name: z.string().min(LIMITS.roleName.min).max(LIMITS.roleName.max).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        permissions: z.number().int().min(0).optional(),
        hoist: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
      })
      .parse(request.body);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_ROLES);

    const role = await prisma.role.findFirst({ where: { id: roleId, serverId } });
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isDefault && body.name) {
      throw ApiError.badRequest('The default role cannot be renamed');
    }
    if (
      body.permissions !== undefined &&
      !can(context.permissions, Permission.ADMINISTRATOR) &&
      (body.permissions & ~context.permissions) !== 0
    ) {
      throw ApiError.forbidden('You cannot grant permissions you do not hold');
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
        ...(body.hoist !== undefined ? { hoist: body.hoist } : {}),
        ...(body.position !== undefined && !role.isDefault ? { position: body.position } : {}),
      },
    });

    await broadcastRoles(serverId);
    return toRole(updated);
  });

  app.delete('/:serverId/roles/:roleId', async (request, reply) => {
    const { serverId, roleId } = z
      .object({ serverId: z.string().min(1), roleId: z.string().min(1) })
      .parse(request.params);

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_ROLES);

    const role = await prisma.role.findFirst({ where: { id: roleId, serverId } });
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isDefault) throw ApiError.badRequest('The default role cannot be deleted');

    await prisma.role.delete({ where: { id: roleId } });
    await broadcastRoles(serverId);
    reply.status(204).send();
  });

  // --- invites --------------------------------------------------------------

  app.get('/:serverId/invites', async (request) => {
    const { serverId } = idParam.parse(request.params);
    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.MANAGE_SERVER);
    const invites = await prisma.invite.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(toInvite);
  });

  app.post('/:serverId/invite', async (request, reply) => {
    const { serverId } = idParam.parse(request.params);
    const body = z
      .object({
        maxUses: z.number().int().min(1).max(1000).nullable().optional(),
        expiresInHours: z.number().int().min(1).max(720).nullable().optional(),
      })
      .parse(request.body ?? {});

    const context = await loadMemberContext(serverId, request.userId);
    assertPermission(context, Permission.CREATE_INVITE);

    const invite = await createInvite({
      serverId,
      inviterId: request.userId,
      maxUses: body.maxUses ?? null,
      expiresInHours: body.expiresInHours ?? null,
    });

    reply.status(201).send(toInvite(invite));
  });
}

function normalizeChannelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_а-яё]/gi, '')
    .slice(0, LIMITS.channelName.max) || 'channel';
}

async function rolePositions(roleIds: string[]): Promise<number[]> {
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { position: true },
  });
  return roles.map((role) => role.position);
}

async function broadcastRoles(serverId: string): Promise<void> {
  const roles = await prisma.role.findMany({ where: { serverId }, orderBy: { position: 'asc' } });
  emitToServer(serverId, 'role:update', { serverId, roles: roles.map(toRole) });
}
