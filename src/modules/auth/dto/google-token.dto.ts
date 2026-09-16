import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleTokenDto {
  @ApiProperty({ description: 'Google Identity Services ID token (JWT credential)' })
  @IsString()
  @MinLength(10)
  public idToken!: string;
}
