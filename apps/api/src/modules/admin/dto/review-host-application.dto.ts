import { HostApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewHostApplicationDto {
  @IsEnum(HostApplicationStatus)
  status!: HostApplicationStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}