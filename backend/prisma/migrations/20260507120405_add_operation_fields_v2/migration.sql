-- AlterTable
ALTER TABLE "ProductOrderOperation" ADD COLUMN     "costPerPackaging" DECIMAL(15,2),
ADD COLUMN     "ctpPlates" INTEGER,
ADD COLUMN     "itemPackaged" TEXT,
ADD COLUMN     "laminationSheetsCount" INTEGER,
ADD COLUMN     "packagingLocation" TEXT,
ADD COLUMN     "printCostPerImpression" DECIMAL(15,2),
ADD COLUMN     "printImpressions" INTEGER,
ADD COLUMN     "quantityItemFinished" INTEGER,
ADD COLUMN     "vendor" TEXT;
