import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { useAuthStore } from '@/stores/authStore';
const tabs = [
    { id: 'profile', label: 'My Profile' },
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'appearance', label: 'Appearance' },
];
/** Desktop settings modal. Mobile uses the full-screen MobileSettingsView instead. */
export function UserSettingsDialog({ open, onClose }) {
    const [tab, setTab] = useState('profile');
    const logout = useAuthStore((state) => state.logout);
    return (_jsx(Modal, { open: open, onClose: onClose, title: "User Settings", width: "lg", children: _jsxs("div", { className: "flex gap-6", children: [_jsxs("nav", { className: "flex w-[180px] shrink-0 flex-col gap-0.5", "aria-label": "Settings sections", children: [tabs.map((entry) => (_jsx("button", { type: "button", onClick: () => setTab(entry.id), className: cn('min-h-9 rounded px-2 text-left text-base transition-colors', tab === entry.id
                                ? 'bg-surface-selected text-text-heading'
                                : 'text-text-muted hover:bg-surface-hover hover:text-text'), children: entry.label }, entry.id))), _jsx("div", { className: "my-2 h-px bg-divider" }), _jsxs(Button, { variant: "ghost", className: "justify-start text-danger", onClick: () => void logout(), children: [_jsx(LogOut, { size: 16, "aria-hidden": true }), "Log out"] })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [tab === 'profile' ? _jsx(ProfileSettings, {}) : null, tab === 'account' ? _jsx(AccountSettings, {}) : null, tab === 'notifications' ? _jsx(NotificationSettings, {}) : null, tab === 'appearance' ? _jsx(AppearanceSettings, {}) : null] })] }) }));
}
//# sourceMappingURL=UserSettingsDialog.js.map