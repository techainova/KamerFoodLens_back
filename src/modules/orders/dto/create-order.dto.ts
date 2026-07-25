import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderMode } from '@prisma/client';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'menu-item-uuid' })
  @IsString()
  public menuItemId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  public qty!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'restaurant-uuid' })
  @IsString()
  public restaurantId!: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  public items!: CreateOrderItemDto[];

  @ApiProperty({ enum: OrderMode, example: OrderMode.delivery })
  @IsEnum(OrderMode)
  public mode!: OrderMode;

  @ApiPropertyOptional({ example: 'Sans piment, merci' })
  @IsOptional()
  @IsString()
  public note?: string;

  @ApiPropertyOptional({ example: '2026-07-22T19:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  public reservationAt?: string;
}
