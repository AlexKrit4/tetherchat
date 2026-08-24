import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Grows a textarea with its content up to maxHeight, then lets it scroll.
 * Required on mobile, where a fixed-height composer would clip multi-line drafts.
 */
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight: number,
): void {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    const next = Math.min(node.scrollHeight, maxHeight);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight, ref, value]);
}
