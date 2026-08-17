import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMessageSearch } from '@/hooks/useMessages';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { messageTimestamp } from '@/lib/time';
import { MessageContent } from './MessageContent';
import { useUiStore } from '@/stores/uiStore';
/** Ctrl/Cmd+F opens this over the channel; on mobile it becomes a sheet. */
export function SearchPanel() {
    const open = useUiStore((state) => state.searchOpen);
    const setOpen = useUiStore((state) => state.setSearchOpen);
    const { channelId, isDm, title } = useChatTarget();
    const [term, setTerm] = useState('');
    const debounced = useDebounced(term, 250);
    const { data: results, isFetching } = useMessageSearch(channelId, debounced, isDm);
    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [setOpen]);
    useEffect(() => {
        if (!open)
            setTerm('');
    }, [open]);
    return (_jsxs(AdaptiveDialog, { open: open, onClose: () => setOpen(false), title: isDm ? `Search ${title}` : `Search #${title}`, width: "md", children: [_jsx(Input, { autoFocus: true, value: term, onChange: (event) => setTerm(event.target.value), placeholder: "Search messages\u2026", "aria-label": "Search messages" }), _jsx("div", { className: "mt-3", children: isFetching ? (_jsx("div", { className: "flex justify-center py-6", children: _jsx(Spinner, {}) })) : debounced.trim().length < 2 ? (_jsxs("div", { className: "flex flex-col items-center gap-2 py-8 text-center", children: [_jsx(Search, { size: 30, className: "text-text-faint", "aria-hidden": true }), _jsx("p", { className: "text-base text-text-muted", children: "Type at least two characters to search." })] })) : results && results.length > 0 ? (_jsx("ul", { className: "flex flex-col gap-2", children: results.map((message) => (_jsxs("li", { className: "rounded-lg bg-base-secondary p-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Avatar, { user: message.author, size: 22 }), _jsx("span", { className: "text-base font-medium text-text-heading", children: message.author.displayName ?? message.author.username }), _jsx("span", { className: "text-xs text-text-muted", children: messageTimestamp(message.createdAt) })] }), _jsx("div", { className: "mt-1", children: _jsx(MessageContent, { content: message.content }) })] }, message.id))) })) : (_jsx("p", { className: "py-8 text-center text-base text-text-muted", children: "No messages matched." })) })] }));
}
function useDebounced(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [delay, value]);
    return debounced;
}
//# sourceMappingURL=SearchPanel.js.map