import { afterEach, describe, expect, it } from 'vitest';
import { listOutbox, markOutboxFailed, putOutbox, removeOutbox, type OutboxItem } from './outbox';

const KEY = 'tetherchat-outbox';

function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    nonce: 'n1',
    userId: 'alice',
    channelId: 'chan-1',
    createdAt: 1_700_000_000_000,
    status: 'pending',
    payload: { content: 'hello from Alice', isDm: false, isSecret: false },
    ...overrides,
  };
}

afterEach(() => {
  localStorage.removeItem(KEY);
});

describe('outbox user isolation', () => {
  it('does not flush another account\'s pending sends', () => {
    putOutbox(
      item({
        userId: 'alice',
        channelId: 'dm-alice',
        payload: { content: 'alice secret', isDm: true, isSecret: false },
      }),
    );
    putOutbox(
      item({
        nonce: 'n2',
        userId: 'bob',
        channelId: 'chan-1',
        payload: { content: 'bob hi', isDm: false, isSecret: false },
      }),
    );

    expect(listOutbox('bob').map((entry) => entry.payload.content)).toEqual(['bob hi']);
    expect(listOutbox('alice').map((entry) => entry.payload.content)).toEqual(['alice secret']);
    expect(listOutbox('bob', 'chan-1')).toHaveLength(1);
    expect(listOutbox('alice', 'chan-1')).toHaveLength(0);
  });

  it('does not send Alice\'s pending channel message after Bob logs in on the same browser', () => {
    putOutbox(
      item({
        userId: 'alice',
        channelId: 'shared-general',
        payload: { content: 'пароль от Wi-Fi: hunter2', isDm: false, isSecret: false },
      }),
    );

    expect(listOutbox('bob', 'shared-general')).toEqual([]);
    expect(listOutbox('alice', 'shared-general')[0]?.payload.content).toBe('пароль от Wi-Fi: hunter2');
  });

  it('drops legacy rows that have no userId so a later login cannot send them', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          nonce: 'legacy',
          channelId: 'chan-1',
          createdAt: Date.now(),
          status: 'pending',
          payload: { content: 'left behind', isDm: false, isSecret: false },
        },
        item({ nonce: 'owned', userId: 'bob' }),
      ]),
    );

    expect(listOutbox('bob').map((entry) => entry.nonce)).toEqual(['owned']);
    expect(listOutbox('alice')).toEqual([]);
  });

  it('fails and removes only the current user\'s row when nonces collide', () => {
    putOutbox(item({ nonce: 'same', userId: 'alice', payload: { content: 'A', isDm: false, isSecret: false } }));
    putOutbox(item({ nonce: 'same', userId: 'bob', payload: { content: 'B', isDm: false, isSecret: false } }));

    markOutboxFailed('same', 'bob');
    expect(listOutbox('alice')[0]?.status).toBe('pending');
    expect(listOutbox('bob')[0]?.status).toBe('failed');

    removeOutbox('same', 'bob');
    expect(listOutbox('bob')).toEqual([]);
    expect(listOutbox('alice')).toHaveLength(1);
  });
});
