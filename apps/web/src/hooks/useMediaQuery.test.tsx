import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setViewport } from '@/test/setup';
import { useHasHover, useLayout } from './useMediaQuery';

describe('useLayout', () => {
  it('picks the mobile layout below 768px', () => {
    setViewport(390);
    expect(renderHook(() => useLayout()).result.current).toBe('mobile');
  });

  it('picks the tablet layout between 768px and 1023px', () => {
    setViewport(800);
    expect(renderHook(() => useLayout()).result.current).toBe('tablet');
  });

  it('picks the desktop layout at 1024px and above', () => {
    setViewport(1024);
    expect(renderHook(() => useLayout()).result.current).toBe('desktop');

    setViewport(1920);
    expect(renderHook(() => useLayout()).result.current).toBe('desktop');
  });

  it('treats the narrowest supported phone as mobile', () => {
    setViewport(320);
    expect(renderHook(() => useLayout()).result.current).toBe('mobile');
  });
});

describe('useHasHover', () => {
  it('is false on touch viewports and true on pointer ones', () => {
    setViewport(390);
    expect(renderHook(() => useHasHover()).result.current).toBe(false);

    setViewport(1440);
    expect(renderHook(() => useHasHover()).result.current).toBe(true);
  });
});
