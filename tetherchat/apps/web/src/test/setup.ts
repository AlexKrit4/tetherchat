import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initI18n } from '@/i18n';

initI18n();

afterEach(() => cleanup());

/**
 * jsdom implements neither matchMedia nor visualViewport, and both drive the
 * responsive layout, so tests declare the viewport they are simulating.
 */
export function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      const min = /min-width:\s*(\d+)px/.exec(query);
      const hoverNone = query.includes('hover: none');
      const hoverHover = query.includes('hover: hover');

      let matches = true;
      if (max) matches = matches && width <= Number(max[1]);
      if (min) matches = matches && width >= Number(min[1]);
      // Treat narrow viewports as touch devices.
      if (hoverHover) matches = width >= 768;
      if (hoverNone) matches = width < 768;

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }),
  );
}

setViewport(1440);
