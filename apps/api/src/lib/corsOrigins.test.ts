import { describe, expect, it } from 'vitest';
import { DESKTOP_WEB_ORIGINS, webCorsOrigins } from './corsOrigins.js';

describe('webCorsOrigins', () => {
  it('includes configured web origins and desktop shell origins', () => {
    const origins = webCorsOrigins('https://tetherchat.ru,http://localhost:5173');
    expect(origins).toContain('https://tetherchat.ru');
    expect(origins).toContain('http://localhost:5173');
    for (const desktop of DESKTOP_WEB_ORIGINS) {
      expect(origins).toContain(desktop);
    }
  });
});
