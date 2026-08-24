-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "durationMs" INTEGER;

-- AlterTable
ALTER TABLE "DirectConversation" ADD COLUMN "isSaved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectConversation" ADD COLUMN "savedForUserId" TEXT;

-- AlterTable
ALTER TABLE "DirectConversationMember" ADD COLUMN "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "forwardedFromId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_savedForUserId_key" ON "DirectConversation"("savedForUserId");

-- CreateIndex
CREATE INDEX "Message_forwardedFromId_idx" ON "Message"("forwardedFromId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
