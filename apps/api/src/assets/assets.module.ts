import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Asset, AssetSchema } from './asset.schema';
import { AssetsService } from './assets.service';

// Asset persistence (media produced by run steps). Exported so the runs module
// can create assets on step completion and list them per run.
@Module({
  imports: [MongooseModule.forFeature([{ name: Asset.name, schema: AssetSchema }])],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
