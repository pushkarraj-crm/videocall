import { ResolutionAction } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class ResolveReportDto {
  @IsString()
  resolution!: string;

  @IsEnum(ResolutionAction)
  action!: ResolutionAction;
}