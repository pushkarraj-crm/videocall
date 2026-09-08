import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  async check() {
    const database = await this.health.checkDatabase();
    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database },
    };
  }

  @Public()
  @Get('live')
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    return this.health.getReadiness();
  }

  @Public()
  @Get('metrics')
  async metrics() {
    return this.health.getMetrics();
  }
}