import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CourseLevel } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ example: 'Introduction au Ndolé' })
  @IsString()
  public title!: string;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/courses/lesson1.mp4' })
  @IsOptional()
  @IsString()
  public videoUrl?: string;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public duration?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  public order!: number;

  @ApiPropertyOptional({ example: 'Les bases' })
  @IsOptional()
  @IsString()
  public sectionTitle?: string;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'Maîtriser la cuisine camerounaise' })
  @IsString()
  public title!: string;

  @ApiPropertyOptional({ example: 'Un cours complet sur les plats traditionnels camerounais' })
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public priceXAF?: number;

  @ApiPropertyOptional({ example: 'https://cdn.kmerfoodlens.com/courses/cover.jpg' })
  @IsOptional()
  @IsString()
  public imageUrl?: string;

  @ApiPropertyOptional({ enum: CourseLevel, example: CourseLevel.beginner })
  @IsOptional()
  @IsEnum(CourseLevel)
  public level?: CourseLevel;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  public isCertified?: boolean;

  @ApiPropertyOptional({ type: [CreateLessonDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreateLessonDto)
  public lessons?: CreateLessonDto[];
}
