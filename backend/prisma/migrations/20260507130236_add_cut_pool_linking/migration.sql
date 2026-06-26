-- AlterTable
ALTER TABLE "ProductOrderOperation" ADD COLUMN     "cutsConsumed" INTEGER,
ADD COLUMN     "sourceCuttingOpId" TEXT,
ADD COLUMN     "targetOperationStage" TEXT;
