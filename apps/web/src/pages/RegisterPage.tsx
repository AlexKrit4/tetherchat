import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';

export function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = t('auth.invalidEmail');
    if (username.length < LIMITS.username.min) {
      next.username = t('auth.usernameMin', { min: LIMITS.username.min });
    } else if (!USERNAME_PATTERN.test(username)) {
      next.username = t('auth.usernamePattern');
    }
    if (password.length < LIMITS.password.min) {
      next.password = t('auth.passwordMin', { min: LIMITS.password.min });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      navigate(`/channels/${DM_ROUTE}`, { replace: true });
    } catch (registerError) {
      setErrors({ form: errorMessage(registerError, t('auth.registerFailed')) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      footer={
        <>
          {t('auth.alreadyRegistered')}{' '}
          <Link to="/login" className="text-text-link hover:underline">
            {t('auth.logIn')}
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          autoFocus
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Input
          label={t('auth.username')}
          autoComplete="username"
          autoCapitalize="none"
          required
          value={username}
          error={errors.username}
          maxLength={LIMITS.username.max}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />

        <Input
          label={t('auth.displayName')}
          autoComplete="nickname"
          value={displayName}
          maxLength={LIMITS.displayName.max}
          hint={t('auth.displayNameHint')}
          onChange={(event) => setDisplayName(event.target.value)}
        />

        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {errors.form ? <p className="text-sm text-danger">{errors.form}</p> : null}

        <Button type="submit" size="lg" fullWidth loading={busy}>
          {t('auth.continue')}
        </Button>
      </form>
    </AuthLayout>
  );
}
