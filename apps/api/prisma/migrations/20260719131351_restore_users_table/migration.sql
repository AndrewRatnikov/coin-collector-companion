-- DropForeignKey
ALTER TABLE "CoinItem" DROP CONSTRAINT "CoinItem_slotId_fkey";

-- DropForeignKey
ALTER TABLE "CoinItem" DROP CONSTRAINT "CoinItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionSet" DROP CONSTRAINT "CollectionSet_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "SetSlot" DROP CONSTRAINT "SetSlot_setId_fkey";

-- DropForeignKey
ALTER TABLE "UserSet" DROP CONSTRAINT "UserSet_setId_fkey";

-- DropForeignKey
ALTER TABLE "UserSet" DROP CONSTRAINT "UserSet_userId_fkey";

-- DropTable
DROP TABLE "CoinItem";

-- DropTable
DROP TABLE "CollectionSet";

-- DropTable
DROP TABLE "SetSlot";

-- DropTable
DROP TABLE "UserSet";

-- DropEnum
DROP TYPE "Denomination";

