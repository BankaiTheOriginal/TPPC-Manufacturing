-- AlterTable: add quantityExcess to ProductOrderOperation
ALTER TABLE "ProductOrderOperation" ADD COLUMN "quantityExcess" INTEGER DEFAULT 0;

-- CreateTable: TaskPrerequisite (global stage gating)
CREATE TABLE "TaskPrerequisite" (
    "id" TEXT NOT NULL,
    "stage" "OperationStage" NOT NULL,
    "requiredStage" "OperationStage" NOT NULL,
    "unlockThreshold" TEXT NOT NULL DEFAULT 'partial_any',
    "thresholdPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TaskPrerequisiteOverride (per-order overrides)
CREATE TABLE "TaskPrerequisiteOverride" (
    "id" TEXT NOT NULL,
    "productOrderId" TEXT NOT NULL,
    "stage" "OperationStage" NOT NULL,
    "requiredStage" "OperationStage",
    "unlockThreshold" TEXT NOT NULL DEFAULT 'partial_any',
    "thresholdPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPrerequisiteOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AppSetting (key-value config)
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskPrerequisite_stage_key" ON "TaskPrerequisite"("stage");

-- CreateIndex
CREATE INDEX "TaskPrerequisiteOverride_productOrderId_idx" ON "TaskPrerequisiteOverride"("productOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPrerequisiteOverride_productOrderId_stage_key" ON "TaskPrerequisiteOverride"("productOrderId", "stage");

-- AddForeignKey
ALTER TABLE "TaskPrerequisiteOverride" ADD CONSTRAINT "TaskPrerequisiteOverride_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: Default prerequisite chain (each stage requires previous stage)
-- PAPER_SELECTION: no prerequisite (first stage)
-- CUTTING requires PAPER_SELECTION
INSERT INTO "TaskPrerequisite" ("id", "stage", "requiredStage", "unlockThreshold", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'CUTTING',       'PAPER_SELECTION', 'partial_any', NOW()),
  (gen_random_uuid()::text, 'ARTWORK_DESIGN','CUTTING',         'partial_any', NOW()),
  (gen_random_uuid()::text, 'CTP_MAKING',    'ARTWORK_DESIGN',  'partial_any', NOW()),
  (gen_random_uuid()::text, 'PRINTING',      'CTP_MAKING',      'partial_any', NOW()),
  (gen_random_uuid()::text, 'LAMINATION',    'PRINTING',        'partial_any', NOW()),
  (gen_random_uuid()::text, 'DIECUTTING',    'LAMINATION',      'partial_any', NOW()),
  (gen_random_uuid()::text, 'FINISHING',     'DIECUTTING',       'partial_any', NOW()),
  (gen_random_uuid()::text, 'PACKAGING',     'FINISHING',        'partial_any', NOW());
