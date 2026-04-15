-- CreateTable
CREATE TABLE "ScheduleTemplateEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "type" "ScheduleEntryType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTemplateEntry_userId_weekday_key" ON "ScheduleTemplateEntry"("userId", "weekday");

-- CreateIndex
CREATE INDEX "ScheduleTemplateEntry_userId_idx" ON "ScheduleTemplateEntry"("userId");

-- AddForeignKey
ALTER TABLE "ScheduleTemplateEntry"
ADD CONSTRAINT "ScheduleTemplateEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
