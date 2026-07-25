import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SearchByIngredientsDto {
  @ApiProperty({ example: ['tomate', 'oignon', 'poisson fumé'], type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  public ingredients!: string[];
}
