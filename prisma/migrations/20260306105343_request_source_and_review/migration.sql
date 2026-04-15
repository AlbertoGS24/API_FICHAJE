-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('EMPLOYEE', 'COMPANY');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "source" "RequestSource" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateIndex
CREATE INDEX "Request_source_idx" ON "Request"("source");
