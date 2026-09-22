import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadCourseMediaDto {
  @ApiProperty({ description: 'Base64-encoded media data (raw or data: URI) — image, video or document' })
  @IsString()
  @MinLength(10)
  public dataBase64!: string;

  @ApiPropertyOptional({ example: 'video/mp4' })
  @IsOptional()
  @IsString()
  public mimeType?: string;
}
