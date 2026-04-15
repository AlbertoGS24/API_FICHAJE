-- CreateTable
CREATE TABLE "AdminActivationKey" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "companyCode" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyLogoUrl" TEXT,
  "adminEmail" TEXT NOT NULL,
  "adminName" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "usedByUserId" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminActivationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminActivationKey_keyHash_key" ON "AdminActivationKey"("keyHash");

-- CreateIndex
CREATE INDEX "AdminActivationKey_companyCode_idx" ON "AdminActivationKey"("companyCode");

-- CreateIndex
CREATE INDEX "AdminActivationKey_adminEmail_idx" ON "AdminActivationKey"("adminEmail");

-- CreateIndex
CREATE INDEX "AdminActivationKey_expiresAt_usedAt_idx" ON "AdminActivationKey"("expiresAt", "usedAt");
