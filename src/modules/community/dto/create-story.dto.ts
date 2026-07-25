import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateStoryDto {
  @ApiProperty({ example: 'base64-encoded-image-bytes' })
  @IsString()
  public imageBase64!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  public mimeType?: string;

  @ApiPropertyOptional({ example: 'Le plat national camerounais !' })
  @IsOptional()
  @IsString()
  public caption?: string;
}
