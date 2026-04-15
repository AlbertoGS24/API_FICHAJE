ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "scopeKey" TEXT NOT NULL DEFAULT 'GLOBAL';

UPDATE "Notification"
SET "scopeKey" =
  CASE
    WHEN "type" = 'WEEKLY_LIMIT_EXCEEDED' THEN
      COALESCE(
        'WEEK_' || COALESCE(to_char(("meta"->>'weekStart')::timestamp, 'YYYY-MM-DD'), ''),
        'WEEK_LEGACY_' || "id"
      )
    WHEN "type" = 'INTERN_40H_REMAINING' THEN 'INTERN_40H'
    ELSE 'GLOBAL'
  END;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "type", "scopeKey"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "Notification"
)
DELETE FROM "Notification"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_type_scopeKey_key"
ON "Notification"("userId", "type", "scopeKey");
