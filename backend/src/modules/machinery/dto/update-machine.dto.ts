import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OperationStage } from 'generated/prisma/enums';

export class UpdateMachineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(OperationStage)
  @IsOptional()
  operationStage?: OperationStage;
}