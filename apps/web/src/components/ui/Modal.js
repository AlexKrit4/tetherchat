import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
const widths = {
    sm: 'max-w-[440px]',
    md: 'max-w-[520px]',
    lg: 'max-w-[720px]',
};
export function Modal({ open, onClose, title, description, children, footer, width = 'sm', className, }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, open]);
    if (!mounted)
        return null;
    return createPortal(_jsx(AnimatePresence, { children: open ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx(motion.button, { type: "button", "aria-label": "Close", className: "absolute inset-0 bg-base-overlay", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, onClick: onClose }), _jsxs(motion.div, { role: "dialog", "aria-modal": "true", "aria-label": typeof title === 'string' ? title : undefined, className: cn('relative z-10 flex w-full flex-col overflow-hidden rounded-lg bg-base shadow-floating', widths[width], className), initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 0.15, ease: 'easeOut' }, children: [title ? (_jsxs("header", { className: "flex items-start justify-between gap-3 px-4 pb-2 pt-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "text-xl font-bold text-text-heading", children: title }), description ? (_jsx("p", { className: "mt-1 text-base text-text-muted", children: description })) : null] }), _jsx(IconButton, { icon: X, label: "Close", onClick: onClose, showTooltip: false })] })) : null, _jsx("div", { className: "scroller max-h-[70vh] px-4 py-3", children: children }), footer ? (_jsx("footer", { className: "flex items-center justify-end gap-2 bg-base-secondary px-4 py-4", children: footer })) : null] })] })) : null }), document.body);
}
//# sourceMappingURL=Modal.js.map