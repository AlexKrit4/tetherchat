import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectConversation, FriendRequest, PublicUser } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/api';
import { t } from '@/i18n';
import { sortDirectConversations } from './useDms';

export function useIncomingFriendRequests() {
  return useQuery({
    queryKey: queryKeys.friendIncoming,
    queryFn: () => api.get<FriendRequest[]>('/api/friends/incoming'),
    staleTime: 15_000,
  });
}

export function useFriends() {
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: () => api.get<PublicUser[]>('/api/friends'),
    staleTime: 30_000,
  });
}

export function useSendFriendRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId?: string; username?: string }) =>
      api.post<{ accepted: boolean; user: PublicUser; conversation?: DirectConversation }>(
        '/api/friends/requests',
        input,
      ),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: queryKeys.friendIncoming });
      void client.invalidateQueries({ queryKey: queryKeys.friends });
      void client.invalidateQueries({ queryKey: queryKeys.dms });
      toast.success(result.accepted ? t('friends.becameFriends') : t('friends.requestSent'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useAcceptFriendRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ user: PublicUser; conversation: DirectConversation }>(`/api/friends/requests/${id}/accept`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.friendIncoming });
      void client.invalidateQueries({ queryKey: queryKeys.friends });
      void client.invalidateQueries({ queryKey: queryKeys.dms });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeclineFriendRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/friends/requests/${id}/decline`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.friendIncoming }),
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function usePinConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) =>
      pinned
        ? api.post<DirectConversation>(`/api/dms/${conversationId}/pin`)
        : api.delete<DirectConversation>(`/api/dms/${conversationId}/pin`),
    onSuccess: (conversation) => {
      client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) => {
        if (!current) return current;
        return [...current.map((row) => (row.id === conversation.id ? conversation : row))].sort(
          sortDirectConversations,
        );
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
