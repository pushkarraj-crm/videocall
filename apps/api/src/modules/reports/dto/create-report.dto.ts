import { ReportCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  reportedId!: string;

  @IsEnum(ReportCategory)
  category!: ReportCategory;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsUUID()
  @IsOptional()
  callId?: string;

  @IsUUID()
  @IsOptional()
  messageId?: string;

  @IsUrl()
  @IsOptional()
  evidenceUrl?: string;
}