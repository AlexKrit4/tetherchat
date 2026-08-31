ALTER TABLE "User" ADD COLUMN "isPlus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "plusUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "hideLastSeen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "transcript" TEXT;
ALTER TABLE "DirectConversationMember" ADD COLUMN "wallpaperUrl" TEXT;
ALTER TABLE "ChannelNotificationSetting" ADD COLUMN "wallpaperUrl" TEXT;
