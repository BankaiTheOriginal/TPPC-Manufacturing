import {
  IsDateString,
  IsString,
  IsInt,
  IsOptional,
  IsDecimal,
  IsArray,
  Min,
} from 'class-validator';

export class UpdateFactoryActivityDto {
  @IsString()
  @IsOptional()
  productOrderId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  workDate?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workerNames?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  quantityAllocated?: number;

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
