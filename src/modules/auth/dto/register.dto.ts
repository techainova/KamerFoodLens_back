import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  public email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd', minLength: 8 })
  @IsString()
  @MinLength(8)
  public password!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  public firstName!: string;

  @ApiProperty({ example: 'Mballa' })
  @IsString()
  public lastName!: string;

  @ApiPropertyOptional({ example: '+237690000000' })
  @IsOptional()
  @IsString()
  public phone?: string;

  @ApiPropertyOptional({ example: 'jean_mballa' })
  @IsOptional()
  @IsString()
  public username?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  public isBusiness?: boolean;
}
