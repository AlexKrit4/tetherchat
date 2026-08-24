/** Socket.IO Java sends auth values as strings; browsers send a boolean. */
export function handshakeIsSilent(auth: unknown, query: unknown): boolean {
  const authSilent = (auth as { silent?: unknown } | null | undefined)?.silent;
  if (authSilent === true || authSilent === 'true' || authSilent === '1') return true;

  const raw = (query as { silent?: unknown } | null | undefined)?.silent;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === true || value === 'true' || value === '1';
}
