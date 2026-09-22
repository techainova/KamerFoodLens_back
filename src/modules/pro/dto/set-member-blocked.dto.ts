import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetMemberBlockedDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  public blocked!: boolean;
}
