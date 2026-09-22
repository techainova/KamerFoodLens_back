import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Festival du Ndolé' })
  @IsString()
  @IsNotEmpty()
  public title!: string;

  @ApiPropertyOptional({ example: 'Une célébration annuelle du plat national camerounais' })
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiPropertyOptional({ example: 'gastronomie' })
  @IsOptional()
  @IsString()
  public category?: string;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/events/ndole-festival.jpg' })
  @IsOptional()
  @IsString()
  public imageUrl?: string;

  @ApiPropertyOptional({ example: 'Douala, Cameroun' })
  @IsOptional()
  @IsString()
  public location?: string;

  @ApiPropertyOptional({ example: 'Douala' })
  @IsOptional()
  @IsString()
  public city?: string;

  @ApiPropertyOptional({ example: ['Festival', 'Famille'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public tags?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  public isOnline?: boolean;

  @ApiPropertyOptional({ example: 'https://stream.kmerfoodlens.com/live/ndole-festival' })
  @IsOptional()
  @IsString()
  public streamUrl?: string;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  @IsDateString()
  public startAt!: string;

  @ApiProperty({ example: '2026-08-15T18:00:00.000Z' })
  @IsDateString()
  public endAt!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public priceXAF?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxSeats?: number;
}
