import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
const DRAG_CLOSE_PX = 96;
const DRAG_CLOSE_VELOCITY = 500;
/**
 * The mobile counterpart of a modal: slides up from the bottom, respects the home
 * indicator inset, and can be dismissed by dragging the handle down.
 */
export function BottomSheet({ open, onClose, title, children, full, className }) {
    const [mounted, setMounted] = useState(false);
    const sheetRef = useRef(null);
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
    return createPortal(_jsx(AnimatePresence, { children: open ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-end justify-center", role: "dialog", "aria-modal": "true", children: [_jsx(motion.button, { type: "button", "aria-label": "Close", className: "absolute inset-0 bg-base-overlay", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, onClick: onClose }), _jsxs(motion.div, { ref: sheetRef, className: cn('relative z-10 w-full rounded-t-2xl bg-base pb-safe shadow-sheet', full ? 'h-[90dvh]' : 'max-h-[90dvh]', className), initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', damping: 32, stiffness: 340 }, drag: "y", dragConstraints: { top: 0, bottom: 0 }, dragElastic: { top: 0, bottom: 0.4 }, onDragEnd: (_event, info) => {
                        if (info.offset.y > DRAG_CLOSE_PX || info.velocity.y > DRAG_CLOSE_VELOCITY)
                            onClose();
                    }, children: [_jsx("div", { className: "flex justify-center pt-2.5", "aria-hidden": true, children: _jsx("span", { className: "h-1 w-9 rounded-sm bg-[#4e5058]" }) }), title ? (_jsx("h2", { className: "px-4 pb-1 pt-3 text-base font-semibold text-text-heading", children: title })) : null, _jsx("div", { className: cn('scroller px-1 pb-2', full ? 'h-[calc(90dvh-56px)]' : 'max-h-[78dvh]'), children: children })] })] })) : null }), document.body);
}
/** 48px rows keep every sheet action inside the comfortable touch range. */
export function SheetAction({ icon, label, hint, onSelect, tone = 'default', disabled }) {
    return (_jsxs("button", { type: "button", disabled: disabled, onClick: onSelect, className: cn('flex min-h-12 w-full items-center gap-3 rounded px-3 text-left text-base', 'active:bg-surface-hover disabled:opacity-40', tone === 'danger' ? 'text-danger' : 'text-text'), children: [icon ? _jsx("span", { className: "flex h-6 w-6 items-center justify-center text-text-muted", children: icon }) : null, _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("span", { className: "truncate", children: label }), hint ? _jsx("span", { className: "truncate text-xs text-text-muted", children: hint }) : null] })] }));
}
//# sourceMappingURL=BottomSheet.js.map