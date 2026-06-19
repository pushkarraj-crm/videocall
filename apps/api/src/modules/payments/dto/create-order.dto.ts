import { IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  packageId!: string;
}