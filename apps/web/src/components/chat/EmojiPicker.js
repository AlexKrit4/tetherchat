import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Spinner } from '@/components/ui/Spinner';
// emoji-mart's dataset is large; keep it out of the initial bundle.
const Picker = lazy(async () => {
    const [{ default: Component }, { default: data }] = await Promise.all([
        import('@emoji-mart/react'),
        import('@emoji-mart/data'),
    ]);
    return {
        default: ({ onSelect }) => (_jsx(Component, { data: data, theme: "dark", previewPosition: "none", skinTonePosition: "search", onEmojiSelect: (emoji) => {
                if (emoji.native)
                    onSelect(emoji.native);
            } })),
    };
});
/**
 * A bottom sheet on touch and a floating panel on desktop — the same picker in
 * both cases, only the container changes.
 */
export function EmojiPicker({ open, onClose, onSelect }) {
    const isMobile = useIsMobile();
    const picker = (_jsx(Suspense, { fallback: _jsx("div", { className: "flex h-[320px] items-center justify-center", children: _jsx(Spinner, {}) }), children: _jsx(Picker, { onSelect: (emoji) => {
                onSelect(emoji);
                onClose();
            } }) }));
    if (isMobile) {
        return (_jsx(BottomSheet, { open: open, onClose: onClose, title: "Reactions", children: _jsx("div", { className: "flex justify-center px-2 pb-2", children: picker }) }));
    }
    if (!open)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", "aria-label": "Close emoji picker", className: "fixed inset-0 z-40 cursor-default", onClick: onClose }), _jsx("div", { className: "absolute bottom-full right-0 z-50 mb-2 overflow-hidden rounded-lg shadow-floating", children: picker })] }));
}
//# sourceMappingURL=EmojiPicker.js.map