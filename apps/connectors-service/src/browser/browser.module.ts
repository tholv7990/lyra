import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';

// Always registered, but inert unless BROWSER_CONNECTOR_ENABLED=true (the controller
// rejects /browser/publish when off). Keeps the fence in one place.
@Module({ controllers: [BrowserController], providers: [BrowserService] })
export class BrowserModule {}
