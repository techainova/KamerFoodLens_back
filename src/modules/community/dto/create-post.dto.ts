import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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

export class CreatePostDto {
  @ApiProperty({ example: 'Ma recette de Ndolé maison !' })
  @IsString()
  public content!: string;

  @ApiPropertyOptional({ example: 'base64-encoded-image-bytes' })
  @IsOptional()
  @IsString()
  public imageBase64?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  public mimeType?: string;

  @ApiProperty({ enum: PostType, example: PostType.recipe })
  @IsEnum(PostType)
  public type!: PostType;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Super recette, merci du partage !' })
  @IsString()
  public text!: string;
}
