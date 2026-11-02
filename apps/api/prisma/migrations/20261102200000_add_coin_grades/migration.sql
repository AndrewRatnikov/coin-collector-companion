-- CreateEnum
CREATE TYPE "CoinGrade" AS ENUM ('G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC');

-- AlterTable
ALTER TABLE "Ownership" ADD COLUMN     "grade" "CoinGrade";

-- AlterTable
ALTER TABLE "UserSet" ADD COLUMN     "minGrade" "CoinGrade";
