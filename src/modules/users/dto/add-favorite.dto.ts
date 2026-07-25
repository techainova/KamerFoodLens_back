import { ApiProperty } from '@nestjs/swagger';
import { FavoriteType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ enum: FavoriteType, example: FavoriteType.dish })
  @IsEnum(FavoriteType)
  public type!: FavoriteType;

  @ApiProperty({ example: 'dish-uuid-or-restaurant-uuid' })
  @IsString()
  public itemId!: string;
}
