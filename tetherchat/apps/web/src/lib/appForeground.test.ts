import { afterEach, describe, expect, it } from 'vitest';
import { isAppInBackground, markNativeBackground, markSessionParked } from './appForeground';

describe('isAppInBackground', () => {
  afterEach(() => {
    markNativeBackground(false);
    markSessionParked(false);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('follows the document visibility state', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    expect(isAppInBackground()).toBe(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    expect(isAppInBackground()).toBe(false);
  });

  it('treats a parked session or Android onStop as background even if the WebView stays visible', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    markNativeBackground(true);
    expect(isAppInBackground()).toBe(true);
    markNativeBackground(false);
    markSessionParked(true);
    expect(isAppInBackground()).toBe(true);
  });
});
