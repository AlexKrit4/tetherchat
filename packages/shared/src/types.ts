import type { NotificationLevel, PresenceStatus } from './constants.js';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerColor: string | null;
  bio: string | null;
  customStatus: string | null;
  status: PresenceStatus;
  createdAt: string;
}

export interface SelfUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  /** When false, Enter inserts a newline and an explicit send button is used. */
  enterToSend: boolean;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  isDefault: boolean;
  hoist: boolean;
}

export interface ServerMember {
  userId: string;
  serverId: string;
  nickname: string | null;
  joinedAt: string;
  roleIds: string[];
  user: PublicUser;
}

export interface Category {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  topic: string | null;
  position: number;
  createdAt: string;
}

export interface ServerSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  ownerId: string;
  memberCount: number;
}

export interface ServerDetail extends ServerSummary {
  categories: Category[];
  channels: Channel[];
  roles: Role[];
  /** Effective permission bitmask of the requesting user in this server. */
  permissions: number;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
  /** Set by the API for the requesting user. */
  me: boolean;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface MessageReference {
  id: string;
  authorId: string;
  author: PublicUser | null;
  content: string;
  deleted: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  /** Present for guild channels, null for direct conversations. */
  serverId: string | null;
  authorId: string;
  author: PublicUser;
  content: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  system: boolean;
  replyTo: MessageReference | null;
  attachments: Attachment[];
  reactions: Reaction[];
  previews: LinkPreview[];
  mentionedUserIds: string[];
  mentionsEveryone: boolean;
  /** Client-only marker used for optimistic sends. */
  pending?: boolean;
  failed?: boolean;
  nonce?: string;
}

export interface DirectConversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  iconUrl: string | null;
  ownerId: string | null;
  members: PublicUser[];
  lastMessageAt: string | null;
}

export interface Invite {
  code: string;
  serverId: string;
  inviterId: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface InvitePreview {
  code: string;
  server: ServerSummary;
  inviter: PublicUser;
  alreadyMember: boolean;
}

export interface ReadState {
  channelId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mentionCount: number;
  unread: boolean;
}

export interface ChannelNotificationSetting {
  channelId: string;
  level: NotificationLevel;
  muted: boolean;
}

export interface Ban {
  userId: string;
  serverId: string;
  reason: string | null;
  createdAt: string;
  user: PublicUser;
  moderator: PublicUser | null;
}

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: SelfUser;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
