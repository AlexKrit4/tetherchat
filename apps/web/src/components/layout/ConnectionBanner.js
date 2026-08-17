import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
/**
 * Thin strip pinned to the top while the socket is down. Messages still send over
 * REST in that state, so the wording says "reconnecting", not "offline".
 */
export function ConnectionBanner({ state }) {
    const visible = state === 'reconnecting' || state === 'offline';
    return (_jsx(AnimatePresence, { children: visible ? (_jsxs(motion.div, { role: "status", initial: { y: -32, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -32, opacity: 0 }, transition: { duration: 0.18 }, className: "fixed inset-x-0 top-0 z-[99] flex items-center justify-center gap-2 bg-warning px-3 py-1 pt-safe text-sm font-medium text-[#1e1f22]", children: [_jsx(WifiOff, { size: 14, "aria-hidden": true }), state === 'offline'
                    ? 'Connection lost — retrying'
                    : 'Reconnecting to TetherChat…'] })) : null }));
}
//# sourceMappingURL=ConnectionBanner.js.map