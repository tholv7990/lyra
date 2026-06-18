import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { PublishJob } from '@lyra/shared';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { PublishService } from './publish.service';
import { PublishBody } from './dto';

@Controller()
@UseGuards(ServiceTokenGuard)
export class PublishController {
  constructor(private readonly svc: PublishService) {}

  @Get('connect-link')
  connectLink() {
    return this.svc.connectUrl();
  }

  @Get('channels')
  async channels(@Headers('x-connector-key') key?: string) {
    return { channels: await this.svc.channels(requireKey(key)) };
  }

  @Post('publish')
  publish(@Body() b: PublishBody, @Headers('x-connector-key') key?: string) {
    return this.svc.publish(requireKey(key), b);
  }

  @Get('jobs/:id')
  job(@Param('id') id: string): PublishJob {
    return this.svc.job(id) ?? { jobId: id, status: 'failed', receipts: [] };
  }
}

function requireKey(key?: string): string {
  if (!key) throw new UnauthorizedException('missing connector key');
  return key;
}
