ALTER TABLE "DirectConversation"
ADD COLUMN "isSecret" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message"
ADD COLUMN "encryptionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "encryptionIv" TEXT,
ADD COLUMN "ciphertext" TEXT;

CREATE TABLE "CryptoDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "CryptoDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretConversationKey" (
  "conversationId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "wrappedKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretConversationKey_pkey" PRIMARY KEY ("conversationId", "deviceId")
);

CREATE INDEX "CryptoDevice_userId_revokedAt_idx" ON "CryptoDevice"("userId", "revokedAt");
CREATE INDEX "SecretConversationKey_deviceId_idx" ON "SecretConversationKey"("deviceId");

ALTER TABLE "CryptoDevice"
ADD CONSTRAINT "CryptoDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretConversationKey"
ADD CONSTRAINT "SecretConversationKey_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretConversationKey"
ADD CONSTRAINT "SecretConversationKey_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "CryptoDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
