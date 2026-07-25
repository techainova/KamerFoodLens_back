import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchRecipesDto {
  @ApiPropertyOptional({ example: 'Ndolé' })
  @IsOptional()
  @IsString()
  public q?: string;

  @ApiPropertyOptional({ example: 'Littoral' })
  @IsOptional()
  @IsString()
  public region?: string;
}
