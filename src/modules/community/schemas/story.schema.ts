import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ timestamps: true, collection: 'stories' })
export class Story {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public imageUrl!: string;

  @Prop()
  public caption?: string;

  @Prop({ required: true, expires: 0 })
  public expiresAt!: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);
