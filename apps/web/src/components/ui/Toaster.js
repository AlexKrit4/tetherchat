import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
const icons = {
    info: Info,
    success: CheckCircle2,
    error: AlertTriangle,
};
const tones = {
    info: 'text-text-subheading',
    success: 'text-success',
    error: 'text-danger',
};
/** Bottom-centre on phones so it clears the composer, bottom-right on desktop. */
export function Toaster() {
    const toasts = useToastStore((state) => state.toasts);
    const dismiss = useToastStore((state) => state.dismiss);
    return (_jsx("div", { className: cn('pointer-events-none fixed z-[95] flex flex-col gap-2', 'bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-4 right-4', 'md:left-auto md:right-6 md:w-[380px]'), children: _jsx(AnimatePresence, { initial: false, children: toasts.map((toast) => {
                const Icon = icons[toast.kind];
                return (_jsxs(motion.div, { layout: true, initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 }, transition: { duration: 0.18 }, role: "status", className: "pointer-events-auto flex items-start gap-3 rounded-lg bg-base-floating px-3 py-3 shadow-floating", children: [_jsx(Icon, { size: 18, className: cn('mt-0.5 shrink-0', tones[toast.kind]), "aria-hidden": true }), _jsx("p", { className: "min-w-0 flex-1 text-base text-text", children: toast.message }), _jsx("button", { type: "button", "aria-label": "Dismiss", onClick: () => dismiss(toast.id), className: "shrink-0 text-text-muted transition-colors hover:text-text-heading", children: _jsx(X, { size: 16, "aria-hidden": true }) })] }, toast.id));
            }) }) }));
}
//# sourceMappingURL=Toaster.js.map