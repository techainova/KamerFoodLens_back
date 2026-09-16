import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateHighlightDto {
  @ApiProperty({ example: 'Mes Recettes' })
  @IsString()
  public title!: string;

  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  @IsString()
  public storyId!: string;

  @ApiPropertyOptional({ example: 'https://.../cover.jpg' })
  @IsOptional()
  @IsString()
  public coverImageUrl?: string;
}

export class AddToHighlightDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  @IsString()
  public storyId!: string;
}
