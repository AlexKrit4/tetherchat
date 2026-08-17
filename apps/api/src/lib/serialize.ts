import type { Prisma } from '@prisma/client';
import type {
  Attachment,
  Ban,
  Category,
  Channel,
  DirectConversation,
  Invite,
  LinkPreview,
  Message,
  PresenceStatus,
  PublicUser,
  Reaction,
  Role,
  SelfUser,
  ServerMember,
} from '@tetherchat/shared';

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bannerColor: true,
  bio: true,
  customStatus: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** Invisible users are indistinguishable from offline ones for everybody else. */
function visibleStatus(status: PublicUserRow['status']): PresenceStatus {
  return status === 'invisible' ? 'offline' : status;
}

export function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bannerColor: row.bannerColor,
    bio: row.bio,
    customStatus: row.customStatus,
    status: visibleStatus(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSelfUser(
  row: PublicUserRow & { email: string; emailVerified: boolean; enterToSend: boolean },
): SelfUser {
  return {
    ...toPublicUser(row),
    status: row.status,
    email: row.email,
    emailVerified: row.emailVerified,
    enterToSend: row.enterToSend,
  };
}

export const messageInclude = {
  author: { select: publicUserSelect },
  attachments: true,
  reactions: true,
  previews: true,
  replyTo: { include: { author: { select: publicUserSelect } } },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export function toAttachment(row: MessageRow['attachments'][number]): Attachment {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    width: row.width,
    height: row.height,
  };
}

export function toLinkPreview(row: MessageRow['previews'][number]): LinkPreview {
  return {
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    siteName: row.siteName,
  };
}

export function toReactions(
  rows: { emoji: string; userId: string }[],
  currentUserId: string | null,
): Reaction[] {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.emoji) ?? [];
    list.push(row.userId);
    grouped.set(row.emoji, list);
  }
  return Array.from(grouped.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds,
    me: currentUserId ? userIds.includes(currentUserId) : false,
  }));
}

export function toMessage(row: MessageRow, currentUserId: string | null): Message {
  return {
    id: row.id,
    channelId: row.channelId ?? row.conversationId ?? '',
    serverId: null,
    authorId: row.authorId,
    author: toPublicUser(row.author),
    content: row.deletedAt ? '' : row.content,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    pinned: row.pinned,
    system: row.system,
    replyTo: row.replyTo
      ? {
          id: row.replyTo.id,
          authorId: row.replyTo.authorId,
          author: row.replyTo.author ? toPublicUser(row.replyTo.author) : null,
          content: row.replyTo.deletedAt ? '' : row.replyTo.content,
          deleted: Boolean(row.replyTo.deletedAt),
        }
      : null,
    attachments: row.attachments.map(toAttachment),
    reactions: toReactions(row.reactions, currentUserId),
    previews: row.previews.map(toLinkPreview),
    mentionedUserIds: row.mentionedUserIds,
    mentionsEveryone: row.mentionsEveryone,
  };
}

/** Guild messages carry the owning server id so the client can route mentions. */
export function withServerId(message: Message, serverId: string | null): Message {
  return { ...message, serverId };
}

export function toRole(row: {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  isDefault: boolean;
  hoist: boolean;
}): Role {
  return {
    id: row.id,
    serverId: row.serverId,
    name: row.name,
    color: row.color,
    permissions: row.permissions,
    position: row.position,
    isDefault: row.isDefault,
    hoist: row.hoist,
  };
}

export function toChannel(row: {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  topic: string | null;
  position: number;
  createdAt: Date;
}): Channel {
  return {
    id: row.id,
    serverId: row.serverId,
    categoryId: row.categoryId,
    name: row.name,
    topic: row.topic,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCategory(row: {
  id: string;
  serverId: string;
  name: string;
  position: number;
}): Category {
  return { id: row.id, serverId: row.serverId, name: row.name, position: row.position };
}

export const memberInclude = {
  user: { select: publicUserSelect },
  roles: { select: { roleId: true } },
} satisfies Prisma.ServerMemberInclude;

export type MemberRow = Prisma.ServerMemberGetPayload<{ include: typeof memberInclude }>;

export function toMember(row: MemberRow): ServerMember {
  return {
    userId: row.userId,
    serverId: row.serverId,
    nickname: row.nickname,
    joinedAt: row.joinedAt.toISOString(),
    roleIds: row.roles.map((entry) => entry.roleId),
    user: toPublicUser(row.user),
  };
}

export const conversationInclude = {
  members: { include: { user: { select: publicUserSelect } } },
} satisfies Prisma.DirectConversationInclude;

export type ConversationRow = Prisma.DirectConversationGetPayload<{
  include: typeof conversationInclude;
}>;

export function toConversation(row: ConversationRow): DirectConversation {
  return {
    id: row.id,
    isGroup: row.isGroup,
    name: row.name,
    iconUrl: row.iconUrl,
    ownerId: row.ownerId,
    members: row.members.filter((member) => !member.leftAt).map((member) => toPublicUser(member.user)),
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
  };
}

export function toInvite(row: {
  code: string;
  serverId: string;
  inviterId: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  createdAt: Date;
}): Invite {
  return {
    code: row.code,
    serverId: row.serverId,
    inviterId: row.inviterId,
    uses: row.uses,
    maxUses: row.maxUses,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const banInclude = {
  user: { select: publicUserSelect },
  moderator: { select: publicUserSelect },
} satisfies Prisma.BanInclude;

export type BanRow = Prisma.BanGetPayload<{ include: typeof banInclude }>;

export function toBan(row: BanRow): Ban {
  return {
    userId: row.userId,
    serverId: row.serverId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    user: toPublicUser(row.user),
    moderator: row.moderator ? toPublicUser(row.moderator) : null,
  };
}
