-- DropForeignKey
ALTER TABLE "PodiumPrediction" DROP CONSTRAINT "PodiumPrediction_userId_fkey";

-- DropForeignKey
ALTER TABLE "PodiumPrediction" DROP CONSTRAINT "PodiumPrediction_firstId_fkey";

-- DropForeignKey
ALTER TABLE "PodiumPrediction" DROP CONSTRAINT "PodiumPrediction_secondId_fkey";

-- DropForeignKey
ALTER TABLE "PodiumPrediction" DROP CONSTRAINT "PodiumPrediction_thirdId_fkey";

-- DropTable
DROP TABLE "PodiumPrediction";
