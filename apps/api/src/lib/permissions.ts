import { Permission, can, resolvePermissions } from '@tetherchat/shared';
import type { PermissionBit } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';

export interface MemberContext {
  serverId: string;
  userId: string;
  memberId: string;
  isOwner: boolean;
  roleIds: string[];
  roleMasks: number[];
  permissions: number;
}

/** Loads membership plus effective server-level permissions, or throws 404/403. */
export async function loadMemberContext(
  serverId: string,
  userId: string,
): Promise<MemberContext> {
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: {
      server: { select: { ownerId: true } },
      roles: { include: { role: { select: { id: true, permissions: true } } } },
    },
  });

  if (!member) throw ApiError.forbidden('You are not a member of this server');

  const isOwner = member.server.ownerId === userId;
  const roleMasks = member.roles.map((entry) => entry.role.permissions);

  return {
    serverId,
    userId,
    memberId: member.id,
    isOwner,
    roleIds: member.roles.map((entry) => entry.role.id),
    roleMasks,
    permissions: resolvePermissions({ isOwner, roleMasks }),
  };
}

/** Same as loadMemberContext but folds in per-channel role overwrites. */
export async function loadChannelContext(
  channelId: string,
  userId: string,
): Promise<MemberContext & { channelId: string; serverName: string }> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      server: { select: { id: true, name: true, ownerId: true } },
      overwrites: true,
    },
  });

  if (!channel) throw ApiError.notFound('Channel not found');

  const base = await loadMemberContext(channel.serverId, userId);

  let allow = 0;
  let deny = 0;
  for (const overwrite of channel.overwrites) {
    if (!base.roleIds.includes(overwrite.roleId)) continue;
    allow |= overwrite.allow;
    deny |= overwrite.deny;
  }

  const permissions = resolvePermissions({
    isOwner: base.isOwner,
    roleMasks: base.roleMasks,
    channelAllow: allow,
    channelDeny: deny,
  });

  if (!can(permissions, Permission.VIEW_CHANNEL)) {
    throw ApiError.forbidden('You cannot view this channel');
  }

  return { ...base, permissions, channelId, serverName: channel.server.name };
}

export function assertPermission(context: { permissions: number }, permission: PermissionBit): void {
  if (!can(context.permissions, permission)) {
    throw ApiError.forbidden('Missing permissions for this action');
  }
}

/**
 * Role hierarchy check: a member may only act on targets whose highest role
 * sits strictly below their own. Owners outrank everybody.
 */
export async function assertOutranks(
  actor: MemberContext,
  targetUserId: string,
): Promise<void> {
  if (actor.userId === targetUserId) {
    throw ApiError.badRequest('You cannot perform this action on yourself');
  }
  if (actor.isOwner) return;

  const server = await prisma.server.findUnique({
    where: { id: actor.serverId },
    select: { ownerId: true },
  });
  if (server?.ownerId === targetUserId) {
    throw ApiError.forbidden('You cannot act on the server owner');
  }

  const [actorTop, targetTop] = await Promise.all([
    highestRolePosition(actor.serverId, actor.userId),
    highestRolePosition(actor.serverId, targetUserId),
  ]);

  if (actorTop <= targetTop) {
    throw ApiError.forbidden('Target has an equal or higher role than you');
  }
}

export async function highestRolePosition(serverId: string, userId: string): Promise<number> {
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roles: { include: { role: { select: { position: true } } } } },
  });
  if (!member) return -1;
  return member.roles.reduce((max, entry) => Math.max(max, entry.role.position), 0);
}

export async function assertConversationMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  const membership = await prisma.directConversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.leftAt) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
}
