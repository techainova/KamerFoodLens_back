import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty({ example: 'Meilleure recette de Koki ?' })
  @IsString()
  public title!: string;

  @ApiProperty({ example: "Quelqu'un a-t-il une recette de Koki qui ne dessèche pas ?" })
  @IsString()
  public content!: string;

  @ApiProperty({ example: ['recettes', 'koki'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  public tags!: string[];
}

export class CreateReplyDto {
  @ApiProperty({ example: "J'ajoute un peu plus d'huile de palme, ça fonctionne bien !" })
  @IsString()
  public content!: string;
}
