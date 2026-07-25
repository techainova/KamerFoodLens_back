import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RejectProRequestDto {
  @ApiProperty({ example: 'Documents justificatifs manquants' })
  @IsString()
  public reason!: string;
}
