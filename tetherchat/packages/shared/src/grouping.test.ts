import { describe, expect, it } from 'vitest';
import { buildMessageEntries } from './grouping.js';
import type { Message, PublicUser } from './types.js';

const author: PublicUser = {
  id: 'u1',
  username: 'wumpus',
  displayName: 'Wumpus',
  avatarUrl: null,
  bannerColor: null,
  bio: null,
  customStatus: null,
  status: 'online',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const other: PublicUser = { ...author, id: 'u2', username: 'hoods', displayName: 'Hoods' };

function message(overrides: Partial<Message> & { id: string; createdAt: string }): Message {
  return {
    channelId: 'c1',
    serverId: 's1',
    authorId: overrides.authorId ?? author.id,
    author: overrides.author ?? author,
    content: 'hello',
    editedAt: null,
    pinned: false,
    system: false,
    replyTo: null,
    attachments: [],
    reactions: [],
    previews: [],
    mentionedUserIds: [],
    mentionsEveryone: false,
    ...overrides,
  };
}

describe('buildMessageEntries', () => {
  it('groups consecutive messages from the same author', () => {
    const entries = buildMessageEntries([
      message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z' }),
      message({ id: 'm2', createdAt: '2026-08-17T14:14:00.000Z' }),
    ]);

    expect(entries[0].isGroupStart).toBe(true);
    expect(entries[1].isGroupStart).toBe(false);
  });

  it('breaks a group when the author changes', () => {
    const entries = buildMessageEntries([
      message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z' }),
      message({ id: 'm2', createdAt: '2026-08-17T14:13:30.000Z', authorId: other.id, author: other }),
    ]);

    expect(entries[1].isGroupStart).toBe(true);
  });

  it('breaks a group after the 5 minute window', () => {
    const entries = buildMessageEntries([
      message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z' }),
      message({ id: 'm2', createdAt: '2026-08-17T14:19:00.000Z' }),
    ]);

    expect(entries[1].isGroupStart).toBe(true);
  });

  it('breaks a group for replies and system messages', () => {
    const entries = buildMessageEntries([
      message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z' }),
      message({
        id: 'm2',
        createdAt: '2026-08-17T14:13:10.000Z',
        replyTo: { id: 'm1', authorId: author.id, author, content: 'hello', deleted: false },
      }),
      message({ id: 'm3', createdAt: '2026-08-17T14:13:20.000Z', system: true }),
    ]);

    expect(entries[1].isGroupStart).toBe(true);
    expect(entries[2].isGroupStart).toBe(true);
  });

  it('emits a day divider on the first message and on date changes', () => {
    const entries = buildMessageEntries([
      message({ id: 'm1', createdAt: '2026-08-16T23:59:00.000Z' }),
      message({ id: 'm2', createdAt: '2026-08-17T00:01:00.000Z' }),
    ]);

    expect(entries[0].dayDivider).toBe('2026-08-16');
    expect(entries[1].dayDivider).toBe('2026-08-17');
    expect(entries[1].isGroupStart).toBe(true);
  });

  it('places the unread divider once, after the last read message', () => {
    const entries = buildMessageEntries(
      [
        message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z' }),
        message({ id: 'm2', createdAt: '2026-08-17T14:14:00.000Z', authorId: other.id, author: other }),
        message({ id: 'm3', createdAt: '2026-08-17T14:15:00.000Z', authorId: other.id, author: other }),
      ],
      { lastReadMessageId: 'm1', currentUserId: 'me' },
    );

    expect(entries.map((entry) => entry.unreadDivider)).toEqual([false, true, false]);
  });

  it('does not show the unread divider for the reader own message', () => {
    const entries = buildMessageEntries(
      [
        message({ id: 'm1', createdAt: '2026-08-17T14:13:00.000Z', authorId: 'me' }),
        message({ id: 'm2', createdAt: '2026-08-17T14:14:00.000Z', authorId: 'me' }),
      ],
      { lastReadMessageId: 'm1', currentUserId: 'me' },
    );

    expect(entries.every((entry) => !entry.unreadDivider)).toBe(true);
  });
});
