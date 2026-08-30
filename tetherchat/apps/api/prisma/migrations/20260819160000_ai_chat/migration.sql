-- Built-in AI assistant account flag and per-user "Нейросеть" conversation.

ALTER TABLE "User" ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DirectConversation" ADD COLUMN "isAi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectConversation" ADD COLUMN "aiForUserId" TEXT;

CREATE UNIQUE INDEX "DirectConversation_aiForUserId_key" ON "DirectConversation"("aiForUserId");
