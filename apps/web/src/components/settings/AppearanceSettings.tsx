import { useMutation } from '@tanstack/react-query';
import type { SelfUser } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { Toggle } from '@/components/ui/Toggle';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function AppearanceSettings() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isMobile = useIsMobile();

  const save = useMutation({
    mutationFn: (input: { enterToSend: boolean }) => api.patch<SelfUser>('/api/users/@me', input),
    onSuccess: (updated) => setUser(updated),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-base-secondary p-4">
        <p className="text-base font-semibold text-text-heading">Theme</p>
        <p className="mt-1 text-sm text-text-muted">
          TetherChat ships with a single dark theme. Colours come from CSS variables, so a light
          theme can be added without touching components.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="flex items-center gap-2 rounded bg-base-tertiary px-3 py-2 text-base text-text-heading ring-2 ring-brand">
            <span className="h-4 w-4 rounded-full bg-base" aria-hidden />
            Dark
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-base-secondary p-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">Enter sends the message</p>
          <p className="mt-1 text-sm text-text-muted">
            {isMobile
              ? 'On phones the send button is always shown and Enter inserts a newline.'
              : 'Turn this off to require the send button and use Enter for newlines.'}
          </p>
        </div>
        <Toggle
          label="Enter sends the message"
          checked={user.enterToSend}
          disabled={isMobile}
          onChange={(next) => save.mutate({ enterToSend: next })}
        />
      </div>
    </div>
  );
}
