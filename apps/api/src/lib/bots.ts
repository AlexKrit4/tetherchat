import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { hashPassword } from './tokens.js';

export type BotKind = 'ai' | 'vpn';

const BOT_PROFILES = {
  ai: {
    username: 'tetherai',
    email: 'tetherai@tetherchat.invalid',
    displayName: 'Нейросеть',
    bio: 'Встроенный помощник TetherChat',
  },
  vpn: {
    username: 'tethervpn',
    email: 'tethervpn@tetherchat.invalid',
    displayName: 'Enigma VPN',
    bio: 'VPN для Happ — тарифы, оплата и подписка',
  },
} as const;

const cache = new Map<BotKind, string>();

export function isReservedUsername(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return Object.values(BOT_PROFILES).some((bot) => bot.username === normalized);
}

export async function getBotUserId(kind: BotKind): Promise<string> {
  const cached = cache.get(kind);
  if (cached) return cached;

  const profile = BOT_PROFILES[kind];
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: profile.username }, { email: profile.email }] },
    select: { id: true },
  });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { isBot: true } });
    cache.set(kind, existing.id);
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      emailVerified: true,
      isBot: true,
      bio: profile.bio,
      status: 'online',
    },
    select: { id: true },
  });
  cache.set(kind, created.id);
  return created.id;
}
