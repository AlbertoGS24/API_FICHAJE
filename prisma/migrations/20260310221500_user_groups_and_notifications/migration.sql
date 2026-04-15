DO $$
BEGIN
  CREATE TYPE "WorkerGroup" AS ENUM ('EMPLOYEE', 'INTERN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('INTERN_40H_REMAINING', 'WEEKLY_LIMIT_EXCEEDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "workerGroup" "WorkerGroup" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN IF NOT EXISTS "internshipTotalHours" INTEGER;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "message" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_type_readAt_idx"
ON "Notification"("userId", "type", "readAt");
