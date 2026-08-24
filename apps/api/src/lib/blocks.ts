import { prisma } from '../db.js';

/** User ids that `userId` has blocked, or that have blocked `userId`. */
export async function blockedPeerIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return ids;
}

export async function isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}
