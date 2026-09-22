import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyToMessageDto {
  @ApiProperty({ example: 'Merci pour votre message, nous préparons votre commande.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public text!: string;
}
