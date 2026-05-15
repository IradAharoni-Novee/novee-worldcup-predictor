-- CreateTable
CREATE TABLE "ThirdPlaceQualifierPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdPlaceQualifierPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThirdPlaceQualifierPick_userId_idx" ON "ThirdPlaceQualifierPick"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPlaceQualifierPick_userId_teamId_key" ON "ThirdPlaceQualifierPick"("userId", "teamId");

-- AddForeignKey
ALTER TABLE "ThirdPlaceQualifierPick" ADD CONSTRAINT "ThirdPlaceQualifierPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPlaceQualifierPick" ADD CONSTRAINT "ThirdPlaceQualifierPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
