import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
const MENU_WIDTH = 200;
const EDGE_PADDING = 8;
/**
 * Desktop right-click menu. Items highlight in brand blurple rather than grey,
 * which is what makes a Discord menu recognisable.
 */
export function useContextMenu() {
    const [state, setState] = useState(null);
    const open = useCallback((event, items) => {
        setState({ x: event.clientX, y: event.clientY, items });
    }, []);
    const close = useCallback(() => setState(null), []);
    return { state, open, close };
}
export function ContextMenu({ state, onClose, }) {
    const ref = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    useLayoutEffect(() => {
        if (!state)
            return;
        const height = ref.current?.offsetHeight ?? 0;
        const top = Math.min(state.y, window.innerHeight - height - EDGE_PADDING);
        const left = Math.min(state.x, window.innerWidth - MENU_WIDTH - EDGE_PADDING);
        setPosition({ top: Math.max(EDGE_PADDING, top), left: Math.max(EDGE_PADDING, left) });
    }, [state]);
    useEffect(() => {
        if (!state)
            return;
        const onPointerDown = (event) => {
            if (!ref.current?.contains(event.target))
                onClose();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onClose);
        window.addEventListener('scroll', onClose, true);
        return () => {
            window.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('scroll', onClose, true);
        };
    }, [onClose, state]);
    if (!state)
        return null;
    return createPortal(_jsx("div", { ref: ref, role: "menu", style: { top: position.top, left: position.left, width: MENU_WIDTH }, className: "fixed z-[90] animate-fade-in rounded bg-base-floating p-2 shadow-floating", children: state.items.map((item) => (_jsxs("div", { children: [item.separatorBefore ? _jsx("div", { className: "my-1 h-px bg-[#2e2f34]" }) : null, _jsxs("button", { type: "button", role: "menuitem", disabled: item.disabled, onClick: () => {
                        item.onSelect();
                        onClose();
                    }, className: cn('flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-base', 'transition-colors duration-75 disabled:cursor-not-allowed disabled:opacity-40', item.tone === 'danger'
                        ? 'text-danger hover:bg-danger hover:text-white'
                        : 'text-text-subheading hover:bg-brand-hover hover:text-white'), children: [_jsx("span", { className: "truncate", children: item.label }), item.icon ? _jsx("span", { className: "shrink-0 opacity-80", children: item.icon }) : null] })] }, item.id))) }), document.body);
}
//# sourceMappingURL=ContextMenu.js.map