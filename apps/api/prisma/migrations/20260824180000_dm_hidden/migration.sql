-- Per-user DM hide (delete for me).
ALTER TABLE "DirectConversationMember" ADD COLUMN "hiddenAt" TIMESTAMP(3);
