import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@tetherchat/shared';
import { messageDeepLink, notifyIncomingMessage } from './push';

function message(partial: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    channelId: 'c1',
    serverId: 's1',
    authorId: 'u2',
    author: {
      id: 'u2',
      username: 'wumpus',
      displayName: 'Wumpus',
      avatarUrl: null,
      bannerColor: null,
      bio: null,
      customStatus: null,
      status: 'online',
      createdAt: new Date().toISOString(),
    },
    content: 'hello there',
    createdAt: new Date().toISOString(),
    editedAt: null,
    pinned: false,
    system: false,
    replyTo: null,
    attachments: [],
    reactions: [],
    previews: [],
    mentionedUserIds: [],
    mentionsEveryone: false,
    ...partial,
  };
}

describe('messageDeepLink', () => {
  it('points at the server channel or a DM thread', () => {
    expect(messageDeepLink(message())).toBe('/channels/s1/c1');
    expect(messageDeepLink(message({ serverId: null }))).toBe('/channels/@me/c1');
  });
});

describe('notifyIncomingMessage', () => {
  it('uses the native Android bridge when the page is hidden', () => {
    const showNotification = vi.fn();
    window.TetherChatNative = {
      showNotification,
      notificationsAllowed: () => true,
    };
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    localStorage.setItem('tetherchat:push-subscribed', '1');

    notifyIncomingMessage(message(), 'u1');
    expect(showNotification).toHaveBeenCalledWith('Wumpus', 'hello there', '/channels/s1/c1');

    showNotification.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    notifyIncomingMessage(message(), 'u1');
    expect(showNotification).not.toHaveBeenCalled();

    window.__tetherchatNativeBackground = true;
    notifyIncomingMessage(message(), 'u1');
    expect(showNotification).toHaveBeenCalledTimes(1);

    delete window.TetherChatNative;
    delete window.__tetherchatNativeBackground;
  });
});
