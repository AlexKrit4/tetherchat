import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Compass, Plus } from 'lucide-react';
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
/**
 * The 72px column of round server icons. The active server is marked by a white
 * pill on the left edge, and hovering morphs the icon from a squircle to a circle.
 */
export function ServerRail() {
    const navigate = useNavigate();
    const { serverId } = useParams();
    const { data: servers } = useServers();
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    return (_jsxs("nav", { "aria-label": "Servers", className: "flex h-full w-rail shrink-0 flex-col items-center gap-2 bg-base-tertiary pt-3", children: [_jsx(RailButton, { label: "Direct Messages", active: serverId === DM_ROUTE, onClick: () => navigate(`/channels/${DM_ROUTE}`), children: _jsx(TetherLogo, { className: "h-7 w-7" }) }), _jsx("div", { className: "h-px w-8 shrink-0 bg-[#35363c]", "aria-hidden": true }), _jsxs("div", { className: "scroller scroller-hover flex w-full flex-1 flex-col items-center gap-2 pb-2", children: [servers?.map((server) => (_jsx(ServerIcon, { server: server, active: server.id === serverId }, server.id))), _jsx(RailButton, { label: "Add a Server", onClick: () => setCreateOpen(true), tone: "accent", children: _jsx(Plus, { size: 24, strokeWidth: 2, "aria-hidden": true }) }), _jsx(RailButton, { label: "Join a Server", onClick: () => setJoinOpen(true), tone: "accent", children: _jsx(Compass, { size: 22, strokeWidth: 2, "aria-hidden": true }) })] }), _jsx(CreateServerDialog, { open: createOpen, onClose: () => setCreateOpen(false) }), _jsx(JoinServerDialog, { open: joinOpen, onClose: () => setJoinOpen(false) })] }));
}
function ServerIcon({ server, active }) {
    const navigate = useNavigate();
    const readStates = useReadStateIndex();
    const channelIndex = useServerChannelIndex();
    const channelIds = useMemo(() => channelIndex[server.id] ?? [], [channelIndex, server.id]);
    const unread = readStates.serverHasUnread(channelIds);
    const mentions = readStates.serverMentionCount(channelIds);
    return (_jsx(RailButton, { label: server.name, active: active, unread: unread, mentions: mentions, onClick: () => navigate(`/channels/${server.id}`), children: server.iconUrl ? (_jsx("img", { src: server.iconUrl, alt: "", className: "h-full w-full object-cover", loading: "lazy", decoding: "async" })) : (_jsx("span", { className: "text-base font-semibold", children: serverInitials(server.name) })) }));
}
function RailButton({ label, children, onClick, active, unread, mentions = 0, tone = 'default', }) {
    const pillHeight = active ? 40 : unread ? 8 : 0;
    return (_jsxs("div", { className: "relative flex w-full items-center justify-center", children: [_jsx("span", { "aria-hidden": true, className: "absolute left-0 rounded-r bg-text-heading transition-all duration-150", style: { width: 4, height: pillHeight, opacity: pillHeight ? 1 : 0 } }), _jsx(Tooltip, { content: label, placement: "right", children: _jsx("button", { type: "button", "aria-label": label, "aria-current": active ? 'page' : undefined, onClick: onClick, className: cn('group relative flex h-12 w-12 items-center justify-center overflow-hidden', 'transition-[border-radius,background-color] duration-150 ease-out', active ? 'rounded-2xl' : 'rounded-3xl hover:rounded-2xl', tone === 'accent'
                        ? 'bg-base-secondary text-success hover:bg-success hover:text-white'
                        : active
                            ? 'bg-brand text-white'
                            : 'bg-base-secondary text-text hover:bg-brand hover:text-white'), children: children }) }), mentions > 0 ? (_jsx(MentionBadge, { count: mentions, className: "pointer-events-none absolute bottom-0 right-2 ring-2 ring-base-tertiary" })) : null] }));
}
export function serverInitials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
}
//# sourceMappingURL=ServerRail.js.map