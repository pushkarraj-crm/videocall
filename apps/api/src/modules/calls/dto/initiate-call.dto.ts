import { IsUUID } from 'class-validator';

export class InitiateCallDto {
  @IsUUID()
  calleeId!: string;
}