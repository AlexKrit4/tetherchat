import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config.js';

const DEFAULT_TTL_SEC = 12 * 60 * 60;

export function fileTokenTtlSec(): number {
  return DEFAULT_TTL_SEC;
}

export function signFileToken(attachmentId: string, exp: number, secret = getConfig().JWT_ACCESS_SECRET): string {
  return createHmac('sha256', secret).update(`${attachmentId}.${exp}`).digest('base64url');
}

export function verifyFileToken(
  attachmentId: string,
  exp: number,
  sig: string,
  now = Math.floor(Date.now() / 1000),
  secret = getConfig().JWT_ACCESS_SECRET,
): boolean {
  if (!Number.isFinite(exp) || exp <= now) return false;
  if (!sig) return false;
  const expected = signFileToken(attachmentId, exp, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signedFilePath(attachmentId: string, ttlSec = DEFAULT_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = signFileToken(attachmentId, exp);
  return `/api/files/${attachmentId}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

export function signedFileUrl(attachmentId: string, ttlSec = DEFAULT_TTL_SEC): string {
  const origin = getConfig().PUBLIC_API_ORIGIN.replace(/\/$/, '');
  return `${origin}${signedFilePath(attachmentId, ttlSec)}`;
}
