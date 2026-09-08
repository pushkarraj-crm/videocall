import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

export class BulkPromoActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['activate', 'deactivate', 'delete'])
  action!: 'activate' | 'deactivate' | 'delete';
}