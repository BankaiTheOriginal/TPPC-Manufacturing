CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationStage" "OperationStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationStage" "OperationStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Machine_name_operationStage_key" ON "Machine"("name", "operationStage");
CREATE INDEX "Machine_operationStage_idx" ON "Machine"("operationStage");

CREATE UNIQUE INDEX "Vendor_name_operationStage_key" ON "Vendor"("name", "operationStage");
CREATE INDEX "Vendor_operationStage_idx" ON "Vendor"("operationStage");