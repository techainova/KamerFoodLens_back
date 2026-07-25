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

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public content!: string;

  @Prop()
  public imageUrl?: string;

  @Prop({ required: true, enum: ['post', 'recipe', 'review'] })
  public type!: string;

  @Prop({ type: [String], default: [] })
  public likes!: string[];

  @Prop({ type: [PostCommentSchema], default: [] })
  public comments!: PostComment[];
}

export const PostSchema = SchemaFactory.createForClass(Post);
