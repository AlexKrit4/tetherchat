import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';
function FieldShell({ id, label, hint, error, required, children, }) {
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [label ? (_jsxs("label", { htmlFor: id, className: cn('text-xs font-bold uppercase tracking-[0.02em]', error ? 'text-danger' : 'text-text-subheading'), children: [label, required ? _jsx("span", { className: "ml-1 text-danger", children: "*" }) : null, error ? _jsxs("span", { className: "ml-2 normal-case tracking-normal", children: ["\u2014 ", error] }) : null] })) : null, children, hint ? _jsx("p", { className: "text-xs text-text-muted", children: hint }) : null] }));
}
export const Input = forwardRef(function Input({ label, hint, error, required, className, id, ...props }, ref) {
    const generated = useId();
    const inputId = id ?? generated;
    return (_jsx(FieldShell, { id: inputId, label: label, hint: hint, error: error, required: required, children: _jsx("input", { ref: ref, id: inputId, "aria-invalid": error ? true : undefined, 
            // 48px tall on phones so the field is easy to hit and iOS does not zoom.
            className: cn('w-full rounded bg-base-tertiary px-3 text-base text-text placeholder:text-text-faint', 'h-12 md:h-10', 'outline-none transition-shadow duration-150', error
                ? 'shadow-[0_0_0_1px_var(--red)] focus:shadow-[0_0_0_2px_var(--red)]'
                : 'focus:shadow-[0_0_0_2px_var(--brand)]', className), ...props }) }));
});
export const Textarea = forwardRef(function Textarea({ label, hint, error, required, className, id, ...props }, ref) {
    const generated = useId();
    const inputId = id ?? generated;
    return (_jsx(FieldShell, { id: inputId, label: label, hint: hint, error: error, required: required, children: _jsx("textarea", { ref: ref, id: inputId, "aria-invalid": error ? true : undefined, className: cn('w-full resize-none rounded bg-base-tertiary px-3 py-2.5 text-base text-text', 'placeholder:text-text-faint outline-none transition-shadow duration-150', 'focus:shadow-[0_0_0_2px_var(--brand)]', className), ...props }) }));
});
//# sourceMappingURL=Input.js.map