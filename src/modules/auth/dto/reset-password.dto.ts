import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-value' })
  @IsString()
  public token!: string;

  @ApiProperty({ example: 'NewStrongP@ssw0rd', minLength: 8 })
  @IsString()
  @MinLength(8)
  public newPassword!: string;
}
