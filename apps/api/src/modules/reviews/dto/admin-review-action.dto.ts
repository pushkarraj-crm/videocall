import { IsIn, IsOptional } from 'class-validator';

export enum ReviewAdminAction {
  hide = 'hide',
  unhide = 'unhide',
  report = 'report',
  unreport = 'unreport',
}

export class AdminReviewActionDto {
  @IsIn(Object.values(ReviewAdminAction))
  action!: ReviewAdminAction;
}