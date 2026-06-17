import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  // Server-only field — never lives in @lyra/shared, never serialized to clients.
  // Optional: accounts created via Google sign-in have no password.
  @Prop()
  passwordHash?: string;

  // Set for accounts that signed in with Google (the OAuth `sub`).
  @Prop({ index: true })
  googleId?: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: true, index: true })
  active!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Defense in depth: strip the hash if a document is ever serialized directly.
UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});
