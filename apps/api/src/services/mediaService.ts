import type { ChatMediaItem, Paginated } from '@tetherchat/shared';
import { prisma } from '../db.js';

export async function listChatMedia(input: {
  channelId?: string;
  conversationId?: string;
  before?: string;
  limit: number;
}): Promise<Paginated<ChatMediaItem>> {
  const rows = await prisma.attachment.findMany({
    where: {
      message: {
        deletedAt: null,
        ...(input.channelId ? { channelId: input.channelId } : {}),
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      },
      OR: [{ contentType: { startsWith: 'image/' } }, { contentType: { startsWith: 'video/' } }],
      ...(input.before ? { createdAt: { lt: new Date(input.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit + 1,
    select: {
      id: true,
      url: true,
      filename: true,
      contentType: true,
      width: true,
      height: true,
      spoiler: true,
      createdAt: true,
      messageId: true,
    },
  });

  const media = rows.slice(0, input.limit + 1);

  const hasMore = media.length > input.limit;
  const items = (hasMore ? media.slice(0, input.limit) : media).flatMap((row) =>
    row.messageId
      ? [
          {
            id: row.id,
            messageId: row.messageId,
            url: row.url,
            filename: row.filename,
            contentType: row.contentType,
            width: row.width,
            height: row.height,
            spoiler: row.spoiler,
            createdAt: row.createdAt.toISOString(),
          } satisfies ChatMediaItem,
        ]
      : [],
  );

  return { items, hasMore };
}
