import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryHighlightDocument = StoryHighlight & Document;

@Schema({ timestamps: true, collection: 'story_highlights' })
export class StoryHighlight {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public title!: string;

  @Prop()
  public coverImageUrl?: string;

  @Prop({ type: [String], default: [] })
  public storyIds!: string[];
}

export const StoryHighlightSchema = SchemaFactory.createForClass(StoryHighlight);
