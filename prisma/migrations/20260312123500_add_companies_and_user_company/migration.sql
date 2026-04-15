-- CreateTable
CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- Seed default company for existing data
INSERT INTO "Company" ("id", "code", "name", "isActive", "createdAt")
VALUES ('company_default', 'DEFAULT', 'Empresa principal', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Add column first as nullable for backfill
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;

-- Backfill existing users
UPDATE "User"
SET "companyId" = 'company_default'
WHERE "companyId" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

-- Add index and FK
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

ALTER TABLE "User"
ADD CONSTRAINT "User_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
