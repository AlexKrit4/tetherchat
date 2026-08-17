import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? `/channels/${DM_ROUTE}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(errorMessage(loginError, 'Could not sign in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="We are happy to see you again."
      footer={
        <>
          Need an account?{' '}
          <Link to="/register" className="text-text-link hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          label="Email or username"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={error}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Link to="/forgot-password" className="-mt-2 self-start text-sm text-text-link hover:underline">
          Forgot your password?
        </Link>

        <Button type="submit" size="lg" fullWidth loading={busy}>
          Log In
        </Button>
      </form>
    </AuthLayout>
  );
}
