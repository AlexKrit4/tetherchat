import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
/**
 * Two linked rings — the "tether" — used as the app mark on the rail, the login
 * screen and the PWA icon.
 */
export function TetherLogo({ className }) {
    return (_jsxs("svg", { viewBox: "0 0 32 32", fill: "none", "aria-hidden": true, className: cn('shrink-0', className), children: [_jsx("path", { d: "M12.5 20.5 19.5 13.5", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" }), _jsx("circle", { cx: "10.2", cy: "22.8", r: "4.6", stroke: "currentColor", strokeWidth: "2.4" }), _jsx("circle", { cx: "21.8", cy: "11.2", r: "4.6", stroke: "currentColor", strokeWidth: "2.4" })] }));
}
export function TetherWordmark({ className }) {
    return (_jsxs("div", { className: cn('flex items-center gap-2', className), children: [_jsx(TetherLogo, { className: "h-7 w-7 text-brand" }), _jsx("span", { className: "text-xl font-bold tracking-tight text-text-heading", children: "TetherChat" })] }));
}
//# sourceMappingURL=TetherLogo.js.map