ALTER TABLE "ProductOrderOperation"
ADD COLUMN "paperSelectionOpId" TEXT;

CREATE INDEX "ProductOrderOperation_productOrderId_paperSelectionOpId_idx"
ON "ProductOrderOperation"("productOrderId", "paperSelectionOpId");