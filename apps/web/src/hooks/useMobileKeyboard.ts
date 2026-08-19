import { useEffect, useState } from 'react';

/**
 * Tracks the on-screen keyboard. Mobile browsers often shrink `visualViewport`
 * while leaving `100dvh` unchanged, so the composer would sit under the keys.
 * Android WebView is even less consistent; the native IME inset is the primary
 * fix there, and this hook covers Safari and Chrome where the viewport shrinks.
 */
export function useMobileKeyboard(): { offset: number; open: boolean } {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const visualHeight = viewport?.height ?? window.innerHeight;
      const visualTop = viewport?.offsetTop ?? 0;
      const layoutHeight = window.innerHeight;
      const raw = layoutHeight - visualHeight - visualTop;
      const next = raw > 80 ? Math.round(raw) : 0;
      setOffset((current) => (Math.abs(current - next) > 2 ? next : current));
    };

    update();
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
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
