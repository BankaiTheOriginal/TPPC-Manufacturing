import {
  IsDateString,
  IsString,
  IsInt,
  IsOptional,
  IsDecimal,
  IsArray,
  Min,
} from 'class-validator';

export class CreateFactoryActivityDto {
  @IsString()
  productOrderId!: string;

  @IsString()
  locationId!: string;

  @IsDateString()
  workDate!: string;

  @IsString()
  supervisorId!: string;

  @IsArray()
  @IsString({ each: true })
  workerNames!: string[];

  @IsInt()
  @Min(0)
  quantityAllocated!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityFinished?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityWasted?: number;

  @IsString()
  @IsOptional()
  typeOfFinishing?: string;

  @IsDecimal()
  @IsOptional()
  costPerFinish?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
