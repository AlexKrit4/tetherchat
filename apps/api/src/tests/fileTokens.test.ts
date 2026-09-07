import { describe, expect, it } from 'vitest';
import { signFileToken, verifyFileToken } from '../lib/fileTokens.js';

const SECRET = 'test-file-token-secret-key';

describe('file tokens', () => {
  it('accepts a fresh signature and rejects an expired or tampered one', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signFileToken('att_1', exp, SECRET);
    expect(verifyFileToken('att_1', exp, sig, exp - 1, SECRET)).toBe(true);
    expect(verifyFileToken('att_1', exp, sig, exp + 1, SECRET)).toBe(false);
    expect(verifyFileToken('att_2', exp, sig, exp - 1, SECRET)).toBe(false);
    expect(verifyFileToken('att_1', exp, `${sig}x`, exp - 1, SECRET)).toBe(false);
  });
});
