import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft, AtSign, Bell, Hash, Pin, Search, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
/**
 * 48px bar above the message list. On mobile the leading slot becomes a back
 * button, and every action is a 44px touch target.
 */
export function ChatHeader() {
    const isMobile = useIsMobile();
    const { title, topic, isDm, conversation } = useChatTarget();
    const currentUserId = useAuthStore((state) => state.user?.id);
    const membersOpen = useUiStore((state) => state.membersOpen);
    const toggleMembers = useUiStore((state) => state.toggleMembers);
    const setPinsOpen = useUiStore((state) => state.setPinsOpen);
    const setSearchOpen = useUiStore((state) => state.setSearchOpen);
    const popMobileView = useUiStore((state) => state.popMobileView);
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const dmPeer = conversation?.members.find((member) => member.id !== currentUserId);
    return (_jsxs("header", { className: cn('flex h-header shrink-0 items-center gap-1 bg-base px-2 shadow-elevated md:px-4'), children: [isMobile ? (_jsx(IconButton, { icon: ArrowLeft, label: "Back", size: "lg", showTooltip: false, onClick: popMobileView, className: "-ml-1" })) : null, _jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2", children: [isDm ? (dmPeer ? (_jsx(Avatar, { user: dmPeer, size: 24, showStatus: true })) : (_jsx(AtSign, { size: 20, className: "shrink-0 text-text-faint", "aria-hidden": true }))) : (_jsx(Hash, { size: 22, strokeWidth: 2, className: "shrink-0 text-text-faint", "aria-hidden": true })), _jsx("h1", { className: "truncate text-lg font-semibold text-text-heading", children: title || '…' }), topic ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "hidden h-6 w-px shrink-0 bg-divider lg:block", "aria-hidden": true }), _jsx("p", { className: "hidden min-w-0 truncate text-sm text-text-muted lg:block", children: topic })] })) : null] }), _jsxs("div", { className: "flex shrink-0 items-center gap-0.5", children: [!isDm ? (_jsx(IconButton, { icon: Bell, label: "Notification settings", size: isMobile ? 'lg' : 'md', className: "hidden md:inline-flex" })) : null, _jsx(IconButton, { icon: Pin, label: "Pinned messages", size: isMobile ? 'lg' : 'md', onClick: () => setPinsOpen(true) }), _jsx(IconButton, { icon: Users, label: membersOpen ? 'Hide member list' : 'Show member list', size: isMobile ? 'lg' : 'md', active: membersOpen, onClick: () => (isMobile ? pushMobileView('members') : toggleMembers()) }), _jsx(IconButton, { icon: Search, label: "Search", size: isMobile ? 'lg' : 'md', onClick: () => (isMobile ? pushMobileView('search') : setSearchOpen(true)) })] })] }));
}
//# sourceMappingURL=ChatHeader.js.map