import { MESSAGE_GROUP_WINDOW_MS } from './constants.js';
import type { Message } from './types.js';

export interface MessageGroupEntry {
  message: Message;
  /** First message of a group renders the avatar and username header. */
  isGroupStart: boolean;
  /**
   * Last message of a group. Bubble layouts hang the tail off it and put the
   * timestamp there instead of on every message in the run.
   */
  isGroupEnd: boolean;
  /** Rendered above the message as a date divider ("August 17, 2026"). */
  dayDivider: string | null;
  /** Rendered above the message as the red "NEW MESSAGES" line. */
  unreadDivider: boolean;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Turns a chronological message list into render entries carrying grouping and
 * divider information. Kept pure so both the virtualized list and tests can use it.
 */
export function buildMessageEntries(
  messages: Message[],
  options: { lastReadMessageId?: string | null; currentUserId?: string } = {},
): MessageGroupEntry[] {
  const entries: MessageGroupEntry[] = [];
  let unreadPlaced = false;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const previous = i > 0 ? messages[i - 1] : null;

    const sameDay = previous ? dayKey(previous.createdAt) === dayKey(message.createdAt) : false;
    const withinWindow = previous
      ? Date.parse(message.createdAt) - Date.parse(previous.createdAt) < MESSAGE_GROUP_WINDOW_MS
      : false;

    const isGroupStart =
      !previous ||
      previous.authorId !== message.authorId ||
      !sameDay ||
      !withinWindow ||
      message.system ||
      previous.system ||
      Boolean(message.replyTo);

    let unreadDivider = false;
    if (
      !unreadPlaced &&
      options.lastReadMessageId &&
      previous?.id === options.lastReadMessageId &&
      message.authorId !== options.currentUserId
    ) {
      unreadDivider = true;
      unreadPlaced = true;
    }

    entries.push({
      message,
      isGroupStart,
      // Filled in below: it depends on the message after this one.
      isGroupEnd: true,
      dayDivider: previous && sameDay ? null : dayKey(message.createdAt),
      unreadDivider,
    });
  }

  for (let i = 0; i < entries.length; i += 1) {
    const next = entries[i + 1];
    // An unread divider splits the run visually even when the author and the
    // timestamps would otherwise have kept it together.
    entries[i].isGroupEnd = !next || next.isGroupStart || next.unreadDivider;
  }

  return entries;
}
