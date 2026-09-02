import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QrLoginPanel } from '@/components/auth/QrLoginPanel';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';

type LoginMode = 'password' | 'qr';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const completeTotp = useAuthStore((state) => state.completeTotp);

  const [mode, setMode] = useState<LoginMode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? `/channels/${DM_ROUTE}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (ticket) {
        await completeTotp(ticket, totpCode.trim());
      } else {
        await login(identifier.trim(), password);
      }
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      const challenge = loginError as { code?: string; ticket?: string };
      if (challenge.code === 'totp_required' && challenge.ticket) {
        setTicket(challenge.ticket);
        setError(null);
      } else if (loginError instanceof ApiRequestError && loginError.code === 'account_banned') {
        setError(loginError.message);
      } else {
        setError(errorMessage(loginError, t('auth.loginFailed')));
      }
    } finally {
      setBusy(false);
    }
  };

  const showQr = mode === 'qr' && !ticket;

  return (
    <AuthLayout
      title={ticket ? t('auth.totpTitle') : showQr ? t('auth.qrTitle') : t('auth.loginTitle')}
      subtitle={
        ticket ? t('auth.totpSubtitle') : showQr ? t('auth.qrSubtitle') : t('auth.loginSubtitle')
      }
      footer={
        <>
          {t('auth.needAccount')}{' '}
          <Link to="/register" className="text-text-link hover:underline">
            {t('auth.register')}
          </Link>
        </>
      }
    >
      {!ticket ? (
        <div
          className={cn(
            'mb-4 flex p-1',
            isGraphite()
              ? 'rounded-lg bg-surface-secondary shadow-hairline'
              : 'rounded-lg bg-surface-secondary',
          )}
        >
          <button
            type="button"
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              mode === 'password'
                ? isGraphite()
                  ? 'bg-surface text-text-heading shadow-hairline'
                  : 'bg-surface text-text-heading shadow-sm'
                : 'text-text-muted',
            )}
            onClick={() => {
              setMode('password');
              setQrExpired(false);
            }}
          >
            {t('auth.passwordTab')}
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              mode === 'qr'
                ? isGraphite()
                  ? 'bg-surface text-text-heading shadow-hairline'
                  : 'bg-surface text-text-heading shadow-sm'
                : 'text-text-muted',
            )}
            onClick={() => setMode('qr')}
          >
            {t('auth.qrTab')}
          </button>
        </div>
      ) : null}

      {showQr ? (
        <>
          {qrExpired ? (
            <p className="mb-4 text-center text-sm text-text-muted">{t('auth.qrExpired')}</p>
          ) : null}
          <QrLoginPanel
            onSuccess={() => navigate(redirectTo, { replace: true })}
            onExpired={() => setQrExpired(true)}
          />
        </>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          {ticket ? (
            <Input
              label={t('settings.twoFactorCode')}
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              required
              value={totpCode}
              error={error}
              onChange={(event) => setTotpCode(event.target.value)}
            />
          ) : (
            <>
              <Input
                label={t('auth.loginIdentifier')}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
              <Input
                label={t('auth.password')}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                error={error}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Link to="/forgot-password" className="-mt-2 self-start text-sm text-text-link hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy}>
            {ticket ? t('auth.totpContinue') : t('auth.logIn')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
