import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Bell, ChevronRight, LogOut, Palette, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MobileHeader } from './MobileHeader';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
/** Full-screen settings with a second level, instead of a desktop modal. */
export function MobileSettingsView() {
    const popMobileView = useUiStore((state) => state.popMobileView);
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const [section, setSection] = useState('root');
    if (section !== 'root') {
        return (_jsxs("div", { className: "flex h-full flex-col bg-base", children: [_jsx(MobileHeader, { title: titles[section], onBack: () => setSection('root') }), _jsxs("div", { className: "scroller flex-1 px-4 pb-safe pt-3", children: [section === 'profile' ? _jsx(ProfileSettings, {}) : null, section === 'account' ? _jsx(AccountSettings, {}) : null, section === 'notifications' ? _jsx(NotificationSettings, {}) : null, section === 'appearance' ? _jsx(AppearanceSettings, {}) : null] })] }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col bg-base", children: [_jsx(MobileHeader, { title: "User Settings", onBack: popMobileView }), _jsxs("div", { className: "scroller flex-1 pb-safe", children: [user ? (_jsxs("div", { className: "flex items-center gap-3 px-4 py-4", children: [_jsx(Avatar, { user: user, size: 56, showStatus: true }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-lg font-semibold text-text-heading", children: user.displayName ?? user.username }), _jsxs("p", { className: "truncate text-sm text-text-muted", children: ["@", user.username] })] })] })) : null, _jsxs(SettingsGroup, { label: "My Account", children: [_jsx(SettingsRow, { icon: User, label: "Edit Profile", onSelect: () => setSection('profile') }), _jsx(SettingsRow, { icon: ShieldCheck, label: "Account & Security", onSelect: () => setSection('account') })] }), _jsxs(SettingsGroup, { label: "App Settings", children: [_jsx(SettingsRow, { icon: Bell, label: "Notifications", onSelect: () => setSection('notifications') }), _jsx(SettingsRow, { icon: Palette, label: "Appearance", onSelect: () => setSection('appearance') })] }), _jsx("div", { className: "px-4 py-6", children: _jsxs(Button, { variant: "danger", fullWidth: true, size: "lg", onClick: () => void logout(), className: "justify-center", children: [_jsx(LogOut, { size: 18, "aria-hidden": true }), "Log Out"] }) })] })] }));
}
const titles = {
    profile: 'Edit Profile',
    account: 'Account & Security',
    notifications: 'Notifications',
    appearance: 'Appearance',
};
function SettingsGroup({ label, children }) {
    return (_jsxs("section", { className: "mt-4", children: [_jsx("h2", { className: "px-4 pb-1 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted", children: label }), _jsx("div", { children: children })] }));
}
function SettingsRow({ icon: Icon, label, onSelect, tone = 'default', }) {
    return (_jsxs("button", { type: "button", onClick: onSelect, className: cn('flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-surface-hover', tone === 'danger' ? 'text-danger' : 'text-text'), children: [_jsx(Icon, { size: 20, className: "shrink-0 text-text-muted", "aria-hidden": true }), _jsx("span", { className: "flex-1 text-base", children: label }), _jsx(ChevronRight, { size: 18, className: "shrink-0 text-text-muted", "aria-hidden": true })] }));
}
//# sourceMappingURL=MobileSettingsView.js.map