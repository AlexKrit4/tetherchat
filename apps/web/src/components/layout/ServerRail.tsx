import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Compass, Plus, Users } from 'lucide-react';
import type { ServerSummary } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useServers } from '@/hooks/useServers';
import { useReadStateIndex } from '@/hooks/useReadStates';
import { useServerChannelIndex } from '@/hooks/useServerChannelIndex';
import { MentionBadge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { CreateServerDialog } from '@/components/modals/CreateServerDialog';
import { JoinServerDialog } from '@/components/modals/JoinServerDialog';
import { TetherLogo } from '@/components/brand/TetherLogo';
import { useT } from '@/i18n/useT';
import { useUiStore } from '@/stores/uiStore';

/**
 * The 72px column of round server icons. The active server is marked by a white
 * pill on the left edge, and hovering morphs the icon from a squircle to a circle.
 */
export function ServerRail() {
  const t = useT();
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId?: string }>();
  const { data: servers } = useServers();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const friendsOpen = useUiStore((state) => state.friendsRailOpen);
  const setFriendsOpen = useUiStore((state) => state.setFriendsRailOpen);

  return (
    <nav
      aria-label={t('nav.servers')}
      className="flex h-full w-rail shrink-0 flex-col items-center gap-2 bg-surface-tertiary pt-3"
    >
      <RailButton
        label={t('nav.directMessages')}
        active={serverId === DM_ROUTE && !friendsOpen}
        onClick={() => {
          setFriendsOpen(false);
          navigate(`/channels/${DM_ROUTE}`);
        }}
      >
        <TetherLogo className="h-7 w-7" />
      </RailButton>
      <RailButton label={t('friends.title')} active={friendsOpen} onClick={() => setFriendsOpen(true)}>
        <Users size={23} aria-hidden />
      </RailButton>

      <div className="h-px w-8 shrink-0 bg-[#35363c]" aria-hidden />

      <div className="scroller scroller-hover flex w-full flex-1 flex-col items-center gap-2 pb-2">
        {servers?.map((server) => (
          <ServerIcon key={server.id} server={server} active={!friendsOpen && server.id === serverId} />
        ))}

        <RailButton label={t('nav.addServer')} onClick={() => setCreateOpen(true)} tone="accent">
          <Plus size={24} strokeWidth={2} aria-hidden />
        </RailButton>

        <RailButton label={t('nav.joinServer')} onClick={() => setJoinOpen(true)} tone="accent">
          <Compass size={22} strokeWidth={2} aria-hidden />
        </RailButton>
      </div>

      <CreateServerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinServerDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </nav>
  );
}

function ServerIcon({ server, active }: { server: ServerSummary; active: boolean }) {
  const navigate = useNavigate();
  const readStates = useReadStateIndex();
  const channelIndex = useServerChannelIndex();
  const setFriendsOpen = useUiStore((state) => state.setFriendsRailOpen);
  const channelIds = useMemo(() => channelIndex[server.id] ?? [], [channelIndex, server.id]);

  const unread = readStates.serverHasUnread(channelIds);
  const mentions = readStates.serverMentionCount(channelIds);

  return (
    <RailButton
      label={server.name}
      active={active}
      unread={unread}
      mentions={mentions}
      onClick={() => {
        setFriendsOpen(false);
        navigate(`/channels/${server.id}`);
      }}
    >
      {server.iconUrl ? (
        <img
          src={server.iconUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-base font-semibold">{serverInitials(server.name)}</span>
      )}
    </RailButton>
  );
}

interface RailButtonProps {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  unread?: boolean;
  mentions?: number;
  tone?: 'default' | 'accent';
}

function RailButton({
  label,
  children,
  onClick,
  active,
  unread,
  mentions = 0,
  tone = 'default',
}: RailButtonProps) {
  const pillHeight = active ? 40 : unread ? 8 : 0;

  return (
    <div className="relative flex w-full items-center justify-center">
      <span
        aria-hidden
        className="absolute left-0 rounded-r bg-text-heading transition-all duration-150"
        style={{ width: 4, height: pillHeight, opacity: pillHeight ? 1 : 0 }}
      />

      <Tooltip content={label} placement="right">
        <button
          type="button"
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          onClick={onClick}
          className={cn(
            'group relative flex h-12 w-12 items-center justify-center overflow-hidden',
            'transition-[border-radius,background-color] duration-150 ease-out',
            active ? 'rounded-2xl' : 'rounded-3xl hover:rounded-2xl',
            tone === 'accent'
              ? 'bg-surface-secondary text-success hover:bg-success hover:text-white'
              : active
                ? 'bg-brand text-white'
                : 'bg-surface-secondary text-text hover:bg-brand hover:text-white',
          )}
        >
          {children}
        </button>
      </Tooltip>

      {mentions > 0 ? (
        <MentionBadge
          count={mentions}
          className="pointer-events-none absolute bottom-0 right-2 ring-2 ring-surface-tertiary"
        />
      ) : null}
    </div>
  );
}

export function serverInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}
