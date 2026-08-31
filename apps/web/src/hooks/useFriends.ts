import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DirectConversation, FriendRequest, PublicUser } from '@tetherchat/shared';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { usePlusStore } from '@/stores/plusStore';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/stores/toastStore';
import { t } from '@/i18n';
import { sortDirectConversations } from './useDms';

/** Built-in bots (@tetherai, @tethervpn) — no friendship required. */
export function isBuiltInBotUsername(username: string | undefined): boolean {
  return username === 'tetherai' || username === 'tethervpn';
}

/** 1:1 chats (including secret) require an accepted friendship. Saved / AI / VPN / groups / bots do not. */
export function conversationNeedsFriendship(
  conversation: DirectConversation | null | undefined,
  currentUserId?: string,
): boolean {
  if (!conversation) return false;
  if (conversation.isSaved || conversation.isAi || conversation.isVpn || conversation.isMonitor || conversation.isGroup) return false;
  const peer = currentUserId
    ? conversation.members.find((member) => member.id !== currentUserId)
    : conversation.members[0];
  if (isBuiltInBotUsername(peer?.username)) return false;
  return true;
}

export function isFriendOf(
  friends: PublicUser[] | undefined,
  userId: string | undefined,
): boolean {
  if (!friends || !userId) return false;
  return friends.some((friend) => friend.id === userId);
}

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
    onError: (error) => {
      if (error instanceof ApiRequestError && error.status === 403) {
        usePlusStore.getState().show('pins');
        return;
      }
      toast.error(errorMessage(error));
    },
  });
}
