import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStoryTextOverlayDto {
  @ApiProperty({ example: 'Bonne cuisine = bonne humeur 🍲' })
  @IsString()
  public text!: string;

  @ApiProperty({ example: 0.5, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  public x!: number;

  @ApiProperty({ example: 0.5, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  public y!: number;

  @ApiPropertyOptional({ example: 26 })
  @IsOptional()
  @IsNumber()
  public fontSize?: number;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  public color?: string;

  @ApiPropertyOptional({ example: '700' })
  @IsOptional()
  @IsString()
  public fontWeight?: string;

  @ApiPropertyOptional({ example: 'center' })
  @IsOptional()
  @IsString()
  public align?: string;

  @ApiPropertyOptional({ example: 'rgba(0,0,0,0.55)' })
  @IsOptional()
  @IsString()
  public backgroundColor?: string;
}
