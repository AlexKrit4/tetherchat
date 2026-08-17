import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMembers } from '@/hooks/useServers';
import { Avatar } from '@/components/ui/Avatar';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { UserProfileDialog } from '@/components/modals/UserProfileDialog';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';
/**
 * Members grouped exactly like Discord: one section per hoisted role (highest
 * first, online members only), then a single Offline section at the bottom.
 */
function buildSections(members, roles, liveStatuses) {
    const statusOf = (member) => liveStatuses[member.userId] ?? member.user.status;
    const online = members.filter((member) => statusOf(member) !== 'offline');
    const offline = members.filter((member) => statusOf(member) === 'offline');
    const hoisted = [...roles]
        .filter((role) => role.hoist && !role.isDefault)
        .sort((a, b) => b.position - a.position);
    const byName = (a, b) => (a.nickname ?? a.user.displayName ?? a.user.username).localeCompare(b.nickname ?? b.user.displayName ?? b.user.username);
    const sections = [];
    const assigned = new Set();
    for (const role of hoisted) {
        const group = online.filter((member) => !assigned.has(member.userId) && member.roleIds.includes(role.id));
        if (group.length === 0)
            continue;
        for (const member of group)
            assigned.add(member.userId);
        sections.push({ key: role.id, label: role.name, members: group.sort(byName) });
    }
    const remaining = online.filter((member) => !assigned.has(member.userId));
    if (remaining.length > 0) {
        sections.push({ key: 'online', label: 'Online', members: remaining.sort(byName) });
    }
    if (offline.length > 0) {
        sections.push({ key: 'offline', label: 'Offline', members: offline.sort(byName) });
    }
    return sections;
}
export function MemberList({ className, compact = true }) {
    const { server, serverId, isDm, conversation } = useChatTarget();
    const { data: members, isLoading } = useMembers(serverId);
    const liveStatuses = usePresenceStore((state) => state.statuses);
    const currentUserId = useAuthStore((state) => state.user?.id);
    const [profileFor, setProfileFor] = useState(null);
    const sections = useMemo(() => buildSections(members ?? [], server?.roles ?? [], liveStatuses), [liveStatuses, members, server?.roles]);
    const roleColorOf = useMemo(() => {
        const colours = new Map();
        const byPosition = [...(server?.roles ?? [])].sort((a, b) => b.position - a.position);
        for (const member of members ?? []) {
            const role = byPosition.find((entry) => entry.color && !entry.isDefault && member.roleIds.includes(entry.id));
            if (role?.color)
                colours.set(member.userId, role.color);
        }
        return colours;
    }, [members, server?.roles]);
    if (isDm) {
        return (_jsxs("aside", { className: cn('flex flex-col bg-base-secondary', className), children: [_jsxs("div", { className: "scroller flex-1 px-2 py-4", children: [_jsx("p", { className: "px-2 pb-2 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted", children: conversation?.isGroup ? `Members — ${conversation.members.length}` : 'Conversation' }), _jsx("ul", { className: "flex flex-col gap-0.5", children: conversation?.members.map((member) => (_jsx("li", { children: _jsx(MemberRow, { user: member, label: member.displayName ?? member.username, hint: member.customStatus, colour: null, isOwner: false, compact: compact, onOpen: () => setProfileFor(member.id) }) }, member.id))) })] }), profileFor ? (_jsx(UserProfileDialog, { userId: profileFor, open: true, onClose: () => setProfileFor(null) })) : null] }));
    }
    return (_jsxs("aside", { "aria-label": "Members", className: cn('flex flex-col bg-base-secondary', className), children: [_jsx("div", { className: "scroller scroller-hover flex-1 px-2 py-4", children: isLoading ? (_jsx(SidebarSkeleton, {})) : (sections.map((section) => (_jsxs("section", { className: "mb-4 last:mb-0", children: [_jsxs("h3", { className: "px-2 pb-1.5 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted", children: [section.label, " \u2014 ", section.members.length] }), _jsx("ul", { className: "flex flex-col gap-0.5", children: section.members.map((member) => (_jsx("li", { children: _jsx(MemberRow, { user: member.user, label: member.nickname ?? member.user.displayName ?? member.user.username, hint: member.user.customStatus, colour: roleColorOf.get(member.userId) ?? null, isOwner: member.userId === server?.ownerId, dimmed: section.key === 'offline', isSelf: member.userId === currentUserId, compact: compact, onOpen: () => setProfileFor(member.userId) }) }, member.userId))) })] }, section.key)))) }), profileFor ? (_jsx(UserProfileDialog, { userId: profileFor, open: true, onClose: () => setProfileFor(null) })) : null] }));
}
function MemberRow({ user, label, hint, colour, isOwner, compact, dimmed, isSelf, onOpen, }) {
    return (_jsxs("button", { type: "button", onClick: onOpen, className: cn('flex w-full items-center gap-3 rounded px-2 text-left transition-colors', compact ? 'min-h-11 md:min-h-[42px]' : 'min-h-12', 'hover:bg-surface-hover', dimmed && 'opacity-40 hover:opacity-100'), children: [_jsx(Avatar, { user: user, size: 32, showStatus: true, ringColor: "var(--bg-secondary)" }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "truncate text-base font-medium", style: { color: colour ?? 'var(--text-normal)' }, children: label }), isSelf ? _jsx("span", { className: "shrink-0 text-2xs text-text-faint", children: "(you)" }) : null, isOwner ? (_jsx(Crown, { size: 13, className: "shrink-0 text-warning", "aria-label": "Server owner" })) : null] }), hint ? _jsx("span", { className: "truncate text-xs text-text-muted", children: hint }) : null] })] }));
}
//# sourceMappingURL=MemberList.js.map