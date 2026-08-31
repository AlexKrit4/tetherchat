import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { isBlockedEitherWay } from './blocks.js';

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const row = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: otherId } },
    select: { userId: true },
  });
  return Boolean(row);
}

export async function assertFriends(userId: string, otherId: string): Promise<void> {
  if (!(await areFriends(userId, otherId))) {
    throw ApiError.forbidden('Сначала добавьте пользователя в друзья');
  }
}

export async function incomingRequestCount(userId: string): Promise<number> {
  return prisma.friendRequest.count({ where: { toId: userId } });
}

export async function createFriendshipPair(userA: string, userB: string): Promise<void> {
  await prisma.$transaction([
    prisma.friendship.upsert({
      where: { userId_friendId: { userId: userA, friendId: userB } },
      create: { userId: userA, friendId: userB },
      update: {},
    }),
    prisma.friendship.upsert({
      where: { userId_friendId: { userId: userB, friendId: userA } },
      create: { userId: userB, friendId: userA },
      update: {},
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromId: userA, toId: userB },
          { fromId: userB, toId: userA },
        ],
      },
    }),
  ]);
}

export async function dropFriendship(userA: string, userB: string): Promise<void> {
  await prisma.$transaction([
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: userA, friendId: userB },
          { userId: userB, friendId: userA },
        ],
      },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromId: userA, toId: userB },
          { fromId: userB, toId: userA },
        ],
      },
    }),
  ]);
}

export async function assertCanRequest(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) throw ApiError.badRequest('Нельзя добавить себя');
  if (await isBlockedEitherWay(fromId, toId)) {
    throw ApiError.forbidden('Нельзя отправить заявку этому пользователю');
  }
  if (await areFriends(fromId, toId)) {
    throw ApiError.conflict('Вы уже друзья');
  }
}
