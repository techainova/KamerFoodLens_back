import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { ScanResult, ScanResultSchema } from './schemas/scan-result.schema';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: ScanResult.name, schema: ScanResultSchema }]), GamesModule],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
