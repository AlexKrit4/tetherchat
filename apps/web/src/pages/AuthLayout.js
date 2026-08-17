import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TetherWordmark } from '@/components/brand/TetherLogo';
/**
 * Auth screens are a single centred card on desktop and a full-bleed form on
 * phones, where a floating card would waste vertical space.
 */
export function AuthLayout({ title, subtitle, children, footer, }) {
    return (_jsx("div", { className: "flex min-h-screen-dvh flex-col items-center justify-center bg-base-tertiary px-safe pb-safe pt-safe md:p-6", children: _jsxs("div", { className: "flex w-full max-w-[480px] flex-col gap-6 bg-base p-6 md:rounded-lg md:p-8 md:shadow-floating", children: [_jsxs("div", { className: "flex flex-col items-center gap-3 text-center", children: [_jsx(TetherWordmark, {}), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text-heading", children: title }), subtitle ? _jsx("p", { className: "mt-1 text-base text-text-muted", children: subtitle }) : null] })] }), children, footer ? _jsx("div", { className: "text-sm text-text-muted", children: footer }) : null] }) }));
}
//# sourceMappingURL=AuthLayout.js.map