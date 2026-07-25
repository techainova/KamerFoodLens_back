import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmptyObject, IsOptional, IsString } from 'class-validator';

export class AddJournalDto {
  @ApiProperty({ example: 'Ndolé aux crevettes' })
  @IsString()
  public dishName!: string;

  @ApiPropertyOptional({ example: 'dish-uuid' })
  @IsOptional()
  @IsString()
  public dishId?: string;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/scans/dish.jpg' })
  @IsOptional()
  @IsString()
  public imageUrl?: string;

  @ApiPropertyOptional({ example: { calories: 450, proteins: 22, carbs: 40, fats: 18 } })
  @IsOptional()
  @IsNotEmptyObject()
  public nutritionFacts?: Record<string, number>;

  @ApiProperty({ example: 'lunch' })
  @IsString()
  public mealType!: string;

  @ApiProperty({ example: '2026-07-21' })
  @IsDateString()
  public date!: string;

  @ApiPropertyOptional({ example: 'Repas pris avec la famille' })
  @IsOptional()
  @IsString()
  public note?: string;
}
