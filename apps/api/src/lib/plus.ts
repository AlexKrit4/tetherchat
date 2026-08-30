import { LIMITS } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';

export type PlusFields = {
  isPlus: boolean;
  plusUntil?: Date | null;
};

export function isPlusActive(user: PlusFields): boolean {
  if (!user.isPlus) return false;
  if (user.plusUntil && user.plusUntil.getTime() < Date.now()) return false;
  return true;
}

export async function loadPlus(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlus: true, plusUntil: true },
  });
  return row ? isPlusActive(row) : false;
}

export async function assertPlus(userId: string): Promise<void> {
  if (!(await loadPlus(userId))) {
    throw ApiError.forbidden('Это функция TetherChat Plus');
  }
}

export function bioLimit(plus: boolean): number {
  return plus ? LIMITS.bio.plus : LIMITS.bio.max;
}

export function attachmentLimit(plus: boolean): number {
  return plus ? LIMITS.attachmentBytesPlus : LIMITS.attachmentBytes;
}

export function pinnedDmLimit(plus: boolean): number {
  return plus ? LIMITS.pinnedDmsPlus : LIMITS.pinnedDms;
}
