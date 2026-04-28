-- CreateEnum
CREATE TYPE "AgentProvider" AS ENUM ('OPENCLAW');

-- CreateTable
CREATE TABLE "AgentIntegration" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" "AgentProvider" NOT NULL DEFAULT 'OPENCLAW',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "tokenHash" TEXT,
  "tokenPreview" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentIntegration_tokenHash_key" ON "AgentIntegration"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentIntegration_companyId_provider_key" ON "AgentIntegration"("companyId", "provider");

-- CreateIndex
CREATE INDEX "AgentIntegration_companyId_isEnabled_idx" ON "AgentIntegration"("companyId", "isEnabled");

-- AddForeignKey
ALTER TABLE "AgentIntegration"
ADD CONSTRAINT "AgentIntegration_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
