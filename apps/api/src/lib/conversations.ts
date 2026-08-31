import { prisma } from '../db.js';
import { conversationInclude, toConversation } from './serialize.js';
import { emitToUser } from '../ws/realtime.js';

/** Push an updated conversation to every active member (e.g. after unhide on new message). */
export async function emitConversationRefresh(conversationId: string): Promise<void> {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!conversation) return;
  for (const member of conversation.members) {
    if (member.leftAt) continue;
    emitToUser(member.userId, 'dm:update', toConversation(conversation, member.userId));
  }
}
