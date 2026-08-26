import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectConversation, PublicUser } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { getE2eeDeviceId } from '@/lib/e2ee';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';

export function useConversations() {
  const userId = useAuthStore((state) => state.user?.id);
  const deviceId = userId ? getE2eeDeviceId(userId) : null;
  return useQuery({
    queryKey: [...queryKeys.dms, deviceId ?? 'none'],
    queryFn: () =>
      api.get<DirectConversation[]>(
        deviceId ? `/api/dms?deviceId=${encodeURIComponent(deviceId)}` : '/api/dms',
      ),
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

export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, scope }: { conversationId: string; scope: 'me' | 'all' }) =>
      api.delete(`/api/dms/${conversationId}`, { query: { scope } }),
    onSuccess: (_data, { conversationId }) => {
      client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) =>
        current?.filter((row) => row.id !== conversationId),
      );
      client.removeQueries({ queryKey: queryKeys.dm(conversationId) });
    },
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
  aiLabel = 'Нейросеть',
  vpnLabel = 'Enigma VPN',
): string {
  if (conversation.isSaved) return savedLabel;
  if (conversation.isAi) return aiLabel;
  if (conversation.isVpn) return vpnLabel;
  if (conversation.name) return conversation.name;
  const others = conversation.members.filter((member) => member.id !== currentUserId);
  if (others.length === 0) return savedLabel;
  return others.map((member) => member.displayName ?? member.username).join(', ');
}

/** Saved Messages, then the AI chat, then VPN bot, then pins, then recency. */
export function sortDirectConversations(a: DirectConversation, b: DirectConversation): number {
  if (Boolean(a.isSaved) !== Boolean(b.isSaved)) return a.isSaved ? -1 : 1;
  if (Boolean(a.isAi) !== Boolean(b.isAi)) return a.isAi ? -1 : 1;
  if (Boolean(a.isVpn) !== Boolean(b.isVpn)) return a.isVpn ? -1 : 1;
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
}
