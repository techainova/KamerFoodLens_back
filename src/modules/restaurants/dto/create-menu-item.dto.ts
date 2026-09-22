import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Weekday } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Ndolé traditionnel' })
  @IsString()
  @IsNotEmpty()
  public name!: string;

  @ApiPropertyOptional({ example: 'Ndolé Traditional' })
  @IsOptional()
  @IsString()
  public nameEN?: string;

  @ApiPropertyOptional({ example: "Poisson fumé, crevettes, pâte d'arachide maison" })
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiProperty({ example: 4500 })
  @IsInt()
  @Min(0)
  public priceXAF!: number;

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

  @ApiPropertyOptional({
    enum: Weekday,
    isArray: true,
    example: ['saturday', 'sunday'],
    description: 'Jours où le plat est au menu — vide ou omis = tous les jours',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Weekday, { each: true })
  public availableDays?: Weekday[];
}
