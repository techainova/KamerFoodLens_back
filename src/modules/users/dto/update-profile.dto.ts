import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  public firstName?: string;

  @ApiPropertyOptional({ example: 'Mballa' })
  @IsOptional()
  @IsString()
  public lastName?: string;

  @ApiPropertyOptional({ example: 'jean_mballa' })
  @IsOptional()
  @IsString()
  public username?: string;

  @ApiPropertyOptional({ example: '+237690000000' })
  @IsOptional()
  @IsString()
  public phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/avatars/user.jpg' })
  @IsOptional()
  @IsString()
  public avatar?: string;

  @ApiPropertyOptional({ example: 'Passionné de cuisine camerounaise' })
  @IsOptional()
  @IsString()
  public bio?: string;

  @ApiPropertyOptional({ example: 'Douala, Cameroun' })
  @IsOptional()
  @IsString()
  public location?: string;
}
