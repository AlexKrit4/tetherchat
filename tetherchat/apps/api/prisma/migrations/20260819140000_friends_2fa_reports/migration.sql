-- 2FA, platform admin, friend requests, pinned DMs, spoilers, reports, site bans.

ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isPlatformAdmin" = true
WHERE "username" = 'alexkrit' AND "email" = 'alesa89851307411@gmail.com';

ALTER TABLE "Attachment" ADD COLUMN "spoiler" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DirectConversationMember" ADD COLUMN "pinnedAt" TIMESTAMP(3);

CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendRequest_fromId_toId_key" ON "FriendRequest"("fromId", "toId");
CREATE INDEX "FriendRequest_toId_createdAt_idx" ON "FriendRequest"("toId", "createdAt");

ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Friendship" (
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userId","friendId")
);

CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ReportStatus" AS ENUM ('pending', 'pardoned', 'banned');

CREATE TABLE "SiteBan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "SiteBan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteBan_userId_liftedAt_idx" ON "SiteBan"("userId", "liftedAt");
CREATE INDEX "SiteBan_expiresAt_idx" ON "SiteBan"("expiresAt");

ALTER TABLE "SiteBan" ADD CONSTRAINT "SiteBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteBan" ADD CONSTRAINT "SiteBan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "siteBanId" TEXT,
    "messageContent" TEXT NOT NULL,
    "messageCreatedAt" TIMESTAMP(3) NOT NULL,
    "attachmentsJson" JSONB NOT NULL,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageReport_siteBanId_key" ON "MessageReport"("siteBanId");
CREATE INDEX "MessageReport_status_createdAt_idx" ON "MessageReport"("status", "createdAt");
CREATE INDEX "MessageReport_reporterId_messageId_idx" ON "MessageReport"("reporterId", "messageId");
CREATE INDEX "MessageReport_targetUserId_idx" ON "MessageReport"("targetUserId");

ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_siteBanId_fkey" FOREIGN KEY ("siteBanId") REFERENCES "SiteBan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
