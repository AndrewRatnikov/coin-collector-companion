-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "Coin" ADD COLUMN     "rejectionReason" TEXT;
