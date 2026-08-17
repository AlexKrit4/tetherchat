import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Pin } from 'lucide-react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { usePins } from '@/hooks/useMessages';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { messageTimestamp } from '@/lib/time';
import { MessageContent } from './MessageContent';
import { useUiStore } from '@/stores/uiStore';
export function PinnedMessagesPanel() {
    const open = useUiStore((state) => state.pinsOpen);
    const setOpen = useUiStore((state) => state.setPinsOpen);
    const { channelId, isDm } = useChatTarget();
    const { data: pins, isLoading } = usePins(channelId, open && !isDm);
    return (_jsx(AdaptiveDialog, { open: open, onClose: () => setOpen(false), title: "Pinned Messages", width: "md", children: isDm ? (_jsx("p", { className: "py-6 text-center text-base text-text-muted", children: "Pins are available in server channels." })) : isLoading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })) : pins && pins.length > 0 ? (_jsx("ul", { className: "flex flex-col gap-3", children: pins.map((message) => (_jsxs("li", { className: "rounded-lg bg-base-secondary p-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Avatar, { user: message.author, size: 24 }), _jsx("span", { className: "text-base font-medium text-text-heading", children: message.author.displayName ?? message.author.username }), _jsx("span", { className: "text-xs text-text-muted", children: messageTimestamp(message.createdAt) })] }), _jsx("div", { className: "mt-1", children: _jsx(MessageContent, { content: message.content }) })] }, message.id))) })) : (_jsxs("div", { className: "flex flex-col items-center gap-2 py-8 text-center", children: [_jsx(Pin, { size: 32, className: "text-text-faint", "aria-hidden": true }), _jsx("p", { className: "text-base text-text-muted", children: "Nothing pinned yet. Pin a message to keep it handy." })] })) }));
}
//# sourceMappingURL=PinnedMessagesPanel.js.map