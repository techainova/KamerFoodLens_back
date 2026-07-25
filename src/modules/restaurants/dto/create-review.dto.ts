import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  public rating!: number;

  @ApiPropertyOptional({ example: 'Excellent Ndolé, service rapide !' })
  @IsOptional()
  @IsString()
  public comment?: string;
}
