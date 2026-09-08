import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['today', '7d', '30d', '90d', 'custom'])
  period?: 'today' | '7d' | '30d' | '90d' | 'custom';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class AnalyticsExportQueryDto extends AnalyticsQueryDto {
  @IsIn(['revenue', 'hosts', 'withdrawals'])
  type!: 'revenue' | 'hosts' | 'withdrawals';
}