import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(calendar);
dayjs.extend(relativeTime);
/** "Today at 2:13 PM" — the timestamp format shown next to a message author. */
export function messageTimestamp(iso) {
    return dayjs(iso).calendar(null, {
        sameDay: '[Today at] h:mm A',
        lastDay: '[Yesterday at] h:mm A',
        lastWeek: 'MM/DD/YYYY h:mm A',
        sameElse: 'MM/DD/YYYY h:mm A',
    });
}
/** Compact form used on grouped messages when hovered. */
export function shortTime(iso) {
    return dayjs(iso).format('h:mm A');
}
/** Divider label between days of history. */
export function dayLabel(dayKey) {
    const day = dayjs(dayKey);
    if (day.isSame(dayjs(), 'day'))
        return 'Today';
    if (day.isSame(dayjs().subtract(1, 'day'), 'day'))
        return 'Yesterday';
    return day.format('MMMM D, YYYY');
}
export function fullTimestamp(iso) {
    return dayjs(iso).format('dddd, MMMM D, YYYY h:mm A');
}
export function memberSince(iso) {
    return dayjs(iso).format('MMM D, YYYY');
}
export function relativeFromNow(iso) {
    return dayjs(iso).fromNow();
}
//# sourceMappingURL=time.js.map