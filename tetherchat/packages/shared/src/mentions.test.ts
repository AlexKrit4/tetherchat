import { describe, expect, it } from 'vitest';
import {
  extractChannelMentions,
  extractUrls,
  extractUserMentions,
  mentionsEveryone,
  tokenizeMentions,
} from './mentions.js';

describe('mentions', () => {
  it('extracts user and channel mentions without duplicates', () => {
    const content = 'hey <@u1> and <@u1>, see <#c9>';
    expect(extractUserMentions(content)).toEqual(['u1']);
    expect(extractChannelMentions(content)).toEqual(['c9']);
  });

  it('detects @everyone only as a standalone token', () => {
    expect(mentionsEveryone('@everyone when are y-all free?')).toBe(true);
    expect(mentionsEveryone('ping (@everyone)')).toBe(true);
    expect(mentionsEveryone('mail me at me@everyone.com')).toBe(false);
    expect(mentionsEveryone('@everyonelse')).toBe(false);
  });

  it('tokenizes content into text and mention parts', () => {
    expect(tokenizeMentions('hi <@u1> in <#c1> @everyone!')).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'user', id: 'u1' },
      { type: 'text', value: ' in ' },
      { type: 'channel', id: 'c1' },
      { type: 'text', value: ' ' },
      { type: 'everyone' },
      { type: 'text', value: '!' },
    ]);
  });

  it('extracts urls up to the limit', () => {
    const content = 'a https://a.example b https://b.example c https://c.example d https://d.example';
    expect(extractUrls(content)).toHaveLength(3);
    expect(extractUrls(content, 1)).toEqual(['https://a.example']);
  });

  it('trims trailing punctuation-free urls only', () => {
    expect(extractUrls('see https://tetherchat.ru/invite/abc123')).toEqual([
      'https://tetherchat.ru/invite/abc123',
    ]);
  });
});
