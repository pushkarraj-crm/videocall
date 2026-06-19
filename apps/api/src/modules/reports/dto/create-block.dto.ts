import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBlockDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}