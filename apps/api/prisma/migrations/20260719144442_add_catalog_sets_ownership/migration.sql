-- CreateTable
CREATE TABLE "Coin" (
    "id" TEXT NOT NULL,
    "numistaTypeId" TEXT,
    "country" TEXT NOT NULL,
    "denomination" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mintMark" TEXT NOT NULL DEFAULT '',
    "variety" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageSource" TEXT,
    "imageLicense" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,

    CONSTRAINT "CanonicalSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalSetCoin" (
    "id" TEXT NOT NULL,
    "canonicalSetId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CanonicalSetCoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clonedFromCanonicalId" TEXT,
    "clonedFromUserSetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetCoin" (
    "id" TEXT NOT NULL,
    "userSetId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "UserSetCoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ownership" (
    "userId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "ownedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("userId","coinId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coin_country_denomination_year_mintMark_variety_key" ON "Coin"("country", "denomination", "year", "mintMark", "variety");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSetCoin_canonicalSetId_coinId_key" ON "CanonicalSetCoin"("canonicalSetId", "coinId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetCoin_userSetId_coinId_key" ON "UserSetCoin"("userSetId", "coinId");

-- AddForeignKey
ALTER TABLE "CanonicalSetCoin" ADD CONSTRAINT "CanonicalSetCoin_canonicalSetId_fkey" FOREIGN KEY ("canonicalSetId") REFERENCES "CanonicalSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSetCoin" ADD CONSTRAINT "CanonicalSetCoin_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSet" ADD CONSTRAINT "UserSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSet" ADD CONSTRAINT "UserSet_clonedFromCanonicalId_fkey" FOREIGN KEY ("clonedFromCanonicalId") REFERENCES "CanonicalSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSet" ADD CONSTRAINT "UserSet_clonedFromUserSetId_fkey" FOREIGN KEY ("clonedFromUserSetId") REFERENCES "UserSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetCoin" ADD CONSTRAINT "UserSetCoin_userSetId_fkey" FOREIGN KEY ("userSetId") REFERENCES "UserSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetCoin" ADD CONSTRAINT "UserSetCoin_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
