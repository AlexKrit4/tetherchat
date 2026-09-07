import { describe, expect, it } from 'vitest';
import { mergeDrafts, parseDrafts } from '../lib/drafts.js';

describe('draft merge', () => {
  it('keeps the newer text and drops empty ones', () => {
    const current = parseDrafts({
      a: { text: 'old', updatedAt: 1 },
      b: { text: 'keep', updatedAt: 5 },
    });
    const merged = mergeDrafts(current, {
      a: { text: 'new', updatedAt: 2 },
      b: { text: '', updatedAt: 6 },
      c: { text: 'fresh', updatedAt: 3 },
    });
    expect(merged).toEqual({
      a: { text: 'new', updatedAt: 2 },
      c: { text: 'fresh', updatedAt: 3 },
    });
  });
});
