-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "fdId" INTEGER,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "dateOfBirth" TEXT,
    "nationality" TEXT,
    "teamId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentWinnerPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentWinnerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenBootPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldenBootPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_fdId_key" ON "Player"("fdId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentWinnerPrediction_userId_key" ON "TournamentWinnerPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenBootPrediction_userId_key" ON "GoldenBootPrediction"("userId");

-- CreateIndex
CREATE INDEX "GoldenBootPrediction_playerId_idx" ON "GoldenBootPrediction"("playerId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentWinnerPrediction" ADD CONSTRAINT "TournamentWinnerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentWinnerPrediction" ADD CONSTRAINT "TournamentWinnerPrediction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenBootPrediction" ADD CONSTRAINT "GoldenBootPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenBootPrediction" ADD CONSTRAINT "GoldenBootPrediction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
