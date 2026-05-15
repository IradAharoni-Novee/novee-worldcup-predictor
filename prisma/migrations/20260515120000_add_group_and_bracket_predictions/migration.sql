-- CreateTable
CREATE TABLE "GroupPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "team1stId" TEXT NOT NULL,
    "team2ndId" TEXT NOT NULL,
    "team3rdId" TEXT NOT NULL,
    "team4thId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "round" "Stage" NOT NULL,
    "slot" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupPrediction_group_idx" ON "GroupPrediction"("group");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPrediction_userId_group_key" ON "GroupPrediction"("userId", "group");

-- CreateIndex
CREATE INDEX "BracketPick_userId_round_idx" ON "BracketPick"("userId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "BracketPick_userId_round_slot_key" ON "BracketPick"("userId", "round", "slot");

-- AddForeignKey
ALTER TABLE "GroupPrediction" ADD CONSTRAINT "GroupPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrediction" ADD CONSTRAINT "GroupPrediction_team1stId_fkey" FOREIGN KEY ("team1stId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrediction" ADD CONSTRAINT "GroupPrediction_team2ndId_fkey" FOREIGN KEY ("team2ndId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrediction" ADD CONSTRAINT "GroupPrediction_team3rdId_fkey" FOREIGN KEY ("team3rdId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPrediction" ADD CONSTRAINT "GroupPrediction_team4thId_fkey" FOREIGN KEY ("team4thId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketPick" ADD CONSTRAINT "BracketPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketPick" ADD CONSTRAINT "BracketPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
