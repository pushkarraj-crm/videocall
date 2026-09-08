import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('COMMUNICATIONS_INTERNAL_API_KEY');
    if (!key) {
      throw new UnauthorizedException('Internal API is disabled');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-internal-api-key'];
    if (typeof header !== 'string' || header !== key) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}