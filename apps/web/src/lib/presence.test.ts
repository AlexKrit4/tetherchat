import { describe, expect, it } from 'vitest';
import { isPresentOnline } from './presence';

describe('isPresentOnline', () => {
  it('counts online, idle and dnd as in-session', () => {
    expect(isPresentOnline('online')).toBe(true);
    expect(isPresentOnline('idle')).toBe(true);
    expect(isPresentOnline('dnd')).toBe(true);
  });

  it('hides offline and invisible people from the online list', () => {
    expect(isPresentOnline('offline')).toBe(false);
    expect(isPresentOnline('invisible')).toBe(false);
    expect(isPresentOnline(undefined)).toBe(false);
  });
});
