import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';

export function SessionSettings() {
  const t = useT();
  const client = useQueryClient();
  const { data: sessions, isLoading } = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => api.get<Session[]>('/api/auth/sessions'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/auth/sessions/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.sessions });
      toast.success(t('settings.sessionRevoked'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.post('/api/auth/sessions/revoke-others'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.sessions });
      toast.success(t('settings.otherSessionsRevoked'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-semibold text-text-heading">{t('settings.sessions')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('settings.sessionsHint')}</p>
      </div>

      {isLoading ? <p className="text-sm text-text-muted">{t('common.loading')}</p> : null}

      <ul className="flex flex-col gap-2">
        {(sessions ?? []).map((session) => (
          <li
            key={session.id}
            className="flex items-start justify-between gap-3 rounded-lg bg-surface-secondary px-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-heading">
                {describeUserAgent(session.userAgent)}
                {session.current ? (
                  <span className="ml-2 text-2xs font-semibold uppercase text-success">
                    {t('settings.thisDevice')}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {session.ip ? `${session.ip} · ` : ''}
                {t('settings.lastActive', { time: formatSessionTime(session.lastUsedAt) })}
              </p>
            </div>
            {session.current ? null : (
              <Button
                variant="ghost"
                className="shrink-0 text-danger"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                {t('settings.endSession')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        loading={revokeOthers.isPending}
        disabled={(sessions ?? []).filter((session) => !session.current).length === 0}
        onClick={() => revokeOthers.mutate()}
      >
        {t('settings.endOtherSessions')}
      </Button>
    </div>
  );
}

function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown';
  if (/okhttp|TetherChat/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac OS/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return userAgent.slice(0, 64);
}

function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
