import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentP@ssw0rd' })
  @IsString()
  public currentPassword!: string;

  @ApiProperty({ example: 'NewP@ssw0rd123' })
  @IsString()
  @MinLength(8)
  public newPassword!: string;
}
