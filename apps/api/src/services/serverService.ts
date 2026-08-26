import { customAlphabet } from 'nanoid';
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_NAME,
  MODERATOR_PERMISSIONS,
  Permission,
  resolvePermissions,
} from '@tetherchat/shared';
import type { ServerDetail, ServerSummary } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { toCategory, toChannel, toRole, memberInclude, toMember } from '../lib/serialize.js';
import { emitToServer, joinUserToRoom, removeUserFromRoom } from '../ws/realtime.js';
import { socketRooms } from '@tetherchat/shared';

const inviteCode = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 8);

export async function createServer(input: {
  ownerId: string;
  name: string;
  iconUrl?: string | null;
}): Promise<ServerDetail> {
  const server = await prisma.$transaction(async (tx) => {
    const created = await tx.server.create({
      data: { name: input.name, ownerId: input.ownerId, iconUrl: input.iconUrl ?? null },
    });

    const everyone = await tx.role.create({
      data: {
        serverId: created.id,
        name: DEFAULT_ROLE_NAME,
        permissions: DEFAULT_PERMISSIONS,
        position: 0,
        isDefault: true,
      },
    });

    const moderator = await tx.role.create({
      data: {
        serverId: created.id,
        name: 'Moderator',
        color: '#3498db',
        permissions: MODERATOR_PERMISSIONS,
        position: 1,
        hoist: true,
      },
    });

    const member = await tx.serverMember.create({
      data: { serverId: created.id, userId: input.ownerId },
    });
    await tx.serverMemberRole.createMany({
      data: [
        { memberId: member.id, roleId: everyone.id },
        { memberId: member.id, roleId: moderator.id },
      ],
    });

    const textChannels = await tx.category.create({
      data: { serverId: created.id, name: 'Text Channels', position: 0 },
    });

    await tx.channel.createMany({
      data: [
        {
          serverId: created.id,
          categoryId: textChannels.id,
          name: 'general',
          topic: 'A place for friends to talk',
          position: 0,
        },
        { serverId: created.id, categoryId: textChannels.id, name: 'off-topic', position: 1 },
      ],
    });

    return created;
  });

  return getServerDetail(server.id, input.ownerId);
}

export async function getServerDetail(serverId: string, userId: string): Promise<ServerDetail> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      categories: { orderBy: { position: 'asc' } },
      channels: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      roles: { orderBy: { position: 'asc' } },
      _count: { select: { members: true } },
    },
  });
  if (!server) throw ApiError.notFound('Server not found');

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roles: { include: { role: { select: { permissions: true } } } } },
  });
  if (!member) throw ApiError.forbidden('You are not a member of this server');

  const permissions = resolvePermissions({
    isOwner: server.ownerId === userId,
    roleMasks: member.roles.map((entry) => entry.role.permissions),
  });

  return {
    id: server.id,
    name: server.name,
    iconUrl: server.iconUrl,
    description: server.description,
    ownerId: server.ownerId,
    memberCount: server._count.members,
    categories: server.categories.map(toCategory),
    channels: server.channels.map(toChannel),
    roles: server.roles.map(toRole),
    permissions,
  };
}

export async function listUserServers(userId: string): Promise<ServerSummary[]> {
  const memberships = await prisma.serverMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: { server: { include: { _count: { select: { members: true } } } } },
  });

  return memberships.map(({ server }) => ({
    id: server.id,
    name: server.name,
    iconUrl: server.iconUrl,
    description: server.description,
    ownerId: server.ownerId,
    memberCount: server._count.members,
  }));
}

export async function createInvite(input: {
  serverId: string;
  inviterId: string;
  maxUses?: number | null;
  expiresInHours?: number | null;
}) {
  return prisma.invite.create({
    data: {
      code: inviteCode(),
      serverId: input.serverId,
      inviterId: input.inviterId,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 3_600_000)
        : null,
    },
  });
}

export async function joinByInvite(code: string, userId: string): Promise<{ serverId: string }> {
  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { server: { select: { id: true } } },
  });
  if (!invite) throw ApiError.notFound('This invite is invalid or has expired');
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw ApiError.notFound('This invite has expired');
  }
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    throw ApiError.notFound('This invite has reached its usage limit');
  }

  const banned = await prisma.ban.findUnique({
    where: { serverId_userId: { serverId: invite.serverId, userId } },
  });
  if (banned) throw ApiError.forbidden('You are banned from this server');

  const existing = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: invite.serverId, userId } },
  });
  if (existing) return { serverId: invite.serverId };

  const everyone = await prisma.role.findFirst({
    where: { serverId: invite.serverId, isDefault: true },
  });

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.serverMember.create({
      data: { serverId: invite.serverId, userId },
      include: memberInclude,
    });
    if (everyone) {
      await tx.serverMemberRole.create({ data: { memberId: created.id, roleId: everyone.id } });
    }
    await tx.invite.update({ where: { code }, data: { uses: { increment: 1 } } });
    return created;
  });

  const withRoles = await prisma.serverMember.findUniqueOrThrow({
    where: { id: member.id },
    include: memberInclude,
  });

  await joinUserToRoom(userId, socketRooms.server(invite.serverId));
  const channels = await prisma.channel.findMany({
    where: { serverId: invite.serverId },
    select: { id: true },
  });
  await Promise.all(
    channels.map((channel) => joinUserToRoom(userId, socketRooms.channel(channel.id))),
  );

  emitToServer(invite.serverId, 'member:join', {
    serverId: invite.serverId,
    member: toMember(withRoles),
  });

  return { serverId: invite.serverId };
}

export async function leaveServer(serverId: string, userId: string): Promise<void> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true },
  });
  if (!server) throw ApiError.notFound('Server not found');
  if (server.ownerId === userId) {
    throw ApiError.badRequest('Transfer ownership or delete the server before leaving');
  }

  await prisma.serverMember.deleteMany({ where: { serverId, userId } });
  await removeUserFromServerRooms(serverId, userId);
  emitToServer(serverId, 'member:leave', { serverId, userId });
}

export async function kickMember(serverId: string, userId: string): Promise<void> {
  await prisma.serverMember.deleteMany({ where: { serverId, userId } });
  await removeUserFromServerRooms(serverId, userId);
  emitToServer(serverId, 'member:leave', { serverId, userId });
}

export async function banMember(input: {
  serverId: string;
  userId: string;
  moderatorId: string;
  reason?: string | null;
}): Promise<void> {
  await prisma.$transaction([
    prisma.ban.upsert({
      where: { serverId_userId: { serverId: input.serverId, userId: input.userId } },
      create: {
        serverId: input.serverId,
        userId: input.userId,
        moderatorId: input.moderatorId,
        reason: input.reason ?? null,
      },
      update: { reason: input.reason ?? null, moderatorId: input.moderatorId },
    }),
    prisma.serverMember.deleteMany({ where: { serverId: input.serverId, userId: input.userId } }),
  ]);

  await removeUserFromServerRooms(input.serverId, input.userId);
  emitToServer(input.serverId, 'member:leave', { serverId: input.serverId, userId: input.userId });
}

/** Drop the user from the server room and every channel room so kicked/banned sockets stop receiving traffic. */
async function removeUserFromServerRooms(serverId: string, userId: string): Promise<void> {
  const channels = await prisma.channel.findMany({ where: { serverId }, select: { id: true } });
  await removeUserFromRoom(userId, socketRooms.server(serverId));
  await Promise.all(
    channels.map((channel) => removeUserFromRoom(userId, socketRooms.channel(channel.id))),
  );
}

export async function nextChannelPosition(serverId: string, categoryId: string | null): Promise<number> {
  const last = await prisma.channel.findFirst({
    where: { serverId, categoryId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

/** The default @everyone role is the permission floor for a server. */
export async function defaultRole(serverId: string) {
  const role = await prisma.role.findFirst({ where: { serverId, isDefault: true } });
  if (!role) throw ApiError.internal('Server is missing its default role');
  return role;
}

export const OWNER_ONLY_PERMISSIONS = [Permission.ADMINISTRATOR] as const;
