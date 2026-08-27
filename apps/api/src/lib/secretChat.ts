import type { DirectConversation } from '@tetherchat/shared';
import { prisma } from '../db.js';

export async function userHasSecretKey(conversationId: string, userId: string): Promise<boolean> {
  const count = await prisma.secretConversationKey.count({
    where: {
      conversationId,
      device: { userId, revokedAt: null },
    },
  });
  return count > 0;
}

export async function deviceHasSecretKey(conversationId: string, deviceId: string): Promise<boolean> {
  const row = await prisma.secretConversationKey.findUnique({
    where: { conversationId_deviceId: { conversationId, deviceId } },
  });
  return Boolean(row);
}

export async function secretConversationIdsForDevice(deviceId: string): Promise<Set<string>> {
  const rows = await prisma.secretConversationKey.findMany({
    where: { deviceId },
    select: { conversationId: true },
  });
  return new Set(rows.map((row) => row.conversationId));
}

export async function filterSecretConversationsForDevice(
  conversations: DirectConversation[],
  deviceId: string | undefined,
  userId?: string,
): Promise<DirectConversation[]> {
  const hasSecrets = conversations.some((row) => row.isSecret);
  if (!hasSecrets) return conversations;
  if (!deviceId) return conversations.filter((row) => !row.isSecret);
  if (userId) {
    const device = await prisma.cryptoDevice.findUnique({
      where: { id: deviceId },
      select: { userId: true, revokedAt: true },
    });
    if (!device || device.userId !== userId || device.revokedAt) {
      return conversations.filter((row) => !row.isSecret);
    }
  }
  const allowed = await secretConversationIdsForDevice(deviceId);
  return conversations.filter((row) => !row.isSecret || allowed.has(row.id));
}
