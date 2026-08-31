import { useEffect, useState } from 'react';
import { getLocale, setLocale, subscribeI18n, t, type Locale } from './index';

/** Re-renders when the locale changes. */
export function useT(): typeof t {
  const [, setTick] = useState(0);
  useEffect(() => subscribeI18n(() => setTick((n) => n + 1)), []);
  return t;
}

export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const [, setTick] = useState(0);
  useEffect(() => subscribeI18n(() => setTick((n) => n + 1)), []);
  return { locale: getLocale(), setLocale };
}
