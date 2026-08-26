import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;

export function generateTotpSecret(): string {
  return toBase32(randomBytes(20));
}

export function otpauthUrl(username: string, secret: string): string {
  const label = encodeURIComponent(`TetherChat:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=TetherChat&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

export function totpCode(secret: string, step = Math.floor(Date.now() / 1000 / TOTP_PERIOD)): string {
  const key = fromBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(step / 0x1_0000_0000), 0);
  buffer.writeUInt32BE(step >>> 0, 4);
  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const trimmed = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmed)) return false;
  const now = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  const presented = Buffer.from(trimmed);
  for (let delta = -window; delta <= window; delta += 1) {
    const generated = Buffer.from(totpCode(secret, now + delta));
    if (generated.length === presented.length && timingSafeEqual(generated, presented)) return true;
  }
  return false;
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('malformed totp secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

function encryptionKey(): Buffer {
  return createHmac('sha256', getConfig().JWT_ACCESS_SECRET).update('tetherchat-totp').digest();
}

function toBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export async function qrDataUrl(text: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.default.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
}
