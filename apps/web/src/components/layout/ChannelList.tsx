import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, ChevronDown, Hash, Plus, Settings } from 'lucide-react';
import { Permission, can } from '@tetherchat/shared';
import type { Channel, ServerDetail } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { groupChannels } from '@/hooks/useChatTarget';
import { useReadStateIndex, useUpdateChannelNotifications } from '@/hooks/useReadStates';
import { useDeleteChannel } from '@/hooks/useServers';
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu';
import { IconButton } from '@/components/ui/IconButton';
import { MentionBadge } from '@/components/ui/Badge';
import { CreateChannelDialog } from '@/components/modals/CreateChannelDialog';
import { ChannelSettingsDialog } from '@/components/modals/ChannelSettingsDialog';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';

export interface ChannelListProps {
  server: ServerDetail;
  activeChannelId: string | undefined;
  /** Mobile uses larger rows and navigates instead of swapping the centre pane. */
  compact?: boolean;
  onSelect?: (channel: Channel) => void;
}

export function ChannelList({ server, activeChannelId, compact = true, onSelect }: ChannelListProps) {
  const t = useT();
  const navigate = useNavigate();
  const collapsed = useUiStore((state) => state.collapsedCategories);
  const toggleCategory = useUiStore((state) => state.toggleCategory);
  const readStates = useReadStateIndex();
  const menu = useContextMenu();

  const [createIn, setCreateIn] = useState<string | null | undefined>(undefined);
  const [settingsFor, setSettingsFor] = useState<Channel | null>(null);

  const groups = useMemo(() => groupChannels(server), [server]);
  const manageChannels = can(server.permissions, Permission.MANAGE_CHANNELS);
  const deleteChannel = useDeleteChannel(server.id);

  const open = (channel: Channel) => {
    if (onSelect) onSelect(channel);
    else navigate(`/channels/${server.id}/${channel.id}`);
  };

  return (
    <>
      <div className="flex flex-col pb-4">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.id] ?? false;
          const visible = group.channels.filter(
            (channel) =>
              !isCollapsed || channel.id === activeChannelId || readStates.isUnread(channel.id),
          );

          return (
            <section key={group.id} className="mt-4 first:mt-2">
              {group.name ? (
                <header className="group/category flex items-center pr-2">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.id)}
                    aria-expanded={!isCollapsed}
                    className={cn(
                      'flex min-h-touch flex-1 items-center gap-0.5 pl-2 text-left md:min-h-6',
                      'text-xs font-semibold uppercase tracking-[0.02em] text-text-muted',
                      'transition-colors hover:text-text-heading',
                    )}
                  >
                    <ChevronDown
                      size={12}
                      strokeWidth={3}
                      aria-hidden
                      className={cn('transition-transform duration-150', isCollapsed && '-rotate-90')}
                    />
                    <span className="truncate">{group.name}</span>
                  </button>

                  {manageChannels ? (
                    <IconButton
                      icon={Plus}
                      label={t('channel.createIn', { name: group.name })}
                      size="sm"
                      className="opacity-0 focus-visible:opacity-100 group-hover/category:opacity-100 md:h-4 md:w-4"
                      onClick={() => setCreateIn(group.id === 'uncategorised' ? null : group.id)}
                    />
                  ) : null}
                </header>
              ) : null}

              <ul className="mt-0.5 flex flex-col gap-0.5 px-2">
                {visible.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={channel.id === activeChannelId}
                    unread={readStates.isUnread(channel.id)}
                    mentions={readStates.mentionCount(channel.id)}
                    compact={compact}
                    canManage={manageChannels}
                    onOpen={() => open(channel)}
                    onSettings={() => setSettingsFor(channel)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      menu.open(event, [
                        {
                          id: 'mark-read',
                          label: t('channel.markRead'),
                          onSelect: () => undefined,
                          disabled: !readStates.isUnread(channel.id),
                        },
                        {
                          id: 'copy-link',
                          label: t('channel.copyLink'),
                          onSelect: () => {
                            void navigator.clipboard.writeText(
                              `${window.location.origin}/channels/${server.id}/${channel.id}`,
                            );
                            toast.success(t('channel.linkCopied'));
                          },
                        },
                        ...(manageChannels
                          ? [
                              {
                                id: 'edit',
                                label: t('channel.editChannel'),
                                separatorBefore: true,
                                onSelect: () => setSettingsFor(channel),
                              },
                              {
                                id: 'delete',
                                label: t('channel.deleteChannel'),
                                tone: 'danger' as const,
                                onSelect: () => {
                                  deleteChannel.mutate(channel.id, {
                                    onError: (error) => toast.error(errorMessage(error)),
                                  });
                                },
                              },
                            ]
                          : []),
                      ]);
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <ContextMenu state={menu.state} onClose={menu.close} />

      <CreateChannelDialog
        serverId={server.id}
        categoryId={createIn ?? null}
        open={createIn !== undefined}
        onClose={() => setCreateIn(undefined)}
      />

      {settingsFor ? (
        <ChannelSettingsDialog
          server={server}
          channel={settingsFor}
          open
          onClose={() => setSettingsFor(null)}
        />
      ) : null}
    </>
  );
}

interface ChannelRowProps {
  channel: Channel;
  active: boolean;
  unread: boolean;
  mentions: number;
  compact: boolean;
  canManage: boolean;
  onOpen: () => void;
  onSettings: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

function ChannelRow({
  channel,
  active,
  unread,
  mentions,
  compact,
  canManage,
  onOpen,
  onSettings,
  onContextMenu,
}: ChannelRowProps) {
  const t = useT();
  const notifications = useUpdateChannelNotifications(channel.id);
  const [muted, setMuted] = useState(false);

  return (
    <li className="relative">
      {/* Unread marker: a white pill, never a coloured dot. */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r bg-text-heading transition-all duration-150"
        style={{ width: 4, height: unread && !active ? 8 : 0, opacity: unread && !active ? 1 : 0 }}
      />

      <div
        className={cn(
          'group/channel flex items-center rounded pr-1',
          active ? 'bg-surface-selected' : 'hover:bg-surface-hover',
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          onContextMenu={onContextMenu}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded pl-2 pr-1 text-left',
            compact ? 'min-h-11 md:min-h-8' : 'min-h-12',
            active
              ? 'text-text-heading'
              : unread
                ? 'text-text-heading'
                : 'text-text-muted group-hover/channel:text-text-subheading',
          )}
        >
          <Hash size={18} strokeWidth={2} aria-hidden className="shrink-0 text-text-faint" />
          <span className={cn('truncate text-base', (active || unread) && 'font-medium')}>
            {channel.name}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <MentionBadge count={mentions} />

          {/* Hover-only on desktop; touch users get these from the long-press menu. */}
          <IconButton
            icon={muted ? BellOff : Bell}
            label={muted ? t('channel.unmuteChannel') : t('channel.muteChannel')}
            size="sm"
            className="hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/channel:opacity-100"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              notifications.mutate({ muted: next });
            }}
          />

          {canManage ? (
            <IconButton
              icon={Settings}
              label={t('channel.editChannel')}
              size="sm"
              className="hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/channel:opacity-100"
              onClick={onSettings}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}