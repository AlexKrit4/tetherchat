import { useState } from 'react';
import { Mic, MicOff, Settings, UserPlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { DisplayName } from '@/components/plus/DisplayName';
import { IconButton } from '@/components/ui/IconButton';
import { UserSettingsDialog } from '@/components/modals/UserSettingsDialog';
import { IncomingFriendsDialog } from '@/components/friends/IncomingFriends';
import { StatusMenu } from '@/components/modals/StatusMenu';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/uiStore';
import { useIncomingFriendRequests } from '@/hooks/useFriends';

/**
 * Fixed strip at the bottom of the channel sidebar: avatar, name, and the
 * quick-settings buttons. Clicking the name area opens the status menu.
 */
export function UserPanel({ className }: { className?: string }) {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const incoming = useIncomingFriendRequests();
  const incomingCount = incoming.data?.length ?? 0;

  if (!user) return null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 bg-surface-panel px-2 py-1.5',
        isGraphite() && 'shadow-hairline-t',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setStatusOpen(true)}
        className={cn(
          'flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded px-1 text-left md:min-h-0 md:py-1',
          'transition-colors hover:bg-surface-hover',
          isGraphite() && 'duration-fast ease-out',
        )}
      >
        <Avatar user={user} size={isGraphite() ? 26 : 32} showStatus ringColor="var(--user-panel-bg)" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text-heading">
            <DisplayName user={user} name={user.displayName ?? user.username} />
          </span>
          <span className="truncate text-xs text-text-muted">
            {user.customStatus ?? `@${user.username}`}
          </span>
        </span>
      </button>

      <IconButton
        icon={muted ? MicOff : Mic}
        label={muted ? t('common.unmuteNotifications') : t('common.muteNotifications')}
        size={isMobile ? 'lg' : 'md'}
        onClick={() => setMuted((current) => !current)}
        active={muted}
        tone={muted ? 'danger' : 'default'}
      />

      <span className="relative inline-flex">
        <IconButton
          icon={UserPlus}
          label={t('friends.incoming')}
          size={isMobile ? 'lg' : 'md'}
          showTooltip={!isMobile}
          onClick={() => (isMobile ? pushMobileView('friends') : setFriendsOpen(true))}
        />
        {incomingCount > 0 ? (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {incomingCount > 9 ? '9+' : incomingCount}
          </span>
        ) : null}
      </span>

      <IconButton
        icon={Settings}
        label={t('nav.userSettings')}
        size={isMobile ? 'lg' : 'md'}
        onClick={() => (isMobile ? pushMobileView('settings') : setSettingsOpen(true))}
      />

      <StatusMenu open={statusOpen} onClose={() => setStatusOpen(false)} />
      <UserSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <IncomingFriendsDialog open={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </div>
  );
}
