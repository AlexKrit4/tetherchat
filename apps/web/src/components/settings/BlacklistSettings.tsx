import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import type { PublicUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';

export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.blocks,
    queryFn: () => api.get<PublicUser[]>('/api/users/@me/blocks'),
    staleTime: 15_000,
  });
}

export function useBlockUser() {
  const client = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (userId: string) => api.put<PublicUser>(`/api/users/@me/blocks/${userId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.blocks });
      void client.invalidateQueries({ queryKey: queryKeys.dms });
      toast.success(t('settings.userBlocked'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUnblockUser() {
  const client = useQueryClient();
  const t = useT();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/api/users/@me/blocks/${userId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.blocks });
      void client.invalidateQueries({ queryKey: queryKeys.dms });
      toast.success(t('settings.userUnblocked'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** Blacklist shown in user settings (desktop modal and mobile settings). */
export function BlacklistSettings() {
  const t = useT();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t('settings.blockedUsersHint')}</p>
      {blocked.data?.length ? (
        <ul className="flex flex-col gap-1">
          {blocked.data.map((user) => (
            <li key={user.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
              <Avatar user={user} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-heading">
                  {user.displayName ?? user.username}
                </span>
                <span className="block truncate text-xs text-text-muted">@{user.username}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                loading={unblock.isPending && unblock.variables === user.id}
                onClick={() => unblock.mutate(user.id)}
              >
                {t('settings.unblockUser')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-surface-secondary p-4 text-sm text-text-muted">
          <Ban size={18} className="shrink-0" aria-hidden />
          {t('settings.blockedEmpty')}
        </div>
      )}
    </div>
  );
}
