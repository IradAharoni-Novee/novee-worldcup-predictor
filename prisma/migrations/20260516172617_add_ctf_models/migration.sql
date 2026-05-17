-- CreateTable
CREATE TABLE "CtfFlag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "hint" TEXT NOT NULL,
    "discoveryHint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtfFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtfCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtfCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CtfFlag_slug_key" ON "CtfFlag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CtfFlag_code_key" ON "CtfFlag"("code");

-- CreateIndex
CREATE INDEX "CtfCapture_userId_idx" ON "CtfCapture"("userId");

-- CreateIndex
CREATE INDEX "CtfCapture_flagId_idx" ON "CtfCapture"("flagId");

-- CreateIndex
CREATE UNIQUE INDEX "CtfCapture_userId_flagId_key" ON "CtfCapture"("userId", "flagId");

-- AddForeignKey
ALTER TABLE "CtfCapture" ADD CONSTRAINT "CtfCapture_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "CtfFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
