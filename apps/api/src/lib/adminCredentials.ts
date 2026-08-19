import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export function mskNow(now = new Date()): Date {
  return new Date(now.getTime() + MSK_OFFSET_MS);
}

/** Calendar date in Europe/Moscow, YYYY-MM-DD. */
export function mskDateKey(now = new Date()): string {
  return mskNow(now).toISOString().slice(0, 10);
}

/** Instant of the next 00:00 Europe/Moscow. */
export function nextMskMidnight(now = new Date()): Date {
  const msk = mskNow(now);
  const next = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() + 1, 0, 0, 0, 0);
  return new Date(next - MSK_OFFSET_MS);
}

export function secondsUntilMskMidnight(now = new Date()): number {
  return Math.max(1, Math.floor((nextMskMidnight(now).getTime() - now.getTime()) / 1000));
}

export function dailyAdminCredentials(now = new Date()): {
  dateKey: string;
  login: string;
  password: string;
  expiresAt: Date;
} {
  const dateKey = mskDateKey(now);
  return {
    dateKey,
    login: hmacSlice(`admin-login:${dateKey}`, 18),
    password: hmacSlice(`admin-password:${dateKey}`, 18),
    expiresAt: nextMskMidnight(now),
  };
}

export function adminCredentialsMatch(login: string, password: string, now = new Date()): boolean {
  const expected = dailyAdminCredentials(now);
  return safeEqual(login, expected.login) && safeEqual(password, expected.password);
}

function hmacSlice(label: string, length: number): string {
  const digest = createHmac('sha256', `${getConfig().JWT_ACCESS_SECRET}:admin-daily`)
    .update(label)
    .digest();
  let output = '';
  for (let i = 0; output.length < length; i += 1) {
    output += ALPHABET[digest[i % digest.length] % ALPHABET.length];
  }
  return output.slice(0, length);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
