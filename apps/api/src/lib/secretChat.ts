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
): Promise<DirectConversation[]> {
  if (!deviceId) return conversations;
  const secretIds = conversations.filter((row) => row.isSecret).map((row) => row.id);
  if (secretIds.length === 0) return conversations;
  const allowed = await secretConversationIdsForDevice(deviceId);
  return conversations.filter((row) => !row.isSecret || allowed.has(row.id));
}
