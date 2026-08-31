import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import type { SelfUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { SessionSettings } from './SessionSettings';
import { PushToggle } from './NotificationSettings';
import { TwoFactorSettings } from './TwoFactorSettings';

export function AccountSettings() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState(user?.username ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (nextUsername: string) =>
      api.patch<SelfUser>('/api/users/@me', { username: nextUsername }),
    onSuccess: (updated) => {
      setUser(updated);
      setError(null);
      toast.success(t('settings.usernameUpdated'));
    },
    onError: (mutationError) => {
      const message = errorMessage(mutationError);
      setError(message);
      toast.error(message);
    },
  });

  const requestReset = useMutation({
    mutationFn: () => api.post('/api/auth/forgot-password', { email: user?.email }),
    onSuccess: () => toast.success(t('settings.resetSent')),
  });

  const resendVerification = useMutation({
    mutationFn: () => api.post('/api/auth/resend-verification'),
    onSuccess: () => toast.success(t('auth.verificationSent')),
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-surface-secondary p-4">
        <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-muted">{t('settings.email')}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-text">
          {user.email}
          <span
            className={
              user.emailVerified
                ? 'rounded bg-[rgba(35,165,89,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-success'
                : 'rounded bg-[rgba(242,63,67,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-danger'
            }
          >
            {user.emailVerified ? t('settings.verified') : t('settings.unverified')}
          </span>
        </p>
        {!user.emailVerified ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-text-muted">{t('auth.verifyEmailHint')}</p>
            <Button
              variant="secondary"
              size="sm"
              loading={resendVerification.isPending}
              onClick={() => resendVerification.mutate()}
            >
              {t('auth.resendVerification')}
            </Button>
          </div>
        ) : null}
      </div>

      <Input
        label={t('settings.username')}
        value={username}
        error={error}
        maxLength={LIMITS.username.max}
        hint={t('settings.usernameHint')}
        onChange={(event) => {
          setUsername(event.target.value.toLowerCase());
          setError(null);
        }}
      />

      <Button
        loading={save.isPending}
        disabled={username === user.username}
        onClick={() => {
          if (!USERNAME_PATTERN.test(username) || username.length < LIMITS.username.min) {
            setError(t('settings.usernameBad'));
            return;
          }
          save.mutate(username);
        }}
      >
        {t('settings.saveUsername')}
      </Button>

      <div className="h-px bg-divider" />

      <PushToggle />

      <div className="h-px bg-divider" />

      <TwoFactorSettings />

      <div className="h-px bg-divider" />

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-text-heading">{t('settings.password')}</p>
        <p className="text-sm text-text-muted">
          {user.emailVerified
            ? t('settings.passwordHint', { email: user.email })
            : t('settings.passwordUnverifiedHint')}
        </p>
        <Button
          variant="secondary"
          loading={requestReset.isPending}
          disabled={!user.emailVerified}
          onClick={() => requestReset.mutate()}
        >
          {t('settings.sendReset')}
        </Button>
      </div>

      <div className="h-px bg-divider" />

      <SessionSettings />
    </div>
  );
}
