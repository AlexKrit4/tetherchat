import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { hashPassword } from './tokens.js';

export type BotKind = 'ai' | 'vpn' | 'monitor';

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
  monitor: {
    username: 'tethermonitor',
    email: 'tethermonitor@tetherchat.invalid',
    displayName: 'Server Monitor',
    bio: 'Мониторинг сервера TetherChat — только для администратора',
  },
} as const;

const cache = new Map<BotKind, string>();

export function isReservedUsername(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return Object.values(BOT_PROFILES).some((bot) => bot.username === normalized);
}

export function isReservedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return Object.values(BOT_PROFILES).some((bot) => bot.email === normalized);
}

export function botKindForUsername(username: string): BotKind | null {
  const normalized = username.trim().toLowerCase();
  for (const [kind, profile] of Object.entries(BOT_PROFILES) as [BotKind, (typeof BOT_PROFILES)[BotKind]][]) {
    if (profile.username === normalized) return kind;
  }
  return null;
}

export async function isBuiltInBotUserId(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true, username: true } });
  return Boolean(user?.isBot && botKindForUsername(user.username));
}

export async function getBotUserId(kind: BotKind): Promise<string> {
  const cached = cache.get(kind);
  if (cached) return cached;

  const profile = BOT_PROFILES[kind];
  const existingBot = await prisma.user.findFirst({
    where: {
      isBot: true,
      OR: [{ username: profile.username }, { email: profile.email }],
    },
    select: { id: true },
  });
  if (existingBot) {
    cache.set(kind, existingBot.id);
    return existingBot.id;
  }

  // A regular account may have squatted the reserved email before the bot
  // existed. Never flip that row into a bot — it would join every AI/VPN
  // conversation. Create the bot with a fallback email if needed.
  const emailOwner = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, isBot: true },
  });
  const email =
    emailOwner && !emailOwner.isBot ? `${kind}-bot@tetherchat.invalid` : profile.email;

  try {
    const created = await prisma.user.create({
      data: {
        email,
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
  } catch {
    const raced = await prisma.user.findFirst({
      where: {
        isBot: true,
        OR: [{ username: profile.username }, { email: profile.email }, { email }],
      },
      select: { id: true },
    });
    if (raced) {
      cache.set(kind, raced.id);
      return raced.id;
    }
    throw new Error(`Failed to create ${kind} bot user`);
  }
}
