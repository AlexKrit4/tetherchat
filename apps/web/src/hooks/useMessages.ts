import { useCallback, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { LIMITS } from '@tetherchat/shared';
import type { Attachment, Message, SearchHit } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { decryptSecretMessage, encryptSecretMessage } from '@/lib/e2ee';
import {
  listOutbox,
  markOutboxFailed,
  outboxAsMessage,
  putOutbox,
  removeOutbox,
  type OutboxPayload,
} from '@/lib/outbox';

export interface MessagePage {
  items: Message[];
  hasMore: boolean;
}

type MessageInfiniteData = InfiniteData<MessagePage, string | undefined>;

/** DM conversations and guild channels share one message endpoint shape. */
export function messagesPath(channelId: string, isDm: boolean): string {
  return isDm ? `/api/dms/${channelId}/messages` : `/api/channels/${channelId}/messages`;
}

export function useMessageHistory(channelId: string | undefined, isDm: boolean, isSecret = false) {
  const userId = useAuthStore((state) => state.user?.id);
  return useInfiniteQuery<MessagePage, Error, MessageInfiniteData, readonly unknown[], string | undefined>({
    queryKey: queryKeys.messages(channelId ?? 'none'),
    enabled: Boolean(channelId),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const page = await api.get<MessagePage>(messagesPath(channelId!, isDm), {
        query: { before: pageParam, limit: LIMITS.messagePageSize },
      });
      if (!isSecret || !userId) return page;
      return {
        ...page,
        items: await Promise.all(page.items.map((message) => decryptSecretMessage(userId, message))),
      };
    },
    // Pages arrive newest-first; the cursor for the next page is the oldest id we hold.
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.items.length > 0 ? lastPage.items[0].id : undefined,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

/** Flattens paginated history into a single chronological list. */
export function useMessages(channelId: string | undefined, isDm: boolean, isSecret = false) {
  const query = useMessageHistory(channelId, isDm, isSecret);

  const messages = useMemo(() => {
    const pages = query.data?.pages ?? [];
    // Page 0 holds the newest batch, so older pages come first once reversed.
    return [...pages].reverse().flatMap((page) => page.items);
  }, [query.data]);

  return { ...query, messages };
}

function upsertMessage(client: QueryClient, channelId: string, message: Message): void {
  if (message.threadRootId) {
    client.setQueryData<{ root: Message; items: Message[] }>(
      queryKeys.thread(message.threadRootId),
      (current) => {
        if (!current) return current;
        const existing = current.items.findIndex((item) => item.id === message.id || (message.nonce && item.nonce === message.nonce));
        const items =
          existing === -1
            ? [...current.items, message]
            : current.items.map((item, index) => (index === existing ? { ...item, ...message, pending: false, failed: false } : item));
        return { ...current, items };
      },
    );
    client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === message.threadRootId
              ? { ...item, threadReplyCount: Math.max(item.threadReplyCount ?? 0, message.threadReplyCount ?? 0) }
              : item,
          ),
        })),
      };
    });
    return;
  }

  client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
    if (!current) return current;

    const pages = current.pages.map((page) => ({ ...page, items: [...page.items] }));
    for (const page of pages) {
      const byId = page.items.findIndex((item) => item.id === message.id);
      if (byId !== -1) {
        page.items[byId] = { ...page.items[byId], ...message, pending: false, failed: false };
        return { ...current, pages };
      }
      if (message.nonce) {
        const byNonce = page.items.findIndex((item) => item.nonce && item.nonce === message.nonce);
        if (byNonce !== -1) {
          page.items[byNonce] = { ...message, pending: false, failed: false };
          return { ...current, pages };
        }
      }
    }

    if (pages.length === 0) return { ...current, pages: [{ items: [message], hasMore: false }] };
    pages[0] = { ...pages[0], items: [...pages[0].items, message] };
    return { ...current, pages };
  });
}

function removeMessage(client: QueryClient, channelId: string, messageId: string): void {
  client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== messageId),
      })),
    };
  });
}

export const messageCache = { upsertMessage, removeMessage };

export function hydrateOutbox(client: QueryClient, author: Message['author']): void {
  for (const item of listOutbox()) {
    if (item.payload.threadRootId) continue;
    client.setQueryData<MessageInfiniteData>(queryKeys.messages(item.channelId), (current) => {
      const message = outboxAsMessage(item, author);
      if (!current) {
        return { pageParams: [undefined], pages: [{ items: [message], hasMore: false }] };
      }
      const exists = current.pages.some((page) =>
        page.items.some((entry) => entry.nonce === item.nonce || entry.id === message.id),
      );
      if (exists) return current;
      const pages = current.pages.map((page) => ({ ...page, items: [...page.items] }));
      if (pages.length === 0) return { ...current, pages: [{ items: [message], hasMore: false }] };
      pages[0] = { ...pages[0], items: [...pages[0].items, message] };
      return { ...current, pages };
    });
  }
}

export type SendMessageInput = {
  content: string;
  replyToId?: string | null;
  threadRootId?: string | null;
  attachmentIds?: string[];
  attachmentDurations?: Record<string, number>;
  attachmentSpoilers?: Record<string, boolean>;
  forwardMessageId?: string;
  optimisticAttachments?: Attachment[];
  nonce: string;
};

async function deliverMessage(
  channelId: string,
  isDm: boolean,
  isSecret: boolean,
  userId: string | undefined,
  input: SendMessageInput,
): Promise<Message> {
  if (isSecret) {
    if (!userId) throw new Error('Войдите снова');
    if (input.attachmentIds?.length || input.replyToId || input.forwardMessageId || input.threadRootId) {
      throw new Error('В секретном чате сейчас доступны только текстовые сообщения');
    }
    const encrypted = await encryptSecretMessage(userId, channelId, input.content);
    const message = await api.post<Message>(messagesPath(channelId, isDm), {
      encrypted,
      nonce: input.nonce,
    });
    return decryptSecretMessage(userId, message);
  }
  const socket = getSocket();
  const body = {
    channelId,
    content: input.content,
    replyToId: input.replyToId,
    threadRootId: input.threadRootId,
    attachmentIds: input.attachmentIds,
    attachmentDurations: input.attachmentDurations,
    attachmentSpoilers: input.attachmentSpoilers,
    forwardMessageId: input.forwardMessageId,
    nonce: input.nonce,
  };
  if (socket.connected) {
    return new Promise<Message>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('Message timed out — check your connection')),
        10_000,
      );
      socket.emit('message:send', body, (result) => {
        window.clearTimeout(timer);
        if (result.ok) resolve(result.data);
        else reject(new Error(result.message));
      });
    });
  }
  return api.post<Message>(messagesPath(channelId, isDm), body);
}

export function useSendMessage(channelId: string, isDm: boolean, isSecret = false) {
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      deliverMessage(channelId, isDm, isSecret, user?.id, input),

    onMutate: (input) => {
      if (!user) return;
      const payload: OutboxPayload = {
        content: input.content,
        replyToId: input.replyToId,
        threadRootId: input.threadRootId,
        attachmentIds: input.attachmentIds,
        attachmentDurations: input.attachmentDurations,
        attachmentSpoilers: input.attachmentSpoilers,
        isDm,
        isSecret,
      };
      putOutbox({
        nonce: input.nonce,
        channelId,
        createdAt: Date.now(),
        status: 'pending',
        payload,
      });
      const optimistic: Message = {
        id: `pending-${input.nonce}`,
        channelId,
        serverId: null,
        authorId: user.id,
        author: user,
        content: input.content,
        createdAt: new Date().toISOString(),
        editedAt: null,
        pinned: false,
        system: false,
        replyTo: null,
        forwardedFrom: null,
        threadRootId: input.threadRootId ?? null,
        threadReplyCount: 0,
        attachments: input.optimisticAttachments ?? [],
        reactions: [],
        previews: [],
        mentionedUserIds: [],
        mentionsEveryone: false,
        pending: true,
        nonce: input.nonce,
        outbox: payload,
      };
      upsertMessage(client, channelId, optimistic);
    },

    onSuccess: (message, input) => {
      removeOutbox(input.nonce);
      removeMessage(client, channelId, `pending-${input.nonce}`);
      upsertMessage(client, channelId, message);
    },

    onError: (_error, input) => {
      markOutboxFailed(input.nonce);
      const fail = (item: Message) =>
        item.id === `pending-${input.nonce}` ? { ...item, pending: false, failed: true } : item;
      client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map(fail),
          })),
        };
      });
      if (input.threadRootId) {
        client.setQueryData<{ root: Message; items: Message[] }>(
          queryKeys.thread(input.threadRootId),
          (current) => current ? { ...current, items: current.items.map(fail) } : current,
        );
      }
    },
  });
}

export function useRetryMessage(channelId: string, isDm: boolean, isSecret = false) {
  const send = useSendMessage(channelId, isDm, isSecret);
  return useCallback(
    (message: Message) => {
      const payload = message.outbox;
      if (!payload || !message.nonce) return;
      send.mutate({
        ...payload,
        nonce: message.nonce,
      });
    },
    [send],
  );
}

export async function drainOutbox(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const { queryClient } = await import('@/lib/queryClient');
  for (const item of listOutbox()) {
    try {
      const message = await deliverMessage(
        item.channelId,
        item.payload.isDm,
        item.payload.isSecret,
        user.id,
        { ...item.payload, nonce: item.nonce },
      );
      removeOutbox(item.nonce);
      removeMessage(queryClient, item.channelId, `pending-${item.nonce}`);
      upsertMessage(queryClient, item.channelId, message);
    } catch {
      markOutboxFailed(item.nonce);
    }
  }
}

export function useEditMessage(channelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch<Message>(`/api/messages/${messageId}`, { content }),
    onSuccess: (message) => upsertMessage(client, channelId, message),
  });
}

export function useDeleteMessage(channelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.delete(`/api/messages/${messageId}`),
    onSuccess: (_data, messageId) => removeMessage(client, channelId, messageId),
  });
}

export function useToggleReaction(channelId: string) {
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.put<{ messageId: string; reactions: Message['reactions'] }>(
        `/api/messages/${messageId}/reactions`,
        { emoji },
      ),
    onMutate: ({ messageId, emoji }) => {
      if (!user) return;
      client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item.id !== messageId) return item;
              const existing = item.reactions.find((reaction) => reaction.emoji === emoji);
              if (!existing) {
                return {
                  ...item,
                  reactions: [
                    ...item.reactions,
                    { emoji, count: 1, userIds: [user.id], me: true },
                  ],
                };
              }
              const reactions = item.reactions
                .map((reaction) =>
                  reaction.emoji === emoji
                    ? {
                        ...reaction,
                        me: !reaction.me,
                        count: reaction.count + (reaction.me ? -1 : 1),
                        userIds: reaction.me
                          ? reaction.userIds.filter((id) => id !== user.id)
                          : [...reaction.userIds, user.id],
                      }
                    : reaction,
                )
                .filter((reaction) => reaction.count > 0);
              return { ...item, reactions };
            }),
          })),
        };
      });
    },
    onSuccess: ({ messageId, reactions }) => {
      client.setQueryData<MessageInfiniteData>(queryKeys.messages(channelId), (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === messageId
                ? {
                    ...item,
                    reactions: reactions.map((reaction) => ({
                      ...reaction,
                      me: user ? reaction.userIds.includes(user.id) : false,
                    })),
                  }
                : item,
            ),
          })),
        };
      });
    },
  });
}

export function usePins(channelId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.pins(channelId ?? 'none'),
    queryFn: () => api.get<Message[]>(`/api/channels/${channelId}/pins`),
    enabled: Boolean(channelId) && enabled,
  });
}

export function useTogglePin(channelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      pinned
        ? api.put(`/api/channels/${channelId}/pins/${messageId}`)
        : api.delete(`/api/channels/${channelId}/pins/${messageId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.pins(channelId) }),
  });
}

export function useMessageSearch(channelId: string | undefined, query: string, isDm: boolean) {
  return useQuery({
    queryKey: queryKeys.search(channelId ?? 'none', query),
    queryFn: () =>
      api.get<Message[]>(
        isDm
          ? `/api/dms/${channelId}/messages/search`
          : `/api/channels/${channelId}/messages/search`,
        { query: { q: query } },
      ),
    enabled: Boolean(channelId) && query.trim().length >= 2,
  });
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.globalSearch(query),
    queryFn: () => api.get<SearchHit[]>('/api/search/messages', { query: { q: query } }),
    enabled: query.trim().length >= 2,
  });
}

export function useThread(rootId: string | null) {
  return useQuery({
    queryKey: queryKeys.thread(rootId ?? 'none'),
    queryFn: () => api.get<{ root: Message; items: Message[] }>(`/api/messages/${rootId}/thread`),
    enabled: Boolean(rootId),
  });
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: (input: File | { file: File; durationMs?: number }) => {
      const payload = input instanceof File ? { file: input, durationMs: undefined } : input;
      const form = new FormData();
      form.append('file', payload.file);
      return api.post<Attachment>('/api/upload', form, {
        query: payload.durationMs ? { durationMs: payload.durationMs } : undefined,
      });
    },
  });
}

/** Stable nonce generator for optimistic sends. */
export function useNonce(): () => string {
  return useCallback(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
}
