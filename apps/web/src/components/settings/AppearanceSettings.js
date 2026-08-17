import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Toggle } from '@/components/ui/Toggle';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
export function AppearanceSettings() {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const isMobile = useIsMobile();
    const save = useMutation({
        mutationFn: (input) => api.patch('/api/users/@me', input),
        onSuccess: (updated) => setUser(updated),
    });
    if (!user)
        return null;
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { className: "rounded-lg bg-base-secondary p-4", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Theme" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "TetherChat ships with a single dark theme. Colours come from CSS variables, so a light theme can be added without touching components." }), _jsx("div", { className: "mt-3 flex gap-2", children: _jsxs("span", { className: "flex items-center gap-2 rounded bg-base-tertiary px-3 py-2 text-base text-text-heading ring-2 ring-brand", children: [_jsx("span", { className: "h-4 w-4 rounded-full bg-base", "aria-hidden": true }), "Dark"] }) })] }), _jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-base-secondary p-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Enter sends the message" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: isMobile
                                    ? 'On phones the send button is always shown and Enter inserts a newline.'
                                    : 'Turn this off to require the send button and use Enter for newlines.' })] }), _jsx(Toggle, { label: "Enter sends the message", checked: user.enterToSend, disabled: isMobile, onChange: (next) => save.mutate({ enterToSend: next }) })] })] }));
}
//# sourceMappingURL=AppearanceSettings.js.map