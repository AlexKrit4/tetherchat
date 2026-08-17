import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTypingUsers } from '@/stores/typingStore';
/** Sits in the 24px gutter under the composer, exactly like Discord. */
export function TypingIndicator({ channelId }) {
    const users = useTypingUsers(channelId);
    return (_jsx("div", { className: "h-6 truncate pt-1 text-sm text-text", "aria-live": "polite", children: users.length > 0 ? (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "flex gap-0.5", "aria-hidden": true, children: [0, 1, 2].map((dot) => (_jsx("span", { className: "h-1 w-1 animate-pulse-soft rounded-full bg-text-muted", style: { animationDelay: `${dot * 160}ms` } }, dot))) }), _jsxs("span", { className: "truncate", children: [_jsx("strong", { className: "font-semibold", children: describe(users.map((user) => user.username)) }), ' ', users.length === 1 ? 'is typing…' : 'are typing…'] })] })) : null }));
}
function describe(names) {
    if (names.length === 1)
        return names[0];
    if (names.length === 2)
        return `${names[0]} and ${names[1]}`;
    if (names.length === 3)
        return `${names[0]}, ${names[1]} and ${names[2]}`;
    return `${names.length} people`;
}
//# sourceMappingURL=TypingIndicator.js.map