import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CompetitorStatus, AdStatus, AdEventType } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ timestamps: true })
export class Competitor extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, trim: true })
  brand!: string;

  @Prop()
  domain?: string;

  @Prop({ default: '' })
  niche!: string;

  @Prop({
    required: true,
    enum: Object.values(CompetitorStatus),
    default: CompetitorStatus.Candidate,
  })
  status!: CompetitorStatus;

  @Prop()
  lastError?: string;

  @Prop()
  lastCrawledAt?: Date;
}
export type CompetitorDocument = HydratedDocument<Competitor>;
export const CompetitorSchema = SchemaFactory.createForClass(Competitor);
CompetitorSchema.index({ workspaceId: 1, status: 1 });

@Schema({ timestamps: true })
export class AdvertiserHandle {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  competitorId!: string;

  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  advertiserId!: string;

  @Prop()
  resolvedAt?: Date;
}
export type AdvertiserHandleDocument = HydratedDocument<AdvertiserHandle>;
export const AdvertiserHandleSchema = SchemaFactory.createForClass(AdvertiserHandle);
AdvertiserHandleSchema.index({ workspaceId: 1, competitorId: 1 });

@Schema({ timestamps: true })
export class MonitorAd {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  competitorId!: string;

  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  adId!: string;

  @Prop()
  creativeUrl?: string;

  @Prop()
  copy?: string;

  @Prop()
  format?: string;

  @Prop({
    required: true,
    enum: Object.values(AdStatus),
    default: AdStatus.Active,
  })
  status!: AdStatus;

  @Prop({ required: true })
  firstSeen!: string; // 'YYYY-MM-DD'

  @Prop({ required: true })
  lastSeen!: string;

  @Prop({ required: true, default: 1 })
  daysRunning!: number;
}
export type MonitorAdDocument = HydratedDocument<MonitorAd>;
export const MonitorAdSchema = SchemaFactory.createForClass(MonitorAd);
MonitorAdSchema.index({ workspaceId: 1, competitorId: 1, platform: 1, adId: 1 }, { unique: true });
MonitorAdSchema.index({ workspaceId: 1, competitorId: 1, status: 1 });

@Schema({ timestamps: true })
export class AdEvent {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  competitorId!: string;

  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  adId!: string;

  @Prop({ required: true, enum: Object.values(AdEventType) })
  event!: AdEventType;

  @Prop({ required: true })
  date!: string; // 'YYYY-MM-DD'
}
export type AdEventDocument = HydratedDocument<AdEvent>;
export const AdEventSchema = SchemaFactory.createForClass(AdEvent);
AdEventSchema.index({ workspaceId: 1, date: 1 });
AdEventSchema.index({ workspaceId: 1, competitorId: 1 });
