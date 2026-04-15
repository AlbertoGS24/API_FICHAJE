-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "country" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "municipality" TEXT,
ADD COLUMN "postalCode" TEXT;

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM (
  'NATIONAL',
  'REGIONAL',
  'PROVINCIAL',
  'LOCAL',
  'COMPANY'
);

-- CreateTable
CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "HolidayScope" NOT NULL DEFAULT 'COMPANY',
  "country" TEXT,
  "region" TEXT,
  "province" TEXT,
  "municipality" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holiday_companyId_date_idx" ON "Holiday"("companyId", "date");

-- CreateIndex
CREATE INDEX "Holiday_companyId_scope_date_idx" ON "Holiday"("companyId", "scope", "date");

-- AddForeignKey
ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
