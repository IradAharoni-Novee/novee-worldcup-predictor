-- CreateTable
CREATE TABLE "PodiumPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstId" TEXT NOT NULL,
    "secondId" TEXT NOT NULL,
    "thirdId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodiumPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodiumPrediction_userId_key" ON "PodiumPrediction"("userId");

-- CreateIndex
CREATE INDEX "PodiumPrediction_firstId_idx" ON "PodiumPrediction"("firstId");

-- CreateIndex
CREATE INDEX "PodiumPrediction_secondId_idx" ON "PodiumPrediction"("secondId");

-- CreateIndex
CREATE INDEX "PodiumPrediction_thirdId_idx" ON "PodiumPrediction"("thirdId");

-- AddForeignKey
ALTER TABLE "PodiumPrediction" ADD CONSTRAINT "PodiumPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodiumPrediction" ADD CONSTRAINT "PodiumPrediction_firstId_fkey" FOREIGN KEY ("firstId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodiumPrediction" ADD CONSTRAINT "PodiumPrediction_secondId_fkey" FOREIGN KEY ("secondId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodiumPrediction" ADD CONSTRAINT "PodiumPrediction_thirdId_fkey" FOREIGN KEY ("thirdId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
