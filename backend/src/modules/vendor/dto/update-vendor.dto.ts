import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OperationStage } from 'generated/prisma/enums';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(OperationStage)
  @IsOptional()
  operationStage?: OperationStage;
}