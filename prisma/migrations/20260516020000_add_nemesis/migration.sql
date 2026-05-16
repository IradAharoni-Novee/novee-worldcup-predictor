-- AlterTable
ALTER TABLE "User" ADD COLUMN "nemesisId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_nemesisId_fkey"
  FOREIGN KEY ("nemesisId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
