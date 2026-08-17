import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';
const boxes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-touch w-touch',
};
const glyphs = {
    sm: 14,
    md: 20,
    lg: 22,
};
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, size = 'md', active, tone = 'default', className, showTooltip = true, ...props }, ref) {
    const button = (_jsx("button", { ref: ref, type: "button", "aria-label": label, "aria-pressed": active, className: cn('inline-flex shrink-0 items-center justify-center rounded transition-colors duration-150', boxes[size], tone === 'danger'
            ? 'text-text-muted hover:bg-surface-hover hover:text-danger'
            : active
                ? 'text-text-heading'
                : 'text-text-subheading hover:text-text-heading', 'disabled:cursor-not-allowed disabled:opacity-40', className), ...props, children: _jsx(Icon, { size: glyphs[size], strokeWidth: 1.75, "aria-hidden": true }) }));
    if (!showTooltip)
        return button;
    return _jsx(Tooltip, { content: label, children: button });
});
//# sourceMappingURL=IconButton.js.map