import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
/** 44px wide switch: comfortable to tap and readable at a glance. */
export function Toggle({ checked, onChange, label, disabled }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": checked, "aria-label": label, disabled: disabled, onClick: () => onChange(!checked), className: cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150', checked ? 'bg-success' : 'bg-[#72767d]', disabled && 'cursor-not-allowed opacity-50'), children: _jsx("span", { "aria-hidden": true, className: "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-150", style: { transform: checked ? 'translateX(24px)' : 'translateX(4px)' } }) }));
}
//# sourceMappingURL=Toggle.js.map