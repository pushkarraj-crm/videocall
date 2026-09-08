import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { LegalPolicyService } from './legal-policy.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalPolicies: LegalPolicyService) {}

  @Public()
  @Get('policies')
  list() {
    return this.legalPolicies.listPublished();
  }

  @Public()
  @Get('policies/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.legalPolicies.getPublishedBySlug(slug);
  }
}