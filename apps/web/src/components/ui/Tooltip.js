import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { cloneElement, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useHasHover } from '@/hooks/useMediaQuery';
const OFFSET = 8;
/**
 * Hover-only affordance: on touch devices it renders nothing but the child, so
 * no tooltip can ever get stuck on screen after a tap.
 */
export function Tooltip({ content, placement = 'top', children, delay = 120 }) {
    const hasHover = useHasHover();
    const id = useId();
    const timer = useRef(null);
    const [position, setPosition] = useState(null);
    if (!hasHover || !content)
        return children;
    const show = (event) => {
        const target = event.currentTarget.getBoundingClientRect();
        timer.current = window.setTimeout(() => {
            const coordinates = {
                top: placement === 'top'
                    ? target.top - OFFSET
                    : placement === 'bottom'
                        ? target.bottom + OFFSET
                        : target.top + target.height / 2,
                left: placement === 'right'
                    ? target.right + OFFSET
                    : placement === 'left'
                        ? target.left - OFFSET
                        : target.left + target.width / 2,
            };
            setPosition(coordinates);
        }, delay);
    };
    const hide = () => {
        if (timer.current !== null)
            window.clearTimeout(timer.current);
        setPosition(null);
    };
    const translate = {
        top: 'translate(-50%, -100%)',
        bottom: 'translate(-50%, 0)',
        left: 'translate(-100%, -50%)',
        right: 'translate(0, -50%)',
    };
    return (_jsxs(_Fragment, { children: [cloneElement(children, {
                'aria-describedby': position ? id : undefined,
                onMouseEnter: show,
                onMouseLeave: hide,
                onFocus: show,
                onBlur: hide,
            }), position
                ? createPortal(_jsx("div", { id: id, role: "tooltip", style: { top: position.top, left: position.left, transform: translate[placement] }, className: cn('pointer-events-none fixed z-[100] max-w-[240px] animate-fade-in', 'rounded bg-base-floating px-2 py-1.5 text-sm font-medium text-text-heading shadow-floating'), children: content }), document.body)
                : null] }));
}
//# sourceMappingURL=Tooltip.js.map