import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
const variants = {
    primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
    secondary: 'bg-surface-active text-text-heading hover:bg-[#4e5058] active:bg-[#5c5e66]',
    danger: 'bg-danger text-white hover:bg-danger-hover',
    success: 'bg-success text-white hover:brightness-110',
    ghost: 'bg-transparent text-text-subheading hover:bg-surface-hover hover:text-text-heading',
    link: 'bg-transparent text-text-link hover:underline px-0',
};
// 44px is the minimum comfortable touch target, so md and lg both clear it.
const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 min-h-touch px-4 text-base md:min-h-0',
    lg: 'h-11 px-5 text-base',
};
export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) {
    return (_jsxs("button", { ref: ref, type: props.type ?? 'button', disabled: disabled || loading, className: cn('inline-flex select-none items-center justify-center gap-2 rounded font-medium', 'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], fullWidth && 'w-full', className), ...props, children: [loading ? _jsx(Spinner, { className: "h-4 w-4" }) : null, children] }));
});
//# sourceMappingURL=Button.js.map