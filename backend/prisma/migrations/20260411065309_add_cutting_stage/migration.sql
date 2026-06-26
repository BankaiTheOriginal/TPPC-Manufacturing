-- AlterEnum
ALTER TYPE "OperationStage" ADD VALUE 'CUTTING';

-- DropIndex
DROP INDEX "ProductOrderOperation_productOrderId_operationStage_key";
