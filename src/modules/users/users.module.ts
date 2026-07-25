import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JournalEntry, JournalEntrySchema } from './schemas/journal-entry.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: JournalEntry.name, schema: JournalEntrySchema }])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
