import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';
/** Shared 56px header for every mobile view, with a 44px back target. */
export function MobileHeader({ title, subtitle, onBack, actions, className }) {
    return (_jsxs("header", { className: cn('flex h-14 shrink-0 items-center gap-1 px-1 shadow-elevated', className), children: [onBack ? (_jsx(IconButton, { icon: ArrowLeft, label: "Back", size: "lg", showTooltip: false, onClick: onBack })) : (_jsx("span", { className: "w-2" })), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("h1", { className: "truncate text-lg font-semibold text-text-heading", children: title }), subtitle ? _jsx("p", { className: "truncate text-xs text-text-muted", children: subtitle }) : null] }), actions ? _jsx("div", { className: "flex shrink-0 items-center gap-0.5 pr-1", children: actions }) : null] }));
}
//# sourceMappingURL=MobileHeader.js.map