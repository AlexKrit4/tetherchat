import { useMutation } from '@tanstack/react-query';
import { LogOut, Moon, MinusCircle, EyeOff, Circle } from 'lucide-react';
import type { PresenceStatus, SelfUser } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useT } from '@/i18n/useT';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

export function StatusMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const options: {
    status: PresenceStatus;
    label: string;
    hint?: string;
    icon: typeof Circle;
    colour: string;
  }[] = [
    { status: 'online', label: t('status.online'), icon: Circle, colour: 'var(--green)' },
    { status: 'idle', label: t('status.idle'), icon: Moon, colour: 'var(--yellow)' },
    {
      status: 'dnd',
      label: t('status.dnd'),
      hint: t('status.dndHint'),
      icon: MinusCircle,
      colour: 'var(--red)',
    },
    {
      status: 'invisible',
      label: t('status.invisible'),
      hint: t('status.invisibleHint'),
      icon: EyeOff,
      colour: 'var(--grey)',
    },
  ];

  const save = useMutation({
    mutationFn: (status: PresenceStatus) => api.patch<SelfUser>('/api/users/@me', { status }),
    onSuccess: (updated) => {
      setUser(updated);
      const socket = getSocket();
      if (socket.connected) socket.emit('presence:update', { status: updated.status });
    },
  });

  if (!user) return null;

  return (
    <AdaptiveDialog open={open} onClose={onClose} width="sm">
      <div className="flex flex-col">
        <div className="flex items-center gap-3 pb-3">
          <Avatar user={user} size={48} showStatus />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text-heading">
              {user.displayName ?? user.username}
            </p>
            <p className="truncate text-sm text-text-muted">@{user.username}</p>
          </div>
        </div>

        <div className="h-px bg-divider" />

        <ul className="py-1">
          {options.map((option) => {
            const active = user.status === option.status;
            const Icon = option.icon;
            return (
              <li key={option.status}>
                <button
                  type="button"
                  onClick={() => {
                    save.mutate(option.status);
                    onClose();
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded px-2 text-left md:min-h-10',
                    active ? 'bg-surface-selected' : 'hover:bg-surface-hover',
                  )}
                >
                  <Icon
                    size={16}
                    aria-hidden
                    className="shrink-0"
                    style={{ color: option.colour }}
                    fill={option.status === 'online' ? option.colour : 'none'}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-base text-text-heading">{option.label}</span>
                    {option.hint ? (
                      <span className="truncate text-xs text-text-muted">{option.hint}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="h-px bg-divider" />

        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-12 items-center gap-3 rounded px-2 text-left text-danger hover:bg-surface-hover md:min-h-10"
        >
          <LogOut size={16} aria-hidden />
          {t('status.logOut')}
        </button>
      </div>
    </AdaptiveDialog>
  );
}
