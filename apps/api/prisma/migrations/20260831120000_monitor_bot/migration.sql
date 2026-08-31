-- AlterTable
ALTER TABLE "DirectConversation" ADD COLUMN "isMonitor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectConversation" ADD COLUMN "monitorForUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_monitorForUserId_key" ON "DirectConversation"("monitorForUserId");
