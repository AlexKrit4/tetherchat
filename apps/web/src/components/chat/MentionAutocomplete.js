import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Hash } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
/**
 * Detects an in-progress @ or # mention at the caret. Returns null unless the
 * trigger starts a word, so email addresses and "C#" never open the picker.
 */
export function detectMentionQuery(value, caret) {
    const upToCaret = value.slice(0, caret);
    const match = /(^|\s)([@#])([\p{L}\p{N}._-]{0,32})$/u.exec(upToCaret);
    if (!match)
        return null;
    const trigger = match[2];
    const term = match[3];
    return {
        kind: trigger === '@' ? 'user' : 'channel',
        term,
        start: caret - term.length - 1,
    };
}
const MAX_RESULTS = 8;
/** Opens above the composer so the on-screen keyboard never covers it. */
export function MentionAutocomplete({ query, members, channels, onPick, onDismiss, }) {
    const [index, setIndex] = useState(0);
    const results = useMemo(() => {
        const term = query.term.toLowerCase();
        if (query.kind === 'user') {
            const everyone = 'everyone'.startsWith(term) && term.length > 0
                ? [{ id: 'everyone', label: '@everyone', insert: '@everyone', member: null }]
                : [];
            const users = members
                .filter((member) => {
                const name = (member.nickname ?? member.user.displayName ?? member.user.username).toLowerCase();
                return name.includes(term) || member.user.username.includes(term);
            })
                .slice(0, MAX_RESULTS)
                .map((member) => ({
                id: member.userId,
                label: member.nickname ?? member.user.displayName ?? member.user.username,
                insert: `<@${member.userId}>`,
                member,
            }));
            return [...everyone, ...users];
        }
        return channels
            .filter((channel) => channel.name.toLowerCase().includes(term))
            .slice(0, MAX_RESULTS)
            .map((channel) => ({
            id: channel.id,
            label: `#${channel.name}`,
            insert: `<#${channel.id}>`,
            member: null,
        }));
    }, [channels, members, query.kind, query.term]);
    useEffect(() => setIndex(0), [query.term, query.kind]);
    useEffect(() => {
        const onKeyDown = (event) => {
            if (results.length === 0)
                return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((current) => (current + 1) % results.length);
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((current) => (current - 1 + results.length) % results.length);
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                const picked = results[index];
                if (picked) {
                    onPick({
                        text: `${picked.insert} `,
                        start: query.start,
                        length: query.term.length + 1,
                    });
                }
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onDismiss();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [index, onDismiss, onPick, query.start, query.term.length, results]);
    if (results.length === 0)
        return null;
    return (_jsxs("div", { className: "absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg bg-base-floating shadow-floating", children: [_jsx("p", { className: "px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted", children: query.kind === 'user' ? 'Members' : 'Channels' }), _jsx("ul", { className: "scroller max-h-[240px] pb-2", children: results.map((result, resultIndex) => (_jsx("li", { children: _jsxs("button", { type: "button", onMouseEnter: () => setIndex(resultIndex), onClick: () => onPick({
                            text: `${result.insert} `,
                            start: query.start,
                            length: query.term.length + 1,
                        }), className: cn('flex min-h-11 w-full items-center gap-2 px-3 text-left text-base md:min-h-8', resultIndex === index
                            ? 'bg-surface-hover text-text-heading'
                            : 'text-text-subheading'), children: [result.member ? (_jsx(Avatar, { user: result.member.user, size: 22 })) : query.kind === 'channel' ? (_jsx(Hash, { size: 18, className: "text-text-faint", "aria-hidden": true })) : (_jsx("span", { className: "flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand text-2xs font-bold text-white", children: "@" })), _jsx("span", { className: "truncate", children: result.label }), result.member ? (_jsxs("span", { className: "truncate text-sm text-text-muted", children: ["@", result.member.user.username] })) : null] }) }, result.id))) })] }));
}
//# sourceMappingURL=MentionAutocomplete.js.map