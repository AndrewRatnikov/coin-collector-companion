-- CreateEnum
CREATE TYPE "CoinStatus" AS ENUM ('approved', 'pending', 'rejected');

-- AlterTable
ALTER TABLE "Coin"
  ADD COLUMN "status" "CoinStatus" NOT NULL DEFAULT 'approved',
  ADD COLUMN "submittedByUserId" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Coin" ADD CONSTRAINT "Coin_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
