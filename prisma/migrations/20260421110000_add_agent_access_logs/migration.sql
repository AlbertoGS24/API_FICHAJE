-- CreateTable
CREATE TABLE "AgentAccessLog" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT,
  "companyId" TEXT,
  "provider" "AgentProvider",
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentAccessLog_companyId_createdAt_idx" ON "AgentAccessLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAccessLog_integrationId_createdAt_idx" ON "AgentAccessLog"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAccessLog_status_createdAt_idx" ON "AgentAccessLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentAccessLog"
ADD CONSTRAINT "AgentAccessLog_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "AgentIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAccessLog"
ADD CONSTRAINT "AgentAccessLog_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
