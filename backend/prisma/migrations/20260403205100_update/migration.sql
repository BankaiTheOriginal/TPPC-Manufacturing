/*
  Warnings:

  - A unique constraint covering the columns `[productOrderId,operationStage]` on the table `ProductOrderOperation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductOrderOperation_productOrderId_operationStage_key" ON "ProductOrderOperation"("productOrderId", "operationStage");
