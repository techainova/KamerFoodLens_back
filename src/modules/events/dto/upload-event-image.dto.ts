import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadEventImageDto {
  @ApiProperty({ description: 'Base64-encoded image data (raw or data: URI)' })
  @IsString()
  @MinLength(10)
  public imageBase64!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  public mimeType?: string;
}
