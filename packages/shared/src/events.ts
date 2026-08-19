import type { PresenceStatus } from './constants.js';
import type {
  Channel,
  Category,
  DirectConversation,
  Message,
  Reaction,
  Role,
  ServerMember,
  ServerSummary,
} from './types.js';

export interface ClientToServerEvents {
  'message:send': (
    payload: {
      channelId: string;
      content: string;
      replyToId?: string | null;
      attachmentIds?: string[];
      attachmentDurations?: Record<string, number>;
      forwardMessageId?: string;
      nonce?: string;
    },
    ack?: (result: AckResult<Message>) => void,
  ) => void;
  'message:edit': (
    payload: { messageId: string; content: string },
    ack?: (result: AckResult<Message>) => void,
  ) => void;
  'message:delete': (
    payload: { messageId: string },
    ack?: (result: AckResult<{ messageId: string }>) => void,
  ) => void;
  'reaction:toggle': (
    payload: { messageId: string; emoji: string },
    ack?: (result: AckResult<{ messageId: string; reactions: Reaction[] }>) => void,
  ) => void;
  'typing:start': (payload: { channelId: string }) => void;
  'typing:stop': (payload: { channelId: string }) => void;
  'presence:update': (payload: { status: PresenceStatus }) => void;
  'channel:subscribe': (payload: { channelId: string }) => void;
  'channel:unsubscribe': (payload: { channelId: string }) => void;
  'channel:ack': (payload: { channelId: string; messageId: string }) => void;
}

export interface ServerToClientEvents {
  ready: (payload: { userId: string; sessionId: string }) => void;
  'message:new': (payload: Message) => void;
  'message:updated': (payload: Message) => void;
  'message:deleted': (payload: { messageId: string; channelId: string }) => void;
  'message:pinned': (payload: { messageId: string; channelId: string; pinned: boolean }) => void;
  'reaction:updated': (payload: { messageId: string; channelId: string; reactions: Reaction[] }) => void;
  'typing:update': (payload: { channelId: string; users: { id: string; username: string }[] }) => void;
  'presence:update': (payload: { userId: string; status: PresenceStatus }) => void;
  'member:join': (payload: { serverId: string; member: ServerMember }) => void;
  'member:leave': (payload: { serverId: string; userId: string }) => void;
  'member:update': (payload: { serverId: string; member: ServerMember }) => void;
  'server:update': (payload: ServerSummary) => void;
  'server:delete': (payload: { serverId: string }) => void;
  'server:join': (payload: { serverId: string }) => void;
  'channel:create': (payload: Channel) => void;
  'channel:update': (payload: Channel) => void;
  'channel:delete': (payload: { channelId: string; serverId: string }) => void;
  'category:create': (payload: Category) => void;
  'category:update': (payload: Category) => void;
  'category:delete': (payload: { categoryId: string; serverId: string }) => void;
  'role:update': (payload: { serverId: string; roles: Role[] }) => void;
  'dm:create': (payload: DirectConversation) => void;
  'receipt:update': (payload: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string;
    lastReadAt: string;
  }) => void;
  error: (payload: { code: string; message: string }) => void;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/**
 * Room names shared by the server (emit side) and the client (subscribe side).
 * Fan-out across API instances is handled by the socket.io Redis adapter.
 */
export const socketRooms = {
  user: (userId: string) => `user:${userId}`,
  server: (serverId: string) => `server:${serverId}`,
  channel: (channelId: string) => `channel:${channelId}`,
  conversation: (conversationId: string) => `dm:${conversationId}`,
};
