import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum NigerianState {
  Abia = 'Abia',
  Adamawa = 'Adamawa',
  AkwaIbom = 'AkwaIbom',
  Anambra = 'Anambra',
  Bauchi = 'Bauchi',
  Bayelsa = 'Bayelsa',
  Benue = 'Benue',
  Borno = 'Borno',
  CrossRiver = 'CrossRiver',
  Delta = 'Delta',
  Ebonyi = 'Ebonyi',
  Edo = 'Edo',
  Ekiti = 'Ekiti',
  Enugu = 'Enugu',
  FCT = 'FCT',
  Gombe = 'Gombe',
  Imo = 'Imo',
  Jigawa = 'Jigawa',
  Kaduna = 'Kaduna',
  Kano = 'Kano',
  Katsina = 'Katsina',
  Kebbi = 'Kebbi',
  Kogi = 'Kogi',
  Kwara = 'Kwara',
  Lagos = 'Lagos',
  Nasarawa = 'Nasarawa',
  Niger = 'Niger',
  Ogun = 'Ogun',
  Ondo = 'Ondo',
  Osun = 'Osun',
  Oyo = 'Oyo',
  Plateau = 'Plateau',
  Rivers = 'Rivers',
  Sokoto = 'Sokoto',
  Taraba = 'Taraba',
  Yobe = 'Yobe',
  Zamfara = 'Zamfara',
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @IsEnum(NigerianState)
  state: NigerianState;
}
