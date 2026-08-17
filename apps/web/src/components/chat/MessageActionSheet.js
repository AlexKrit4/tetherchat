import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Copy, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { BottomSheet, SheetAction } from '@/components/ui/BottomSheet';
import { toast } from '@/stores/toastStore';
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🔥'];
/**
 * Mobile message menu. Opens on long-press and leads with a quick reaction row,
 * which is the fastest interaction on a phone.
 */
export function MessageActionSheet({ message, onClose, canEdit, canDelete, canPin, onReply, onEdit, onDelete, onTogglePin, onReact, onOpenEmojiPicker, }) {
    const run = (action) => {
        action();
        onClose();
    };
    return (_jsx(BottomSheet, { open: Boolean(message), onClose: onClose, children: message ? (_jsxs("div", { className: "pb-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-1 px-3 pb-3 pt-1", children: [QUICK_REACTIONS.map((emoji) => (_jsx("button", { type: "button", "aria-label": `React with ${emoji}`, onClick: () => run(() => onReact(message, emoji)), className: "flex h-touch w-touch items-center justify-center rounded-full bg-base-secondary text-xl active:bg-surface-hover", children: emoji }, emoji))), _jsx("button", { type: "button", "aria-label": "More reactions", onClick: () => run(() => onOpenEmojiPicker(message)), className: "flex h-touch w-touch items-center justify-center rounded-full bg-base-secondary text-text-muted active:bg-surface-hover", children: _jsx(SmilePlus, { size: 20, "aria-hidden": true }) })] }), _jsx("div", { className: "h-px bg-divider" }), _jsxs("div", { className: "pt-1", children: [_jsx(SheetAction, { icon: _jsx(Reply, { size: 18, "aria-hidden": true }), label: "Reply", onSelect: () => run(() => onReply(message)) }), _jsx(SheetAction, { icon: _jsx(Copy, { size: 18, "aria-hidden": true }), label: "Copy text", onSelect: () => run(() => {
                                void navigator.clipboard.writeText(message.content);
                                toast.success('Message copied');
                            }) }), canEdit ? (_jsx(SheetAction, { icon: _jsx(Pencil, { size: 18, "aria-hidden": true }), label: "Edit message", onSelect: () => run(() => onEdit(message)) })) : null, canPin ? (_jsx(SheetAction, { icon: _jsx(Pin, { size: 18, "aria-hidden": true }), label: message.pinned ? 'Unpin message' : 'Pin message', onSelect: () => run(() => onTogglePin(message)) })) : null, canDelete ? (_jsx(SheetAction, { icon: _jsx(Trash2, { size: 18, "aria-hidden": true }), label: "Delete message", tone: "danger", onSelect: () => run(() => onDelete(message)) })) : null] })] })) : null }));
}
//# sourceMappingURL=MessageActionSheet.js.map