import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, ChevronDown, Hash, Plus, Settings } from 'lucide-react';
import { Permission, can } from '@tetherchat/shared';
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
export function ChannelList({ server, activeChannelId, compact = true, onSelect }) {
    const navigate = useNavigate();
    const collapsed = useUiStore((state) => state.collapsedCategories);
    const toggleCategory = useUiStore((state) => state.toggleCategory);
    const readStates = useReadStateIndex();
    const menu = useContextMenu();
    const [createIn, setCreateIn] = useState(undefined);
    const [settingsFor, setSettingsFor] = useState(null);
    const groups = useMemo(() => groupChannels(server), [server]);
    const manageChannels = can(server.permissions, Permission.MANAGE_CHANNELS);
    const deleteChannel = useDeleteChannel(server.id);
    const open = (channel) => {
        if (onSelect)
            onSelect(channel);
        else
            navigate(`/channels/${server.id}/${channel.id}`);
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex flex-col pb-4", children: groups.map((group) => {
                    const isCollapsed = collapsed[group.id] ?? false;
                    const visible = group.channels.filter((channel) => !isCollapsed || channel.id === activeChannelId || readStates.isUnread(channel.id));
                    return (_jsxs("section", { className: "mt-4 first:mt-2", children: [group.name ? (_jsxs("header", { className: "group/category flex items-center pr-2", children: [_jsxs("button", { type: "button", onClick: () => toggleCategory(group.id), "aria-expanded": !isCollapsed, className: cn('flex min-h-touch flex-1 items-center gap-0.5 pl-2 text-left md:min-h-6', 'text-xs font-semibold uppercase tracking-[0.02em] text-text-muted', 'transition-colors hover:text-text-heading'), children: [_jsx(ChevronDown, { size: 12, strokeWidth: 3, "aria-hidden": true, className: cn('transition-transform duration-150', isCollapsed && '-rotate-90') }), _jsx("span", { className: "truncate", children: group.name })] }), manageChannels ? (_jsx(IconButton, { icon: Plus, label: `Create channel in ${group.name}`, size: "sm", className: "opacity-0 focus-visible:opacity-100 group-hover/category:opacity-100 md:h-4 md:w-4", onClick: () => setCreateIn(group.id === 'uncategorised' ? null : group.id) })) : null] })) : null, _jsx("ul", { className: "mt-0.5 flex flex-col gap-0.5 px-2", children: visible.map((channel) => (_jsx(ChannelRow, { channel: channel, active: channel.id === activeChannelId, unread: readStates.isUnread(channel.id), mentions: readStates.mentionCount(channel.id), compact: compact, canManage: manageChannels, onOpen: () => open(channel), onSettings: () => setSettingsFor(channel), onContextMenu: (event) => {
                                        event.preventDefault();
                                        menu.open(event, [
                                            {
                                                id: 'mark-read',
                                                label: 'Mark as read',
                                                onSelect: () => undefined,
                                                disabled: !readStates.isUnread(channel.id),
                                            },
                                            {
                                                id: 'copy-link',
                                                label: 'Copy link',
                                                onSelect: () => {
                                                    void navigator.clipboard.writeText(`${window.location.origin}/channels/${server.id}/${channel.id}`);
                                                    toast.success('Channel link copied');
                                                },
                                            },
                                            ...(manageChannels
                                                ? [
                                                    {
                                                        id: 'edit',
                                                        label: 'Edit channel',
                                                        separatorBefore: true,
                                                        onSelect: () => setSettingsFor(channel),
                                                    },
                                                    {
                                                        id: 'delete',
                                                        label: 'Delete channel',
                                                        tone: 'danger',
                                                        onSelect: () => {
                                                            deleteChannel.mutate(channel.id, {
                                                                onError: (error) => toast.error(errorMessage(error)),
                                                            });
                                                        },
                                                    },
                                                ]
                                                : []),
                                        ]);
                                    } }, channel.id))) })] }, group.id));
                }) }), _jsx(ContextMenu, { state: menu.state, onClose: menu.close }), _jsx(CreateChannelDialog, { serverId: server.id, categoryId: createIn ?? null, open: createIn !== undefined, onClose: () => setCreateIn(undefined) }), settingsFor ? (_jsx(ChannelSettingsDialog, { server: server, channel: settingsFor, open: true, onClose: () => setSettingsFor(null) })) : null] }));
}
function ChannelRow({ channel, active, unread, mentions, compact, canManage, onOpen, onSettings, onContextMenu, }) {
    const notifications = useUpdateChannelNotifications(channel.id);
    const [muted, setMuted] = useState(false);
    return (_jsxs("li", { className: "relative", children: [_jsx("span", { "aria-hidden": true, className: "absolute left-0 top-1/2 -translate-y-1/2 rounded-r bg-text-heading transition-all duration-150", style: { width: 4, height: unread && !active ? 8 : 0, opacity: unread && !active ? 1 : 0 } }), _jsxs("div", { className: cn('group/channel flex items-center rounded pr-1', active ? 'bg-surface-selected' : 'hover:bg-surface-hover'), children: [_jsxs("button", { type: "button", onClick: onOpen, onContextMenu: onContextMenu, "aria-current": active ? 'page' : undefined, className: cn('flex min-w-0 flex-1 items-center gap-1.5 rounded pl-2 pr-1 text-left', compact ? 'min-h-11 md:min-h-8' : 'min-h-12', active
                            ? 'text-text-heading'
                            : unread
                                ? 'text-text-heading'
                                : 'text-text-muted group-hover/channel:text-text-subheading'), children: [_jsx(Hash, { size: 18, strokeWidth: 2, "aria-hidden": true, className: "shrink-0 text-text-faint" }), _jsx("span", { className: cn('truncate text-base', (active || unread) && 'font-medium'), children: channel.name })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-0.5", children: [_jsx(MentionBadge, { count: mentions }), _jsx(IconButton, { icon: muted ? BellOff : Bell, label: muted ? 'Unmute channel' : 'Mute channel', size: "sm", className: "hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/channel:opacity-100", onClick: () => {
                                    const next = !muted;
                                    setMuted(next);
                                    notifications.mutate({ muted: next });
                                } }), canManage ? (_jsx(IconButton, { icon: Settings, label: "Edit channel", size: "sm", className: "hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/channel:opacity-100", onClick: onSettings })) : null] })] })] }));
}
//# sourceMappingURL=ChannelList.js.map