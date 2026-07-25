import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JournalEntryDocument = JournalEntry & Document;

@Schema({ timestamps: true, collection: 'journal_entries' })
export class JournalEntry {
  @Prop({ required: true, index: true })
  public userId!: string;

  @Prop({ required: true })
  public dishName!: string;

  @Prop()
  public dishId?: string;

  @Prop()
  public imageUrl?: string;

  @Prop({ type: Object })
  public nutritionFacts?: Record<string, number>;

  @Prop({ required: true })
  public mealType!: string;

  @Prop({ required: true, index: true })
  public date!: Date;

  @Prop()
  public note?: string;
}

export const JournalEntrySchema = SchemaFactory.createForClass(JournalEntry);
