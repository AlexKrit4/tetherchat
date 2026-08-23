import { describe, expect, it } from 'vitest';
import { detectMentionQuery } from './MentionAutocomplete';

describe('detectMentionQuery', () => {
  it('detects a user mention at the caret', () => {
    const value = 'hey @wum';
    expect(detectMentionQuery(value, value.length)).toEqual({
      kind: 'user',
      term: 'wum',
      start: 4,
    });
  });

  it('detects a channel mention', () => {
    const value = 'see #gen';
    expect(detectMentionQuery(value, value.length)).toEqual({
      kind: 'channel',
      term: 'gen',
      start: 4,
    });
  });

  it('detects a trigger typed at the very start', () => {
    expect(detectMentionQuery('@', 1)).toEqual({ kind: 'user', term: '', start: 0 });
  });

  it('ignores a trigger in the middle of a word', () => {
    expect(detectMentionQuery('mail me at me@example', 21)).toBeNull();
    expect(detectMentionQuery('what about C#', 13)).toBeNull();
  });

  it('stops matching once the mention is finished', () => {
    const value = 'hey @wumpus said hi';
    expect(detectMentionQuery(value, value.length)).toBeNull();
  });

  it('only looks at text before the caret', () => {
    const value = 'hey @wum and more';
    expect(detectMentionQuery(value, 8)).toEqual({ kind: 'user', term: 'wum', start: 4 });
  });

  it('handles cyrillic names', () => {
    const value = 'привет @вум';
    expect(detectMentionQuery(value, value.length)).toEqual({
      kind: 'user',
      term: 'вум',
      start: 7,
    });
  });
});
