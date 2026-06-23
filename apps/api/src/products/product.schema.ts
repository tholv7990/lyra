import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductStatus } from '@lyra/shared';
import type {
  EvidenceClaim, SourceRow, UnitEcon, SubScores, ConfidenceGrade, Decision,
  ProductEconInputs, ProductSource,
} from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProductDocument = HydratedDocument<Product>;

// A durable researched opportunity, owned by ONE project (peer of Task). Holds the
// evidence ledger + economics + score/grade/decision the research pipeline writes,
// plus a manual lifecycle status and first-party outcome note.
@Schema({ timestamps: true })
export class Product extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: Object })
  source?: ProductSource;

  @Prop()
  niche?: string;

  @Prop()
  category?: string;

  @Prop({
    required: true,
    enum: Object.values(ProductStatus),
    default: ProductStatus.Candidate,
    index: true,
  })
  status!: ProductStatus;

  @Prop({ type: [Object], default: [] })
  evidence!: EvidenceClaim[];

  @Prop({ type: [Object], default: [] })
  sources!: SourceRow[];

  @Prop({ type: Object })
  unitEcon?: UnitEcon;

  @Prop({ type: Object })
  subScores?: SubScores;

  @Prop()
  score?: number;

  @Prop()
  grade?: ConfidenceGrade;

  @Prop()
  decision?: Decision;

  @Prop({ type: Object })
  econInputs?: ProductEconInputs;

  @Prop({ type: [String], default: [] })
  competitorIds!: string[];

  @Prop()
  outcome?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ projectId: 1, createdAt: -1 });
