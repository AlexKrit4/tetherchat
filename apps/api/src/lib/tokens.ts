import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config.js';
import { ApiError } from '../errors.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const config = getConfig();
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL,
    issuer: 'tetherchat',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, getConfig().JWT_ACCESS_SECRET, { issuer: 'tetherchat' });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('malformed token');
    return { sub: String(decoded.sub), username: String((decoded as jwt.JwtPayload).username ?? '') };
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

/** Access token lifetime in seconds, exposed to clients so they can pre-refresh. */
export function accessTokenTtlSeconds(): number {
  const ttl = getConfig().ACCESS_TOKEN_TTL;
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * multiplier;
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 digest is stored,
 * so a database leak cannot be replayed against the auth endpoints.
 */
export function createRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + getConfig().REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOpaqueToken(bytes = 32): { token: string; tokenHash: string } {
  const token = randomBytes(bytes).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export const REFRESH_COOKIE = 'tc_refresh';

export function refreshCookieOptions() {
  const config = getConfig();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.COOKIE_SECURE,
    domain: config.COOKIE_DOMAIN,
    path: '/api/auth',
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400,
  };
}
