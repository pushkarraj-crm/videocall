import { NotificationPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export enum AnnouncementTarget {
  all_users = 'all_users',
  hosts_only = 'hosts_only',
  users_only = 'users_only',
  verified_hosts = 'verified_hosts',
  premium_users = 'premium_users',
  single_user = 'single_user',
}

export class SendAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsEnum(AnnouncementTarget)
  target!: AnnouncementTarget;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsUUID()
  userId?: string;
}