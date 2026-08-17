import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { disablePush, enablePush, pushState } from '@/lib/push';
import { toast } from '@/stores/toastStore';
/** Web push opt-in plus the local desktop-notification toggle. */
export function NotificationSettings() {
    const [state, setState] = useState(() => pushState());
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const next = pushState();
            if (!cancelled)
                setState(next);
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    const toggle = async (enabled) => {
        setBusy(true);
        try {
            if (enabled) {
                const result = await enablePush();
                if (result === 'denied') {
                    toast.error('Notifications are blocked in your browser settings');
                }
                else if (result === 'unsupported') {
                    toast.error('This browser cannot receive push notifications');
                }
                else {
                    toast.success('Push notifications enabled');
                }
            }
            else {
                await disablePush();
                toast.info('Push notifications disabled');
            }
            setState(pushState());
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-base-secondary p-4", children: [state.subscribed ? (_jsx(Bell, { size: 20, className: "mt-0.5 shrink-0 text-success", "aria-hidden": true })) : (_jsx(BellOff, { size: 20, className: "mt-0.5 shrink-0 text-text-muted", "aria-hidden": true })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Push notifications" }), _jsxs("p", { className: "mt-1 text-sm text-text-muted", children: ["Get notified about mentions and direct messages even when TetherChat is closed.", state.supported ? '' : ' Not supported in this browser.'] })] }), _jsx(Toggle, { checked: state.subscribed, disabled: !state.supported || busy, label: "Push notifications", onChange: (next) => void toggle(next) })] }), state.permission === 'denied' ? (_jsx("p", { className: "text-sm text-danger", children: "Notifications are blocked for this site. Allow them in your browser settings, then try again." })) : null, _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Per-channel settings" }), _jsx("p", { className: "text-sm text-text-muted", children: "Mute a single channel from its context menu in the channel list." }), _jsx(Button, { variant: "secondary", disabled: true, children: "Managed per channel" })] })] }));
}
//# sourceMappingURL=NotificationSettings.js.map