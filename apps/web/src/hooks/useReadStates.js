import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getSocket } from '@/lib/socket';
export function useReadStates() {
    return useQuery({
        queryKey: queryKeys.readStates,
        queryFn: () => api.get('/api/users/@me/read-states'),
        staleTime: 15_000,
    });
}
export function useReadStateIndex() {
    const { data } = useReadStates();
    return useMemo(() => {
        const byChannel = new Map((data ?? []).map((state) => [state.channelId, state]));
        return {
            isUnread: (channelId) => byChannel.get(channelId)?.unread ?? false,
            mentionCount: (channelId) => byChannel.get(channelId)?.mentionCount ?? 0,
            lastReadMessageId: (channelId) => byChannel.get(channelId)?.lastReadMessageId ?? null,
            serverHasUnread: (channelIds) => channelIds.some((channelId) => byChannel.get(channelId)?.unread ?? false),
            serverMentionCount: (channelIds) => channelIds.reduce((total, channelId) => total + (byChannel.get(channelId)?.mentionCount ?? 0), 0),
        };
    }, [data]);
}
/**
 * Acknowledges a channel over the socket (cheap, fire and forget) and patches the
 * local read state so unread badges clear immediately.
 */
export function useAckChannel() {
    const client = useQueryClient();
    return useCallback((channelId, messageId) => {
        const socket = getSocket();
        if (socket.connected)
            socket.emit('channel:ack', { channelId, messageId });
        else
            void api.post(`/api/channels/${channelId}/ack`, { messageId }).catch(() => undefined);
        client.setQueryData(queryKeys.readStates, (current) => {
            if (!current)
                return current;
            const existing = current.find((state) => state.channelId === channelId);
            const next = {
                channelId,
                lastReadMessageId: messageId,
                lastReadAt: new Date().toISOString(),
                mentionCount: 0,
                unread: false,
            };
            return existing
                ? current.map((state) => (state.channelId === channelId ? next : state))
                : [...current, next];
        });
    }, [client]);
}
export function useChannelNotificationSetting(channelId) {
    return useQuery({
        queryKey: queryKeys.channelNotifications(channelId ?? 'none'),
        queryFn: () => api.get(`/api/channels/${channelId}/notifications`),
        enabled: Boolean(channelId),
    });
}
export function useUpdateChannelNotifications(channelId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.put(`/api/channels/${channelId}/notifications`, input),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.channelNotifications(channelId) }),
    });
}
//# sourceMappingURL=useReadStates.js.map