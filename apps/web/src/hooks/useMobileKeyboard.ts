import { useEffect, useState } from 'react';

/**
 * Tracks the on-screen keyboard using visualViewport. Mobile browsers shrink the
 * visual viewport instead of the layout viewport, so a `100dvh` shell keeps its
 * height and the composer would end up underneath the keyboard. Exposing the
 * offset lets the chat view lift its input by exactly that much.
 */
export function useMobileKeyboard(): { offset: number; open: boolean } {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // Ignore the sub-pixel jitter Safari reports while scrolling.
      const raw = window.innerHeight - viewport.height - viewport.offsetTop;
      const next = raw > 80 ? Math.round(raw) : 0;
      setOffset((current) => (Math.abs(current - next) > 2 ? next : current));
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return { offset, open: offset > 0 };
}

/** Applies the keyboard offset as a CSS variable on the document root. */
export function useKeyboardOffsetVariable(): void {
  const { offset } = useMobileKeyboard();

  useEffect(() => {
    document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    return () => {
      document.documentElement.style.removeProperty('--keyboard-offset');
    };
  }, [offset]);
}
