import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DirectConversation, Message, PresenceStatus, ReadState, ServerMember } from '@tetherchat/shared';
import { queryKeys } from '@/lib/queryKeys';
import { connectSocket, getSocket } from '@/lib/socket';
import { isSessionParked } from '@/lib/appForeground';
import { notifyIncomingMessage } from '@/lib/push';
import { messageCache } from './useMessages';
import { sortDirectConversations } from './useDms';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useTypingStore } from '@/stores/typingStore';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/**
 * Owns the socket lifecycle and folds every server event into the react-query
 * cache, so components only ever read from the cache and never from the socket.
 */
export function useRealtime(): ConnectionState {
  const client = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const setPresence = usePresenceStore((state) => state.set);
  const setTyping = useTypingStore((state) => state.set);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const socket = connectSocket();

    const onConnect = () => {
      setConnection('connected');
      const preferred = useAuthStore.getState().user?.status;
      if (preferred && preferred !== 'offline') {
        socket.emit('presence:update', { status: preferred });
      }
    };
    const onDisconnect = () => {
      if (isSessionParked()) return;
      setConnection('reconnecting');
    };
    const onConnectError = () => setConnection('offline');

    const onMessageNew = (message: Message) => {
      messageCache.upsertMessage(client, message.channelId, message);
      if (message.authorId !== currentUserId) {
        markChannelUnread(client, message.channelId, message.mentionedUserIds.includes(currentUserId ?? ''));
        notifyIncomingMessage(message, currentUserId);
      }
      void client.invalidateQueries({ queryKey: queryKeys.dms, refetchType: 'none' });
    };

    const onMessageUpdated = (message: Message) => {
      messageCache.upsertMessage(client, message.channelId, message);
    };

    const onMessageDeleted = ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      messageCache.removeMessage(client, channelId, messageId);
    };

    const onReactionUpdated = ({
      messageId,
      channelId,
      reactions,
    }: {
      messageId: string;
      channelId: string;
      reactions: Message['reactions'];
    }) => {
      const existing = client
        .getQueryData<{ pages: { items: Message[] }[] }>(queryKeys.messages(channelId))
        ?.pages.flatMap((page) => page.items)
        .find((item) => item.id === messageId);
      if (!existing) return;
      messageCache.upsertMessage(client, channelId, {
        ...existing,
        reactions: reactions.map((reaction) => ({
          ...reaction,
          me: currentUserId ? reaction.userIds.includes(currentUserId) : false,
        })),
      });
    };

    const onPinned = ({ channelId }: { channelId: string }) => {
      void client.invalidateQueries({ queryKey: queryKeys.pins(channelId) });
      void client.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
    };

    const onTypingUpdate = ({
      channelId,
      users,
    }: {
      channelId: string;
      users: { id: string; username: string }[];
    }) => {
      setTyping(
        channelId,
        users.filter((user) => user.id !== currentUserId),
      );
    };

    const onPresence = ({ userId, status: next }: { userId: string; status: PresenceStatus }) => {
      setPresence(userId, next);
    };

    const onMemberJoin = ({ serverId, member }: { serverId: string; member: ServerMember }) => {
      client.setQueryData<ServerMember[]>(queryKeys.members(serverId), (current) =>
        current ? [...current.filter((row) => row.userId !== member.userId), member] : current,
      );
      void client.invalidateQueries({ queryKey: queryKeys.servers });
    };

    const onMemberLeave = ({ serverId, userId }: { serverId: string; userId: string }) => {
      client.setQueryData<ServerMember[]>(queryKeys.members(serverId), (current) =>
        current?.filter((row) => row.userId !== userId),
      );
      if (userId === currentUserId) void client.invalidateQueries({ queryKey: queryKeys.servers });
    };

    const onMemberUpdate = ({ serverId, member }: { serverId: string; member: ServerMember }) => {
      client.setQueryData<ServerMember[]>(queryKeys.members(serverId), (current) =>
        current?.map((row) => (row.userId === member.userId ? member : row)),
      );
    };

    const invalidateServer = (serverId: string) => {
      void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
    };

    const onDmCreate = (conversation: DirectConversation) => {
      client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) =>
        current ? [conversation, ...current.filter((row) => row.id !== conversation.id)] : current,
      );
    };

    const onDmUpdate = (conversation: DirectConversation) => {
      client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) => {
        if (!current) return current;
        return [...current.map((row) => (row.id === conversation.id ? conversation : row))].sort(
          sortDirectConversations,
        );
      });
    };

    const onFriendIncoming = () => {
      void client.invalidateQueries({ queryKey: queryKeys.friendIncoming });
    };

    const onReceipt = (payload: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
      lastReadAt: string;
    }) => {
      if (payload.userId === currentUserId) return;
      const patch = (conversation: DirectConversation): DirectConversation =>
        conversation.id === payload.conversationId
          ? {
              ...conversation,
              peerLastReadMessageId: payload.lastReadMessageId,
              peerLastReadAt: payload.lastReadAt,
            }
          : conversation;
      client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) => current?.map(patch));
      client.setQueryData<DirectConversation>(queryKeys.dm(payload.conversationId), (current) =>
        current ? patch(current) : current,
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessageNew);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('message:pinned', onPinned);
    socket.on('reaction:updated', onReactionUpdated);
    socket.on('typing:update', onTypingUpdate);
    socket.on('presence:update', onPresence);
    socket.on('member:join', onMemberJoin);
    socket.on('member:leave', onMemberLeave);
    socket.on('member:update', onMemberUpdate);
    socket.on('channel:create', (channel) => invalidateServer(channel.serverId));
    socket.on('channel:update', (channel) => invalidateServer(channel.serverId));
    socket.on('channel:delete', ({ serverId }) => invalidateServer(serverId));
    socket.on('category:create', (category) => invalidateServer(category.serverId));
    socket.on('category:update', (category) => invalidateServer(category.serverId));
    socket.on('category:delete', ({ serverId }) => invalidateServer(serverId));
    socket.on('role:update', ({ serverId }) => invalidateServer(serverId));
    socket.on('server:update', () => void client.invalidateQueries({ queryKey: queryKeys.servers }));
    socket.on('server:delete', () => void client.invalidateQueries({ queryKey: queryKeys.servers }));
    socket.on('server:join', () => void client.invalidateQueries({ queryKey: queryKeys.servers }));
    socket.on('dm:create', onDmCreate);
    socket.on('dm:update', onDmUpdate);
    socket.on('friend:incoming', onFriendIncoming);
    socket.on('friend:accepted', onFriendIncoming);
    socket.on('receipt:update', onReceipt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.removeAllListeners('message:new');
      socket.removeAllListeners('message:updated');
      socket.removeAllListeners('message:deleted');
      socket.removeAllListeners('message:pinned');
      socket.removeAllListeners('reaction:updated');
      socket.removeAllListeners('typing:update');
      socket.removeAllListeners('presence:update');
      socket.removeAllListeners('member:join');
      socket.removeAllListeners('member:leave');
      socket.removeAllListeners('member:update');
      socket.removeAllListeners('channel:create');
      socket.removeAllListeners('channel:update');
      socket.removeAllListeners('channel:delete');
      socket.removeAllListeners('category:create');
      socket.removeAllListeners('category:update');
      socket.removeAllListeners('category:delete');
      socket.removeAllListeners('role:update');
      socket.removeAllListeners('server:update');
      socket.removeAllListeners('server:delete');
      socket.removeAllListeners('server:join');
      socket.removeAllListeners('dm:create');
      socket.removeAllListeners('dm:update');
      socket.removeAllListeners('friend:incoming');
      socket.removeAllListeners('friend:accepted');
      socket.removeAllListeners('receipt:update');
    };
  }, [client, currentUserId, setPresence, setTyping, status]);

  return connection;
}

function markChannelUnread(
  client: ReturnType<typeof useQueryClient>,
  channelId: string,
  mentioned: boolean,
): void {
  client.setQueryData<ReadState[]>(queryKeys.readStates, (current) => {
    if (!current) return current;
    const existing = current.find((state) => state.channelId === channelId);
    if (!existing) {
      return [
        ...current,
        {
          channelId,
          lastReadMessageId: null,
          lastReadAt: null,
          mentionCount: mentioned ? 1 : 0,
          unread: true,
        },
      ];
    }
    return current.map((state) =>
      state.channelId === channelId
        ? {
            ...state,
            unread: true,
            mentionCount: state.mentionCount + (mentioned ? 1 : 0),
          }
        : state,
    );
  });
}

/** Joins the channel room so the server sends this channel's traffic. */
export function useChannelSubscription(channelId: string | undefined): void {
  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    const subscribe = () => socket.emit('channel:subscribe', { channelId });
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    return () => {
      socket.off('connect', subscribe);
      if (socket.connected) socket.emit('channel:unsubscribe', { channelId });
    };
  }, [channelId]);
}
