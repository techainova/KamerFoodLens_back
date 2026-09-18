import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityGateway } from './community.gateway';
import { Post, PostSchema } from './schemas/post.schema';
import { Story, StorySchema } from './schemas/story.schema';
import { StoryHighlight, StoryHighlightSchema } from './schemas/story-highlight.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Story.name, schema: StorySchema },
      { name: StoryHighlight.name, schema: StoryHighlightSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityGateway],
  exports: [CommunityService],
})
export class CommunityModule {}
