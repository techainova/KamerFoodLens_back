import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../../common/common.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoPost, VideoPostSchema } from './schemas/video-post.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([{ name: VideoPost.name, schema: VideoPostSchema }]),
  ],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
