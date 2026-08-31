-- AlterTable
ALTER TABLE "DirectConversation" ADD COLUMN "isVpn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectConversation" ADD COLUMN "vpnForUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_vpnForUserId_key" ON "DirectConversation"("vpnForUserId");

-- CreateEnum
CREATE TYPE "VpnOrderStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE "VpnSubscriptionStatus" AS ENUM ('trial', 'active', 'expired', 'disabled');

-- CreateTable
CREATE TABLE "VpnPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL DEFAULT 'для себя',
    "durationDays" INTEGER NOT NULL,
    "trafficGb" INTEGER,
    "deviceLimit" INTEGER NOT NULL DEFAULT 2,
    "priceRub" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VpnPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VpnOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "VpnOrderStatus" NOT NULL DEFAULT 'pending',
    "paymentProvider" TEXT NOT NULL DEFAULT 'yoomoney',
    "paymentExternalId" TEXT,
    "paymentLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "VpnOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VpnSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "orderId" TEXT,
    "status" "VpnSubscriptionStatus" NOT NULL,
    "subToken" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "trafficLimitGb" INTEGER,
    "trafficUsedGb" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "deviceLimit" INTEGER NOT NULL DEFAULT 2,
    "marzbanUsername" TEXT,
    "marzbanUuid" TEXT,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VpnSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VpnPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VpnPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VpnPlan_slug_key" ON "VpnPlan"("slug");
CREATE UNIQUE INDEX "VpnOrder_paymentLabel_key" ON "VpnOrder"("paymentLabel");
CREATE INDEX "VpnOrder_userId_idx" ON "VpnOrder"("userId");
CREATE INDEX "VpnOrder_status_idx" ON "VpnOrder"("status");
CREATE UNIQUE INDEX "VpnSubscription_orderId_key" ON "VpnSubscription"("orderId");
CREATE UNIQUE INDEX "VpnSubscription_subToken_key" ON "VpnSubscription"("subToken");
CREATE INDEX "VpnSubscription_userId_status_endsAt_idx" ON "VpnSubscription"("userId", "status", "endsAt");
CREATE UNIQUE INDEX "VpnPayment_provider_externalId_key" ON "VpnPayment"("provider", "externalId");

ALTER TABLE "VpnOrder" ADD CONSTRAINT "VpnOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VpnOrder" ADD CONSTRAINT "VpnOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VpnPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VpnSubscription" ADD CONSTRAINT "VpnSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VpnSubscription" ADD CONSTRAINT "VpnSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VpnPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VpnSubscription" ADD CONSTRAINT "VpnSubscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VpnOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VpnPayment" ADD CONSTRAINT "VpnPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VpnOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
