import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const completeTotp = useAuthStore((state) => state.completeTotp);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <AuthLayout
      title={ticket ? t('auth.totpTitle') : t('auth.loginTitle')}
      subtitle={ticket ? t('auth.totpSubtitle') : t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.needAccount')}{' '}
          <Link to="/register" className="text-text-link hover:underline">
            {t('auth.register')}
          </Link>
        </>
      }
    >
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
    </AuthLayout>
  );
}
