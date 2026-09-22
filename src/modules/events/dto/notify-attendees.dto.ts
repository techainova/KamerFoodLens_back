import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class NotifyAttendeesDto {
  @ApiProperty({ example: "Changement de lieu pour l'événement" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public title!: string;

  @ApiProperty({ example: "L'événement se tiendra finalement à la salle B, même horaire." })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public body!: string;
}
