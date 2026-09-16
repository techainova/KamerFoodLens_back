import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  public recipientId!: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Bonjour, avez-vous une table pour ce soir ?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public text!: string;
}
