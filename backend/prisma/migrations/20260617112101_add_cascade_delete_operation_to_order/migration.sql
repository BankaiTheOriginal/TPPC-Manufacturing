-- AddForeignKey: change Operation.productOrderId to ON DELETE CASCADE
ALTER TABLE "Operation" DROP CONSTRAINT IF EXISTS "Operation_productOrderId_fkey";
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_productOrderId_fkey"
    FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
