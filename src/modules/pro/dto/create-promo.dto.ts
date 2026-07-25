import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePromoDto {
  @ApiProperty({ example: 'restaurant-uuid' })
  @IsString()
  public restaurantId!: string;

  @ApiProperty({ example: '20% de réduction ce weekend' })
  @IsString()
  public title!: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  public discountPercent?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public discountXAF?: number;

  @ApiProperty({ example: '2026-07-25T00:00:00.000Z' })
  @IsDateString()
  public validFrom!: string;

  @ApiProperty({ example: '2026-07-27T23:59:59.000Z' })
  @IsDateString()
  public validUntil!: string;
}
