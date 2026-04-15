-- CreateTable
CREATE TABLE "Workplace" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 200,
  "strictMode" BOOLEAN NOT NULL DEFAULT false,
  "maxAllowedAccuracy" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Workplace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workplace_companyId_key" ON "Workplace"("companyId");
CREATE INDEX "Workplace_companyId_strictMode_idx" ON "Workplace"("companyId", "strictMode");

-- AddForeignKey
ALTER TABLE "Workplace"
ADD CONSTRAINT "Workplace_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Shift"
ADD COLUMN "startDistanceMeters" DOUBLE PRECISION,
ADD COLUMN "endDistanceMeters" DOUBLE PRECISION,
ADD COLUMN "startInsideGeofence" BOOLEAN,
ADD COLUMN "endInsideGeofence" BOOLEAN,
ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riskReasons" JSONB,
ADD COLUMN "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "startIp" TEXT,
ADD COLUMN "endIp" TEXT,
ADD COLUMN "startUserAgent" TEXT,
ADD COLUMN "endUserAgent" TEXT;

-- CreateIndex
CREATE INDEX "Shift_isSuspicious_startAt_idx" ON "Shift"("isSuspicious", "startAt");
