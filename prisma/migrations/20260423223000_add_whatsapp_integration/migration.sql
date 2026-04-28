-- CreateEnum
CREATE TYPE "WhatsappProvider" AS ENUM ('META_CLOUD_API');

-- CreateEnum
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WhatsappMessageStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SENT', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "WhatsappClockAction" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "WhatsappClockSessionStatus" AS ENUM ('PENDING_LOCATION', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "WhatsappIntegration" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" "WhatsappProvider" NOT NULL DEFAULT 'META_CLOUD_API',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "displayPhoneNumber" TEXT,
  "phoneNumberId" TEXT,
  "businessAccountId" TEXT,
  "allowClockIn" BOOLEAN NOT NULL DEFAULT true,
  "allowClockOut" BOOLEAN NOT NULL DEFAULT true,
  "requireLocation" BOOLEAN NOT NULL DEFAULT true,
  "lastInboundAt" TIMESTAMP(3),
  "lastOutboundAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsappIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessageLog" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT,
  "companyId" TEXT,
  "userId" TEXT,
  "direction" "WhatsappMessageDirection" NOT NULL,
  "status" "WhatsappMessageStatus" NOT NULL,
  "messageType" TEXT,
  "command" TEXT,
  "body" TEXT,
  "fromPhone" TEXT,
  "toPhone" TEXT,
  "providerMessageId" TEXT,
  "payload" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsappMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappClockSession" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "action" "WhatsappClockAction" NOT NULL,
  "status" "WhatsappClockSessionStatus" NOT NULL DEFAULT 'PENDING_LOCATION',
  "requestedWorkplaceId" TEXT,
  "shiftId" TEXT,
  "locationLat" DOUBLE PRECISION,
  "locationLng" DOUBLE PRECISION,
  "locationAccuracy" DOUBLE PRECISION,
  "locationAddress" TEXT,
  "providerMessageId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsappClockSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappIntegration_phoneNumberId_key" ON "WhatsappIntegration"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappIntegration_companyId_provider_key" ON "WhatsappIntegration"("companyId", "provider");

-- CreateIndex
CREATE INDEX "WhatsappIntegration_companyId_isEnabled_idx" ON "WhatsappIntegration"("companyId", "isEnabled");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_companyId_createdAt_idx" ON "WhatsappMessageLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_integrationId_createdAt_idx" ON "WhatsappMessageLog"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_userId_createdAt_idx" ON "WhatsappMessageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessageLog_status_createdAt_idx" ON "WhatsappMessageLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappClockSession_companyId_createdAt_idx" ON "WhatsappClockSession"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappClockSession_userId_createdAt_idx" ON "WhatsappClockSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappClockSession_status_expiresAt_idx" ON "WhatsappClockSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WhatsappClockSession_phone_createdAt_idx" ON "WhatsappClockSession"("phone", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsappIntegration"
ADD CONSTRAINT "WhatsappIntegration_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessageLog"
ADD CONSTRAINT "WhatsappMessageLog_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "WhatsappIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessageLog"
ADD CONSTRAINT "WhatsappMessageLog_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessageLog"
ADD CONSTRAINT "WhatsappMessageLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappClockSession"
ADD CONSTRAINT "WhatsappClockSession_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "WhatsappIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappClockSession"
ADD CONSTRAINT "WhatsappClockSession_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappClockSession"
ADD CONSTRAINT "WhatsappClockSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
