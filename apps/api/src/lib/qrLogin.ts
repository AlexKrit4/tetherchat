import type { QrLoginPollResult } from '@tetherchat/shared';

const QR_LOGIN_PREFIX = 'qr-login:';
const QR_LOGIN_TTL_SECONDS = 300;

export interface QrLoginRecord {
  status: 'pending' | 'approved';
  userId?: string;
}

export function qrLoginKey(ticket: string): string {
  return `${QR_LOGIN_PREFIX}${ticket}`;
}

export function qrLoginTtlSeconds(): number {
  return QR_LOGIN_TTL_SECONDS;
}

export function qrLoginUrl(origin: string, ticket: string): string {
  return `${origin.replace(/\/$/, '')}/qr-login?ticket=${encodeURIComponent(ticket)}`;
}

export function parseQrLoginRecord(raw: string | null): QrLoginRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QrLoginRecord;
    if (parsed.status !== 'pending' && parsed.status !== 'approved') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function pendingPoll(): QrLoginPollResult {
  return { status: 'pending' };
}

export function expiredPoll(): QrLoginPollResult {
  return { status: 'expired' };
}
