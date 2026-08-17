import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/cn';
export function Skeleton({ className, style }) {
    return (_jsx("div", { "aria-hidden": true, className: cn('animate-pulse-soft rounded bg-base-secondary', className), style: style }));
}
/** Placeholder rows that mimic the shape of grouped messages while history loads. */
export function MessageSkeletonList({ count = 8 }) {
    return (_jsx("div", { className: "flex flex-col gap-6 px-4 py-6 md:px-4", children: Array.from({ length: count }).map((_, index) => (_jsxs("div", { className: "flex gap-4", children: [_jsx(Skeleton, { className: "h-10 w-10 rounded-full" }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-2", children: [_jsx(Skeleton, { className: "h-3.5", style: { width: `${90 + ((index * 37) % 60)}px` } }), _jsx(Skeleton, { className: "h-3.5", style: { width: `${45 + ((index * 53) % 50)}%` } }), index % 3 === 0 ? (_jsx(Skeleton, { className: "h-3.5", style: { width: `${30 + ((index * 29) % 40)}%` } })) : null] })] }, index))) }));
}
export function SidebarSkeleton() {
    return (_jsxs("div", { className: "flex flex-col gap-1.5 px-2 py-3", children: [_jsx(Skeleton, { className: "mb-1 h-3 w-20" }), Array.from({ length: 6 }).map((_, index) => (_jsx(Skeleton, { className: "h-8 rounded", style: { width: `${60 + ((index * 41) % 35)}%` } }, index)))] }));
}
//# sourceMappingURL=Skeleton.js.map