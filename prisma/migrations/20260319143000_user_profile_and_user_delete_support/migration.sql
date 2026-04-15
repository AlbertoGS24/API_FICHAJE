-- Add profile fields to users
ALTER TABLE "User"
ADD COLUMN "phone" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3);

-- Allow deleting reviewer users without breaking reviewed requests
ALTER TABLE "Request" DROP CONSTRAINT "Request_reviewedById_fkey";

ALTER TABLE "Request"
ADD CONSTRAINT "Request_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
