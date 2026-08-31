-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined', 'busy');

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'ringing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Call_roomName_key" ON "Call"("roomName");

-- CreateIndex
CREATE INDEX "Call_callerId_status_idx" ON "Call"("callerId", "status");

-- CreateIndex
CREATE INDEX "Call_calleeId_status_idx" ON "Call"("calleeId", "status");

-- CreateIndex
CREATE INDEX "Call_conversationId_startedAt_idx" ON "Call"("conversationId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
