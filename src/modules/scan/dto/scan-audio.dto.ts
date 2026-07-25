import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ScanAudioDto {
  @ApiProperty({ example: 'base64-encoded-audio-bytes' })
  @IsString()
  public audioBase64!: string;

  @ApiPropertyOptional({ example: 'audio/wav' })
  @IsOptional()
  @IsString()
  public mimeType?: string;
}
