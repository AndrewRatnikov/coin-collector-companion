-- CreateEnum
CREATE TYPE "Denomination" AS ENUM ('Cent', 'Nickel', 'Dime', 'Quarter', 'HalfDollar', 'Dollar');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "denomination" "Denomination" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetSlot" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mintMark" TEXT,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isKeyDate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SetSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "denomination" "Denomination" NOT NULL,
    "year" INTEGER NOT NULL,
    "mintMark" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "grade" TEXT,
    "purchasePrice" DECIMAL(65,30),
    "notes" TEXT,
    "acquiredDate" TIMESTAMP(3),
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SetSlot_setId_idx" ON "SetSlot"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "SetSlot_setId_year_mintMark_label_key" ON "SetSlot"("setId", "year", "mintMark", "label");

-- CreateIndex
CREATE UNIQUE INDEX "UserSet_userId_setId_key" ON "UserSet"("userId", "setId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinItem_userId_slotId_key" ON "CoinItem"("userId", "slotId");

-- AddForeignKey
ALTER TABLE "CollectionSet" ADD CONSTRAINT "CollectionSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetSlot" ADD CONSTRAINT "SetSlot_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CollectionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSet" ADD CONSTRAINT "UserSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSet" ADD CONSTRAINT "UserSet_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CollectionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinItem" ADD CONSTRAINT "CoinItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinItem" ADD CONSTRAINT "CoinItem_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SetSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
