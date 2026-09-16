import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ _id: false })
export class StoryReaction {
  @Prop({ required: true }) public userId!: string;
  @Prop({ required: true }) public emoji!: string;
  @Prop({ default: Date.now }) public createdAt!: Date;
}
export const StoryReactionSchema = SchemaFactory.createForClass(StoryReaction);

@Schema({ _id: false })
export class StoryReply {
  @Prop({ required: true }) public userId!: string;
  @Prop({ required: true }) public text!: string;
  @Prop({ default: Date.now }) public createdAt!: Date;
}
export const StoryReplySchema = SchemaFactory.createForClass(StoryReply);

@Schema({ _id: false })
export class StoryViewer {
  @Prop({ required: true }) public userId!: string;
  @Prop({ default: Date.now }) public viewedAt!: Date;
}
export const StoryViewerSchema = SchemaFactory.createForClass(StoryViewer);

@Schema({ _id: false })
export class StoryPollOption {
  @Prop({ required: true }) public label!: string;
  @Prop({ type: [String], default: [] }) public voterIds!: string[];
}
export const StoryPollOptionSchema = SchemaFactory.createForClass(StoryPollOption);

@Schema({ _id: false })
export class StoryPoll {
  @Prop({ required: true }) public question!: string;
  @Prop({ type: [StoryPollOptionSchema], required: true }) public options!: StoryPollOption[];
  @Prop({ min: 0, max: 1 }) public x?: number;
  @Prop({ min: 0, max: 1 }) public y?: number;
}
export const StoryPollSchema = SchemaFactory.createForClass(StoryPoll);

@Schema({ _id: false })
export class StoryQuizOption {
  @Prop({ required: true }) public label!: string;
  @Prop({ type: [String], default: [] }) public pickedByIds!: string[];
}
export const StoryQuizOptionSchema = SchemaFactory.createForClass(StoryQuizOption);

@Schema({ _id: false })
export class StoryQuiz {
  @Prop({ required: true }) public question!: string;
  @Prop({ type: [StoryQuizOptionSchema], required: true }) public options!: StoryQuizOption[];
  @Prop({ required: true }) public correctIndex!: number;
  @Prop({ min: 0, max: 1 }) public x?: number;
  @Prop({ min: 0, max: 1 }) public y?: number;
}
export const StoryQuizSchema = SchemaFactory.createForClass(StoryQuiz);

@Schema({ _id: false })
export class StorySliderVote {
  @Prop({ required: true }) public userId!: string;
  @Prop({ required: true, min: 0, max: 1 }) public value!: number;
}
export const StorySliderVoteSchema = SchemaFactory.createForClass(StorySliderVote);

@Schema({ _id: false })
export class StorySlider {
  @Prop({ required: true }) public question!: string;
  @Prop({ required: true }) public emoji!: string;
  @Prop({ type: [StorySliderVoteSchema], default: [] }) public votes!: StorySliderVote[];
  @Prop({ min: 0, max: 1 }) public x?: number;
  @Prop({ min: 0, max: 1 }) public y?: number;
}
export const StorySliderSchema = SchemaFactory.createForClass(StorySlider);

@Schema({ _id: false })
export class StoryTextOverlay {
  @Prop({ required: true }) public text!: string;
  @Prop({ required: true, min: 0, max: 1 }) public x!: number;
  @Prop({ required: true, min: 0, max: 1 }) public y!: number;
  @Prop({ default: 26 }) public fontSize!: number;
  @Prop({ default: '#FFFFFF' }) public color!: string;
  @Prop({ default: '700' }) public fontWeight!: string;
  @Prop({ default: 'center' }) public align!: string;
  @Prop() public backgroundColor?: string;
}
export const StoryTextOverlaySchema = SchemaFactory.createForClass(StoryTextOverlay);

@Schema({ timestamps: true, collection: 'stories' })
export class Story {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ default: 'image' })
  public mediaType!: 'image' | 'text';

  @Prop()
  public imageUrl?: string;

  @Prop()
  public filter?: string;

  @Prop()
  public backgroundColor?: string;

  @Prop({ type: [String] })
  public gradient?: string[];

  @Prop({ type: [StoryTextOverlaySchema], default: [] })
  public textOverlays!: StoryTextOverlay[];

  @Prop()
  public caption?: string;

  // Optional (not required) so it can be unset when a story is saved to a highlight —
  // MongoDB's TTL monitor skips documents where the indexed field is missing, which is
  // exactly how a highlighted story becomes permanent instead of expiring after 24h.
  @Prop({ expires: 0 })
  public expiresAt?: Date;

  @Prop({ default: false })
  public isArchived!: boolean;

  @Prop({ type: [StoryReactionSchema], default: [] })
  public reactions!: StoryReaction[];

  @Prop({ type: [StoryReplySchema], default: [] })
  public replies!: StoryReply[];

  @Prop({ type: [StoryViewerSchema], default: [] })
  public views!: StoryViewer[];

  @Prop({ type: StoryPollSchema })
  public poll?: StoryPoll;

  @Prop({ type: StoryQuizSchema })
  public quiz?: StoryQuiz;

  @Prop({ type: StorySliderSchema })
  public slider?: StorySlider;
}

export const StorySchema = SchemaFactory.createForClass(Story);
