import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';

export function RegisterPage() {
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter a valid email';
    if (username.length < LIMITS.username.min) {
      next.username = `At least ${LIMITS.username.min} characters`;
    } else if (!USERNAME_PATTERN.test(username)) {
      next.username = 'Lowercase letters, digits, dot, dash, underscore';
    }
    if (password.length < LIMITS.password.min) {
      next.password = `At least ${LIMITS.password.min} characters`;
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
      setErrors({ form: errorMessage(registerError, 'Could not create the account') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-text-link hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          label="Email"
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
          label="Username"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={username}
          error={errors.username}
          maxLength={LIMITS.username.max}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />

        <Input
          label="Display name"
          autoComplete="nickname"
          value={displayName}
          maxLength={LIMITS.displayName.max}
          hint="Optional. Shown instead of your username."
          onChange={(event) => setDisplayName(event.target.value)}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {errors.form ? <p className="text-sm text-danger">{errors.form}</p> : null}

        <Button type="submit" size="lg" fullWidth loading={busy}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
