import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LIMITS } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';

export function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.resetTitle')}
      subtitle={sent ? t('auth.resetSent') : t('auth.resetHint')}
      footer={
        <Link to="/login" className="text-text-link hover:underline">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {sent ? null : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {t('auth.sendReset')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < LIMITS.password.min) {
      setError(t('auth.passwordMin', { min: LIMITS.password.min }));
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success(t('auth.passwordUpdated'));
      navigate('/login', { replace: true });
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('auth.newPasswordTitle')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          error={error}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={token.length === 0}>
          {t('auth.updatePassword')}
        </Button>
        {token.length === 0 ? (
          <p className="text-sm text-danger">{t('auth.missingToken')}</p>
        ) : null}
      </form>
    </AuthLayout>
  );
}
