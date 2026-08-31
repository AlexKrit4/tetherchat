import { ApiError } from '../errors.js';
import { prisma } from '../db.js';
import { isDesignatedAdmin } from './platformAdmin.js';

export async function canAccessMonitorBot(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, isPlatformAdmin: true },
  });
  if (!user) return false;
  return isDesignatedAdmin(user) || user.isPlatformAdmin;
}

export async function assertMonitorBotAccess(userId: string): Promise<void> {
  if (!(await canAccessMonitorBot(userId))) {
    throw ApiError.forbidden('Недостаточно прав');
  }
}
