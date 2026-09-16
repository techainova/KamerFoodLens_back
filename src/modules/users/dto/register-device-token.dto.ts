import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MinLength(10)
  public token!: string;

  @ApiProperty({ example: 'android', enum: ['android', 'ios', 'web'] })
  @IsIn(['android', 'ios', 'web'])
  public platform!: 'android' | 'ios' | 'web';
}
