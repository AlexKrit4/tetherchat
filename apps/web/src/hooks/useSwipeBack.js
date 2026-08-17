import { useEffect } from 'react';
const EDGE_ZONE_PX = 28;
const TRIGGER_PX = 70;
const MAX_VERTICAL_DRIFT_PX = 45;
/**
 * Edge swipe for mobile back navigation. Only gestures that start within the
 * left edge zone count, so horizontal scrolling inside the page is unaffected.
 */
export function useSwipeBack(onBack, enabled = true) {
    useEffect(() => {
        if (!enabled)
            return;
        let startX = 0;
        let startY = 0;
        let tracking = false;
        const onTouchStart = (event) => {
            const touch = event.touches[0];
            if (!touch || touch.clientX > EDGE_ZONE_PX)
                return;
            startX = touch.clientX;
            startY = touch.clientY;
            tracking = true;
        };
        const onTouchEnd = (event) => {
            if (!tracking)
                return;
            tracking = false;
            const touch = event.changedTouches[0];
            if (!touch)
                return;
            const dx = touch.clientX - startX;
            const dy = Math.abs(touch.clientY - startY);
            if (dx > TRIGGER_PX && dy < MAX_VERTICAL_DRIFT_PX)
                onBack();
        };
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [enabled, onBack]);
}
//# sourceMappingURL=useSwipeBack.js.map