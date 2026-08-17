import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
/**
 * The service worker waits for consent before taking over, so an update never
 * reloads the page while someone is typing.
 */
export function UpdatePrompt() {
    const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker, } = useRegisterSW({
        onRegisterError: (error) => console.warn('[pwa] registration failed', error),
    });
    if (!needRefresh)
        return null;
    return (_jsxs("div", { className: "fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-[96] flex items-center gap-3 rounded-lg bg-base-floating p-3 shadow-floating md:left-auto md:right-6 md:w-[360px]", children: [_jsx(Download, { size: 18, className: "shrink-0 text-brand", "aria-hidden": true }), _jsx("p", { className: "min-w-0 flex-1 text-base text-text", children: "A new version of TetherChat is ready." }), _jsx(Button, { size: "sm", onClick: () => void updateServiceWorker(true), children: "Reload" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setNeedRefresh(false), children: "Later" })] }));
}
//# sourceMappingURL=UpdatePrompt.js.map