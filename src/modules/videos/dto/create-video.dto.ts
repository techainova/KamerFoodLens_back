import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ example: 'base64-encoded-video-bytes' })
  @IsString()
  public videoBase64!: string;

  @ApiPropertyOptional({ example: 'video/mp4' })
  @IsOptional()
  @IsString()
  public mimeType?: string;

  @ApiProperty({ example: 'Le vrai Mbongo Tchobi en 60 secondes ⏱️' })
  @IsString()
  public caption!: string;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public durationSec?: number;

  @ApiPropertyOptional({ example: 'restaurant-uuid' })
  @IsOptional()
  @IsString()
  public restaurantId?: string;

  @ApiPropertyOptional({ example: 'course-uuid', description: 'Formation liée (compte Pro)' })
  @IsOptional()
  @IsString()
  public linkedCourseId?: string;

  @ApiPropertyOptional({ example: 'event-uuid', description: 'Événement lié (compte Pro)' })
  @IsOptional()
  @IsString()
  public linkedEventId?: string;
}

export class CommentVideoDto {
  @ApiProperty({ example: 'Merci pour l\'astuce !' })
  @IsString()
  public text!: string;
}
