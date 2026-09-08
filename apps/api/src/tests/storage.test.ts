import { describe, expect, it } from 'vitest';
import { isSafeStorageKey, physicalStorageKey } from '../lib/storage.js';

describe('storage keys', () => {
  it('strips the forwarded-copy suffix so the original blob can be read', () => {
    expect(physicalStorageKey('attachments/u/1-abc.txt#msg:att')).toBe('attachments/u/1-abc.txt');
    expect(physicalStorageKey('avatars/u/photo.webp')).toBe('avatars/u/photo.webp');
  });

  it('rejects path traversal even when the key starts with a public prefix', () => {
    expect(isSafeStorageKey('avatars/u/photo.webp')).toBe(true);
    expect(isSafeStorageKey('attachments/u/1-abc.txt#msg:att')).toBe(true);
    expect(isSafeStorageKey('avatars/../../../etc/passwd')).toBe(false);
    expect(isSafeStorageKey('avatars/%2e%2e/secret')).toBe(false);
    expect(isSafeStorageKey('/etc/passwd')).toBe(false);
    expect(isSafeStorageKey('avatars/..\\..\\secret')).toBe(false);
  });
});
