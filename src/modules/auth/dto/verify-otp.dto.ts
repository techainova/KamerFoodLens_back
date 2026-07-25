import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  public email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  public otp!: string;
}
