import {
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsEnum,
} from 'class-validator';
import { OperationStage } from 'generated/prisma/enums';

export class UpsertOperationDto {
  @IsEnum(OperationStage)
  operationStage!: OperationStage;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  operationName?: string;

  @IsString()
  @IsOptional()
  assignedStaffId?: string;

  @IsString()
  @IsOptional()
  inventoryId?: string;

  @IsString()
  @IsOptional()
  paperSelectionOpId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityFinished?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityWasted?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedTimeMin?: number;

  @IsDecimal()
  @IsOptional()
  labourCost?: string;

  // Paper
  @IsString()
  @IsOptional()
  paperSize?: string;

  @IsInt()
  @IsOptional()
  sheetsPerPacket?: number;

  @IsDecimal()
  @IsOptional()
  costPerPacket?: string;

  @IsDecimal()
  @IsOptional()
  costPerSheet?: string;

  // Cutting
  @IsString()
  @IsOptional()
  cutSize?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  cutQuantity?: number;

  @IsDecimal()
  @IsOptional()
  costPerCut?: string;

  // CTP
  @IsString()
  @IsOptional()
  ctpMachine?: string;

  @IsDecimal()
  @IsOptional()
  ctpCostPerColor?: string;

  // Printing
  @IsString()
  @IsOptional()
  printMachine?: string;

  @IsDecimal()
  @IsOptional()
  printCostPerColor?: string;

  // Lamination
  @IsString()
  @IsOptional()
  laminationType?: string;

  @IsString()
  @IsOptional()
  laminationSize?: string;

  @IsDecimal()
  @IsOptional()
  glossCost?: string;

  @IsDecimal()
  @IsOptional()
  matteCost?: string;

  // Diecut
  @IsString()
  @IsOptional()
  diecutSize?: string;

  @IsDecimal()
  @IsOptional()
  costPerDiecut?: string;

  // Finishing
  @IsString()
  @IsOptional()
  itemFinished?: string;

  @IsString()
  @IsOptional()
  finishingLocation?: string;

  @IsInt()
  @IsOptional()
  twistedHandles?: number;

  @IsString()
  @IsOptional()
  bagBaseSize?: string;

  @IsDecimal()
  @IsOptional()
  costPerFinish?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  stageStatus?: string;

  // Vendor (CTP, Printing, Diecutting, Lamination)
  @IsString()
  @IsOptional()
  vendor?: string;

  // CTP additional
  @IsInt()
  @IsOptional()
  ctpPlates?: number;

  // Printing additional
  @IsInt()
  @IsOptional()
  printImpressions?: number;

  @IsDecimal()
  @IsOptional()
  printCostPerImpression?: string;

  // Lamination additional
  @IsInt()
  @IsOptional()
  laminationSheetsCount?: number;

  // Packaging
  @IsString()
  @IsOptional()
  itemPackaged?: string;

  @IsString()
  @IsOptional()
  packagingLocation?: string;

  @IsInt()
  @IsOptional()
  quantityItemFinished?: number;

  @IsDecimal()
  @IsOptional()
  costPerPackaging?: string;

  // Cut-pool linking
  @IsString()
  @IsOptional()
  targetOperationStage?: string;

  @IsString()
  @IsOptional()
  sourceCuttingOpId?: string;

  @IsInt()
  @IsOptional()
  cutsConsumed?: number;

  // Paper Selection additional
  @IsString()
  @IsOptional()
  warehouseLocationId?: string;

  @IsInt()
  @IsOptional()
  quantityOfSheetsTaken?: number;

  @IsInt()
  @IsOptional()
  cutoutsPerSheet?: number;

  @IsDecimal()
  @IsOptional()
  costPerCutSheet?: string;

  // Artwork/Design
  @IsString()
  @IsOptional()
  artworkDesignerId?: string;

  @IsInt()
  @IsOptional()
  numberOfDesigns?: number;

  @IsString()
  @IsOptional()
  designNames?: string;

  @IsString()
  @IsOptional()
  designStatus?: string;

  // CTP additional
  @IsString()
  @IsOptional()
  ctpType?: string;

  // Lamination additional
  @IsDecimal()
  @IsOptional()
  costPerLamination?: string;

  // Finishing additional
  @IsInt()
  @IsOptional()
  wastageFromPrinting?: number;

  @IsInt()
  @IsOptional()
  wastageFromDiecutting?: number;

  @IsInt()
  @IsOptional()
  wastageFromLaminating?: number;

  @IsInt()
  @IsOptional()
  wastageFromHandling?: number;

  @IsInt()
  @IsOptional()
  totalWastage?: number;

  // Expected timeline
  @IsString()
  @IsOptional()
  expectedTimeline?: string;

  // Lifecycle timestamps (ISO strings — set by the service automatically,
  // but can be supplied directly if needed)
  @IsString()
  @IsOptional()
  startedAt?: string;

  @IsString()
  @IsOptional()
  stageMovedAt?: string;

  @IsString()
  @IsOptional()
  completedAt?: string;
}
