import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductStatus } from '@lyra/shared';
import type {
  EvidenceClaim, SourceRow, UnitEcon, SubScores, ConfidenceGrade, Decision,
  HardGates, UnitEconInputs, CompetitionData, RiskFlags, Scenarios,
  CustomerJob, ReviewMining, CreativeConcept, SupplyChainInfo, ValidationPlan,
  ProductEconInputs, ProductSource,
} from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

export type ProductDocument = HydratedDocument<Product>;

// A saved AI result kept under a product (branding run output, image, etc.).
// Keeps its own _id so individual results can be removed. `createdBy` records
// who saved it; asset fields are optional (text outputs have none).
@Schema({ _id: true })
export class ProductResultItem {
  @Prop({ required: true }) output!: string;
  @Prop({ required: true }) provider!: string;
  @Prop({ required: true }) model!: string;
  @Prop() assetUrl?: string;
  @Prop() assetType?: string;
  @Prop() runId?: string;
  @Prop() stepIndex?: number;
  @Prop() rating?: number;
  @Prop() note?: string;
  @Prop({ required: true }) createdBy!: string;
  @Prop({ type: Date, default: Date.now }) savedAt!: Date;
}
const ProductResultItemSchema = SchemaFactory.createForClass(ProductResultItem);

// A durable researched opportunity, owned by ONE project (peer of Task). Holds the
// evidence ledger + economics + score/grade/decision the research pipeline writes,
// plus a manual lifecycle status and first-party outcome note.
@Schema({ timestamps: true })
export class Product extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ index: true })
  projectId?: string;

  @Prop()
  originatingProjectId?: string;

  @Prop({ index: true })
  poolProductId?: string;

  @Prop()
  poolSnapshotAt?: string;

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
  hardGates?: HardGates;

  @Prop({ type: Object })
  unitEconInputs?: UnitEconInputs;

  @Prop({ type: [String], default: undefined })
  assumptions?: string[];

  @Prop({ type: Object })
  competition?: CompetitionData;

  @Prop({ type: Object })
  riskFlags?: RiskFlags;

  @Prop({ type: [String], default: undefined })
  riskNotes?: string[];

  @Prop({ type: Object })
  scenarios?: Scenarios;

  @Prop({ type: Object })
  customerJob?: CustomerJob;

  @Prop({ type: Object })
  reviewMining?: ReviewMining;

  @Prop({ type: [Object], default: undefined })
  creativeConcepts?: CreativeConcept[];

  @Prop({ type: Object })
  supplyChain?: SupplyChainInfo;

  @Prop({ type: Object })
  validationPlan?: ValidationPlan;

  @Prop({ type: Object })
  econInputs?: ProductEconInputs;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop()
  price?: number;

  @Prop()
  compareAtPrice?: number;

  @Prop()
  offer?: string;

  @Prop({ type: [String], default: [] })
  competitorIds!: string[];

  @Prop()
  outcome?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  // Saved AI results (branding outputs, images, etc.).
  @Prop({ type: [ProductResultItemSchema], default: [] })
  results!: ProductResultItem[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
