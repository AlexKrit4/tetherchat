import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Permission, can } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useLeaveServer } from '@/hooks/useServers';
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { ChannelList } from './ChannelList';
import { DirectMessageList } from './DirectMessageList';
import { UserPanel } from './UserPanel';
import { CreateChannelDialog } from '@/components/modals/CreateChannelDialog';
import { InviteDialog } from '@/components/modals/InviteDialog';
import { ServerSettingsDialog } from '@/components/modals/ServerSettingsDialog';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';

/**
 * 240px column between the rail and the chat. Holds the server header, the
 * channel tree (or the DM list) and the pinned user panel.
 */
export function ChannelSidebar({ className }: { className?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { channelId, server, isDm } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const menu = useContextMenu();
  const leaveServer = useLeaveServer();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const isOwner = server?.ownerId === currentUserId;

  return (
    <div className={cn('flex h-full w-sidebar shrink-0 flex-col bg-surface-secondary', className)}>
      {isDm ? (
        <header className="flex h-header shrink-0 items-center px-2 shadow-elevated">
          <div className="flex h-7 w-full items-center rounded bg-surface-tertiary px-2 text-sm text-text-muted">
            {t('nav.findConversation')}
          </div>
        </header>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            if (!server) return;
            menu.open(event, [
              {
                id: 'invite',
                label: t('nav.invitePeople'),
                onSelect: () => setInviteOpen(true),
                disabled: !can(server.permissions, Permission.CREATE_INVITE),
              },
              {
                id: 'settings',
                label: t('nav.serverSettings'),
                onSelect: () => setSettingsOpen(true),
                disabled: !can(server.permissions, Permission.MANAGE_SERVER),
              },
              {
                id: 'create-channel',
                label: t('nav.createChannel'),
                onSelect: () => setCreateChannelOpen(true),
                disabled: !can(server.permissions, Permission.MANAGE_CHANNELS),
              },
              {
                id: 'leave',
                label: t('nav.leaveServer'),
                tone: 'danger',
                separatorBefore: true,
                disabled: isOwner,
                onSelect: () =>
                  leaveServer.mutate(server.id, {
                    onSuccess: () => navigate(`/channels/${DM_ROUTE}`),
                    onError: (error) => toast.error(errorMessage(error)),
                  }),
              },
            ]);
          }}
          className={cn(
            'flex h-header shrink-0 items-center justify-between gap-2 px-4 text-left',
            'shadow-elevated transition-colors hover:bg-surface-hover',
          )}
        >
          <span className="truncate text-base font-semibold text-text-heading">
            {server?.name ?? t('common.loading')}
          </span>
          <ChevronDown size={18} strokeWidth={2.2} aria-hidden className="shrink-0 text-text-heading" />
        </button>
      )}

      <div className="scroller scroller-hover flex-1">
        {isDm ? (
          <DirectMessageList activeConversationId={channelId} />
        ) : server ? (
          <ChannelList server={server} activeChannelId={channelId} />
        ) : (
          <SidebarSkeleton />
        )}
      </div>

      <UserPanel />

      <ContextMenu state={menu.state} onClose={menu.close} />

      {server ? (
        <>
          <InviteDialog server={server} open={inviteOpen} onClose={() => setInviteOpen(false)} />
          <ServerSettingsDialog
            server={server}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
          <CreateChannelDialog
            serverId={server.id}
            categoryId={null}
            open={createChannelOpen}
            onClose={() => setCreateChannelOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
