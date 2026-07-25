import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PushNotificationDto {
  @ApiProperty({ example: 'all', description: "'all' | 'standard' | 'pro' | a specific userId" })
  @IsString()
  public target!: string;

  @ApiProperty({ example: 'Nouvelle fonctionnalité disponible !' })
  @IsString()
  public title!: string;

  @ApiProperty({ example: 'Découvrez le nouveau mode scan audio dans KmerFoodLens.' })
  @IsString()
  public body!: string;
}
