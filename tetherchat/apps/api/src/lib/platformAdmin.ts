import { PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_USERNAME } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';

export function isDesignatedAdmin(user: { username: string; email: string }): boolean {
  return user.username === PLATFORM_ADMIN_USERNAME && user.email === PLATFORM_ADMIN_EMAIL;
}

export async function syncPlatformAdminFlag(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, isPlatformAdmin: true },
  });
  if (!user) return false;
  const designated = isDesignatedAdmin(user);
  if (designated !== user.isPlatformAdmin && designated) {
    await prisma.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
    return true;
  }
  return user.isPlatformAdmin || designated;
}

export async function assertPlatformAdmin(userId: string): Promise<void> {
  const ok = await syncPlatformAdminFlag(userId);
  if (!ok) throw ApiError.forbidden('Недостаточно прав');
}

export async function activeSiteBan(userId: string) {
  const now = new Date();
  return prisma.siteBan.findFirst({
    where: {
      userId,
      liftedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function banLoginMessage(ban: { reason: string; expiresAt: Date | null }): string {
  if (!ban.expiresAt) return ban.reason;
  const until = ban.expiresAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  return `${ban.reason}\nБлокировка до ${until} (МСК).`;
}
