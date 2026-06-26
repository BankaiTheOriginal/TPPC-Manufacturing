ALTER TABLE "FactoryWorkerActivity"
ADD COLUMN     "productOrderId" TEXT,
ADD COLUMN     "workDate" TIMESTAMP(3);

UPDATE "FactoryWorkerActivity"
SET "workDate" = "createdAt"
WHERE "workDate" IS NULL;

ALTER TABLE "FactoryWorkerActivity"
ALTER COLUMN "workDate" SET NOT NULL;

CREATE INDEX "FactoryWorkerActivity_productOrderId_idx" ON "FactoryWorkerActivity"("productOrderId");

CREATE INDEX "FactoryWorkerActivity_workDate_idx" ON "FactoryWorkerActivity"("workDate");

ALTER TABLE "FactoryWorkerActivity"
ADD CONSTRAINT "FactoryWorkerActivity_productOrderId_fkey"
FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;