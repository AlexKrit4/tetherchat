import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, UserPlus } from 'lucide-react';
import { Permission, can } from '@tetherchat/shared';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useLeaveServer } from '@/hooks/useServers';
import { ChannelList } from '@/components/layout/ChannelList';
import { UserPanel } from '@/components/layout/UserPanel';
import { IconButton } from '@/components/ui/IconButton';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { BottomSheet, SheetAction } from '@/components/ui/BottomSheet';
import { InviteDialog } from '@/components/modals/InviteDialog';
import { ServerSettingsDialog } from '@/components/modals/ServerSettingsDialog';
import { CreateChannelDialog } from '@/components/modals/CreateChannelDialog';
import { MobileHeader } from './MobileHeader';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { DM_ROUTE } from '@/hooks/useChatTarget';

/** Full-screen channel picker with the user panel pinned to the bottom. */
export function MobileChannelsView() {
  const t = useT();
  const navigate = useNavigate();
  const { server, channelId, serverId } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const setMobileView = useUiStore((state) => state.setMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const leaveServer = useLeaveServer();

  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const isOwner = server?.ownerId === currentUserId;

  return (
    <div className="flex h-full flex-col bg-surface-secondary">
      <MobileHeader
        title={server?.name ?? t('common.loading')}
        subtitle={server ? t('server.membersCount', { count: server.memberCount }) : undefined}
        onBack={() => setMobileView('servers')}
        actions={
          <>
            {server && can(server.permissions, Permission.CREATE_INVITE) ? (
              <IconButton
                icon={UserPlus}
                label={t('nav.invitePeople')}
                size="lg"
                showTooltip={false}
                onClick={() => setInviteOpen(true)}
              />
            ) : null}
            <IconButton
              icon={MoreVertical}
              label={t('server.options')}
              size="lg"
              showTooltip={false}
              onClick={() => setMenuOpen(true)}
            />
          </>
        }
      />

      <div className="scroller flex-1">
        {server ? (
          <ChannelList
            server={server}
            activeChannelId={channelId}
            compact={false}
            onSelect={(channel) => {
              navigate(`/channels/${server.id}/${channel.id}`);
              pushMobileView('chat');
            }}
          />
        ) : (
          <SidebarSkeleton />
        )}
      </div>

      <UserPanel className="pb-safe" />

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={server?.name}>
        <SheetAction
          label={t('nav.invitePeople')}
          onSelect={() => {
            setMenuOpen(false);
            setInviteOpen(true);
          }}
          disabled={!server || !can(server.permissions, Permission.CREATE_INVITE)}
        />
        <SheetAction
          label={t('nav.createChannel')}
          onSelect={() => {
            setMenuOpen(false);
            setCreateChannelOpen(true);
          }}
          disabled={!server || !can(server.permissions, Permission.MANAGE_CHANNELS)}
        />
        <SheetAction
          label={t('nav.serverSettings')}
          onSelect={() => {
            setMenuOpen(false);
            setSettingsOpen(true);
          }}
          disabled={!server || !can(server.permissions, Permission.MANAGE_SERVER)}
        />
        <SheetAction
          label={t('nav.leaveServer')}
          tone="danger"
          disabled={isOwner || !serverId}
          onSelect={() => {
            setMenuOpen(false);
            if (!serverId) return;
            leaveServer.mutate(serverId, {
              onSuccess: () => {
                navigate(`/channels/${DM_ROUTE}`);
                setMobileView('servers');
              },
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        />
      </BottomSheet>

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
