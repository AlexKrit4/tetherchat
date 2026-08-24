import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AdminCredentials, SelfUser, TotpSetup } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

export function TwoFactorSettings() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [adminCreds, setAdminCreds] = useState<AdminCredentials | null>(null);

  const begin = useMutation({
    mutationFn: () => api.post<TotpSetup>('/api/auth/2fa/setup'),
    onSuccess: setSetup,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const enable = useMutation({
    mutationFn: () => api.post<SelfUser>('/api/auth/2fa/enable', { code }),
    onSuccess: (updated) => {
      setUser(updated);
      setSetup(null);
      setCode('');
      toast.success(t('settings.twoFactorOn'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const disable = useMutation({
    mutationFn: () => api.post<SelfUser>('/api/auth/2fa/disable', { code, password }),
    onSuccess: (updated) => {
      setUser(updated);
      setCode('');
      setPassword('');
      toast.success(t('settings.twoFactorOff'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const revealAdmin = useMutation({
    mutationFn: () => api.post<AdminCredentials>('/api/auth/admin-credentials', { code: adminCode }),
    onSuccess: setAdminCreds,
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-semibold text-text-heading">{t('settings.twoFactor')}</p>
      <p className="text-sm text-text-muted">{t('settings.twoFactorHint')}</p>

      {user.totpEnabled ? (
        <>
          <p className="text-sm text-success">{t('settings.twoFactorEnabled')}</p>
          <Input
            label={t('settings.twoFactorCode')}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            variant="danger"
            loading={disable.isPending}
            disabled={code.length < 6 || password.length < 8}
            onClick={() => disable.mutate()}
          >
            {t('settings.twoFactorDisable')}
          </Button>
        </>
      ) : setup ? (
        <>
          <img src={setup.qrDataUrl} alt="" className="h-44 w-44 self-center rounded bg-white p-2" />
          <p className="break-all text-center text-xs text-text-muted">{setup.secret}</p>
          <Input
            label={t('settings.twoFactorCode')}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
          />
          <Button loading={enable.isPending} disabled={code.length < 6} onClick={() => enable.mutate()}>
            {t('settings.twoFactorConfirm')}
          </Button>
        </>
      ) : (
        <Button variant="secondary" loading={begin.isPending} onClick={() => begin.mutate()}>
          {t('settings.twoFactorEnable')}
        </Button>
      )}

      {user.isPlatformAdmin ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-secondary p-4">
          <p className="text-base font-semibold text-text-heading">{t('admin.loginData')}</p>
          <p className="text-sm text-text-muted">{t('admin.loginDataHint')}</p>
          {!user.totpEnabled ? (
            <p className="text-sm text-danger">{t('admin.needsTwoFactor')}</p>
          ) : adminCreds ? (
            <div className="flex flex-col gap-2">
              <CredentialRow label={t('auth.loginIdentifier')} value={adminCreds.login} />
              <CredentialRow label={t('auth.password')} value={adminCreds.password} />
              <p className="text-xs text-text-muted">{t('admin.expiresAt', { time: new Date(adminCreds.expiresAt).toLocaleString() })}</p>
            </div>
          ) : (
            <>
              <Input
                label={t('settings.twoFactorCode')}
                value={adminCode}
                inputMode="numeric"
                onChange={(event) => setAdminCode(event.target.value)}
              />
              <Button
                loading={revealAdmin.isPending}
                disabled={adminCode.length < 6}
                onClick={() => revealAdmin.mutate()}
              >
                {t('admin.showCredentials')}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="truncate font-mono text-sm text-text-heading">{value}</p>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast.success(t('common.copied'));
        }}
      >
        {t('common.copy')}
      </Button>
    </div>
  );
}
