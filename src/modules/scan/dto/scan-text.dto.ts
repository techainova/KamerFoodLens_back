import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ScanTextDto {
  @ApiProperty({ example: 'Ndolé aux crevettes' })
  @IsString()
  @MinLength(2)
  public text!: string;
}
