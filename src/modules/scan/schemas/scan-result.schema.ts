import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScanResultDocument = ScanResult & Document;

@Schema({ timestamps: true, collection: 'scan_results' })
export class ScanResult {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public dishId!: string;

  @Prop({ required: true })
  public dishName!: string;

  @Prop({ required: true })
  public confidence!: number;

  @Prop()
  public imageUrl?: string;

  @Prop({ required: true })
  public scanType!: string;

  @Prop({ type: [Object], default: [] })
  public alternatives!: Record<string, unknown>[];

  @Prop({ type: Object })
  public nutritionFacts?: Record<string, number>;

  @Prop()
  public createdAt?: Date;
}

export const ScanResultSchema = SchemaFactory.createForClass(ScanResult);
