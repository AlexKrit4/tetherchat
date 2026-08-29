import { describe, expect, it } from 'vitest';
import { importConversationAesKey } from './e2ee';

describe('importConversationAesKey', () => {
  it('keeps the AES key extractable so a peer claim can wrap it', async () => {
    const generated = (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ])) as CryptoKey;
    const raw = await crypto.subtle.exportKey('raw', generated);
    const stored = await importConversationAesKey(raw);

    expect(stored.extractable).toBe(true);
    const exported = await crypto.subtle.exportKey('raw', stored);
    expect(new Uint8Array(exported)).toEqual(new Uint8Array(raw));
  });

  it('cannot wrap a key that was imported as non-extractable', async () => {
    const generated = (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ])) as CryptoKey;
    const raw = await crypto.subtle.exportKey('raw', generated);
    const locked = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);

    await expect(crypto.subtle.exportKey('raw', locked)).rejects.toThrow();
  });
});
