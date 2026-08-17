import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { LogOut, Moon, MinusCircle, EyeOff, Circle } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
const options = [
    { status: 'online', label: 'Online', icon: Circle, colour: 'var(--green)' },
    { status: 'idle', label: 'Idle', icon: Moon, colour: 'var(--yellow)' },
    {
        status: 'dnd',
        label: 'Do Not Disturb',
        hint: 'No desktop notifications',
        icon: MinusCircle,
        colour: 'var(--red)',
    },
    {
        status: 'invisible',
        label: 'Invisible',
        hint: 'You appear offline but stay connected',
        icon: EyeOff,
        colour: 'var(--grey)',
    },
];
export function StatusMenu({ open, onClose }) {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const logout = useAuthStore((state) => state.logout);
    const save = useMutation({
        mutationFn: (status) => api.patch('/api/users/@me', { status }),
        onSuccess: (updated) => {
            setUser(updated);
            const socket = getSocket();
            if (socket.connected)
                socket.emit('presence:update', { status: updated.status });
        },
    });
    if (!user)
        return null;
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, width: "sm", children: _jsxs("div", { className: "flex flex-col", children: [_jsxs("div", { className: "flex items-center gap-3 pb-3", children: [_jsx(Avatar, { user: user, size: 48, showStatus: true }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-base font-semibold text-text-heading", children: user.displayName ?? user.username }), _jsxs("p", { className: "truncate text-sm text-text-muted", children: ["@", user.username] })] })] }), _jsx("div", { className: "h-px bg-divider" }), _jsx("ul", { className: "py-1", children: options.map((option) => {
                        const active = user.status === option.status;
                        const Icon = option.icon;
                        return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => {
                                    save.mutate(option.status);
                                    onClose();
                                }, className: cn('flex min-h-12 w-full items-center gap-3 rounded px-2 text-left md:min-h-10', active ? 'bg-surface-selected' : 'hover:bg-surface-hover'), children: [_jsx(Icon, { size: 16, "aria-hidden": true, className: "shrink-0", style: { color: option.colour }, fill: option.status === 'online' ? option.colour : 'none' }), _jsxs("span", { className: "flex min-w-0 flex-col", children: [_jsx("span", { className: "truncate text-base text-text-heading", children: option.label }), option.hint ? (_jsx("span", { className: "truncate text-xs text-text-muted", children: option.hint })) : null] })] }) }, option.status));
                    }) }), _jsx("div", { className: "h-px bg-divider" }), _jsxs("button", { type: "button", onClick: () => void logout(), className: "flex min-h-12 items-center gap-3 rounded px-2 text-left text-danger hover:bg-surface-hover md:min-h-10", children: [_jsx(LogOut, { size: 16, "aria-hidden": true }), "Log out"] })] }) }));
}
//# sourceMappingURL=StatusMenu.js.map