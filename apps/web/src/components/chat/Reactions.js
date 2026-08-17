import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui/Tooltip';
export function Reactions({ reactions, onToggle, onAdd, disabled }) {
    if (reactions.length === 0)
        return null;
    return (_jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-1", children: [reactions.map((reaction) => (_jsx(Tooltip, { content: `${reaction.count} reacted with ${reaction.emoji}`, children: _jsxs("button", { type: "button", disabled: disabled, onClick: () => onToggle(reaction.emoji), "aria-pressed": reaction.me, className: cn('flex h-7 min-w-[36px] items-center justify-center gap-1 rounded px-1.5 transition-colors', reaction.me
                        ? 'bg-[rgba(88,101,242,0.18)] text-[#c9cdfb] ring-1 ring-brand'
                        : 'bg-surface-accent text-text-subheading hover:ring-1 hover:ring-[#4f545c]'), children: [_jsx("span", { className: "text-base leading-none", children: reaction.emoji }), _jsx("span", { className: "text-xs font-semibold tabular-nums", children: reaction.count })] }) }, reaction.emoji))), _jsx(Tooltip, { content: "Add reaction", children: _jsx("button", { type: "button", disabled: disabled, onClick: onAdd, "aria-label": "Add reaction", className: "flex h-7 w-8 items-center justify-center rounded bg-surface-accent text-text-muted transition-colors hover:text-text-heading", children: _jsx(SmilePlus, { size: 16, "aria-hidden": true }) }) })] }));
}
//# sourceMappingURL=Reactions.js.map