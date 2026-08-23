import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { en as enDict, ru as ruDict } from './dictionaries';

export type Locale = 'ru' | 'en';

export const DEFAULT_LOCALE: Locale = 'ru';
export const LOCALE_STORAGE_KEY = 'tc_locale';

type Vars = Record<string, string | number>;
type Dict = { [key: string]: string | Dict };

const listeners = new Set<() => void>();
let currentLocale: Locale = DEFAULT_LOCALE;

function lookup(dict: Dict, path: string): string | undefined {
  const parts = path.split('.');
  let current: string | Dict | undefined = dict;
  for (const part of parts) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, vars?: Vars): string {
  const dict = (currentLocale === 'en' ? enDict : ruDict) as unknown as Dict;
  const value = lookup(dict, key) ?? lookup(ruDict as unknown as Dict, key) ?? key;
  return interpolate(value, vars);
}

export function subscribeI18n(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyDayjs(locale: Locale): void {
  dayjs.locale(locale === 'ru' ? 'ru' : 'en');
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // private mode
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  applyDayjs(locale);
  for (const listener of listeners) listener();
}

export function initI18n(): void {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'en' || stored === 'ru') locale = stored;
  } catch {
    locale = DEFAULT_LOCALE;
  }
  currentLocale = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  applyDayjs(locale);
}
