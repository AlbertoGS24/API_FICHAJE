-- CreateEnum
CREATE TYPE "ScheduleEntryType" AS ENUM (
  'WORK',
  'VACATION',
  'SICK_LEAVE',
  'DAY_OFF',
  'HOLIDAY'
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "type" "ScheduleEntryType" NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_userId_date_key" ON "ScheduleEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "ScheduleEntry_date_idx" ON "ScheduleEntry"("date");

-- AddForeignKey
ALTER TABLE "ScheduleEntry"
ADD CONSTRAINT "ScheduleEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
