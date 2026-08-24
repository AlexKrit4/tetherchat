import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { PublicUser } from '@tetherchat/shared';
import { LIMITS } from '@tetherchat/shared';
import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

const ROWS: { key: string; free: string; plus: string }[] = [
  { key: 'files', free: '10 МБ', plus: '30 МБ' },
  { key: 'pins', free: '5', plus: '10' },
  { key: 'bio', free: '50', plus: '500' },
  { key: 'accounts', free: '1', plus: '2' },
  { key: 'transcript', free: '—', plus: '✓' },
  { key: 'upload', free: 'лимит', plus: 'без лимита' },
  { key: 'lastSeen', free: 'точное время', plus: 'можно скрыть' },
  { key: 'secret', free: 'обычный', plus: 'защита экрана' },
  { key: 'colors', free: 'случайные', plus: 'свои' },
  { key: 'badge', free: '—', plus: '★ Plus' },
  { key: 'wallpaper', free: 'системный', plus: 'своя картинка' },
  { key: 'icons', free: 'системная', plus: 'набор + ярлык' },
];

export function PlusSettings() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState('');

  const toggleSelf = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<PublicUser>(`/api/admin/users/${user!.id}/plus`, { enabled }),
    onSuccess: (updated) => {
      if (user) setUser({ ...user, isPlus: Boolean(updated.isPlus) });
      toast.success(updated.isPlus ? t('plus.granted') : t('plus.revoked'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const grantByUsername = useMutation({
    mutationFn: async (enabled: boolean) => {
      const found = await api.get<PublicUser[]>('/api/users', { query: { q: username.trim() } });
      const match = found.find((entry) => entry.username === username.trim().toLowerCase());
      if (!match) throw new Error(t('plus.userNotFound'));
      return api.patch<PublicUser>(`/api/admin/users/${match.id}/plus`, { enabled });
    },
    onSuccess: (updated) => {
      toast.success(
        `${updated.displayName ?? updated.username}: ${updated.isPlus ? t('plus.granted') : t('plus.revoked')}`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg bg-surface-secondary p-4">
        <Sparkles size={22} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="text-lg font-semibold text-text-heading">{t('plus.title')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {user.isPlus ? t('plus.activeHint') : t('plus.ctaHint')}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-divider">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-secondary text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t('plus.feature')}</th>
              <th className="px-3 py-2 font-medium">{t('plus.free')}</th>
              <th className="px-3 py-2 font-medium text-warning">{t('plus.paid')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-divider">
                <td className="px-3 py-2 text-text">{t(`plus.row.${row.key}`)}</td>
                <td className="px-3 py-2 text-text-muted">{row.free}</td>
                <td className="px-3 py-2 text-text-heading">{row.plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">{t('plus.screenshotHint')}</p>

      {user.isPlatformAdmin ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-text-heading">{t('plus.adminGrant')}</p>
          <Button
            variant={user.isPlus ? 'secondary' : 'primary'}
            loading={toggleSelf.isPending}
            onClick={() => toggleSelf.mutate(!user.isPlus)}
          >
            {user.isPlus ? t('plus.revokeSelf') : t('plus.grantSelf')}
          </Button>
          <Input
            label={t('plus.grantUsername')}
            value={username}
            maxLength={LIMITS.username.max}
            onChange={(event) => setUsername(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={grantByUsername.isPending}
              disabled={username.trim().length < 2}
              onClick={() => grantByUsername.mutate(true)}
            >
              {t('plus.grant')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={grantByUsername.isPending}
              disabled={username.trim().length < 2}
              onClick={() => grantByUsername.mutate(false)}
            >
              {t('plus.revoke')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">{t('plus.writeAdmin')}</p>
      )}
    </div>
  );
}
