import { IsIn } from 'class-validator';

export class SetHostStatusDto {
  @IsIn(['ONLINE', 'OFFLINE'])
  status!: 'ONLINE' | 'OFFLINE';
}