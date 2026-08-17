import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import type { SelfUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

export function AccountSettings() {
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
      toast.success('Username updated');
    },
    onError: (mutationError) => {
      const message = errorMessage(mutationError);
      setError(message);
      toast.error(message);
    },
  });

  const requestReset = useMutation({
    mutationFn: () => api.post('/api/auth/forgot-password', { email: user?.email }),
    onSuccess: () => toast.success('Password reset link sent to your email'),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-base-secondary p-4">
        <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-muted">Email</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-text">
          {user.email}
          <span
            className={
              user.emailVerified
                ? 'rounded bg-[rgba(35,165,89,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-success'
                : 'rounded bg-[rgba(242,63,67,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-danger'
            }
          >
            {user.emailVerified ? 'Verified' : 'Unverified'}
          </span>
        </p>
      </div>

      <Input
        label="Username"
        value={username}
        error={error}
        maxLength={LIMITS.username.max}
        hint="Lowercase letters, digits, dot, dash and underscore."
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
            setError('That username is not allowed');
            return;
          }
          save.mutate(username);
        }}
      >
        Save username
      </Button>

      <div className="h-px bg-divider" />

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-text-heading">Password</p>
        <p className="text-sm text-text-muted">
          We send a one-time link to {user.email}. Existing sessions sign out after a reset.
        </p>
        <Button variant="secondary" loading={requestReset.isPending} onClick={() => requestReset.mutate()}>
          Send password reset link
        </Button>
      </div>
    </div>
  );
}
