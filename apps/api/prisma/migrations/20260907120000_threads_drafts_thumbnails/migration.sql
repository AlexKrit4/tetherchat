-- AlterTable
ALTER TABLE "User" ADD COLUMN "drafts" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "threadRootId" TEXT;
ALTER TABLE "Message" ADD COLUMN "threadReplyCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "thumbnailData" TEXT;

-- CreateIndex
CREATE INDEX "Message_threadRootId_idx" ON "Message"("threadRootId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadRootId_fkey" FOREIGN KEY ("threadRootId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
