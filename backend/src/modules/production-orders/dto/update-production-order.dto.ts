import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority } from 'generated/prisma/enums';

export class UpdateProductionOrderDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  zohoLocationId?: string;

  @IsString()
  @IsOptional()
  zohoLocationName?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;
}
