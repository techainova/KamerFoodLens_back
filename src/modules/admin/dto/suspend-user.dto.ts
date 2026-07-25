import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ example: 7, minimum: 1 })
  @IsInt()
  @Min(1)
  public days!: number;
}
