import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const DEFAULT_DELAY_MS = 500;
const MOVE_CANCEL_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: ReactPointerEvent | React.MouseEvent) => void;
}

/**
 * Touch long-press, the mobile stand-in for the desktop hover toolbar and
 * right-click menu. Scrolling cancels the gesture, and a successful press fires
 * a short haptic tick where the platform supports it.
 */
export function useLongPress(
  onLongPress: () => void,
  options: { delay?: number; enabled?: boolean } = {},
): LongPressHandlers {
  const { delay = DEFAULT_DELAY_MS, enabled = true } = options;
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!enabled || event.pointerType === 'mouse') return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(8);
        onLongPress();
        clear();
      }, delay);
    },
    [clear, delay, enabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!origin.current) return;
      const dx = Math.abs(event.clientX - origin.current.x);
      const dy = Math.abs(event.clientY - origin.current.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clear();
    },
    [clear],
  );

  const onContextMenu = useCallback(
    (event: ReactPointerEvent | React.MouseEvent) => {
      // Suppress the native menu after our own long-press already opened.
      if (fired.current) event.preventDefault();
    },
    [],
  );

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, onContextMenu };
}
