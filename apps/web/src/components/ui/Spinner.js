import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
export function Spinner({ className }) {
    return (_jsxs("svg", { className: cn('h-5 w-5 animate-spin text-current', className), viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeOpacity: "0.25", strokeWidth: "3" }), _jsx("path", { d: "M22 12a10 10 0 0 0-10-10", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" })] }));
}
//# sourceMappingURL=Spinner.js.map