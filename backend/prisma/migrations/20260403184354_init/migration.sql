-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'INVENTORY_MANAGER', 'PRODUCTION_STAFF', 'FINISHING_SUPERVISOR', 'CUSTOMER_CARE_REP', 'SALES_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('BRANDED', 'PLAIN', 'GENERIC');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('BAGS', 'BOXES', 'CUPS');

-- CreateEnum
CREATE TYPE "OperationStage" AS ENUM ('CTP_MAKING', 'PRINTING', 'DIECUTTING', 'LAMINATION', 'PACKAGING', 'FINISHING');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'WORK_IN_PROGRESS', 'PAUSED', 'COMPLETE', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "refreshToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantityInStock" INTEGER NOT NULL,
    "averagePrice" DECIMAL(15,2) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastRestockDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "productCategory" "ProductCategory" NOT NULL,
    "openingStock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomMaterial" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "lineTotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomOperation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "operationStage" "OperationStage" NOT NULL,
    "inventoryId" TEXT,
    "assignedStaffId" TEXT,
    "paperSize" TEXT,
    "sheetsPerPacket" INTEGER,
    "costPerPacket" DECIMAL(15,2),
    "costPerSheet" DECIMAL(15,2),
    "cutSize" TEXT,
    "cutQuantity" INTEGER,
    "costPerCut" DECIMAL(15,2),
    "ctpMachine" TEXT,
    "ctpCostPerColor" DECIMAL(15,2),
    "printMachine" TEXT,
    "printCostPerColor" DECIMAL(15,2),
    "laminationType" TEXT,
    "laminationSize" TEXT,
    "glossCost" DECIMAL(15,2),
    "matteCost" DECIMAL(15,2),
    "diecutSize" TEXT,
    "costPerDiecut" DECIMAL(15,2),
    "itemFinished" TEXT,
    "twistedHandles" INTEGER DEFAULT 65,
    "costPerFinish" DECIMAL(15,2),
    "operationName" TEXT,
    "quantityWasted" INTEGER,
    "estimatedTimeMin" INTEGER,
    "labourCost" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "zohoBooksId" TEXT NOT NULL,
    "salesOrderNumber" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "customerEmail" TEXT,
    "createdOnDateTime" TIMESTAMP(3) NOT NULL,
    "expectedShipmentDate" TIMESTAMP(3),
    "orderCompletionDate" TIMESTAMP(3),
    "itemAvailability" TEXT,
    "status" TEXT NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "sellingPrice" DECIMAL(15,2) NOT NULL,
    "productionCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lineItemTotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productId" TEXT,
    "productType" "ProductType" NOT NULL,
    "productCategory" "ProductCategory" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "zohoBooksId" TEXT,
    "zohoSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderMaterial" (
    "id" TEXT NOT NULL,
    "productOrderId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "quantityUsed" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "lineTotal" DECIMAL(15,2) NOT NULL,
    "endTotal" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrderMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderOperation" (
    "id" TEXT NOT NULL,
    "productOrderId" TEXT NOT NULL,
    "operationStage" "OperationStage" NOT NULL,
    "inventoryId" TEXT,
    "assignedStaffId" TEXT,
    "paperSize" TEXT,
    "sheetsPerPacket" INTEGER,
    "costPerPacket" DECIMAL(15,2),
    "costPerSheet" DECIMAL(15,2),
    "cutSize" TEXT,
    "cutQuantity" INTEGER,
    "costPerCut" DECIMAL(15,2),
    "ctpMachine" TEXT,
    "ctpCostPerColor" DECIMAL(15,2),
    "printMachine" TEXT,
    "printCostPerColor" DECIMAL(15,2),
    "laminationType" TEXT,
    "laminationSize" TEXT,
    "glossCost" DECIMAL(15,2),
    "matteCost" DECIMAL(15,2),
    "diecutSize" TEXT,
    "costPerDiecut" DECIMAL(15,2),
    "itemFinished" TEXT,
    "twistedHandles" INTEGER DEFAULT 65,
    "costPerFinish" DECIMAL(15,2),
    "operationName" TEXT,
    "quantityWasted" INTEGER,
    "estimatedTimeMin" INTEGER,
    "labourCost" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrderOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "operationStage" "OperationStage" NOT NULL,
    "productOrderId" TEXT,
    "role" "Role",
    "assignedStaffId" TEXT,
    "estimatedTimeMin" INTEGER,
    "details" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" "OperationStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationStatusHistory" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "previousStatus" "OperationStatus" NOT NULL,
    "newStatus" "OperationStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changeReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoSyncLog" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "zohoBooksId" TEXT,
    "sourceData" JSONB,
    "syncedData" JSONB,
    "message" TEXT,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ZohoSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoOauth" (
    "id" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoOauth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_staffId_key" ON "User"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_sku_key" ON "Inventory"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "BomMaterial_productId_idx" ON "BomMaterial"("productId");

-- CreateIndex
CREATE INDEX "BomMaterial_inventoryId_idx" ON "BomMaterial"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BomMaterial_productId_inventoryId_key" ON "BomMaterial"("productId", "inventoryId");

-- CreateIndex
CREATE INDEX "BomOperation_productId_idx" ON "BomOperation"("productId");

-- CreateIndex
CREATE INDEX "BomOperation_operationStage_idx" ON "BomOperation"("operationStage");

-- CreateIndex
CREATE INDEX "BomOperation_assignedStaffId_idx" ON "BomOperation"("assignedStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_zohoBooksId_key" ON "SalesOrder"("zohoBooksId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_salesOrderNumber_key" ON "SalesOrder"("salesOrderNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_zohoBooksId_idx" ON "SalesOrder"("zohoBooksId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_syncedAt_idx" ON "SalesOrder"("syncedAt");

-- CreateIndex
CREATE INDEX "OrderLineItem_salesOrderId_idx" ON "OrderLineItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "OrderLineItem_productId_idx" ON "OrderLineItem"("productId");

-- CreateIndex
CREATE INDEX "ProductOrder_sku_idx" ON "ProductOrder"("sku");

-- CreateIndex
CREATE INDEX "ProductOrder_productId_idx" ON "ProductOrder"("productId");

-- CreateIndex
CREATE INDEX "ProductOrder_zohoBooksId_idx" ON "ProductOrder"("zohoBooksId");

-- CreateIndex
CREATE INDEX "ProductOrder_createdAt_idx" ON "ProductOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_status_idx" ON "ProductOrder"("status");

-- CreateIndex
CREATE INDEX "ProductOrderMaterial_productOrderId_idx" ON "ProductOrderMaterial"("productOrderId");

-- CreateIndex
CREATE INDEX "ProductOrderMaterial_inventoryId_idx" ON "ProductOrderMaterial"("inventoryId");

-- CreateIndex
CREATE INDEX "ProductOrderOperation_productOrderId_idx" ON "ProductOrderOperation"("productOrderId");

-- CreateIndex
CREATE INDEX "ProductOrderOperation_operationStage_idx" ON "ProductOrderOperation"("operationStage");

-- CreateIndex
CREATE INDEX "ProductOrderOperation_assignedStaffId_idx" ON "ProductOrderOperation"("assignedStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_operationId_key" ON "Operation"("operationId");

-- CreateIndex
CREATE INDEX "Operation_operationStage_idx" ON "Operation"("operationStage");

-- CreateIndex
CREATE INDEX "Operation_status_idx" ON "Operation"("status");

-- CreateIndex
CREATE INDEX "Operation_productOrderId_idx" ON "Operation"("productOrderId");

-- CreateIndex
CREATE INDEX "Operation_assignedStaffId_idx" ON "Operation"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Operation_createdAt_idx" ON "Operation"("createdAt");

-- CreateIndex
CREATE INDEX "OperationStatusHistory_operationId_idx" ON "OperationStatusHistory"("operationId");

-- CreateIndex
CREATE INDEX "OperationStatusHistory_changedByUserId_idx" ON "OperationStatusHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "OperationStatusHistory_createdAt_idx" ON "OperationStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ZohoSyncLog_syncType_idx" ON "ZohoSyncLog"("syncType");

-- CreateIndex
CREATE INDEX "ZohoSyncLog_status_idx" ON "ZohoSyncLog"("status");

-- CreateIndex
CREATE INDEX "ZohoSyncLog_zohoBooksId_idx" ON "ZohoSyncLog"("zohoBooksId");

-- CreateIndex
CREATE INDEX "ZohoSyncLog_createdAt_idx" ON "ZohoSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BomMaterial" ADD CONSTRAINT "BomMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomMaterial" ADD CONSTRAINT "BomMaterial_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomOperation" ADD CONSTRAINT "BomOperation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomOperation" ADD CONSTRAINT "BomOperation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomOperation" ADD CONSTRAINT "BomOperation_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderMaterial" ADD CONSTRAINT "ProductOrderMaterial_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderMaterial" ADD CONSTRAINT "ProductOrderMaterial_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderOperation" ADD CONSTRAINT "ProductOrderOperation_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderOperation" ADD CONSTRAINT "ProductOrderOperation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderOperation" ADD CONSTRAINT "ProductOrderOperation_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationStatusHistory" ADD CONSTRAINT "OperationStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationStatusHistory" ADD CONSTRAINT "OperationStatusHistory_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
