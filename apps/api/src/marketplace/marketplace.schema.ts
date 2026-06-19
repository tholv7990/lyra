import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MarketplacePromptDocument = HydratedDocument<MarketplacePrompt>;

// A community prompt in the GLOBAL, read-only marketplace catalog (imported from
// prompts.chat, CC0). Deliberately NOT workspace-scoped and NOT an AuditedEntity:
// one shared catalog across all workspaces, no soft-delete envelope. Adopting an
// item creates a real workspace `Prompt` (see MarketplaceService.adopt).
@Schema({ timestamps: true })
export class MarketplacePrompt {
  // Unique per catalog item — the upsert key during sync (act -> title).
  @Prop({ required: true, unique: true, index: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({
    required: true,
    enum: ['text', 'structured'],
    default: 'text',
  })
  type!: 'text' | 'structured';

  @Prop({ required: true, default: false })
  forDevs!: boolean;

  @Prop()
  contributor?: string;

  @Prop({ required: true, default: 'prompts.chat' })
  source!: string;

  // Placeholder names parsed from the body (parsePromptVariables).
  @Prop({ type: [String], default: [] })
  variables!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  // Provided by Mongoose `timestamps: true`; declared for typing only.
  createdAt!: Date;
  updatedAt!: Date;
}

export const MarketplacePromptSchema =
  SchemaFactory.createForClass(MarketplacePrompt);
