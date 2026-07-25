import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScanResult, ScanResultSchema } from '../scan/schemas/scan-result.schema';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ScanResult.name, schema: ScanResultSchema }])],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
