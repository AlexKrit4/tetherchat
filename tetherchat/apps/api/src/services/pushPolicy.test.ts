import { describe, expect, it } from 'vitest';
import { shouldDeliverPush } from './pushPolicy.js';

describe('shouldDeliverPush', () => {
  it('notifies by default when the user has no per-channel setting', () => {
    expect(shouldDeliverPush(undefined, false)).toBe(true);
    expect(shouldDeliverPush(undefined, true)).toBe(true);
  });

  it('honours mute and nothing', () => {
    expect(shouldDeliverPush({ muted: true, level: 'all' }, true)).toBe(false);
    expect(shouldDeliverPush({ muted: false, level: 'nothing' }, true)).toBe(false);
  });

  it('limits mentions-only channels to actual mentions', () => {
    expect(shouldDeliverPush({ muted: false, level: 'mentions' }, false)).toBe(false);
    expect(shouldDeliverPush({ muted: false, level: 'mentions' }, true)).toBe(true);
  });

  it('delivers every message at the all level', () => {
    expect(shouldDeliverPush({ muted: false, level: 'all' }, false)).toBe(true);
  });
});
