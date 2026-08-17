import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from './BottomSheet';
import { Modal } from './Modal';
/**
 * One dialog component for both layouts: a centred modal with a pointer, a
 * bottom sheet on touch. Every call site stays layout-agnostic.
 */
export function AdaptiveDialog({ open, onClose, title, description, children, footer, width, }) {
    const isMobile = useIsMobile();
    if (isMobile) {
        return (_jsx(BottomSheet, { open: open, onClose: onClose, title: title, children: _jsxs("div", { className: "px-3 pb-3", children: [description ? _jsx("p", { className: "mb-3 text-base text-text-muted", children: description }) : null, children, footer ? _jsx("div", { className: "mt-4 flex flex-col-reverse gap-2", children: footer }) : null] }) }));
    }
    return (_jsx(Modal, { open: open, onClose: onClose, title: title, description: description, footer: footer, width: width, children: children }));
}
//# sourceMappingURL=AdaptiveDialog.js.map