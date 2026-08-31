import { useCallback, useRef } from 'react';

const TRIGGER_PX = 56;
const MAX_VERTICAL_DRIFT_PX = 40;

/**
 * Telegram-style swipe-to-reply on touch: a horizontal drag past the threshold
 * fires once per gesture. Vertical drift is capped so scrolling still wins.
 */
export function useSwipeReply(onReply: () => void, enabled = true) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      tracking.current = true;
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      tracking.current = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);
      if (dx > TRIGGER_PX && dy < MAX_VERTICAL_DRIFT_PX) onReply();
    },
    [enabled, onReply],
  );

  return { onTouchStart, onTouchEnd };
}
