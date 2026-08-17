import { useCallback, useRef } from 'react';
const DEFAULT_DELAY_MS = 500;
const MOVE_CANCEL_PX = 10;
/**
 * Touch long-press, the mobile stand-in for the desktop hover toolbar and
 * right-click menu. Scrolling cancels the gesture, and a successful press fires
 * a short haptic tick where the platform supports it.
 */
export function useLongPress(onLongPress, options = {}) {
    const { delay = DEFAULT_DELAY_MS, enabled = true } = options;
    const timer = useRef(null);
    const origin = useRef(null);
    const fired = useRef(false);
    const clear = useCallback(() => {
        if (timer.current !== null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
        origin.current = null;
    }, []);
    const onPointerDown = useCallback((event) => {
        if (!enabled || event.pointerType === 'mouse')
            return;
        fired.current = false;
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => {
            fired.current = true;
            navigator.vibrate?.(8);
            onLongPress();
            clear();
        }, delay);
    }, [clear, delay, enabled, onLongPress]);
    const onPointerMove = useCallback((event) => {
        if (!origin.current)
            return;
        const dx = Math.abs(event.clientX - origin.current.x);
        const dy = Math.abs(event.clientY - origin.current.y);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX)
            clear();
    }, [clear]);
    const onContextMenu = useCallback((event) => {
        // Suppress the native menu after our own long-press already opened.
        if (fired.current)
            event.preventDefault();
    }, []);
    return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, onContextMenu };
}
//# sourceMappingURL=useLongPress.js.map