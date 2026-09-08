import { IsIn, IsOptional, IsString } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

export class OperationsOverviewQueryDto extends AnalyticsQueryDto {}

export class OperationsPaymentsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class OperationsLogsQueryDto {
  @IsOptional()
  @IsIn(['api', 'error', 'payment', 'auth', 'all'])
  type?: 'api' | 'error' | 'payment' | 'auth' | 'all';

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class OperationsSupportQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class OperationsReportExportDto extends AnalyticsQueryDto {
  @IsIn(['daily', 'weekly', 'monthly', 'revenue', 'calls', 'payments'])
  report!: 'daily' | 'weekly' | 'monthly' | 'revenue' | 'calls' | 'payments';

  @IsOptional()
  @IsIn(['csv', 'excel'])
  format?: 'csv' | 'excel';
}