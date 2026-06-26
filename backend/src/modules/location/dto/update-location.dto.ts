import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NigerianState } from './create-location.dto';

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  addressLine?: string;

  @IsEnum(NigerianState)
  @IsOptional()
  state?: NigerianState;
}
