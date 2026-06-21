import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { PublishJob } from '@lyra/shared';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { BrowserService } from './browser.service';
import { BrowserPublishBody } from './dto';

// ⚠️ FENCED browser-automation connector — see browser.service.ts. Off by default
// (BROWSER_CONNECTOR_ENABLED=true to arm). Same service-token auth as the rest of
// the connectors-service; lives on its own /browser/* routes, NOT the publish path.
@Controller('browser')
@UseGuards(ServiceTokenGuard)
export class BrowserController {
  constructor(private readonly svc: BrowserService) {}

  // Safe to call always — reports whether the connector is armed/configured.
  @Get('status')
  status() {
    return this.svc.status();
  }

  @Post('publish')
  publish(@Body() body: BrowserPublishBody): { jobId: string; status: PublishJob['status'] } {
    if (!this.svc.cfg.enabled) {
      throw new ForbiddenException('browser connector disabled (set BROWSER_CONNECTOR_ENABLED=true)');
    }
    return this.svc.publish(body);
  }

  @Get('jobs/:id')
  job(@Param('id') id: string): PublishJob {
    return this.svc.job(id) ?? { jobId: id, status: 'failed', receipts: [] };
  }
}
