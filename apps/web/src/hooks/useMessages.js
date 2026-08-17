import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, } from '@tanstack/react-query';
import { LIMITS } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
/** DM conversations and guild channels share one message endpoint shape. */
export function messagesPath(channelId, isDm) {
    return isDm ? `/api/dms/${channelId}/messages` : `/api/channels/${channelId}/messages`;
}
export function useMessageHistory(channelId, isDm) {
    return useInfiniteQuery({
        queryKey: queryKeys.messages(channelId ?? 'none'),
        enabled: Boolean(channelId),
        initialPageParam: undefined,
        queryFn: ({ pageParam }) => api.get(messagesPath(channelId, isDm), {
            query: { before: pageParam, limit: LIMITS.messagePageSize },
        }),
        // Pages arrive newest-first; the cursor for the next page is the oldest id we hold.
        getNextPageParam: (lastPage) => lastPage.hasMore && lastPage.items.length > 0 ? lastPage.items[0].id : undefined,
        staleTime: 15_000,
        gcTime: 5 * 60_000,
    });
}
/** Flattens paginated history into a single chronological list. */
export function useMessages(channelId, isDm) {
    const query = useMessageHistory(channelId, isDm);
    const messages = useMemo(() => {
        const pages = query.data?.pages ?? [];
        // Page 0 holds the newest batch, so older pages come first once reversed.
        return [...pages].reverse().flatMap((page) => page.items);
    }, [query.data]);
    return { ...query, messages };
}
function upsertMessage(client, channelId, message) {
    client.setQueryData(queryKeys.messages(channelId), (current) => {
        if (!current)
            return current;
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
        if (pages.length === 0)
            return { ...current, pages: [{ items: [message], hasMore: false }] };
        pages[0] = { ...pages[0], items: [...pages[0].items, message] };
        return { ...current, pages };
    });
}
function removeMessage(client, channelId, messageId) {
    client.setQueryData(queryKeys.messages(channelId), (current) => {
        if (!current)
            return current;
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
export function useSendMessage(channelId, isDm) {
    const client = useQueryClient();
    const user = useAuthStore((state) => state.user);
    return useMutation({
        mutationFn: async (input) => {
            const socket = getSocket();
            // The socket path gives the lowest latency; REST is the fallback when the
            // connection is down so a flaky network never blocks sending.
            if (socket.connected) {
                return new Promise((resolve, reject) => {
                    socket
                        .timeout(10_000)
                        .emit('message:send', { channelId, ...input }, (error, result) => {
                        if (error)
                            reject(new Error('Message timed out'));
                        else if (result?.ok && result.data)
                            resolve(result.data);
                        else
                            reject(new Error(result?.message ?? 'Could not send message'));
                    });
                });
            }
            return api.post(messagesPath(channelId, isDm), input);
        },
        onMutate: (input) => {
            if (!user)
                return;
            const optimistic = {
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
                attachments: [],
                reactions: [],
                previews: [],
                mentionedUserIds: [],
                mentionsEveryone: false,
                pending: true,
                nonce: input.nonce,
            };
            upsertMessage(client, channelId, optimistic);
        },
        onSuccess: (message, input) => {
            removeMessage(client, channelId, `pending-${input.nonce}`);
            upsertMessage(client, channelId, message);
        },
        onError: (_error, input) => {
            client.setQueryData(queryKeys.messages(channelId), (current) => {
                if (!current)
                    return current;
                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => item.id === `pending-${input.nonce}`
                            ? { ...item, pending: false, failed: true }
                            : item),
                    })),
                };
            });
        },
    });
}
export function useEditMessage(channelId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ messageId, content }) => api.patch(`/api/messages/${messageId}`, { content }),
        onSuccess: (message) => upsertMessage(client, channelId, message),
    });
}
export function useDeleteMessage(channelId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (messageId) => api.delete(`/api/messages/${messageId}`),
        onSuccess: (_data, messageId) => removeMessage(client, channelId, messageId),
    });
}
export function useToggleReaction(channelId) {
    const client = useQueryClient();
    const user = useAuthStore((state) => state.user);
    return useMutation({
        mutationFn: ({ messageId, emoji }) => api.put(`/api/messages/${messageId}/reactions`, { emoji }),
        onMutate: ({ messageId, emoji }) => {
            if (!user)
                return;
            client.setQueryData(queryKeys.messages(channelId), (current) => {
                if (!current)
                    return current;
                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => {
                            if (item.id !== messageId)
                                return item;
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
                                .map((reaction) => reaction.emoji === emoji
                                ? {
                                    ...reaction,
                                    me: !reaction.me,
                                    count: reaction.count + (reaction.me ? -1 : 1),
                                    userIds: reaction.me
                                        ? reaction.userIds.filter((id) => id !== user.id)
                                        : [...reaction.userIds, user.id],
                                }
                                : reaction)
                                .filter((reaction) => reaction.count > 0);
                            return { ...item, reactions };
                        }),
                    })),
                };
            });
        },
        onSuccess: ({ messageId, reactions }) => {
            client.setQueryData(queryKeys.messages(channelId), (current) => {
                if (!current)
                    return current;
                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        items: page.items.map((item) => item.id === messageId
                            ? {
                                ...item,
                                reactions: reactions.map((reaction) => ({
                                    ...reaction,
                                    me: user ? reaction.userIds.includes(user.id) : false,
                                })),
                            }
                            : item),
                    })),
                };
            });
        },
    });
}
export function usePins(channelId, enabled) {
    return useQuery({
        queryKey: queryKeys.pins(channelId ?? 'none'),
        queryFn: () => api.get(`/api/channels/${channelId}/pins`),
        enabled: Boolean(channelId) && enabled,
    });
}
export function useTogglePin(channelId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ messageId, pinned }) => pinned
            ? api.put(`/api/channels/${channelId}/pins/${messageId}`)
            : api.delete(`/api/channels/${channelId}/pins/${messageId}`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.pins(channelId) }),
    });
}
export function useMessageSearch(channelId, query, isDm) {
    return useQuery({
        queryKey: queryKeys.search(channelId ?? 'none', query),
        queryFn: () => api.get(isDm
            ? `/api/dms/${channelId}/messages/search`
            : `/api/channels/${channelId}/messages/search`, { query: { q: query } }),
        enabled: Boolean(channelId) && query.trim().length >= 2,
    });
}
export function useUploadAttachment() {
    return useMutation({
        mutationFn: (file) => {
            const form = new FormData();
            form.append('file', file);
            return api.post('/api/upload', form);
        },
    });
}
/** Stable nonce generator for optimistic sends. */
export function useNonce() {
    return useCallback(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, []);
}
//# sourceMappingURL=useMessages.js.map