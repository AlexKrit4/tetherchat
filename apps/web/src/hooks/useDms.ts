import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectConversation, PublicUser } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.dms,
    queryFn: () => api.get<DirectConversation[]>('/api/dms'),
    staleTime: 30_000,
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dm(conversationId ?? 'none'),
    queryFn: () => api.get<DirectConversation>(`/api/dms/${conversationId}`),
    enabled: Boolean(conversationId),
  });
}

export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userIds: string[]; name?: string | null }) =>
      api.post<DirectConversation>('/api/dms', input),
    onSuccess: (conversation) => {
      client.setQueryData(queryKeys.dm(conversation.id), conversation);
      void client.invalidateQueries({ queryKey: queryKeys.dms });
    },
  });
}

export function useLeaveConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.post(`/api/dms/${conversationId}/leave`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.dms }),
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.userSearch(query),
    queryFn: () => api.get<PublicUser[]>('/api/users', { query: { q: query } }),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

/** Title shown in the DM list and chat header. */
export function conversationTitle(
  conversation: DirectConversation,
  currentUserId: string | undefined,
  savedLabel = 'Избранное',
): string {
  if (conversation.isSaved) return savedLabel;
  if (conversation.name) return conversation.name;
  const others = conversation.members.filter((member) => member.id !== currentUserId);
  if (others.length === 0) return savedLabel;
  return others.map((member) => member.displayName ?? member.username).join(', ');
}
