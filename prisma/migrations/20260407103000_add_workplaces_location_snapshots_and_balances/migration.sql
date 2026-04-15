ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "vacationAllowanceDays" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "overtimeBankMinutesAdjustment" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Shift"
  ADD COLUMN IF NOT EXISTS "workplaceId" TEXT,
  ADD COLUMN IF NOT EXISTS "startAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "endAddress" TEXT;

ALTER TABLE "Workplace"
  ADD COLUMN IF NOT EXISTS "addressLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "municipality" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "Workplace_companyId_key";

UPDATE "Workplace"
SET "isPrimary" = true
WHERE "companyId" IN (
  SELECT "companyId"
  FROM "Workplace"
  GROUP BY "companyId"
  HAVING COUNT(*) = 1
);

CREATE INDEX IF NOT EXISTS "Shift_workplaceId_idx" ON "Shift"("workplaceId");
CREATE INDEX IF NOT EXISTS "Workplace_companyId_isPrimary_idx" ON "Workplace"("companyId", "isPrimary");
CREATE INDEX IF NOT EXISTS "Workplace_companyId_isActive_idx" ON "Workplace"("companyId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Shift_workplaceId_fkey'
      AND table_name = 'Shift'
  ) THEN
    ALTER TABLE "Shift"
      ADD CONSTRAINT "Shift_workplaceId_fkey"
      FOREIGN KEY ("workplaceId") REFERENCES "Workplace"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
