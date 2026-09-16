import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStoryPollDto {
  @ApiProperty({ example: 'Épicé ou pas ?' })
  @IsString()
  public question!: string;

  @ApiProperty({ example: ['Épicé', 'Pas épicé'] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  public options!: string[];

  @ApiPropertyOptional({ example: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public x?: number;

  @ApiPropertyOptional({ example: 0.6, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public y?: number;
}

export class CreateStoryQuizDto {
  @ApiProperty({ example: 'Quel est l\'ingrédient secret ?' })
  @IsString()
  public question!: string;

  @ApiProperty({ example: ['Njansang', 'Gingembre', 'Piment', 'Curry'] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  public options!: string[];

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  public correctIndex!: number;

  @ApiPropertyOptional({ example: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public x?: number;

  @ApiPropertyOptional({ example: 0.6, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public y?: number;
}

export class CreateStorySliderDto {
  @ApiProperty({ example: 'Note ce plat' })
  @IsString()
  public question!: string;

  @ApiProperty({ example: '🔥' })
  @IsString()
  public emoji!: string;

  @ApiPropertyOptional({ example: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public x?: number;

  @ApiPropertyOptional({ example: 0.6, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public y?: number;
}

export class CreateStoryStickersDto {
  @ApiPropertyOptional({ type: CreateStoryPollDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStoryPollDto)
  public poll?: CreateStoryPollDto;

  @ApiPropertyOptional({ type: CreateStoryQuizDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStoryQuizDto)
  public quiz?: CreateStoryQuizDto;

  @ApiPropertyOptional({ type: CreateStorySliderDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStorySliderDto)
  public slider?: CreateStorySliderDto;
}
