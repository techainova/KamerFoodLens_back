import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ _id: false })
export class PostComment {
  @Prop({ required: true })
  public userId!: string;

  @Prop({ required: true })
  public text!: string;

  @Prop({ default: () => new Date() })
  public createdAt!: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

// A post carries a *carousel* of media (à la Instagram) — any mix of photos
// and short videos, shown swipeable in the feed.
@Schema({ _id: false })
export class PostMedia {
  @Prop({ required: true })
  public url!: string;

  @Prop({ required: true, enum: ['image', 'video'] })
  public type!: string;
}

export const PostMediaSchema = SchemaFactory.createForClass(PostMedia);

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public content!: string;

  // Deprecated — superseded by `media`. Kept so posts created before the
  // carousel feature still render (see CommunityService#toPostView).
  @Prop()
  public imageUrl?: string;

  @Prop({ type: [PostMediaSchema], default: [] })
  public media!: PostMedia[];

  @Prop({ required: true, enum: ['post', 'recipe', 'review', 'event'] })
  public type!: string;

  @Prop({ type: [String], default: [] })
  public likes!: string[];

  @Prop({ type: [PostCommentSchema], default: [] })
  public comments!: PostComment[];
}

export const PostSchema = SchemaFactory.createForClass(Post);
