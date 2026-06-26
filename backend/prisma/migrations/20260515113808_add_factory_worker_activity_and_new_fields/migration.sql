/*
  Warnings:

  - The values [INVENTORY_MANAGER,PRODUCTION_STAFF,FINISHING_SUPERVISOR,CUSTOMER_CARE_REP,SALES_REPRESENTATIVE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "OperationStage" ADD VALUE IF NOT EXISTS 'ARTWORK_DESIGN';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMINISTRATOR', 'GENERAL_MANAGER', 'PRODUCTION_MANAGER', 'HEAD_OF_OPERATIONS', 'SUPERVISOR', 'ACCOUNTANT', 'LOGISTICS_TEAM', 'DESIGN_TEAM');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "Operation" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "BomOperation" ADD COLUMN     "costPerCutSheet" DECIMAL(15,2),
ADD COLUMN     "costPerLamination" DECIMAL(15,2),
ADD COLUMN     "ctpPlates" INTEGER,
ADD COLUMN     "ctpType" TEXT,
ADD COLUMN     "cutoutsPerSheet" INTEGER,
ADD COLUMN     "designNames" TEXT,
ADD COLUMN     "designStatus" TEXT,
ADD COLUMN     "expectedTimeline" TIMESTAMP(3),
ADD COLUMN     "laminationSheetsCount" INTEGER,
ADD COLUMN     "numberOfDesigns" INTEGER,
ADD COLUMN     "printCostPerImpression" DECIMAL(15,2),
ADD COLUMN     "printImpressions" INTEGER,
ADD COLUMN     "quantityFinished" INTEGER,
ADD COLUMN     "totalWastage" INTEGER DEFAULT 0,
ADD COLUMN     "vendor" TEXT,
ADD COLUMN     "wastageFromDiecutting" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromHandling" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromLaminating" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromPrinting" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductOrderOperation" ADD COLUMN     "artworkDesignerId" TEXT,
ADD COLUMN     "costPerCutSheet" DECIMAL(15,2),
ADD COLUMN     "costPerLamination" DECIMAL(15,2),
ADD COLUMN     "ctpType" TEXT,
ADD COLUMN     "cutoutsPerSheet" INTEGER,
ADD COLUMN     "designNames" TEXT,
ADD COLUMN     "designStatus" TEXT,
ADD COLUMN     "expectedTimeline" TIMESTAMP(3),
ADD COLUMN     "numberOfDesigns" INTEGER,
ADD COLUMN     "quantityFinished" INTEGER,
ADD COLUMN     "quantityOfSheetsTaken" INTEGER,
ADD COLUMN     "totalWastage" INTEGER DEFAULT 0,
ADD COLUMN     "warehouseLocationId" TEXT,
ADD COLUMN     "wastageFromDiecutting" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromHandling" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromLaminating" INTEGER DEFAULT 0,
ADD COLUMN     "wastageFromPrinting" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "FactoryWorkerActivity" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "workerNames" TEXT NOT NULL,
    "quantityAllocated" INTEGER NOT NULL,
    "quantityFinished" INTEGER NOT NULL DEFAULT 0,
    "quantityWasted" INTEGER NOT NULL DEFAULT 0,
    "typeOfFinishing" TEXT,
    "costPerFinish" DECIMAL(15,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactoryWorkerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactoryWorkerActivity_locationId_idx" ON "FactoryWorkerActivity"("locationId");

-- CreateIndex
CREATE INDEX "FactoryWorkerActivity_supervisorId_idx" ON "FactoryWorkerActivity"("supervisorId");

-- CreateIndex
CREATE INDEX "FactoryWorkerActivity_createdAt_idx" ON "FactoryWorkerActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "FactoryWorkerActivity" ADD CONSTRAINT "FactoryWorkerActivity_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryWorkerActivity" ADD CONSTRAINT "FactoryWorkerActivity_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
