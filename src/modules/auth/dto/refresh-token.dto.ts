import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  public refreshToken!: string;
}
