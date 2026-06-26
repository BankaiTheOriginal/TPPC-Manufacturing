import { IsDecimal, IsNotEmpty, IsString } from 'class-validator';

export class AddMaterialDto {
  @IsString()
  @IsNotEmpty()
  inventoryId!: string;

  @IsDecimal()
  quantity!: string;

  @IsDecimal()
  unitPrice!: string;
}
