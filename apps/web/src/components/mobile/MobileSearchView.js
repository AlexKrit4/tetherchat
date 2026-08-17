import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMessageSearch } from '@/hooks/useMessages';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { MessageContent } from '@/components/chat/MessageContent';
import { messageTimestamp } from '@/lib/time';
import { MobileHeader } from './MobileHeader';
import { useUiStore } from '@/stores/uiStore';
/** Search gets its own screen on phones rather than a cramped overlay. */
export function MobileSearchView() {
    const popMobileView = useUiStore((state) => state.popMobileView);
    const { channelId, isDm, title } = useChatTarget();
    const [term, setTerm] = useState('');
    const [debounced, setDebounced] = useState('');
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(term), 250);
        return () => window.clearTimeout(timer);
    }, [term]);
    const { data: results, isFetching } = useMessageSearch(channelId, debounced, isDm);
    return (_jsxs("div", { className: "flex h-full flex-col bg-base", children: [_jsx(MobileHeader, { title: "Search", subtitle: isDm ? title : `#${title}`, onBack: popMobileView }), _jsx("div", { className: "shrink-0 px-4 pb-3 pt-1", children: _jsx("input", { autoFocus: true, value: term, onChange: (event) => setTerm(event.target.value), placeholder: "Search messages\u2026", "aria-label": "Search messages", className: "h-12 w-full rounded-lg bg-base-tertiary px-3 text-base text-text outline-none placeholder:text-text-faint focus:shadow-[0_0_0_2px_var(--brand)]" }) }), _jsx("div", { className: "scroller flex-1 px-4 pb-safe", children: isFetching ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })) : debounced.trim().length < 2 ? (_jsxs("div", { className: "flex flex-col items-center gap-2 py-12 text-center", children: [_jsx(Search, { size: 32, className: "text-text-faint", "aria-hidden": true }), _jsx("p", { className: "text-base text-text-muted", children: "Type at least two characters." })] })) : results && results.length > 0 ? (_jsx("ul", { className: "flex flex-col gap-2 pb-6", children: results.map((message) => (_jsxs("li", { className: "rounded-lg bg-base-secondary p-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Avatar, { user: message.author, size: 24 }), _jsx("span", { className: "text-base font-medium text-text-heading", children: message.author.displayName ?? message.author.username }), _jsx("span", { className: "text-xs text-text-muted", children: messageTimestamp(message.createdAt) })] }), _jsx("div", { className: "mt-1", children: _jsx(MessageContent, { content: message.content }) })] }, message.id))) })) : (_jsx("p", { className: "py-12 text-center text-base text-text-muted", children: "No messages matched." })) })] }));
}
//# sourceMappingURL=MobileSearchView.js.map