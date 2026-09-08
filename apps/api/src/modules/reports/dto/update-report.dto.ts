import { ResolutionAction } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReportAdminAction {
  under_review = 'under_review',
  reject = 'reject',
  resolve = 'resolve',
  warning = 'warning',
  suspend_user = 'suspend_user',
  suspend_host = 'suspend_host',
  permanent_ban = 'permanent_ban',
  internal_note = 'internal_note',
}

export class UpdateReportDto {
  @IsEnum(ReportAdminAction)
  action!: ReportAdminAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  @IsOptional()
  @IsBoolean()
  enableCommunityWarning?: boolean;

  /** @deprecated use action — kept for backward compatibility */
  @IsOptional()
  @IsEnum(ResolutionAction)
  legacyAction?: ResolutionAction;
}