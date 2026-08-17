import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LIMITS } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';

export function ForgotPasswordPage() {
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
      title="Reset your password"
      subtitle={
        sent
          ? 'If that address is registered, a reset link is on its way.'
          : 'We will email you a one-time link.'
      }
      footer={
        <Link to="/login" className="text-text-link hover:underline">
          Back to login
        </Link>
      }
    >
      {sent ? null : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < LIMITS.password.min) {
      setError(`At least ${LIMITS.password.min} characters`);
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success('Password updated — sign in with your new password');
      navigate('/login', { replace: true });
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          error={error}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={token.length === 0}>
          Update password
        </Button>
        {token.length === 0 ? (
          <p className="text-sm text-danger">This link is missing its token.</p>
        ) : null}
      </form>
    </AuthLayout>
  );
}
