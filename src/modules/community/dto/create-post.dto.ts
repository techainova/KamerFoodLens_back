import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PostType {
  post = 'post',
  recipe = 'recipe',
  review = 'review',
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
