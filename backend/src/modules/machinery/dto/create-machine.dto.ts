import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OperationStage } from 'generated/prisma/enums';

export class CreateMachineDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(OperationStage)
  operationStage!: OperationStage;
}