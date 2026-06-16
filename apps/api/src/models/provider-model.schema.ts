import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Provider } from '@lyra/shared';
import { AuditedEntity } from '../common/database/audited.entity';

@Schema({ _id: false })
export class ModelItem {
  @Prop({ required: true }) id!: string;
  @Prop({ required: true }) label!: string;
}
const ModelItemSchema = SchemaFactory.createForClass(ModelItem);

export type ProviderModelDocument = HydratedDocument<ProviderModel>;

// The model catalog for one (workspace, provider), refreshed from the provider's
// live /models API so it stays current without code changes.
@Schema({ timestamps: true })
export class ProviderModel extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true, enum: Object.values(Provider) })
  provider!: Provider;

  @Prop({ type: [ModelItemSchema], default: [] })
  models!: ModelItem[];
}

export const ProviderModelSchema = SchemaFactory.createForClass(ProviderModel);
ProviderModelSchema.index(
  { workspaceId: 1, provider: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
