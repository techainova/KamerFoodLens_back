import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ example: 'Ndolé traditionnel' })
  @IsOptional()
  @IsString()
  public name?: string;

  @ApiPropertyOptional({ example: 'Ndolé Traditional' })
  @IsOptional()
  @IsString()
  public nameEN?: string;

  @ApiPropertyOptional({ example: "Poisson fumé, crevettes, pâte d'arachide maison" })
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiPropertyOptional({ example: 4500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public priceXAF?: number;

  @ApiPropertyOptional({ example: 'Plats principaux' })
  @IsOptional()
  @IsString()
  public category?: string;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/menu/ndole.jpg' })
  @IsOptional()
  @IsString()
  public imageUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  public isAvailable?: boolean;

  @ApiPropertyOptional({ example: ['peanuts', 'fish'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public allergens?: string[];
}
