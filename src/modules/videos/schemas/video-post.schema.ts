import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoPostDocument = VideoPost & Document;

@Schema({ _id: false })
export class VideoComment {
  @Prop({ required: true })
  public userId!: string;

  @Prop({ required: true })
  public text!: string;

  @Prop({ default: () => new Date() })
  public createdAt!: Date;
}

export const VideoCommentSchema = SchemaFactory.createForClass(VideoComment);

// Fil "Vidéos" (façon Instagram Reels, orienté gastronomie camerounaise) —
// ouvert aux utilisateurs standards comme aux comptes Pro. Un Pro peut lier
// la vidéo à une formation (linkedCourseId) ou à un événement (linkedEventId)
// qu'il organise, affiché comme un call-to-action sous la légende.
@Schema({ timestamps: true, collection: 'video_posts' })
export class VideoPost {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop()
  public restaurantId?: string;

  @Prop({ required: true })
  public caption!: string;

  @Prop({ required: true })
  public videoUrl!: string;

  @Prop()
  public thumbnailUrl?: string;

  @Prop({ default: 0 })
  public durationSec!: number;

  @Prop({ type: [String], default: [] })
  public likes!: string[];

  @Prop({ type: [VideoCommentSchema], default: [] })
  public comments!: VideoComment[];

  @Prop({ default: 0 })
  public viewsCount!: number;

  @Prop()
  public linkedCourseId?: string;

  @Prop()
  public linkedEventId?: string;
}

export const VideoPostSchema = SchemaFactory.createForClass(VideoPost);
