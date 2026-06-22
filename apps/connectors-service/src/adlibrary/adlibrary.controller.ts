import { Body, Controller, Headers, Post, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { MetaCollector } from './meta.collector';

@Controller('adlibrary')
@UseGuards(ServiceTokenGuard)
export class AdlibraryController {
  constructor(private readonly meta: MetaCollector) {}

  @Post('search')
  async search(@Body() b: { keywords: string[] }, @Headers('x-connector-key') key: string) {
    if (!key) throw new UnprocessableEntityException('missing Apify key');
    return { advertisers: await this.meta.searchAdvertisers(b.keywords ?? [], key) };
  }

  @Post('ads')
  async ads(@Body() b: { pageId: string }, @Headers('x-connector-key') key: string) {
    if (!key) throw new UnprocessableEntityException('missing Apify key');
    return { ads: await this.meta.crawlAds(b.pageId, key) };
  }
}
