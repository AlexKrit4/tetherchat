import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Compass, MessageSquare, Plus, Settings } from 'lucide-react';
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
import { TetherLogo } from '@/components/brand/TetherLogo';
/**
 * Root of the mobile stack. Servers are a full-width list with names, not a
 * narrow icon rail — 72px of icons is a desktop affordance.
 */
export function MobileServersView() {
    const navigate = useNavigate();
    const { data: servers, isLoading } = useServers();
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    return (_jsxs("div", { className: "flex h-full flex-col bg-base-tertiary", children: [_jsx(MobileHeader, { title: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(TetherLogo, { className: "h-5 w-5 text-brand" }), "TetherChat"] }), actions: _jsx(IconButton, { icon: Settings, label: "Settings", size: "lg", showTooltip: false, onClick: () => pushMobileView('settings') }) }), _jsxs("div", { className: "scroller flex-1 pb-safe", children: [_jsxs("button", { type: "button", onClick: () => {
                            navigate(`/channels/${DM_ROUTE}`);
                            pushMobileView('dms');
                        }, className: "flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-hover", children: [_jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white", children: _jsx(MessageSquare, { size: 20, "aria-hidden": true }) }), _jsx("span", { className: "flex-1 text-base font-medium text-text-heading", children: "Direct Messages" }), _jsx(ChevronRight, { size: 18, className: "text-text-muted", "aria-hidden": true })] }), _jsx("div", { className: "mx-4 my-1 h-px bg-divider", "aria-hidden": true }), isLoading ? (_jsx(SidebarSkeleton, {})) : (_jsx("ul", { children: servers?.map((server) => (_jsx("li", { children: _jsx(ServerRow, { server: server, onOpen: () => {
                                    navigate(`/channels/${server.id}`);
                                    pushMobileView('channels');
                                } }) }, server.id))) })), _jsx("div", { className: "mx-4 my-1 h-px bg-divider", "aria-hidden": true }), _jsx(ActionRow, { icon: Plus, label: "Add a Server", onSelect: () => setCreateOpen(true) }), _jsx(ActionRow, { icon: Compass, label: "Join with an Invite", onSelect: () => setJoinOpen(true) })] }), _jsx(CreateServerDialog, { open: createOpen, onClose: () => setCreateOpen(false) }), _jsx(JoinServerDialog, { open: joinOpen, onClose: () => setJoinOpen(false) })] }));
}
function ServerRow({ server, onOpen }) {
    const readStates = useReadStateIndex();
    const channelIndex = useServerChannelIndex();
    const channelIds = useMemo(() => channelIndex[server.id] ?? [], [channelIndex, server.id]);
    const unread = readStates.serverHasUnread(channelIds);
    const mentions = readStates.serverMentionCount(channelIds);
    return (_jsxs("button", { type: "button", onClick: onOpen, className: "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-hover", children: [_jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-base-secondary text-base font-semibold text-text", children: server.iconUrl ? (_jsx("img", { src: server.iconUrl, alt: "", className: "h-full w-full object-cover", loading: "lazy" })) : (serverInitials(server.name)) }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("span", { className: cn('truncate text-base', unread ? 'font-semibold text-text-heading' : 'font-medium text-text'), children: server.name }), _jsxs("span", { className: "truncate text-xs text-text-muted", children: [server.memberCount, " members"] })] }), _jsx(MentionBadge, { count: mentions }), _jsx(ChevronRight, { size: 18, className: "shrink-0 text-text-muted", "aria-hidden": true })] }));
}
function ActionRow({ icon: Icon, label, onSelect, }) {
    return (_jsxs("button", { type: "button", onClick: onSelect, className: "flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-hover", children: [_jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-base-secondary text-success", children: _jsx(Icon, { size: 20, "aria-hidden": true }) }), _jsx("span", { className: "text-base font-medium text-success", children: label })] }));
}
//# sourceMappingURL=MobileServersView.js.map