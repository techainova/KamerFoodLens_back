import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum PostType {
  post = 'post',
  recipe = 'recipe',
  review = 'review',
  // Réservé aux comptes pro (vérifié dans CommunityService.createPost) — une
  // annonce d'événement légère dans le fil, distincte du module Events complet
  // (inscriptions, billetterie) : pas de date/lieu structurés, juste un post
  // mis en avant visuellement.
  event = 'event',
}

export class CreatePostMediaDto {
  @ApiProperty({ example: 'base64-encoded-image-or-video-bytes' })
  @IsString()
  public base64!: string;

  @ApiProperty({ example: 'image/jpeg', description: 'image/* or video/* — determines the carousel item type' })
  @IsString()
  public mimeType!: string;
}

export class CreatePostDto {
  @ApiProperty({ example: 'Ma recette de Ndolé maison !' })
  @IsString()
  @IsNotEmpty()
  public content!: string;

  @ApiPropertyOptional({
    type: [CreatePostMediaDto],
    description: 'Carousel of photos/videos, in display order (Instagram-style — 0 to 10 items).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreatePostMediaDto)
  public media?: CreatePostMediaDto[];

  @ApiProperty({ enum: PostType, example: PostType.recipe })
  @IsEnum(PostType)
  public type!: PostType;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Super recette, merci du partage !' })
  @IsString()
  @IsNotEmpty()
  public text!: string;
}
