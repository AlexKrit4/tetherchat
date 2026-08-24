import { describe, expect, it } from 'vitest';
import { handshakeIsSilent } from './silent.js';

describe('handshakeIsSilent', () => {
  it('accepts a boolean from the web client', () => {
    expect(handshakeIsSilent({ silent: true }, {})).toBe(true);
    expect(handshakeIsSilent({ silent: false }, {})).toBe(false);
  });

  it('accepts the string form used by the Android socket client', () => {
    expect(handshakeIsSilent({ silent: 'true' }, {})).toBe(true);
    expect(handshakeIsSilent({ token: 'x' }, { silent: '1' })).toBe(true);
    expect(handshakeIsSilent({}, { silent: ['true'] })).toBe(true);
    expect(handshakeIsSilent({}, {})).toBe(false);
  });
});
