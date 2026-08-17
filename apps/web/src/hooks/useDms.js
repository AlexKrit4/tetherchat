import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
export function useConversations() {
    return useQuery({
        queryKey: queryKeys.dms,
        queryFn: () => api.get('/api/dms'),
        staleTime: 30_000,
    });
}
export function useConversation(conversationId) {
    return useQuery({
        queryKey: queryKeys.dm(conversationId ?? 'none'),
        queryFn: () => api.get(`/api/dms/${conversationId}`),
        enabled: Boolean(conversationId),
    });
}
export function useCreateConversation() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.post('/api/dms', input),
        onSuccess: (conversation) => {
            client.setQueryData(queryKeys.dm(conversation.id), conversation);
            void client.invalidateQueries({ queryKey: queryKeys.dms });
        },
    });
}
export function useLeaveConversation() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (conversationId) => api.post(`/api/dms/${conversationId}/leave`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.dms }),
    });
}
export function useUserSearch(query) {
    return useQuery({
        queryKey: queryKeys.userSearch(query),
        queryFn: () => api.get('/api/users', { query: { q: query } }),
        enabled: query.trim().length >= 2,
        staleTime: 30_000,
    });
}
/** Title shown in the DM list and chat header. */
export function conversationTitle(conversation, currentUserId) {
    if (conversation.name)
        return conversation.name;
    const others = conversation.members.filter((member) => member.id !== currentUserId);
    if (others.length === 0)
        return 'Just you';
    return others.map((member) => member.displayName ?? member.username).join(', ');
}
//# sourceMappingURL=useDms.js.map