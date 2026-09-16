import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStoryStickersDto } from './create-story-sticker.dto';
import { CreateStoryTextOverlayDto } from './create-story-text-overlay.dto';

export class CreateStoryDto {
  // Required when mediaType is 'image' (the default) — omitted for text-only stories.
  // Enforced in the service, not here, so the two media types can share one DTO.
  @ApiPropertyOptional({ example: 'base64-encoded-image-bytes' })
  @IsOptional()
  @IsString()
  public imageBase64?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  public mimeType?: string;

  @ApiPropertyOptional({ example: 'image', enum: ['image', 'text'] })
  @IsOptional()
  @IsIn(['image', 'text'])
  public mediaType?: 'image' | 'text';

  @ApiPropertyOptional({ example: 'warm' })
  @IsOptional()
  @IsString()
  public filter?: string;

  @ApiPropertyOptional({ example: '#1A237E' })
  @IsOptional()
  @IsString()
  public backgroundColor?: string;

  @ApiPropertyOptional({ example: ['#2E7D32', '#E8591A'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public gradient?: string[];

  @ApiPropertyOptional({ type: [CreateStoryTextOverlayDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateStoryTextOverlayDto)
  public textOverlays?: CreateStoryTextOverlayDto[];

  @ApiPropertyOptional({ example: 'Le plat national camerounais !' })
  @IsOptional()
  @IsString()
  public caption?: string;

  // At most one of poll / quiz / slider should be set — enforced in the service, not here,
  // to keep the validation error message clearer than a class-validator custom decorator would.
  @ApiPropertyOptional({ type: CreateStoryStickersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStoryStickersDto)
  public stickers?: CreateStoryStickersDto;
}
