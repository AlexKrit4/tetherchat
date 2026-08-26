import { MESSAGE_GROUP_WINDOW_MS } from './constants.js';
function dayKey(iso) {
    return iso.slice(0, 10);
}
/**
 * Turns a chronological message list into render entries carrying grouping and
 * divider information. Kept pure so both the virtualized list and tests can use it.
 */
export function buildMessageEntries(messages, options = {}) {
    const entries = [];
    let unreadPlaced = false;
    for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i];
        const previous = i > 0 ? messages[i - 1] : null;
        const sameDay = previous ? dayKey(previous.createdAt) === dayKey(message.createdAt) : false;
        const withinWindow = previous
            ? Date.parse(message.createdAt) - Date.parse(previous.createdAt) < MESSAGE_GROUP_WINDOW_MS
            : false;
        const isGroupStart = !previous ||
            previous.authorId !== message.authorId ||
            !sameDay ||
            !withinWindow ||
            message.system ||
            previous.system ||
            Boolean(message.replyTo);
        let unreadDivider = false;
        if (!unreadPlaced &&
            options.lastReadMessageId &&
            previous?.id === options.lastReadMessageId &&
            message.authorId !== options.currentUserId) {
            unreadDivider = true;
            unreadPlaced = true;
        }
        entries.push({
            message,
            isGroupStart,
            dayDivider: previous && sameDay ? null : dayKey(message.createdAt),
            unreadDivider,
        });
    }
    return entries;
}
//# sourceMappingURL=grouping.js.map