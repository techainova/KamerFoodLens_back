import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchRestaurantsDto {
  @ApiPropertyOptional({ example: 4.0511 })
  @IsOptional()
  @Type(() => Number)
  public lat?: number;

  @ApiPropertyOptional({ example: 9.7679 })
  @IsOptional()
  @Type(() => Number)
  public lng?: number;

  @ApiPropertyOptional({ example: 5, description: 'Search radius in kilometers' })
  @IsOptional()
  @Type(() => Number)
  public radius?: number;

  @ApiPropertyOptional({ example: 'camerounaise' })
  @IsOptional()
  @IsString()
  public cuisine?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  public page?: number;
}
