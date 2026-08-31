import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getLocale, t } from '@/i18n';

dayjs.extend(calendar);
dayjs.extend(relativeTime);

/** Timestamp next to a message author. */
export function messageTimestamp(iso: string): string {
  const locale = getLocale();
  return dayjs(iso).calendar(null, {
    sameDay: t('time.todayAt'),
    lastDay: t('time.yesterdayAt'),
    lastWeek: locale === 'ru' ? 'D MMMM YYYY, HH:mm' : 'MM/DD/YYYY h:mm A',
    sameElse: locale === 'ru' ? 'D MMMM YYYY, HH:mm' : 'MM/DD/YYYY h:mm A',
  });
}

export function shortTime(iso: string): string {
  return dayjs(iso).format(getLocale() === 'ru' ? 'HH:mm' : 'h:mm A');
}

export function dayLabel(dayKey: string): string {
  const day = dayjs(dayKey);
  if (day.isSame(dayjs(), 'day')) return t('time.today');
  if (day.isSame(dayjs().subtract(1, 'day'), 'day')) return t('time.yesterday');
  return day.format(getLocale() === 'ru' ? 'D MMMM YYYY' : 'MMMM D, YYYY');
}

export function fullTimestamp(iso: string): string {
  return dayjs(iso).format(getLocale() === 'ru' ? 'dddd, D MMMM YYYY, HH:mm' : 'dddd, MMMM D, YYYY h:mm A');
}

export function memberSince(iso: string): string {
  return dayjs(iso).format(getLocale() === 'ru' ? 'D MMMM YYYY' : 'MMM D, YYYY');
}

export function relativeFromNow(iso: string): string {
  return dayjs(iso).fromNow();
}
