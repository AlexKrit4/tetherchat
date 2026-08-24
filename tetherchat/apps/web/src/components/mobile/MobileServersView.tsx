import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Compass, MessageSquare, Plus, Settings } from 'lucide-react';
import type { ServerSummary } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useServers } from '@/hooks/useServers';
import { useReadStateIndex } from '@/hooks/useReadStates';
import { useServerChannelIndex } from '@/hooks/useServerChannelIndex';
import { IconButton } from '@/components/ui/IconButton';
import { MentionBadge } from '@/components/ui/Badge';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { CreateServerDialog } from '@/components/modals/CreateServerDialog';
import { JoinServerDialog } from '@/components/modals/JoinServerDialog';
import { MobileHeader } from './MobileHeader';
import { serverInitials } from '@/components/layout/ServerRail';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/i18n/useT';
import { TetherLogo } from '@/components/brand/TetherLogo';

/**
 * Root of the mobile stack. Servers are a full-width list with names, not a
 * narrow icon rail — 72px of icons is a desktop affordance.
 */
export function MobileServersView() {
  const t = useT();
  const navigate = useNavigate();
  const { data: servers, isLoading } = useServers();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-surface-tertiary">
      <MobileHeader
        title={
          <span className="flex items-center gap-2">
            <TetherLogo className="h-5 w-5 text-brand" />
            TetherChat
          </span>
        }
        actions={
          <IconButton
            icon={Settings}
            label={t('nav.settings')}
            size="lg"
            showTooltip={false}
            onClick={() => pushMobileView('settings')}
          />
        }
      />

      <div className="scroller flex-1 pb-safe">
        <button
          type="button"
          onClick={() => {
            navigate(`/channels/${DM_ROUTE}`);
            pushMobileView('dms');
          }}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-hover"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <MessageSquare size={20} aria-hidden />
          </span>
          <span className="flex-1 text-base font-medium text-text-heading">{t('nav.directMessages')}</span>
          <ChevronRight size={18} className="text-text-muted" aria-hidden />
        </button>

        <div className="mx-4 my-1 h-px bg-divider" aria-hidden />

        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <ul>
            {servers?.map((server) => (
              <li key={server.id}>
                <ServerRow
                  server={server}
                  onOpen={() => {
                    navigate(`/channels/${server.id}`);
                    pushMobileView('channels');
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mx-4 my-1 h-px bg-divider" aria-hidden />

        <ActionRow icon={Plus} label={t('nav.addServer')} onSelect={() => setCreateOpen(true)} />
        <ActionRow icon={Compass} label={t('nav.joinInvite')} onSelect={() => setJoinOpen(true)} />
      </div>

      <CreateServerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinServerDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}

function ServerRow({ server, onOpen }: { server: ServerSummary; onOpen: () => void }) {
  const t = useT();
  const readStates = useReadStateIndex();
  const channelIndex = useServerChannelIndex();
  const channelIds = useMemo(() => channelIndex[server.id] ?? [], [channelIndex, server.id]);
  const unread = readStates.serverHasUnread(channelIds);
  const mentions = readStates.serverMentionCount(channelIds);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-hover"
    >
      {/* The icon only repeats the name, so it stays out of the accessible name. */}
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-secondary text-base font-semibold text-text"
      >
        {server.iconUrl ? (
          <img src={server.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          serverInitials(server.name)
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-base',
            unread ? 'font-semibold text-text-heading' : 'font-medium text-text',
          )}
        >
          {server.name}
        </span>
        <span aria-hidden className="truncate text-xs text-text-muted">
          {t('server.membersCount', { count: server.memberCount })}
        </span>
      </span>

      <MentionBadge count={mentions} />
      <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
    </button>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof Plus;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-hover"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-success">
        <Icon size={20} aria-hidden />
      </span>
      <span className="text-base font-medium text-success">{label}</span>
    </button>
  );
}
