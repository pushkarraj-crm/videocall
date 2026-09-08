import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['user', 'host', 'admin'])
  role?: 'user' | 'host' | 'admin';

  @IsOptional()
  @IsIn(['online', 'offline', 'busy'])
  onlineStatus?: 'online' | 'offline' | 'busy';

  @IsOptional()
  @IsIn(['verified', 'pending', 'rejected', 'none'])
  kycStatus?: 'verified' | 'pending' | 'rejected' | 'none';

  @IsOptional()
  @IsIn(['active', 'suspended', 'banned'])
  accountStatus?: 'active' | 'suspended' | 'banned';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminUserNoteDto {
  @IsString()
  note!: string;
}

export class AdminUserSuspendDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminUserHostControlsDto {
  @IsOptional()
  @IsBoolean()
  callsDisabled?: boolean;

  @IsOptional()
  @IsBoolean()
  withdrawalsDisabled?: boolean;
}