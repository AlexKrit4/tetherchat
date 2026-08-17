import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Mic, MicOff, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { UserSettingsDialog } from '@/components/modals/UserSettingsDialog';
import { StatusMenu } from '@/components/modals/StatusMenu';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/uiStore';
/**
 * Fixed strip at the bottom of the channel sidebar: avatar, name, and the
 * quick-settings buttons. Clicking the name area opens the status menu.
 */
export function UserPanel({ className }) {
    const user = useAuthStore((state) => state.user);
    const isMobile = useIsMobile();
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [muted, setMuted] = useState(false);
    if (!user)
        return null;
    return (_jsxs("div", { className: cn('flex shrink-0 items-center gap-1 bg-[#232428] px-2 py-1.5', className), children: [_jsxs("button", { type: "button", onClick: () => setStatusOpen(true), className: "flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded px-1 text-left transition-colors hover:bg-surface-hover md:min-h-0 md:py-1", children: [_jsx(Avatar, { user: user, size: 32, showStatus: true, ringColor: "#232428" }), _jsxs("span", { className: "flex min-w-0 flex-col", children: [_jsx("span", { className: "truncate text-sm font-semibold text-text-heading", children: user.displayName ?? user.username }), _jsx("span", { className: "truncate text-xs text-text-muted", children: user.customStatus ?? `@${user.username}` })] })] }), _jsx(IconButton, { icon: muted ? MicOff : Mic, label: muted ? 'Unmute notifications' : 'Mute notifications', size: isMobile ? 'lg' : 'md', onClick: () => setMuted((current) => !current), active: muted, tone: muted ? 'danger' : 'default' }), _jsx(IconButton, { icon: Settings, label: "User settings", size: isMobile ? 'lg' : 'md', onClick: () => (isMobile ? pushMobileView('settings') : setSettingsOpen(true)) }), _jsx(StatusMenu, { open: statusOpen, onClose: () => setStatusOpen(false) }), _jsx(UserSettingsDialog, { open: settingsOpen, onClose: () => setSettingsOpen(false) })] }));
}
//# sourceMappingURL=UserPanel.js.map