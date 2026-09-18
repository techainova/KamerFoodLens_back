import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JournalEntry, JournalEntrySchema } from './schemas/journal-entry.schema';
import { ScanResult, ScanResultSchema } from '../scan/schemas/scan-result.schema';
import { Post, PostSchema } from '../community/schemas/post.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: JournalEntry.name, schema: JournalEntrySchema },
    { name: ScanResult.name, schema: ScanResultSchema },
    { name: Post.name, schema: PostSchema },
  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
